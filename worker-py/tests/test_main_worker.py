"""Tests for top-level worker orchestration helpers."""
# pylint: disable=missing-function-docstring,missing-class-docstring,too-few-public-methods,unused-argument,unnecessary-lambda,attribute-defined-outside-init

import json

import pytest

import main


def make_job_payload(file_id="audio.wav", task_id="task-123", user_id="user-1"):
    return json.dumps({"fileId": file_id, "taskId": task_id, "userId": user_id})


def test_process_job_success(monkeypatch, tmp_path):
    download_path = tmp_path / "audio.wav"

    def fake_download(file_id, task_id):
        download_path.write_text("data")
        return str(download_path)

    saved_results = []

    def fake_save_result(file_id, result, task_id):
        saved_results.append((file_id, result, task_id))

    monkeypatch.setattr(main.storage, "download_file", fake_download)
    monkeypatch.setattr(main.storage, "save_result", fake_save_result)
    monkeypatch.setattr(main.storage, "save_error", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        main.audio_processor,
        "process",
        lambda *_: {"raw_transcript": "hi"},
    )
    monkeypatch.setattr(
        main.gemini_reviewer,
        "generate_feedback",
        lambda *_: {"summary": "Great job"},
    )

    assert main.process_job(make_job_payload(), None)

    assert saved_results, "Result should be saved"
    _, result, _ = saved_results[0]
    assert "ai_feedback" in result
    assert not download_path.exists(), "Temp file should be cleaned up"


def test_process_job_handles_failure(monkeypatch, tmp_path):
    download_path = tmp_path / "audio.wav"
    download_path.write_text("data")

    monkeypatch.setattr(
        main.storage,
        "download_file",
        lambda *_: str(download_path),
    )

    errors = []
    monkeypatch.setattr(main.storage, "save_result", lambda *_, **__: None)
    monkeypatch.setattr(
        main.storage,
        "save_error",
        lambda *args: errors.append(args),
    )

    monkeypatch.setattr(
        main.audio_processor,
        "process",
        lambda *_: (_ for _ in ()).throw(ValueError("boom")),
    )
    monkeypatch.setattr(main.gemini_reviewer, "generate_feedback", lambda *_: None)

    assert not main.process_job(make_job_payload(), None)
    assert errors and "boom" in errors[0][1]
    assert not download_path.exists()


def test_process_job_cleanup_error(monkeypatch, tmp_path):
    download_path = tmp_path / "audio.wav"

    def fake_download(file_id, task_id):
        download_path.write_text("data")
        return str(download_path)

    monkeypatch.setattr(main.storage, "download_file", fake_download)
    monkeypatch.setattr(main.storage, "save_result", lambda *args, **kwargs: None)
    monkeypatch.setattr(main.audio_processor, "process", lambda *_: {})
    monkeypatch.setattr(main.gemini_reviewer, "generate_feedback", lambda *_: None)
    monkeypatch.setattr(main.os, "remove", lambda path: (_ for _ in ()).throw(OSError("fail")))

    errors = []

    def track_error(message, *args, **kwargs):
        errors.append(message % args if args else message)

    monkeypatch.setattr(main.logger, "error", track_error)

    assert main.process_job(make_job_payload(), None)
    assert any("Failed to cleanup" in msg for msg in errors)


def test_requeue_failed_jobs_pushes(monkeypatch):
    queued = []

    class DummyRedis:
        def lpush(self, queue, payload):
            queued.append((queue, payload))

    monkeypatch.setattr(
        main.storage,
        "reset_failed_submissions",
        lambda limit: [
            {"filename": "file1.wav", "user_id": "user-1"},
            {"filename": "file2.wav", "user_id": "user-2"},
        ],
    )

    main.requeue_failed_jobs(DummyRedis())

    assert len(queued) == 2
    for queue, payload in queued:
        assert queue == main.config.QUEUE_NAME
        data = json.loads(payload)
        assert data["fileId"].endswith(".wav")
        assert data["taskId"]
        assert data["userId"].startswith("user-")


def test_requeue_failed_jobs_noop(monkeypatch):
    class DummyRedis:
        def __init__(self):
            self.called = False

        def lpush(self, *args, **kwargs):
            self.called = True

    monkeypatch.setattr(
        main.storage,
        "reset_failed_submissions",
        lambda limit: [],
    )

    client = DummyRedis()
    main.requeue_failed_jobs(client)
    assert not client.called


def test_requeue_failed_jobs_logs_error(monkeypatch):
    class DummyRedis:
        def lpush(self, *_):
            raise main.redis.RedisError("boom")

    monkeypatch.setattr(
        main.storage,
        "reset_failed_submissions",
        lambda limit: [{"filename": "file1.wav", "user_id": "user-1"}],
    )

    errors = []

    def track_error(message, *args, **kwargs):
        errors.append(message % args if args else message)

    monkeypatch.setattr(main.logger, "error", track_error)

    main.requeue_failed_jobs(DummyRedis())
    assert any("Failed to requeue submission" in msg for msg in errors)


def test_main_handles_connection_failure(monkeypatch):
    monkeypatch.setattr(main.audio_processor, "load_models", lambda: None)

    class DummyRedis:
        def __init__(self, *args, **kwargs):
            pass

        def ping(self):
            raise main.redis.RedisError("fail")

    monkeypatch.setattr(main.redis, "Redis", DummyRedis)
    assert main.main() is None


def test_main_loop_runs_once(monkeypatch):
    monkeypatch.setattr(main.audio_processor, "load_models", lambda: None)

    class DummyRedis:
        def __init__(self, *args, **kwargs):
            self.calls = 0

        def ping(self):
            return None

        def brpop(self, queue, timeout):
            self.calls += 1
            if self.calls == 1:
                return (queue, make_job_payload())
            raise KeyboardInterrupt()

    monkeypatch.setattr(main.redis, "Redis", DummyRedis)
    processed = []
    monkeypatch.setattr(main, "process_job", lambda payload, _client: processed.append(payload))

    requeues = []
    monkeypatch.setattr(main, "requeue_failed_jobs", lambda client: requeues.append(True))
    monkeypatch.setattr(main.config, "FAILED_RETRY_INTERVAL_SECONDS", 0)

    times = iter([0, 1])
    monkeypatch.setattr(main.time, "monotonic", lambda: next(times, 1))
    monkeypatch.setattr(main.time, "sleep", lambda *_: None)

    with pytest.raises(KeyboardInterrupt):
        main.main()
    assert processed
    assert requeues


def test_main_handles_loop_errors(monkeypatch):
    monkeypatch.setattr(main.audio_processor, "load_models", lambda: None)

    class DummyRedis:
        def __init__(self, *args, **kwargs):
            self.calls = 0

        def ping(self):
            return None

        def brpop(self, queue, timeout):
            self.calls += 1
            if self.calls == 1:
                raise main.redis.ConnectionError("lost")
            raise RuntimeError("boom")

    monkeypatch.setattr(main.redis, "Redis", DummyRedis)
    monkeypatch.setattr(main.config, "FAILED_RETRY_INTERVAL_SECONDS", 999)
    monkeypatch.setattr(main, "requeue_failed_jobs", lambda *_: None)


    def sleep(_seconds):
        raise KeyboardInterrupt()

    monkeypatch.setattr(main.time, "sleep", sleep)

    with pytest.raises(KeyboardInterrupt):
        main.main()
