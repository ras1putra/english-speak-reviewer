"""Tests for MinIO/Postgres storage plumbing."""
# pylint: disable=missing-function-docstring,missing-class-docstring,too-few-public-methods,unused-argument,import-outside-toplevel,unspecified-encoding

from pathlib import Path

import pytest

import services.storage as storage_module
from services.storage import Storage


class DummyCursor:
    def __init__(self, stub):
        self.stub = stub
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params):
        self.executed.append((query.strip(), params))
        self.stub.queries.append((query.strip(), params))

    def fetchall(self):
        return self.stub.rows


class DummyConnection:
    def __init__(self, stub):
        self.stub = stub
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return DummyCursor(self.stub)

    def commit(self):
        self.committed = True
        self.stub.commits += 1


@pytest.fixture(name="psycopg_stub")
def fixture_psycopg_stub(monkeypatch):
    class Stub:
        def __init__(self):
            self.rows = []
            self.queries = []
            self.commits = 0

        def connect(self, *args, **kwargs):
            return DummyConnection(self)

    stub = Stub()

    monkeypatch.setattr(storage_module.psycopg, "connect", stub.connect)
    return stub


@pytest.fixture(name="storage_instance")
def fixture_storage_instance(monkeypatch):
    class DummyMinio:
        def __init__(self, *args, **kwargs):
            self.downloads = []

        def fget_object(self, bucket, filename, local_path):
            self.downloads.append((bucket, filename, local_path))
            Path(local_path).write_text("audio", encoding="utf-8")

    monkeypatch.setattr(storage_module, "Minio", DummyMinio)
    return Storage()


def test_download_file(storage_instance, tmp_path):
    local = storage_instance.download_file("clip.wav", "task")
    assert Path(local).exists()


def test_download_file_error(storage_instance, monkeypatch):
    def raise_error(*args, **kwargs):
        raise RuntimeError("fail")

    storage_instance.minio.fget_object = raise_error
    with pytest.raises(RuntimeError):
        storage_instance.download_file("clip.wav", "task")


def test_save_result_updates_db(storage_instance, psycopg_stub):
    storage_instance.save_result("clip.wav", {"score": 90}, "task")
    assert psycopg_stub.commits == 1
    query, params = psycopg_stub.queries[-1]
    assert "UPDATE submissions" in query
    assert params[1] == "clip.wav"


def test_save_error_sets_failed(storage_instance, psycopg_stub):
    storage_instance.save_error("clip.wav", "boom", "task")
    query, params = psycopg_stub.queries[-1]
    assert "SET error_message" in query
    assert params[0] == "boom"


def test_reset_failed_submissions_returns_filenames(storage_instance, psycopg_stub):
    psycopg_stub.rows = [("a.wav", "user-a"), ("b.wav", "user-b")]
    entries = storage_instance.reset_failed_submissions(limit=2)
    assert entries == [
        {"filename": "a.wav", "user_id": "user-a"},
        {"filename": "b.wav", "user_id": "user-b"},
    ]


def test_save_result_error(monkeypatch, storage_instance):
    def raise_connect(*args, **kwargs):
        raise RuntimeError("db")

    monkeypatch.setattr(storage_module.psycopg, "connect", raise_connect)
    with pytest.raises(RuntimeError):
        storage_instance.save_result("file", {}, "task")


def test_save_error_handles_failure(monkeypatch, storage_instance):
    def raise_connect(*args, **kwargs):
        raise RuntimeError("db")

    monkeypatch.setattr(storage_module.psycopg, "connect", raise_connect)
    storage_instance.save_error("file", "boom", "task")


def test_reset_failed_submissions_error(monkeypatch, storage_instance):
    def raise_connect(*args, **kwargs):
        raise RuntimeError("db")

    monkeypatch.setattr(storage_module.psycopg, "connect", raise_connect)
    assert storage_instance.reset_failed_submissions() == []
