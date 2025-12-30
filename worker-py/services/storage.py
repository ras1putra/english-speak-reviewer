"""MinIO and Postgres plumbing for storing worker artifacts and results."""

import json
from typing import Any

import psycopg
from minio import Minio
from services.config import config
from utils.logger import logger


class Storage:
    """Handle downloading audio blobs and persisting job results/errors."""

    def __init__(self) -> None:
        endpoint = config.MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
        self.minio = Minio(
            endpoint,
            access_key=config.MINIO_ACCESS_KEY,
            secret_key=config.MINIO_SECRET_KEY,
            secure=config.MINIO_SECURE,
        )

    def download_file(self, filename: str, task_id: str) -> str:
        """Fetch an audio object from MinIO to a local temp path."""
        local_path = f"/tmp/{filename}"
        try:
            self.minio.fget_object(config.MINIO_BUCKET, filename, local_path)
            logger.info("Downloaded %s to %s (task %s)", filename, local_path, task_id)
            return local_path
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error(
                "Failed to download %s: %s (task %s)",
                filename,
                error,
                task_id,
            )
            raise

    def save_result(self, file_id: str, result: dict[str, Any], task_id: str) -> None:
        """Persist a completed job result to Postgres."""
        try:
            with psycopg.connect(config.DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE submissions
                        SET result = %s, status = 'completed', updated_at = NOW()
                        WHERE filename = %s
                        """,
                        (json.dumps(result), file_id),
                    )
                    conn.commit()
            logger.info("Saved result for %s (task %s)", file_id, task_id)
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error(
                "Failed to save result for %s: %s (task %s)",
                file_id,
                error,
                task_id,
            )
            raise

    def save_error(self, file_id: str, error_message: str, task_id: str) -> None:
        """Mark a submission as failed in Postgres."""
        try:
            with psycopg.connect(config.DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE submissions
                        SET error_message = %s, status = 'failed', updated_at = NOW()
                        WHERE filename = %s
                        """,
                        (error_message, file_id),
                    )
                    conn.commit()
            logger.info("Saved error for %s (task %s)", file_id, task_id)
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error(
                "Failed to save error for %s: %s (task %s)",
                file_id,
                error,
                task_id,
            )

    def reset_failed_submissions(self, limit: int = 10) -> list[dict[str, Any]]:
        """Return filename/user pairs moved from failed to pending for retry."""
        try:
            with psycopg.connect(config.DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        WITH target AS (
                            SELECT filename
                            FROM submissions
                            WHERE status = 'failed'
                            ORDER BY updated_at ASC
                            LIMIT %s
                            FOR UPDATE SKIP LOCKED
                        )
                        UPDATE submissions
                        SET status = 'pending',
                            error_message = NULL,
                            updated_at = NOW()
                        WHERE filename IN (SELECT filename FROM target)
                        RETURNING filename, user_id
                        """,
                        (limit,),
                    )
                    rows = cur.fetchall()
                    conn.commit()
                    return [
                        {"filename": row[0], "user_id": row[1]}
                        for row in rows
                    ]
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error("Failed to reset failed submissions: %s", error)
        return []


storage = Storage()
