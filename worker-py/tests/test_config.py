"""Tests for configuration helpers."""
# pylint: disable=missing-function-docstring

from services.config import normalize_device


def test_normalize_device_variants():
    assert normalize_device(None) == "auto"
    assert normalize_device("   CPU ") == "cpu"
    assert normalize_device("cuda") == "gpu"
    assert normalize_device("gpu") == "gpu"


def test_normalize_device_invalid_defaults_to_auto():
    assert normalize_device("something-else") == "auto"
