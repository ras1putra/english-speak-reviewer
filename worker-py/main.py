"""Worker entry point for processing queued audio scoring jobs."""

import json
import os
import time
from typing import Any
from uuid import uuid4

import redis
from dotenv import load_dotenv
from services.config import config
from services.database import db
from services.gemini import gemini_reviewer
from services.scoring import audio_processor
from services.storage import storage
from utils.logger import logger

# Load environment variables
load_dotenv()

# This worker runs the CPU/GPU intensive scoring pipeline so the Bun API can stay responsive.


def publish_status(redis_client: redis.Redis, payload: dict[str, Any]) -> None:
    """Publish a status update to the realtime channel."""
    if not redis_client:
        return
    event = {key: value for key, value in payload.items() if value is not None}
    logger.info(
        "Publishing status event",
        extra={
            "task_id": event.get("taskId"),
            "file_id": event.get("fileId"),
            "user_id": event.get("userId"),
            "status": event.get("status"),
        },
    )
    try:
        redis_client.publish(config.JOB_STATUS_CHANNEL, json.dumps(event))
    except redis.RedisError as error:  # pragma: no cover - defensive logging
        logger.warning("Failed to publish status event: %s", error)


def process_job(job_data: str, redis_client: redis.Redis) -> bool:
    """
    Process a single audio job.
    """
    file_id = None
    local_path = None
    task_id = str(uuid4())
    user_id = None

    try:
        data = json.loads(job_data)
        file_id = data.get("fileId")
        task_id = data.get("taskId") or task_id
        user_id = data.get("userId")

        question_id = data.get("questionId")

        logger.info("Processing job: %s (task %s)", file_id, task_id)
        publish_status(
            redis_client,
            {
                "taskId": task_id,
                "fileId": file_id,
                "userId": user_id,
                "status": "started",
            },
        )
        local_path = storage.download_file(file_id, task_id)
        logger.info("Downloaded %s to %s (task %s)", file_id, local_path, task_id)
        publish_status(
            redis_client,
            {
                "taskId": task_id,
                "fileId": file_id,
                "userId": user_id,
                "status": "processing",
            },
        )

        # Process Audio
        result = audio_processor.process(local_path, task_id)
        publish_status(
            redis_client,
            {
                "taskId": task_id,
                "fileId": file_id,
                "userId": user_id,
                "status": "transcribed",
            },
        )

        # Generate AI feedback
        question_text = None
        if question_id:
            question_text = db.get_question_text(question_id)
            if question_text:
                logger.info("Fetched question text for %s", question_id)

        ai_feedback = gemini_reviewer.generate_feedback(result, task_id, question_text)
        if ai_feedback:
            result["ai_feedback"] = ai_feedback
        publish_status(
            redis_client,
            {
                "taskId": task_id,
                "fileId": file_id,
                "userId": user_id,
                "status": "feedback",
            },
        )

        # Save Result
        storage.save_result(file_id, result, task_id)
        publish_status(
            redis_client,
            {
                "taskId": task_id,
                "fileId": file_id,
                "userId": user_id,
                "status": "completed",
            },
        )

        logger.info("Job completed: %s (task %s)", file_id, task_id)
        return True

    except Exception as error:  # pylint: disable=broad-exception-caught
        logger.error("Error processing job: %s (task %s)", error, task_id)
        if file_id:
            storage.save_error(file_id, str(error), task_id)
            publish_status(
                redis_client,
                {
                    "taskId": task_id,
                    "fileId": file_id,
                    "userId": user_id,
                    "status": "error",
                    "message": str(error),
                },
            )
        return False
    finally:
        # Cleanup
        if local_path and os.path.exists(local_path):
            try:
                os.remove(local_path)
                logger.info("Cleaned up %s (task %s)", local_path, task_id)
            except OSError as error:
                logger.error(
                    "Failed to cleanup %s: %s (task %s)",
                    local_path,
                    error,
                    task_id,
                )


def requeue_failed_jobs(redis_client: redis.Redis) -> None:
    """
    Periodically sweep failed submissions so the worker can retry them without manual intervention.
    """
    retries = storage.reset_failed_submissions(limit=config.FAILED_RETRY_BATCH_SIZE)

    if not retries:
        return

    for item in retries:
        filename = item.get("filename")
        user_id = item.get("user_id")
        task_id = str(uuid4())
        payload = json.dumps(
            {
                "fileId": filename,
                "filePath": filename,
                "taskId": task_id,
                "userId": user_id,
            }
        )
        try:
            redis_client.lpush(config.QUEUE_NAME, payload)
            logger.info("Requeued failed submission: %s, task_id %s", filename, task_id)
        except redis.RedisError as redis_error:
            logger.error(
                "Failed to requeue submission %s: %s, task_id %s",
                filename,
                redis_error,
                task_id,
            )


def main() -> None:
    """Start the worker loop and listen to Redis for scoring jobs."""
    logger.info("Starting Python AI Worker...")

    # Preload models
    logger.info("Preloading models...")
    audio_processor.load_models()

    try:
        r = redis.Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            decode_responses=True,
        )
        # Verify connection
        r.ping()
        logger.info("Connected to Redis at %s:%s", config.REDIS_HOST, config.REDIS_PORT)
    except redis.RedisError as error:
        logger.error("Failed to connect to Redis: %s", error)
        return

    gemini_enabled = gemini_reviewer.is_enabled()  # Check Gemini setup early
    logger.info("Gemini Reviewer enabled: %s", gemini_enabled)

    last_retry_check = time.monotonic()
    while True:
        try:
            # Blocking pop from list
            item = r.brpop(config.QUEUE_NAME, timeout=5)

            if item:
                _queue, job_data = item
                process_job(job_data, r)

            # Responsibility split from Bun API: keep polling Redis and occasionally requeue failed jobs.
            now = time.monotonic()
            if now - last_retry_check >= config.FAILED_RETRY_INTERVAL_SECONDS:
                logger.info("Running failed submission retry sweep")
                requeue_failed_jobs(r)
                last_retry_check = now

        except redis.ConnectionError:
            logger.error("Redis connection lost, retrying...")
            time.sleep(5)
        except (
            Exception
        ) as error:  # pylint: disable=broad-exception-caught  # pragma: no cover - defensive guard
            logger.error("Unexpected error in worker loop: %s", error)
            time.sleep(1)


if __name__ == "__main__":  # pragma: no cover
    main()
