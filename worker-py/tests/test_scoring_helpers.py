"""Tests for lightweight helper methods inside AudioProcessor."""
# pylint: disable=missing-function-docstring,missing-class-docstring,too-few-public-methods,unused-argument,unnecessary-lambda,attribute-defined-outside-init

import pytest

import services.scoring as scoring_module
from services.scoring import AudioProcessor


@pytest.fixture(name="processor")
def fixture_processor():
    return AudioProcessor()


def test_count_fillers(processor):
    text = "Um I think so well yeah maybe"
    assert processor.count_fillers(text) == 4


def test_filter_extreme_hallucinations_removes_repetition(processor):
    repeated = "hello hi there " * 4 + "all good"
    cleaned = processor.filter_extreme_hallucinations(repeated.strip())
    assert cleaned.startswith("hello hi there")
    assert cleaned.endswith("all good")
    assert cleaned.count("hello hi there") == 1


def test_filter_extreme_hallucinations_no_match(processor):
    text = " ".join(f"word{i}" for i in range(20))
    cleaned = processor.filter_extreme_hallucinations(text)
    assert cleaned == text


def test_post_process_transcript_normalizes_spacing(processor):
    text = "I like Coffee  a lot "
    cleaned = processor.post_process_transcript(text)
    assert cleaned == "I like Cafe a lot"


@pytest.mark.parametrize(
    ("raw_word", "normalized", "should_skip"),
    [
        ("um", "um", True),
        ("I-", "i", True),
        ("so-", "so", True),
        ("Car", "car", False),
    ],
)
def test_is_filler_or_partial(processor, raw_word, normalized, should_skip):
    assert processor.is_filler_or_partial(raw_word, normalized) is should_skip


def test_is_filler_or_partial_short_word(processor):
    assert processor.is_filler_or_partial("ok", "ok")


def test_is_filler_or_partial_partial_word(processor):
    assert processor.is_filler_or_partial("word-", "word")


def test_is_filler_or_partial_short_non_filler(processor):
    assert processor.is_filler_or_partial("At", "at")


def test_levenshtein_distance(processor):
    assert processor.levenshtein_distance("kitten", "sitting") == 3
    assert processor.levenshtein_distance("same", "same") == 0
    assert processor.levenshtein_distance("abc", "") == 3


def test_phonetic_variants_expand(processor):
    variants = processor.phonetic_variants("phone")
    assert "fone" in variants
    assert "phone" in variants


def test_phonetic_similarity_handles_empty(processor):
    assert processor.phonetic_similarity("", "expected") == 0.0
    assert processor.phonetic_similarity("token", "") == 0.0


def test_phonetic_similarity_scores(processor):
    score = processor.phonetic_similarity("phone", "fone")
    assert score > 0.0


def test_best_token_match_prefers_similar_token(processor):
    score, token = processor.best_token_match(["kafe", "coffee"], "cafe")
    assert token in {"kafe", "coffee"}
    assert score > 0.5


def test_best_token_match_handles_empty(processor):
    score, token = processor.best_token_match(["!!!"], "")
    assert score == 0.0 and token == ""
    score, token = processor.best_token_match([""], "hi")
    assert token == ""


def test_best_token_match_exact_match(processor):
    score, token = processor.best_token_match(["cafe"], "cafe")
    assert score == 1.0 and token == "cafe"


def test_best_token_match_contains(processor):
    score, token = processor.best_token_match(["cafeteria"], "cafe")
    assert score == 1.0 and token == "cafeteria"


def test_calculate_fluency_metrics(processor):
    transcription = {
        "words": [
            {"word": "Hello", "start": 0.0, "end": 0.5},
            {"word": "there", "start": 0.7, "end": 1.0},
            {"word": "um", "start": 2.5, "end": 2.7},
            {"word": "friend", "start": 4.0, "end": 4.3},
        ],
        "duration": 30.0,
    }
    fluency = processor.calculate_fluency(transcription)
    assert pytest.approx(fluency["wpm"], rel=0.1) == 8.0
    assert fluency["pauses"] == 2
    assert fluency["fillers"] == 1


def test_sanitize_aligned_words_enforces_minimum_gaps(processor):
    aligned_words = [
        {"word": "one", "start": 0.0, "end": 1.0},
        {"word": "two", "start": 0.5, "end": 1.5},
    ]
    segments = [{"start": 0.0, "end": 3.0}]

    sanitized = processor.sanitize_aligned_words(aligned_words, segments)

    assert sanitized[0]["end"] <= sanitized[1]["start"]
    assert sanitized[0]["start"] >= 0.0
    assert sanitized[1]["end"] <= segments[-1]["end"]


def test_sanitize_aligned_words_handles_empty(processor):
    assert processor.sanitize_aligned_words([], []) == []


def test_sanitize_aligned_words_adjusts_reverse(processor):
    aligned_words = [
        {"word": "one", "start": 1.0, "end": 0.5},
        {"word": "two", "start": 0.4, "end": 0.6},
    ]
    sanitized = processor.sanitize_aligned_words(aligned_words, [])
    assert sanitized[0]["end"] > sanitized[0]["start"]


def test_sanitize_aligned_words_adjusts_neighbors(processor):
    aligned_words = [
        {"word": "one", "start": 0.0, "end": 0.5},
        {"word": "two", "start": 0.2, "end": 0.7},
        {"word": "three", "start": 0.6, "end": 1.0},
    ]
    segments = [{"start": 0.0, "end": 2.0}]
    sanitized = processor.sanitize_aligned_words(aligned_words, segments)
    assert sanitized[1]["start"] > sanitized[0]["end"]
    assert sanitized[1]["end"] <= sanitized[2]["start"]


def test_sanitize_aligned_words_back_and_forth_adjustments(processor):
    aligned_words = [
        {"word": "one", "start": 0.0, "end": 1.2},
        {"word": "two", "start": 0.5, "end": 0.6},
        {"word": "three", "start": 0.55, "end": 0.7},
    ]
    segments = [{"start": 0.0, "end": 1.5}]
    sanitized = processor.sanitize_aligned_words(aligned_words, segments)
    assert sanitized[1]["start"] > sanitized[0]["end"]
    assert sanitized[1]["end"] < sanitized[2]["start"]


def test_sanitize_aligned_words_backward_trim(processor):
    aligned_words = [
        {"word": "one", "start": 0.0, "end": 0.2},
        {"word": "two", "start": 0.5, "end": 1.15},
        {"word": "three", "start": 1.2, "end": 1.4},
    ]
    segments = [{"start": 0.0, "end": 1.0}]
    sanitized = processor.sanitize_aligned_words(aligned_words, segments)
    gap = scoring_module.ALIGNMENT_GAP_BUFFER
    assert sanitized[1]["end"] <= sanitized[2]["start"] - gap


def test_resolve_device_respects_cpu(monkeypatch, processor):
    monkeypatch.setattr(scoring_module.config, "WORKER_DEVICE_MODE", "cpu")
    assert processor.resolve_device() == "cpu"


def test_resolve_device_auto_prefers_cuda(monkeypatch, processor):
    monkeypatch.setattr(scoring_module.config, "WORKER_DEVICE_MODE", "auto")
    monkeypatch.setattr(scoring_module.torch.cuda, "is_available", lambda: True)
    assert processor.resolve_device() == "cuda"


def test_resolve_device_gpu_fallback(monkeypatch, processor):
    monkeypatch.setattr(scoring_module.config, "WORKER_DEVICE_MODE", "gpu")
    monkeypatch.setattr(scoring_module.torch.cuda, "is_available", lambda: False)
    assert processor.resolve_device() == "cpu"


def test_resolve_device_gpu_warning(monkeypatch, processor):
    monkeypatch.setattr(scoring_module.config, "WORKER_DEVICE_MODE", "gpu")
    monkeypatch.setattr(scoring_module.torch.cuda, "is_available", lambda: False)
    messages = []
    monkeypatch.setattr(scoring_module.logger, "warning", lambda msg: messages.append(msg))
    processor.resolve_device()
    assert messages


def test_resolve_device_gpu_success(monkeypatch, processor):
    monkeypatch.setattr(scoring_module.config, "WORKER_DEVICE_MODE", "gpu")
    monkeypatch.setattr(scoring_module.torch.cuda, "is_available", lambda: True)
    assert processor.resolve_device() == "cuda"


def test_process_pipeline(monkeypatch):
    processor = AudioProcessor()
    def fake_transcribe(*_):
        return {
            "text": "hi",
            "words": [],
            "duration": 1,
            "language": "en",
        }

    def fake_assess(*_, **__):
        return {"overall_score": 90, "details": []}

    def fake_fluency(*_):
        return {"wpm": 60}

    monkeypatch.setattr(processor, "transcribe", fake_transcribe)
    monkeypatch.setattr(processor, "assess_pronunciation", fake_assess)
    monkeypatch.setattr(processor, "calculate_fluency", fake_fluency)

    result = processor.process("audio.wav", "task")
    assert result["pronunciation"]["overall_score"] == 90
    assert result["fluency"]["wpm"] == 60


def test_load_models_initializes(monkeypatch):
    processor = AudioProcessor()

    class DummyWhisperModel:
        def __init__(self, size, device, compute_type):
            self.created = (size, device, compute_type)

    class DummyProcessor:
        @classmethod
        def from_pretrained(cls, *_):
            return cls()

    class DummyAcoustic:
        @classmethod
        def from_pretrained(cls, *_):
            return cls()

        def to(self, device):
            self.device = device
            return self

        def eval(self):
            self.evaluated = True
            return self

    monkeypatch.setattr(processor, "resolve_device", lambda: "cpu")
    monkeypatch.setattr(scoring_module, "WhisperModel", DummyWhisperModel)
    monkeypatch.setattr(
        scoring_module.whisperx,
        "load_align_model",
        lambda **_: ("align", {"lang": "en"}),
    )
    monkeypatch.setattr(
        scoring_module.Wav2Vec2Processor,
        "from_pretrained",
        classmethod(lambda cls, *_: DummyProcessor()),
    )
    monkeypatch.setattr(
        scoring_module.Wav2Vec2ForCTC,
        "from_pretrained",
        classmethod(lambda cls, *_: DummyAcoustic()),
    )

    processor.load_models()
    assert processor.whisper_model is not None
    assert processor.align_model == "align"
    assert processor.acoustic_model.evaluated
