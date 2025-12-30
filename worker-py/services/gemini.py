"""Gemini client wrapper for generating narrative feedback from scoring results."""

import json
from typing import Any

from google import genai

from services.config import config
from utils.logger import logger


class GeminiReviewer:
    """Lazy-load Gemini client and format structured speaking feedback."""

    def __init__(self) -> None:
        self.client = None

    def is_enabled(self) -> bool:
        """Return True when API key/model are configured."""
        return bool(config.GEMINI_API_KEY and config.GEMINI_MODEL)

    def ensure_client(self) -> Any:
        """Return cached genai.Client ensuring configuration is present."""
        if not self.is_enabled():
            raise RuntimeError("Gemini reviewer not configured")
        if self.client is None:
            self.client = genai.Client(api_key=config.GEMINI_API_KEY)
        return self.client

    def build_prompt(
        self, scoring_result: dict[str, Any], question_text: str | None = None
    ) -> str:
        """Create a structured prompt summarizing scoring metrics."""
        transcript = scoring_result.get("raw_transcript") or "N/A"
        pronunciation = scoring_result.get("pronunciation", {})
        fluency = scoring_result.get("fluency", {})

        pronunciation_score = pronunciation.get("overall_score")
        mispronounced = [
            word.get("word")
            for word in pronunciation.get("details", [])
            if word.get("is_mispronounced")
        ][:8]

        prompt = f"""
You are an encouraging English speaking coach. You are evaluating a student's answer to a specific question.

QUESTION ASKED:
"{question_text if question_text else 'Unknown Question'}"

STUDENT'S ANSWER (TRANSCRIPT):
"{transcript}"

PRONUNCIATION:
- Overall score: {pronunciation_score}
- Mispronounced words: {', '.join(mispronounced) if mispronounced else 'None'}

FLUENCY:
- Words per minute: {fluency.get('wpm')}
- Pauses (>1s): {fluency.get('pauses')}
- Fillers: {fluency.get('fillers')}

INSTRUCTIONS:
1. Check if the student's answer is relevant to the "QUESTION ASKED".
2. If the answer is irrelevant or completely wrong (e.g. answering a different question), clearly state this in the summary.
3. Provide constructive feedback on their English skills regardless of relevance, but prioritize addressing the content mismatch if it exists.
4. Strengths must be honest. Only list a strength if the answer shows a real positive trait; otherwise leave the array empty or include a single roast-style line that bluntly explains the lack of strengths (e.g. "No standout strengths—answer felt off-topic and shaky."). Never invent praise.

Respond with JSON using this structure:
{{
  "summary": "2 sentences. First, state if the answer was relevant. Then summarize performance.",
  "strengths": ["bullet", "points"],
  "improvements": ["bullet", "points (include 'Stay on topic' if irrelevant)"],
  "grammar": ["optional grammar corrections or empty array"],
  "overall_score_comment": "one motivating closing remark"
}}
Keep feedback concise and supportive.
"""
        return prompt.strip()

    def strip_code_fence(self, text: str) -> str:
        """Remove surrounding markdown code fences when present."""
        content = text.strip()
        if not content.startswith("```"):
            return content
        lines = content.splitlines()
        if not lines:
            return ""
        fence = lines[0].strip()
        if not fence.startswith("```"):
            return content
        end_index = len(lines)
        for idx in range(len(lines) - 1, 0, -1):
            if lines[idx].strip().startswith("```"):
                end_index = idx
                break
        return "\n".join(lines[1:end_index]).strip()

    def parse_feedback(self, response_text: str) -> dict[str, Any]:
        """Convert Gemini response text into structured feedback."""
        cleaned = self.strip_code_fence(response_text)
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            logger.warning("Gemini response not JSON, returning raw text")
        return {
            "summary": cleaned.strip(),
            "strengths": [],
            "improvements": [],
            "grammar": [],
            "overall_score_comment": "",
        }

    def extract_response_text(self, response: Any) -> str:
        """Return a normalized text value from different Gemini client responses."""
        text = getattr(response, "text", None)
        if callable(text):
            text = text()
        text = (text or "").strip()
        if text:
            return text
        alt_text = getattr(response, "output_text", None)
        if callable(alt_text):
            alt_text = alt_text()
        return (alt_text or "").strip()

    def generate_feedback(
        self,
        scoring_result: dict[str, Any],
        task_id: str,
        question_text: str | None = None,
    ) -> dict[str, Any] | None:
        """Return structured feedback dict or None when disabled/errors."""
        if not self.is_enabled():
            logger.info("Gemini feedback disabled or missing credentials (task %s)", task_id)
            return None
        try:
            client = self.ensure_client()
            prompt = self.build_prompt(scoring_result, question_text)
            response = client.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=prompt,
            )
            response_text = self.extract_response_text(response)
            if not response_text:
                logger.warning("Gemini returned empty response (task %s)", task_id)
                return None
            feedback = self.parse_feedback(response_text)
            logger.info("Gemini feedback generated (task %s)", task_id)
            return feedback
        except Exception as error:  # pylint: disable=broad-exception-caught
            logger.error("Gemini feedback failed: %s (task %s)", error, task_id)
            return None


gemini_reviewer = GeminiReviewer()
