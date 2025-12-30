"""Tests focused on transcription/alignment utilities."""
# pylint: disable=missing-function-docstring,missing-class-docstring,too-few-public-methods,unused-argument,unnecessary-lambda

from types import SimpleNamespace

import services.scoring as scoring_module
from services.scoring import AudioProcessor


def make_segment(start, end, text):
    return SimpleNamespace(start=start, end=end, text=text, words=[])


def test_segments_overlap_detects_overlap():
    processor = AudioProcessor()
    seg1 = make_segment(0.0, 1.0, "hello")
    seg2 = make_segment(0.4, 1.4, "world")
    assert processor.segments_overlap(seg1, seg2)


def test_segments_overlap_handles_non_overlap():
    processor = AudioProcessor()
    seg1 = make_segment(0.0, 1.0, "hello")
    seg2 = make_segment(1.2, 2.0, "world")
    assert not processor.segments_overlap(seg1, seg2)


def test_merge_transcription_prefers_disfluencies():
    processor = AudioProcessor()
    conservative = [make_segment(0.0, 1.0, "hello there")]
    aggressive = [
        make_segment(0.0, 1.0, "um hello there uh"),
        make_segment(1.5, 2.0, "new chunk"),
    ]

    merged = processor.merge_transcription_passes(conservative, aggressive)

    assert merged[0].text.startswith("um hello")
    assert any(seg.text == "new chunk" for seg in merged)


def test_merge_transcription_handles_missing_pass():
    processor = AudioProcessor()
    conservative = []
    aggressive = [make_segment(0.0, 1.0, "solo")]
    merged = processor.merge_transcription_passes(conservative, aggressive)
    assert merged == aggressive


def test_merge_transcription_returns_first_when_no_second():
    processor = AudioProcessor()
    conservative = [make_segment(0.0, 1.0, "hello")]
    merged = processor.merge_transcription_passes(conservative, [])
    assert merged == conservative


def test_merge_transcription_no_overlap_keeps_first():
    processor = AudioProcessor()
    conservative = [make_segment(0.0, 1.0, "hello")]
    aggressive = [make_segment(2.0, 3.0, "world")]
    merged = processor.merge_transcription_passes(conservative, aggressive)
    assert merged[0].text == "hello"


def test_merge_transcription_prefers_conservative_when_cleaner():
    processor = AudioProcessor()
    conservative = [make_segment(0.0, 1.0, "um hello")]
    aggressive = [make_segment(0.0, 1.0, "hello")]
    merged = processor.merge_transcription_passes(conservative, aggressive)
    assert merged[0].text == "um hello"


def test_calculate_fluency_empty_transcription():
    processor = AudioProcessor()
    result = processor.calculate_fluency({"words": [], "duration": 10})
    assert result == {"wpm": 0, "pauses": 0, "fillers": 0}


def test_transcribe_merges_segments(monkeypatch, tmp_path):
    processor = AudioProcessor()

    class DummyWord:
        def __init__(self, word, start, end, prob=0.9):
            self.word = word
            self.start = start
            self.end = end
            self.probability = prob

    class DummySegment:
        def __init__(self, text, start, end):
            self.text = text
            self.start = start
            self.end = end
            self.words = [DummyWord(text, start, end)]

    class DummyWhisper:
        def __init__(self):
            self.calls = 0

        def transcribe(self, *args, **kwargs):
            self.calls += 1
            info = SimpleNamespace(language="en", duration=1.5)
            segments = [DummySegment("Hello", 0.0, 1.0)]
            return segments, info

    processor.whisper_model = DummyWhisper()
    processor.align_model = object()
    processor.align_metadata = {}
    processor.device = "cpu"

    monkeypatch.setattr(
        scoring_module.whisperx,
        "align",
        lambda *args, **kwargs: {
            "word_segments": [
                {"word": "Hello", "start": 0.0, "end": 1.0, "score": 0.9}
            ]
        },
    )

    result = processor.transcribe(str(tmp_path / "audio.wav"), "task")
    assert result["text"] == "Hello"
    assert result["words"][0]["word"] == "Hello"
