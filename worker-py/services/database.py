"""Database service for fetching application data."""

import psycopg
from services.config import config
from utils.logger import logger


class DatabaseService:
    """Handle read/write operations to the Postgres database."""

    def get_question_text(self, question_id: str) -> str | None:
        """Fetch the text content of a question by ID."""
        try:
            with psycopg.connect(config.DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT text FROM questions WHERE id = %s",
                        (question_id,),
                    )
                    row = cur.fetchone()
                    return row[0] if row else None
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error("Failed to fetch question text: %s", error)
        return None


db = DatabaseService()
