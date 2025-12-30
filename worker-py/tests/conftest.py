"""Pytest configuration for the worker service."""
# pylint: disable=missing-class-docstring,missing-function-docstring,unnecessary-lambda

import sys
import types
from pathlib import Path
from typing import Dict

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def install_stub(
    name: str,
    module: types.ModuleType | None = None,
    *,
    attrs: Dict[str, object] | None = None,
):
    """Register a lightweight stub module for missing heavy dependencies."""
    if name in sys.modules:
        return None
    module = module or types.ModuleType(name)
    if attrs:
        for key, value in attrs.items():
            setattr(module, key, value)
    sys.modules[name] = module
    return name


@pytest.fixture(scope="session", autouse=True)
def stub_external_modules():
    """
    Provide simple stand-ins for optional heavy dependencies.
    Enables running unit tests without installing GPU/ML packages.
    """

    restored: list[str] = []

    class NoGrad:
        def __enter__(self):
            return None

        def __exit__(self, exc_type, exc, tb):
            return False

    redis_error = type("RedisError", (Exception,), {})
    redis_conn_error = type("ConnectionError", (redis_error,), {})

    for maybe_name in [
            install_stub(
                "torch",
                attrs={
                    "cuda": types.SimpleNamespace(is_available=lambda: False),
                    "no_grad": lambda: NoGrad(),
                },
            ),
            install_stub(
                "librosa",
                attrs={"load": lambda *_, **__: ([0.0], 16000)},
            ),
            install_stub(
                "whisperx",
                attrs={
                    "load_align_model": lambda **_: (
                        object(),
                        {"language": "en"},
                    )
                },
            ),
            install_stub(
                "faster_whisper",
                attrs={
                    "WhisperModel": type(
                        "WhisperModel",
                        (),
                        {"transcribe": lambda *_, **__: ([], types.SimpleNamespace(language="en", duration=0))},
                    )
                },
            ),
            install_stub(
                "transformers",
                attrs={
                    "Wav2Vec2ForCTC": type(
                        "Wav2Vec2ForCTC",
                        (),
                        {
                            "from_pretrained": classmethod(
                                lambda cls, *_args, **_kwargs: cls()
                            ),
                            "to": lambda self, *_args, **_kwargs: self,
                            "eval": lambda self: self,
                        },
                    ),
                    "Wav2Vec2Processor": type(
                        "Wav2Vec2Processor",
                        (),
                        {
                            "from_pretrained": classmethod(
                                lambda cls, *_args, **_kwargs: cls()
                            ),
                            "__call__": lambda self, *args, **kwargs: types.SimpleNamespace(
                                to=lambda *_a, **_kw: types.SimpleNamespace(input_values=[[0.0]])
                            ),
                            "decode": lambda self, *_args, **_kwargs: "",
                        },
                    ),
                },
            ),
            install_stub(
                "google",
                module=types.ModuleType("google"),
            ),
            install_stub(
                "google.genai",
                module=types.ModuleType("google.genai"),
                attrs={
                    "Client": type(
                        "Client",
                        (),
                        {
                            "__init__": lambda self, **_kwargs: setattr(
                                self,
                                "models",
                                types.SimpleNamespace(
                                    generate_content=lambda **__: types.SimpleNamespace(text="")
                                ),
                            ),
                        },
                    ),
                },
            ),
            install_stub(
                "redis",
                attrs={
                    "Redis": type("Redis", (), {}),
                    "RedisError": redis_error,
                    "ConnectionError": redis_conn_error,
                },
            ),
        ]:
        if maybe_name:
            restored.append(maybe_name)

    try:
        yield
    finally:
        for name in restored:
            sys.modules.pop(name, None)
