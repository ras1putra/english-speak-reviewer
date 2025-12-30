"""Structured logging helpers for the Python worker."""

import json
import logging
import os
import sys
from logging.handlers import TimedRotatingFileHandler
from typing import Any

import psutil

COLORS = {
    "DEBUG": "\033[34m",
    "INFO": "\033[32m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[41m",
}
RESET = "\033[0m"


class CustomFormatter(logging.Formatter):
    """Formatter that colorizes levels and injects memory usage, PID, and metadata."""

    def get_memory_usage(self) -> str:
        """Return current RSS for the worker process."""
        process = psutil.Process()
        mem_info = process.memory_info()
        return f"Mem: {mem_info.rss / 1024 / 1024:.2f} MB"

    def format(self, record: logging.LogRecord) -> str:
        """Render the log message with coloring and extra metadata."""
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        pid = f"[PID:{os.getpid()}]"

        level_name = record.levelname
        colored_level = (
            f"{COLORS[level_name]}{level_name}{RESET}"
            if level_name in COLORS
            else level_name
        )
        memory = f"[{self.get_memory_usage()}]"

        meta = {}
        for key, value in record.__dict__.items():
            if key not in [
                "args",
                "asctime",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "thread",
                "threadName",
                "message",
                "taskName",
            ]:
                meta[key] = value

        meta_str = f" {json.dumps(meta)}" if meta else ""
        return f"[{timestamp}] {pid} [{colored_level}] {memory} {record.getMessage()}{meta_str}"


def setup_logger(
    name: str = "worker", log_dir: str = "logs", level: int = logging.DEBUG
) -> logging.Logger:
    """Configure a console and rotating file logger for the worker."""
    logger_instance = logging.getLogger(name)
    logger_instance.setLevel(level)
    logger_instance.propagate = False

    formatter = CustomFormatter()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger_instance.addHandler(console_handler)

    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    file_handler = TimedRotatingFileHandler(
        filename=os.path.join(log_dir, "worker.log"),
        when="W0",
        interval=1,
        backupCount=4,
    )
    file_handler.setFormatter(formatter)
    logger_instance.addHandler(file_handler)

    return logger_instance


logger = setup_logger()
