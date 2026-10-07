# backend/interview_session.py
import json
import re
from backend.vector_memory import VectorMemory
from backend.controller_chain import get_tech_controller_decision
from backend.memory_interview_chain import generate_technical_question
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm


class InterviewSession:
    """Manages a full technical interview session with adaptive question generation."""

    FIRST_QUESTION = (
        "Can you briefly describe one technical project from your resume "
        "and the technologies you used?"
    )

    def __init__(
        self,
        resume_obj=None,
        resume_path=None,
        role: str = "",
        rounds: int = 10,
        session_id: str = "default",
    ):
        if resume_path:
            with open(resume_path, "r", encoding="utf-8") as f:
                self.resume = json.load(f)
        elif resume_obj:
            self.resume = resume_obj
        else:
            raise ValueError("Either resume_path or resume_obj must be provided.")

        self.role          = role
        self.resume_str    = json.dumps(self.resume) if isinstance(self.resume, dict) else self.resume
        self.rounds        = rounds
        self.current_round = 0
        self.session_id    = session_id
        self.round_type    = "Technical"
        self.vector_memory = VectorMemory()
        self.meta: dict    = {}

        self.history: list[dict] = [
            {"question": self.FIRST_QUESTION, "answer": None}
        ]

    # ── Public API ───────────────────────────────────────────────────────────

    def ask_question(self) -> str | None:
        if self.current_round >= self.rounds:
            return None

        # First question: already in history
        if self.current_round == 0:
            self.current_round += 1
            return self.history[0]["question"]

        prev_question   = self.history[-1]["question"]
        prev_answer     = self.history[-1]["answer"] or ""
        resume_excerpt  = self.resume_str[:1500]
        recent_topics   = self.vector_memory.recent_topics()

        decision = get_tech_controller_decision(
            prev_question=prev_question,
            candidate_answer=prev_answer,
            role=self.role,
            resume_excerpt=resume_excerpt,
            recent_topics=recent_topics,
        )

        next_q = generate_technical_question(
            role=self.role,
            decision=decision,
            prev_question=prev_question,
            candidate_answer=prev_answer,
            resume_excerpt=resume_excerpt,
            recent_topics=recent_topics,
        )

        self.history.append({"question": next_q, "answer": None})
        self.current_round += 1
        return next_q

    def provide_answer(self, answer: str) -> None:
        if self.history and self.history[-1]["answer"] is None:
            self.history[-1]["answer"] = answer
            self.vector_memory.add_qa(self.history[-1]["question"], answer)

    def is_complete(self) -> bool:
        return self.current_round >= self.rounds

    def summary(self) -> list[dict]:
        return self.history

    def generate_feedback(self) -> dict:
        qa_summary = "\n\n".join(
            f"Q{i}: {qa['question']}\nA{i}: {qa['answer'] or '(no answer)'}"
            for i, qa in enumerate(self.history, 1)
        )

        feedback_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert mock interview evaluator.
Score the candidate ONLY on their technical interview responses.
Return ONLY a valid JSON object (no markdown) in this exact format:
{{
  "relevance":     <0-100>,
  "clarity":       <0-100>,
  "depth":         <0-100>,
  "examples":      <0-100>,
  "communication": <0-100>,
  "overall":       <0-100>,
  "summary":       "<2-3 sentence overall assessment>"
}}"""),
            ("human", "{qa_summary}"),
        ])

        raw      = (feedback_prompt | llm).invoke({"qa_summary": qa_summary})
        raw_text = raw.content if hasattr(raw, "content") else str(raw)
        raw_text = raw_text.replace("N/A", "null")

        try:
            match = re.search(r"\{.*\}", raw_text, re.DOTALL)
            return json.loads(match.group(0)) if match else {}
        except Exception as e:
            return {"error": f"Could not parse feedback: {e}"}
