# backend/question_generator.py
"""
Question generator:
  - Generates questions via LLM based on skills, role, difficulty
  - Stores all questions to DB upfront (no repetition possible)
  - Provides calculate_question_count helper
"""

import re
import json
import logging
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm

logger = logging.getLogger(__name__)


def calculate_question_count(duration_minutes: int) -> int:
    """
    duration  2 min → 2 questions
    duration 10 min → 5 questions
    duration 30 min → 10 questions  (cap at 15)
    """
    return max(2, min(15, duration_minutes // 2))


_Q_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert technical interviewer.
Generate exactly {count} unique interview questions for a {role} candidate.
Skills to cover: {skills}
Difficulty: {difficulty}

Rules:
- No repeated or similar questions
- Each question must be distinct in topic
- Difficulty guide: easy=fundamentals, medium=applied, hard=system design/advanced
- Return ONLY a JSON array of question strings, no other text or markdown.

Example output format:
["Question 1 text?", "Question 2 text?", ...]"""),
    ("human", "Generate {count} {difficulty} questions for {role} covering {skills}."),
])


class QuestionGenerator:
    def __init__(
        self,
        skills:        List[str],
        difficulty:    str  = "easy",
        max_questions: int  = 5,
        role:          str  = "Software Engineer",
    ):
        self.skills        = skills
        self.difficulty    = difficulty
        self.max_questions = max_questions
        self.role          = role
        self._generated:   List[str] = []

    def _generate_via_llm(self) -> List[str]:
        skills_str = ", ".join(self.skills[:5])  # limit to 5 skills
        try:
            chain = _Q_PROMPT | llm
            raw   = chain.invoke({
                "count":      self.max_questions,
                "role":       self.role,
                "skills":     skills_str,
                "difficulty": self.difficulty,
            })
            text = raw.content if hasattr(raw, "content") else str(raw)
            text = re.sub(r"```json|```", "", text).strip()
            match= re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                questions = json.loads(match.group(0))
                if isinstance(questions, list):
                    return [str(q) for q in questions[:self.max_questions]]
        except Exception as e:
            logger.warning(f"LLM question generation failed: {e}")
        return self._fallback_questions()

    def _fallback_questions(self) -> List[str]:
        skill = self.skills[0] if self.skills else "your primary technology"
        base  = [
            f"Can you explain your experience with {skill}?",
            f"Describe a challenging project you worked on using {skill}.",
            "What is your approach to debugging complex issues?",
            "How do you ensure code quality in your projects?",
            "Describe a situation where you had to learn a new technology quickly.",
            "How do you handle tight deadlines and competing priorities?",
            "What is your experience with system design?",
            "How do you approach performance optimization?",
        ]
        return base[:self.max_questions]

    def generate_all(self, interview_id: str) -> List[str]:
        """
        Generate all questions, persist to DB, and return list.
        Import here to avoid circular imports.
        """
        from backend.database import questions_collection

        questions = self._generate_via_llm()
        self._generated = questions

        # Persist to DB
        docs = [
            {
                "interviewId": interview_id,
                "order":       i,
                "text":        q,
                "skill":       self.skills[i % len(self.skills)] if self.skills else "general",
                "difficulty":  self.difficulty,
            }
            for i, q in enumerate(questions)
        ]
        if docs:
            questions_collection.insert_many(docs)

        return questions

    def get_next_question(self) -> Optional[str]:
        """For in-memory use: iterate through pre-generated questions."""
        if self._current_index < len(self._generated):
            q = self._generated[self._current_index]
            self._current_index += 1
            return q
        return None

    @property
    def _current_index(self):
        if not hasattr(self, "_idx"):
            self._idx = 0
        return self._idx

    @_current_index.setter
    def _current_index(self, v):
        self._idx = v
