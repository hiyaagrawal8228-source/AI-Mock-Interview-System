# backend/hr_session.py
from backend.hr_interview_chain import generate_hr_question
from backend.controller_chain import get_controller_decision
from backend.feedback_utils import generate_hr_feedback


class HRInterviewSession:
    """Manages a full behavioural (HR) interview session."""

    FIRST_QUESTION = (
        "Welcome to the HR round. Tell me about yourself and why you're "
        "interested in this role."
    )

    def __init__(self, role: str, session_id: str, rounds: int = 8):
        self.role          = role
        self.session_id    = session_id
        self.current_round = 0
        self.rounds        = rounds
        self.round_type    = "HR"
        self.meta: dict    = {}

        self.history: list[dict] = [
            {"question": self.FIRST_QUESTION, "answer": None}
        ]

    # ── Public API ───────────────────────────────────────────────────────────

    def ask_question(self) -> str | None:
        if self.current_round >= self.rounds:
            return None

        if self.current_round == 0:
            self.current_round += 1
            return self.history[0]["question"]

        prev_question = self.history[-1]["question"]
        prev_answer   = self.history[-1]["answer"] or ""

        decision = get_controller_decision(prev_question, prev_answer)

        question = generate_hr_question(
            role=self.role,
            prev_question=prev_question,
            last_answer=prev_answer,
            decision=decision,
        )

        self.history.append({"question": question, "answer": None})
        self.current_round += 1
        return question

    def provide_answer(self, answer: str) -> None:
        if self.history and self.history[-1]["answer"] is None:
            self.history[-1]["answer"] = answer

    def is_complete(self) -> bool:
        return self.current_round >= self.rounds

    def generate_feedback(self) -> dict:
        return generate_hr_feedback(self.history)
