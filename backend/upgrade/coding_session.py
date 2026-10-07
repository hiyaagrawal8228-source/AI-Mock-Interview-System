# backend/coding_session.py
import random
import json
import os
from backend.feedback_utils import generate_coding_feedback


class CodingSession:
    """Manages a live coding round with randomised problem selection."""

    def __init__(self, role: str, rounds: int = 2):
        self.role = role
        self.current_round = 0
        self.rounds = rounds
        self.history = []
        self.explanation_history = []
        self.meta = {}
        self.round_type = "Coding"

        problems_path = os.path.join(os.path.dirname(__file__), "problems.json")
        with open(problems_path, "r") as f:
            all_problems = json.load(f)

        self.randomized_problems = random.sample(
            all_problems,
            min(len(all_problems), rounds + 2)
        )

    # ─────────────────────────────────────────────────
    # Coding Engine
    # ─────────────────────────────────────────────────

    def get_next_problem(self):
        if self.current_round >= self.rounds or self.current_round >= len(self.randomized_problems):
            return None

        problem = self.randomized_problems[self.current_round]
        self.current_round += 1
        self.history.append({"problem": problem, "code": ""})
        return problem

    def submit_solution(self, code: str):
        if self.history:
            self.history[-1]["code"] = code

    def is_complete(self):
        return self.current_round >= self.rounds

    # ─────────────────────────────────────────────────
    # Compatibility Methods (IMPORTANT)
    # These prevent FastAPI crashes
    # ─────────────────────────────────────────────────

    def ask_question(self):
        """Coding sessions don't use voice questions."""
        return None

    def provide_answer(self, answer, confidence, focus_score):
        """Ignore voice answers during coding."""
        return None

    def get_progress(self):
        return {
            "current_problem": self.current_round,
            "total_questions": self.rounds,
            "completed": len(self.history),
            "remaining": max(self.rounds - len(self.history), 0),
            "round_type": self.round_type
        }

    def get_transcript(self):
        transcript = ""
        for i, item in enumerate(self.history):
            transcript += f"\nProblem {i+1}: {item['problem'].get('title','')}\n"
            transcript += f"Code:\n{item['code']}\n"
        return transcript

    def generate_report(self):
        feedback = generate_coding_feedback(self.history)

        return {
            "session_id": "coding_session",
            "role": self.role,
            "interview_type": "coding",
            "difficulty": "medium",
            "confidence_score": 70,
            "technical_score": feedback.get("score", 70),
            "communication_score": 70,
            "overall_score": feedback.get("score", 70),
            "grade": "B",
            "skill_level": "Intermediate",
            "strengths": feedback.get("strengths", []),
            "weaknesses": feedback.get("weaknesses", []),
            "recommendations": feedback.get("recommendations", []),
            "interview_summary": feedback.get("summary", ""),
        }

    def generate_feedback(self):
        return generate_coding_feedback(self.history)