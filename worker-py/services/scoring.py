"""Audio processing pipeline that transcribes and scores pronunciation/fluency."""

import re
from typing import Any

import librosa
import torch
import whisperx
from faster_whisper import WhisperModel
from services.config import config
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
from utils.logger import logger

FPS = 50
LEAD_PADDING_SECONDS = 0.04
TRAIL_PADDING_SECONDS = 0.04
SHORT_WORD_DURATION = 0.18
SHORT_LEAD_PADDING_SECONDS = 0.06
SHORT_TRAIL_PADDING_SECONDS = 0.02
ULTRA_SHORT_DURATION = 0.06
ULTRA_SHORT_TRAIL_PADDING_SECONDS = 0.01
GAP_BUFFER_SECONDS = 0.01
MIN_ASSESSMENT_DURATION = 0.15

MAX_WORD_DURATION = 0.9
MIN_SEGMENT_DURATION = 0.08
ALIGNMENT_GAP_BUFFER = 0.015


class AudioProcessor:
    """Coordinate ASR, alignment, pronunciation, and fluency scoring."""

    def __init__(self) -> None:
        """Initialize lazy-loaded model handles."""
        self.whisper_model = None
        self.processor = None
        self.acoustic_model = None
        self.align_model = None
        self.align_metadata = None
        self.device = None

    def resolve_device(self) -> str:
        """Pick CPU/GPU based on configuration and availability."""
        if config.WORKER_DEVICE_MODE == "cpu":
            return "cpu"
        if config.WORKER_DEVICE_MODE == "gpu":
            if torch.cuda.is_available():
                return "cuda"
            logger.warning("GPU requested but CUDA not available. Falling back to CPU.")
            return "cpu"
        return "cuda" if torch.cuda.is_available() else "cpu"

    def load_models(self) -> None:  # pragma: no cover - requires heavy external models
        """Load Whisper, WhisperX alignment, and Wav2Vec2 models into memory."""
        device = self.device or self.resolve_device()

        if self.whisper_model is None:
            logger.info(
                "Loading Faster-Whisper %s on %s...",
                config.WHISPER_MODEL_SIZE,
                device,
            )
            try:
                self.whisper_model = WhisperModel(
                    config.WHISPER_MODEL_SIZE,
                    device=device,
                    compute_type=config.WHISPER_COMPUTE_TYPE,
                )
                self.device = device
            except Exception as e:  # pylint: disable=broad-exception-caught
                logger.error(
                    "Whisper failed on %s: %s, fallback to CPU",
                    device,
                    e,
                )
                self.whisper_model = WhisperModel(
                    config.WHISPER_MODEL_SIZE,
                    device="cpu",
                    compute_type="int8",
                )
                self.device = "cpu"

        if self.align_model is None:
            logger.info("Loading WhisperX alignment model for English...")
            try:
                self.align_model, self.align_metadata = whisperx.load_align_model(
                    language_code="en", device=device
                )
            except Exception as e:  # pylint: disable=broad-exception-caught
                logger.error("WhisperX alignment model load failed: %s", e)
                raise

        if self.acoustic_model is None:
            device = self.device or self.resolve_device()
            logger.info(
                "Loading Wav2Vec2 %s on %s...",
                config.WAV2VEC2_MODEL,
                device,
            )

            self.processor = Wav2Vec2Processor.from_pretrained(config.WAV2VEC2_MODEL)
            self.acoustic_model = Wav2Vec2ForCTC.from_pretrained(config.WAV2VEC2_MODEL)
            self.acoustic_model.to(device)
            self.acoustic_model.eval()

        logger.info("All models loaded.")

    def transcribe(
        self, audio_path: str, task_id: str
    ) -> dict[str, Any]:  # pylint: disable=too-many-locals  # pragma: no cover
        """
        RAW transcription with forced alignment for accurate word boundaries
        Uses multi-pass strategy to capture all disfluencies
        """
        if not self.whisper_model:
            self.load_models()

        logger.info("Transcribing (RAW) %s (task %s)...", audio_path, task_id)

        # ENHANCED: More aggressive prompt for disfluencies
        initial_prompt = (
            "VERBATIM TRANSCRIPTION - DO NOT CLEAN UP. "
            "Include EVERY sound exactly as spoken: "
            "uh, um, ah, eh, heh, hmm, er, like, you know, so, well, yeah, okay, "
            "incomplete words with hyphens: love-, des-, si-, ca-, "
            "repeated words, false starts, self-corrections, stutters, "
            "brief pauses, filler sounds. "
            "Keep ALL speech imperfections. Do not remove or clean anything."
        )

        # Conservative transcription (main content)
        segments_conservative, info = self.whisper_model.transcribe(
            audio_path,
            word_timestamps=True,
            beam_size=10,
            best_of=5,
            temperature=[0.0],  # Greedy only for conservative pass
            condition_on_previous_text=True,
            suppress_blank=False,
            vad_filter=False,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            no_speech_threshold=0.6,
            initial_prompt=initial_prompt,
            no_repeat_ngram_size=0,
            hallucination_silence_threshold=None,  # Disable to keep all speech
            without_timestamps=False,
            max_initial_timestamp=1.0,
        )

        # Aggressive transcription (catch disfluencies)
        logger.info("Running second pass for disfluencies (task %s)...", task_id)
        segments_aggressive, _ = self.whisper_model.transcribe(
            audio_path,
            word_timestamps=True,
            beam_size=5,
            best_of=3,
            temperature=[0.4, 0.6, 0.8],  # Higher temps for more variations
            condition_on_previous_text=False,  # Don't condition to catch more
            suppress_blank=False,
            vad_filter=False,
            compression_ratio_threshold=3.0,
            log_prob_threshold=-1.5,  # More lenient
            no_speech_threshold=0.8,
            initial_prompt=initial_prompt,
            no_repeat_ngram_size=0,
            hallucination_silence_threshold=None,
            without_timestamps=False,
            max_initial_timestamp=1.0,
        )

        # Combine both passes intelligently
        segments_merged = self.merge_transcription_passes(
            list(segments_conservative), list(segments_aggressive)
        )

        # Collect segments for alignment
        segments_for_alignment = []
        words = []
        full_text = []

        for segment in segments_merged:
            text = segment.text
            text = self.filter_extreme_hallucinations(text)
            full_text.append(text)

            segments_for_alignment.append(
                {"text": text, "start": segment.start, "end": segment.end}
            )

            if hasattr(segment, "words") and segment.words:
                for w in segment.words:
                    if w.probability >= 0.01:
                        words.append(
                            {
                                "word": w.word.strip(),
                                "start": float(w.start),
                                "end": float(w.end),
                                "confidence": float(w.probability),
                            }
                        )

        # Apply forced alignment
        logger.info(
            "Applying forced alignment for accurate word boundaries (task %s)...",
            task_id,
        )
        try:
            aligned_result = whisperx.align(
                segments_for_alignment,
                self.align_model,
                self.align_metadata,
                audio_path,
                device=self.device or "cpu",
                return_char_alignments=False,
            )

            if "word_segments" in aligned_result:
                aligned_words = []
                for w in aligned_result["word_segments"]:
                    aligned_words.append(
                        {
                            "word": w["word"],
                            "start": float(w["start"]),
                            "end": float(w["end"]),
                            "confidence": w.get("score", 1.0),
                        }
                    )

                words = self.sanitize_aligned_words(
                    aligned_words, segments_for_alignment
                )
                logger.info(
                    "Alignment successful: %s words with sanitized boundaries (task %s)",
                    len(words),
                    task_id,
                )
            else:
                logger.warning(
                    "Alignment returned no word segments, using Whisper timestamps (task %s)",
                    task_id,
                )

        except Exception as e:  # pylint: disable=broad-exception-caught
            logger.error(
                "Forced alignment failed: %s, using Whisper timestamps as fallback (task %s)",
                e,
                task_id,
            )

        final_text = " ".join(full_text).strip()
        final_text = self.post_process_transcript(final_text)

        return {
            "text": final_text,
            "words": words,
            "language": info.language,
            "duration": info.duration,
        }

    def merge_transcription_passes(self, segments1: list[Any], segments2: list[Any]) -> list[Any]:
        """
        Intelligently merge two transcription passes
        Prefer aggressive pass for capturing disfluencies
        """
        if not segments2 or len(segments2) == 0:
            return segments1

        if not segments1 or len(segments1) == 0:
            return segments2

        merged = []
        seen_ids = set()

        # Create time-based mapping
        for seg1 in segments1:
            # Find overlapping segment in aggressive pass
            overlapping = [
                seg2 for seg2 in segments2 if self.segments_overlap(seg1, seg2)
            ]

            if overlapping:
                # Choose the one with more words (likely has more disfluencies)
                seg2 = max(overlapping, key=lambda s: len(s.text.split()))

                # Prefer seg2 if it has more filler words
                text1_fillers = self.count_fillers(seg1.text)
                text2_fillers = self.count_fillers(seg2.text)

                winner = seg2 if text2_fillers >= text1_fillers else seg1
            else:
                winner = seg1

            if id(winner) not in seen_ids:
                merged.append(winner)
                seen_ids.add(id(winner))

        # Add any segments from pass 2 that weren't matched
        for seg2 in segments2:
            if id(seg2) in seen_ids:
                continue

            if not any(self.segments_overlap(seg2, m) for m in merged):
                # Safety check: Content duplication
                # If timestamps messed up, we might get duplicate text. Check for that.
                if not self.is_content_duplicate(seg2.text, merged):
                    merged.append(seg2)
                    seen_ids.add(id(seg2))

        # Sort by start time
        merged.sort(key=lambda s: s.start)

        return merged

    def is_content_duplicate(self, text: str, existing_segments: list[Any]) -> bool:
        """Check if text is substantially similar to any existing segment (to prevent dups)."""
        clean_new = re.sub(r"[^a-z]", "", text.lower())
        if len(clean_new) < 10:  # Don't dedup very short utterances based on text alone
            return False

        for seg in existing_segments:
            clean_existing = re.sub(r"[^a-z]", "", seg.text.lower())
            
            # Simple containment or high overlap
            if clean_new in clean_existing or clean_existing in clean_new:
                return True
                
            # If lengths are somewhat similar, check Levenshtein or loose match
            if abs(len(clean_new) - len(clean_existing)) < len(clean_new) * 0.5:
                # Quick approx overlap using sets for speed (not perfect but robust for exact dups)
                set_new = set(clean_new)
                set_existing = set(clean_existing)
                overlap = len(set_new.intersection(set_existing))
                if overlap / len(set_new) > 0.8:
                     # Fallback to slower but accurate levenshtein if sets match high
                     dist = self.levenshtein_distance(clean_new, clean_existing)
                     similarity = 1.0 - (dist / max(len(clean_new), len(clean_existing)))
                     if similarity > 0.7:
                         return True
        return False

    def segments_overlap(self, seg1: Any, seg2: Any, threshold: float = 0.5) -> bool:
        """Check if two segments overlap significantly"""
        start = max(seg1.start, seg2.start)
        end = min(seg1.end, seg2.end)
        overlap = max(0, end - start)

        duration1 = seg1.end - seg1.start
        duration2 = seg2.end - seg2.start
        min_duration = min(duration1, duration2)

        return overlap / min_duration > threshold if min_duration > 0 else False

    def count_fillers(self, text: str) -> int:
        """Count filler words in text"""
        fillers = {
            "uh",
            "um",
            "ah",
            "eh",
            "hmm",
            "heh",
            "er",
            "like",
            "you know",
            "so",
            "well",
            "yeah",
            "okay",
        }
        words = text.lower().split()
        return sum(1 for w in words if w.strip(",.!?;:-") in fillers)

    def filter_extreme_hallucinations(self, text: str) -> str:
        """Remove extreme repetition patterns"""
        words_list = text.split()

        if len(words_list) < 12:
            return text

        for phrase_len in range(3, 5):
            i = 0
            while i <= len(words_list) - (phrase_len * 4):
                phrases = [
                    " ".join(words_list[i + j * phrase_len : i + (j + 1) * phrase_len])
                    for j in range(4)
                ]

                if len(set(phrases)) == 1:
                    words_list = (
                        words_list[: i + phrase_len] + words_list[i + phrase_len * 4 :]
                    )
                    continue

                i += 1

        return " ".join(words_list)

    def post_process_transcript(self, text: str) -> str:
        """Minimal cleanup - preserve disfluencies"""
        # Only fix obvious errors
        replacements = {
            " coffee ": " cafe ",
            " Coffee ": " Cafe ",
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        # Normalize whitespace
        text = re.sub(r"  +", " ", text)

        return text.strip()

    def assess_pronunciation(
        self, audio_path: str, transcription: dict[str, Any], task_id: str
    ) -> dict[str, Any]:
        """
        Clean pronunciation assessment using forced-aligned word boundaries
        """
        logger.info("Assessing pronunciation (task %s)...", task_id)

        audio, _ = librosa.load(audio_path, sr=16000)
        device = self.device or self.resolve_device()

        inputs = self.processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        ).to(device)

        with torch.no_grad():
            logits = self.acoustic_model(inputs.input_values).logits

        scored_words = []
        total = 0
        count = 0

        words = transcription["words"]
        for idx, w in enumerate(words):
            raw_word = w["word"].strip()
            word_text = raw_word.lower().rstrip(",.!?;:-")

            # Skip fillers and partial words
            if self.is_filler_or_partial(raw_word, word_text):
                scored_words.append(
                    {
                        **w,
                        "pronunciation_score": None,
                        "acoustic_confidence": None,
                        "text_match": None,
                        "predicted": None,
                        "is_mispronounced": None,
                        "note": "Filler/partial word - not assessed",
                    }
                )
                continue

            duration = w["end"] - w["start"]
            if duration < MIN_ASSESSMENT_DURATION:
                scored_words.append(
                    {
                        **w,
                        "pronunciation_score": None,
                        "acoustic_confidence": None,
                        "text_match": None,
                        "predicted": None,
                        "is_mispronounced": None,
                        "note": "Too short for reliable assessment",
                    }
                )
                continue

            next_start = words[idx + 1]["start"] if idx + 1 < len(words) else None

            lead_padding = LEAD_PADDING_SECONDS
            trail_padding = TRAIL_PADDING_SECONDS

            if duration < SHORT_WORD_DURATION:
                lead_padding = max(lead_padding, SHORT_LEAD_PADDING_SECONDS)
                trail_padding = min(TRAIL_PADDING_SECONDS, SHORT_TRAIL_PADDING_SECONDS)

            if duration < ULTRA_SHORT_DURATION:
                trail_padding = min(trail_padding, ULTRA_SHORT_TRAIL_PADDING_SECONDS)

            start_time = w["start"] - lead_padding
            end_time = w["end"] + trail_padding

            start_time = min(start_time, w["start"])
            start_time = max(0.0, start_time)

            if next_start is not None:
                max_trail = max(0.0, (next_start - w["end"]) - GAP_BUFFER_SECONDS)
                end_time = min(end_time, w["end"] + max_trail)
            end_time = max(end_time, w["end"])

            if end_time <= start_time:
                end_time = min(w["end"], next_start) if next_start else w["end"]
                start_time = max(0.0, start_time - 0.01)

            start = int(start_time * FPS)
            end = int(end_time * FPS)

            if start >= logits.shape[1]:
                continue
            start = max(0, start)
            end = max(start + 1, min(end, logits.shape[1]))

            word_logits = logits[0, start:end]
            probs = torch.softmax(word_logits, dim=-1)

            acoustic_confidence = torch.mean(torch.max(probs, dim=-1).values).item()

            segment_ids = torch.argmax(word_logits, dim=-1)
            predicted_segment = self.processor.decode(segment_ids).lower().strip()
            raw_tokens = [
                token.strip(",.?!;:-")
                for token in predicted_segment.split()
                if token.strip(",.?!;:-")
            ]
            if not raw_tokens:
                raw_tokens = [predicted_segment.strip(",.?!;:-")]

            expected_clean = re.sub(r"[^a-z]", "", word_text)

            match_score, _matching_token = (
                self.best_token_match(  # pylint: disable=arguments-out-of-order
                    raw_tokens, expected_clean
                )
            )

            if (
                match_score == 0
                and acoustic_confidence > 0.85
                and len(expected_clean) <= 2
            ):
                match_score = 0.8

            score = (acoustic_confidence * 0.5 + match_score * 0.5) * 100

            is_mispronounced = (
                acoustic_confidence < 0.75 or match_score < 0.6 or score < 70
            )

            scored_words.append(
                {
                    **w,
                    "pronunciation_score": round(score, 2),
                    "acoustic_confidence": round(acoustic_confidence * 100, 2),
                    "text_match": round(match_score * 100, 2),
                    "predicted": predicted_segment,
                    "is_mispronounced": is_mispronounced,
                }
            )

            total += score
            count += 1

        return {
            "overall_score": round(total / count, 2) if count else 0,
            "details": scored_words,
        }

    def is_filler_or_partial(self, raw_word: str, normalized_word: str) -> bool:
        """Check if word is a filler or partial word"""
        fillers = {
            "uh",
            "um",
            "ah",
            "eh",
            "hmm",
            "heh",
            "er",
            "erm",
            "yeah",
            "yes",
            "okay",
            "ok",
            "alright",
            "so",
        }
        skip_words = {"and", "i"}
        word = normalized_word.lower()

        if word in fillers or word in skip_words:
            return True

        letters_only = re.sub(r"[^a-z]", "", word)
        if len(letters_only) <= 2:
            return True

        stripped = raw_word.strip()
        terminal_trimmed = stripped.rstrip(",.!?;:")
        if terminal_trimmed.endswith("-") or terminal_trimmed.startswith("-"):
            return True

        return False

    def levenshtein_distance(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein distance"""
        if len(s1) < len(s2):
            return self.levenshtein_distance(s1=s2, s2=s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def best_token_match(self, tokens: list[str], expected_clean: str) -> tuple[float, str]:
        """Return similarity score and token best matching expected spelling."""
        if not expected_clean:
            return 0.0, ""
        best_score = 0.0
        best_token = ""

        for token in tokens:
            token_clean = re.sub(r"[^a-z]", "", token)
            if not token_clean:
                continue

            if token_clean == expected_clean:
                return 1.0, token

            if expected_clean in token_clean or token_clean in expected_clean:
                return 1.0, token

            score = self.phonetic_similarity(token_clean, expected_clean)
            if score > best_score:
                best_score = score
                best_token = token

        return best_score, best_token

    def phonetic_similarity(self, token: str, expected: str) -> float:
        """Return normalized edit similarity between phonetic variants."""
        if not token or not expected:
            return 0.0

        token_variants = self.phonetic_variants(token)
        expected_variants = self.phonetic_variants(expected)

        best = 0.0
        for t in token_variants:
            for e in expected_variants:
                if not t or not e:  # pragma: no cover - safety guard
                    continue
                distance = self.levenshtein_distance(t, e)
                score = 1.0 - (distance / max(len(t), len(e)))
                best = max(best, score)
        return best

    def phonetic_variants(self, word: str) -> set[str]:
        """Expand a word into common phonetic replacements."""
        variants = {word}
        replacements = [
            ("th", "d"),
            ("th", "t"),
            ("ph", "f"),
            ("c", "k"),
            ("c", "s"),
            ("ck", "k"),
            ("z", "s"),
            ("v", "b"),
            ("qu", "k"),
        ]
        for src, dst in replacements:
            if src in word:
                variants.add(word.replace(src, dst))
        return variants

    def calculate_fluency(self, transcription: dict[str, Any]) -> dict[str, int | float]:
        """Compute fluency measurements from the aligned transcript."""
        words = transcription["words"]
        if not words:
            return {"wpm": 0, "pauses": 0, "fillers": 0}

        duration_min = transcription["duration"] / 60
        wpm = len(words) / duration_min if duration_min > 0 else 0

        fillers = {
            "uh",
            "um",
            "ah",
            "eh",
            "hmm",
            "heh",
            "like",
            "you know",
            "so",
            "well",
            "okay",
        }

        filler_count = sum(
            1 for w in words if w["word"].lower().rstrip(",.:;!?") in fillers
        )

        pauses = 0
        for i in range(len(words) - 1):
            if words[i + 1]["start"] - words[i]["end"] > 1.0:
                pauses += 1

        return {
            "wpm": round(wpm, 1),
            "pauses": pauses,
            "fillers": filler_count,
        }

    def sanitize_aligned_words(
        self, aligned_words: list[dict[str, Any]], segments: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Ensure aligned word boundaries don't balloon and swallow neighboring words."""
        if not aligned_words:
            return aligned_words

        sanitized = []
        for idx, word in enumerate(aligned_words):
            start = float(word["start"])
            end = float(word["end"])

            if sanitized:
                prev_end = sanitized[-1]["end"]
                start = max(start, prev_end + ALIGNMENT_GAP_BUFFER)

            if idx + 1 < len(aligned_words):
                next_start = float(aligned_words[idx + 1]["start"])
                end = min(end, next_start - ALIGNMENT_GAP_BUFFER)

            if end - start > MAX_WORD_DURATION:
                end = start + MAX_WORD_DURATION

            if end <= start:
                end = start + MIN_SEGMENT_DURATION

            sanitized.append(
                {
                    **word,
                    "start": start,
                    "end": end,
                }
            )

        if segments:
            total_duration = segments[-1]["end"]
            for entry in sanitized:
                entry["start"] = max(
                    0.0,
                    min(entry["start"], total_duration - MIN_SEGMENT_DURATION),
                )
                entry["end"] = max(
                    entry["start"] + MIN_SEGMENT_DURATION,
                    min(entry["end"], total_duration),
                )

            for i in range(1, len(sanitized)):
                prev = sanitized[i - 1]
                curr = sanitized[i]
                if curr["start"] < prev["end"] + ALIGNMENT_GAP_BUFFER:
                    curr["start"] = prev["end"] + ALIGNMENT_GAP_BUFFER
                    curr["end"] = max(
                        curr["start"] + MIN_SEGMENT_DURATION,
                        curr["end"],
                    )

            for i in range(len(sanitized) - 2, -1, -1):
                curr = sanitized[i]
                nxt = sanitized[i + 1]
                if curr["end"] > nxt["start"] - ALIGNMENT_GAP_BUFFER:
                    curr["end"] = max(
                        curr["start"] + MIN_SEGMENT_DURATION,
                        nxt["start"] - ALIGNMENT_GAP_BUFFER,
                    )

        return sanitized

    def process(self, audio_path: str, task_id: str) -> dict[str, Any]:  # pragma: no cover
        """Run the full pipeline for a single audio file."""
        logger.info("Starting processing for %s (task %s)", audio_path, task_id)
        transcription = self.transcribe(audio_path, task_id)
        logger.info("Transcription completed (task %s)", task_id)
        pronunciation = self.assess_pronunciation(audio_path, transcription, task_id)
        logger.info("Pronunciation assessment completed (task %s)", task_id)
        fluency = self.calculate_fluency(transcription)
        logger.info("Fluency metrics calculated (task %s)", task_id)

        return {
            "raw_transcript": transcription["text"],
            "pronunciation": pronunciation,
            "fluency": fluency,
        }


# Singleton
audio_processor = AudioProcessor()
