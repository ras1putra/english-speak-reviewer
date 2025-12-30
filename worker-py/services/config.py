"""Configuration helpers for the Python worker."""

import os
from enum import Enum

from dotenv import load_dotenv

load_dotenv()


class WhisperModelSize(Enum):
    """Whisper checkpoints exposed through environment configuration."""

    TINY_EN = "tiny.en"
    BASE_EN = "base.en"
    SMALL_EN = "small.en"
    MEDIUM_EN = "medium.en"
    LARGE_V1 = "large-v1"
    LARGE_V2 = "large-v2"
    LARGE_V3 = "large-v3"
    DISTIL_LARGE_V2 = "distil-large-v2"
    DISTIL_MEDIUM_EN = "distil-medium.en"


def normalize_device(value: str | None) -> str:
    """Normalize GPU/CPU selection values from the environment."""
    if not value:
        return "auto"
    normalized = value.strip().lower()
    if normalized in {"cpu", "gpu"}:
        return normalized
    if normalized in {"cuda"}:
        return "gpu"
    return "auto"


class Config:  # pylint: disable=too-few-public-methods
    """Static configuration surface for the worker process."""

    # Whisper Settings
    WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", WhisperModelSize.TINY_EN.value)
    WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
    WHISPER_COMPUTE_TYPE = os.getenv(
        "WHISPER_COMPUTE_TYPE", "int8"
    )  # 'float16', 'int8_float16', 'int8'
    WORKER_DEVICE_MODE = normalize_device(
        os.getenv("WORKER_DEVICE_MODE", WHISPER_DEVICE)
    )

    # Redis Settings
    REDIS_HOST = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
    QUEUE_NAME = "audio_queue"

    # MinIO Settings
    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET = os.getenv("MINIO_BUCKET", "audio")
    MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() == "true"

    # Database Settings
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgres://audio:audio123@db:5432/audio_db"
    )

    # Pronunciation Model
    WAV2VEC2_MODEL = "facebook/wav2vec2-base-960h"

    # Gemini Settings
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Retry Settings
    FAILED_RETRY_INTERVAL_SECONDS = int(
        os.getenv("FAILED_RETRY_INTERVAL_SECONDS", "900")
    )
    FAILED_RETRY_BATCH_SIZE = int(os.getenv("FAILED_RETRY_BATCH_SIZE", "10"))

    # Realtime status channel
    JOB_STATUS_CHANNEL = os.getenv("JOB_STATUS_CHANNEL", "job_status")


config = Config()
