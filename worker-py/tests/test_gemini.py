"""Tests for the Gemini reviewer helper."""
# pylint: disable=missing-function-docstring,missing-class-docstring,too-few-public-methods,unused-argument,unnecessary-lambda,attribute-defined-outside-init

from types import SimpleNamespace

import pytest

import services.gemini as gemini_module
from services.gemini import GeminiReviewer


def test_build_prompt_includes_scores():
    reviewer = GeminiReviewer()
    scoring = {
        "raw_transcript": "Hello there",
        "pronunciation": {
            "overall_score": 82.5,
            "details": [
                {"word": "hello", "is_mispronounced": False},
                {"word": "coffee", "is_mispronounced": True},
            ],
        },
        "fluency": {"wpm": 120, "pauses": 1, "fillers": 0},
    }

    prompt = reviewer.build_prompt(scoring)

    assert "82.5" in prompt
    assert "coffee" in prompt
    assert "Words per minute" in prompt


def test_parse_feedback_handles_json_response():
    reviewer = GeminiReviewer()
    response = """{"summary": "Great", "strengths": ["clear"], "improvements": []}"""

    parsed = reviewer.parse_feedback(response)

    assert parsed["summary"] == "Great"
    assert parsed["strengths"] == ["clear"]
    assert parsed["improvements"] == []


def test_parse_feedback_fallback_for_text():
    reviewer = GeminiReviewer()

    parsed = reviewer.parse_feedback("Just keep practicing!")

    assert parsed["summary"] == "Just keep practicing!"
    assert parsed["strengths"] == []
    assert parsed["improvements"] == []


def test_parse_feedback_handles_code_fence():
    reviewer = GeminiReviewer()
    response = """```json
{"summary": "Great", "strengths": [], "improvements": []}
```"""

    parsed = reviewer.parse_feedback(response)

    assert parsed["summary"] == "Great"


def test_is_enabled_flag(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", None)
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", None)
    assert not reviewer.is_enabled()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", "key")
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", "model")
    assert reviewer.is_enabled()


def test_generate_feedback_disabled(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", None)
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", None)
    assert reviewer.generate_feedback({"raw_transcript": ""}, "task") is None
    with pytest.raises(RuntimeError):
        reviewer.ensure_client()


def test_generate_feedback_success(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", "key")
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", "model")

    class DummyClient:
        def __init__(self):
            self.models = SimpleNamespace(generate_content=self.generate_content)

        def generate_content(self, *, model, contents):
            self.model = model
            self.prompt = contents
            return SimpleNamespace(text='{"summary": "Nice"}')

    monkeypatch.setattr(reviewer, "ensure_client", lambda: DummyClient())
    feedback = reviewer.generate_feedback({"raw_transcript": ""}, "task")
    assert feedback["summary"] == "Nice"


def test_ensure_client_initializes(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", "key")
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", "model")
    dummy_client = SimpleNamespace()

    class Client:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    dummy_client.Client = Client
    monkeypatch.setattr(gemini_module, "genai", dummy_client)
    client = reviewer.ensure_client()
    assert isinstance(client, Client)
    assert reviewer.client is client


def test_generate_feedback_empty(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", "key")
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", "model")

    class DummyClient:
        def __init__(self):
            self.models = SimpleNamespace(generate_content=lambda **_: SimpleNamespace(text=""))

    monkeypatch.setattr(reviewer, "ensure_client", lambda: DummyClient())
    assert reviewer.generate_feedback({"raw_transcript": ""}, "task") is None


def test_generate_feedback_exception(monkeypatch):
    reviewer = GeminiReviewer()
    monkeypatch.setattr(gemini_module.config, "GEMINI_API_KEY", "key")
    monkeypatch.setattr(gemini_module.config, "GEMINI_MODEL", "model")

    class DummyClient:
        def __init__(self):
            def raise_error(**_kwargs):
                raise RuntimeError("boom")
            self.models = SimpleNamespace(generate_content=raise_error)

    monkeypatch.setattr(reviewer, "ensure_client", lambda: DummyClient())
    assert reviewer.generate_feedback({"raw_transcript": ""}, "task") is None
