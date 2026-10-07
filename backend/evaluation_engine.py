# backend/evaluation_engine.py

import re
import json
import logging
from typing import Dict, List

import numpy as np

from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm as groq_llm   # ✅ FIX 2: renamed to avoid shadowing

logger = logging.getLogger(__name__)

USE_EMBEDDINGS = False
_embedder = None


def _get_embedder():
    global _embedder
    if not USE_EMBEDDINGS:
        return None
    if _embedder is not None:
        return _embedder
    try:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("✅ Sentence-transformers loaded")
    except Exception as e:
        logger.warning(f"⚠️ Embeddings disabled: {e}")
        _embedder = None
    return _embedder


def _safe_mean(lst):
    return float(np.mean(lst)) if lst else 0.0


def _clip(score):
    return float(np.clip(score, 0, 100))


def _text_confidence(text: str) -> float:
    if not text:
        return 20.0
    words = text.split()
    wc = len(words)
    if wc == 0:
        return 20.0
    filler_words = {"um", "uh", "like", "basically", "actually", "you know"}
    fillers = sum(1 for w in words if w.lower() in filler_words)
    filler_penalty = min(30, (fillers / wc) * 100)
    length_score = min(100, wc * 2)
    return _clip(length_score * 0.6 + (100 - filler_penalty) * 0.4)


def _communication_quality(text: str) -> float:
    if not text:
        return 20.0
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 30.0
    avg_len = float(np.mean([len(s.split()) for s in sentences]))
    if 10 <= avg_len <= 25:
        score = 90.0
    elif avg_len < 10:
        score = avg_len * 8
    else:
        score = max(40.0, 100 - (avg_len - 25) * 2)
    return _clip(score)


def _keyword_relevance(question: str, answer: str) -> float:
    q_words = set(re.findall(r'\b\w{4,}\b', question.lower()))
    a_words = set(re.findall(r'\b\w{4,}\b', answer.lower()))
    if not q_words:
        return 50.0
    overlap = len(q_words & a_words) / len(q_words)
    return _clip(overlap * 100)


def _semantic_similarity(question: str, answer: str) -> float:
    embedder = _get_embedder()
    if embedder is None:
        return _keyword_relevance(question, answer)
    try:
        from sentence_transformers import util
        emb_q = embedder.encode(question, convert_to_tensor=True)
        emb_a = embedder.encode(answer, convert_to_tensor=True)
        sim = float(util.cos_sim(emb_q, emb_a)[0][0])
        return _clip((sim + 1) / 2 * 100)
    except Exception as e:
        logger.warning(f"Embedding error: {e}")
        return _keyword_relevance(question, answer)


PROMPT = ChatPromptTemplate.from_messages([
    ("system", """\
You are a senior technical interviewer.

Return ONLY valid JSON:
{{
  "technical_score": 0,
  "strength": "Good answer",
  "improvement": "Add more detail",
  "keywords_hit": []
}}

Rules:
- technical_score must be integer (0-10)
- No explanation outside JSON
"""),
    ("human", "Question: {question}\nAnswer: {answer}")
])


def _llm_eval(question: str, answer: str) -> Dict:    # ✅ FIX 2: no longer named 'llm'
    if not answer or len(answer.strip()) < 5:
        return {
            "technical_score": 0,
            "strength": "No answer",
            "improvement": "Answer properly",
            "keywords_hit": [],
        }
    try:
        chain = PROMPT | groq_llm                      # ✅ FIX 2: use renamed import
        res = chain.invoke({"question": question, "answer": answer})
        text = res.content if hasattr(res, "content") else str(res)
        text = re.sub(r"```.*?```", "", text, flags=re.DOTALL).strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON found")
        data = json.loads(match.group())
        return {
            "technical_score": int(np.clip(data.get("technical_score", 5), 0, 10)),
            "strength": data.get("strength", "Good attempt"),
            "improvement": data.get("improvement", "Add more detail"),
            "keywords_hit": data.get("keywords_hit", []),
        }
    except Exception as e:
        logger.warning(f"LLM eval failed: {e}")
        return {
            "technical_score": 5,
            "strength": "Answer provided",
            "improvement": "Improve clarity",
            "keywords_hit": [],
        }


class EvaluationEngine:

    def evaluate_single_answer(
        self,
        question: str,
        answer: str,
        audio_confidence: float = 0.5,
        role: str = "",
        question_number: int = 1,
    ) -> Dict:

        # ✅ FIX 1: empty answer returns ALL required keys so evaluate_interview
        #           never hits a KeyError when appending to score lists
        if not answer or not answer.strip():
            return {
                "question_number":     question_number,
                "question":            question,
                "answer":              "",
                "score_out_of_10":     0.0,
                "technical_score":     0.0,   # ← was missing
                "confidence_score":    0.0,   # ← was missing
                "communication_score": 0.0,   # ← was missing
                "relevance_score":     0.0,   # ← was missing
                "strength":            "No answer provided",
                "improvement":         "Please attempt every question",
                "keywords_hit":        [],
            }

        llm_result = _llm_eval(question, answer)       # ✅ FIX 2: variable renamed

        tech = float(llm_result["technical_score"]) * 10   # → 0-100
        conf = _text_confidence(answer)
        comm = _communication_quality(answer)
        rel  = _semantic_similarity(question, answer)

        final = (
            tech * 0.5 +
            rel  * 0.2 +
            comm * 0.2 +
            conf * 0.1
        )

        return {
            "question_number":     question_number,
            "question":            question,
            "answer":              answer,
            "score_out_of_10":     round(final / 10, 1),
            "technical_score":     round(tech, 2),
            "confidence_score":    round(conf, 2),
            "communication_score": round(comm, 2),
            "relevance_score":     round(rel, 2),
            "strength":            llm_result["strength"],
            "improvement":         llm_result["improvement"],
            "keywords_hit":        llm_result.get("keywords_hit", []),
        }

    def evaluate_interview(
        self,
        questions_and_answers: List[Dict] = None,
        audio_confidences: List[float] = None,
        role: str = "",
        proctoring_score: float = 100.0,
    ) -> Dict:

        qa_list = questions_and_answers or []

        if not qa_list:
            return self._empty_report(proctoring_score)

        tech_scores = []
        conf_scores = []
        comm_scores = []
        rel_scores  = []
        per_question = []

        for i, qa in enumerate(qa_list):
            res = self.evaluate_single_answer(
                question        = qa.get("question", ""),
                answer          = qa.get("answer", ""),
                question_number = i + 1,
            )
            per_question.append(res)

            # ✅ FIX 1: these keys now always exist (even for empty answers)
            tech_scores.append(res["technical_score"])
            conf_scores.append(res["confidence_score"])
            comm_scores.append(res["communication_score"])
            rel_scores.append(res["relevance_score"])

        avg_tech = _safe_mean(tech_scores)
        avg_conf = _safe_mean(conf_scores)
        avg_comm = _safe_mean(comm_scores)
        avg_rel  = _safe_mean(rel_scores)

        overall = round(
            avg_tech * 0.45 +
            avg_rel  * 0.20 +
            avg_comm * 0.20 +
            avg_conf * 0.10 +
            proctoring_score * 0.05,
            2
        )

        # ✅ FIX 3: added strengths/weaknesses/recommendations so FeedbackPage
        #           doesn't show empty sections
        strengths, weaknesses, recommendations = self._insights(
            avg_tech, avg_conf, avg_comm, avg_rel, per_question
        )

        return {
            "overall_score":         overall,
            "technical_score":       round(avg_tech, 2),
            "confidence_score":      round(avg_conf, 2),
            "communication_score":   round(avg_comm, 2),
            "relevance_score":       round(avg_rel, 2),
            "proctoring_score":      round(proctoring_score, 2),
            "grade":                 self._grade(overall),
            "skill_level":           self._skill_level(overall),
            "verdict":               "SELECTED" if overall >= 70 else "NEEDS_IMPROVEMENT" if overall >= 50 else "REJECTED",
            "questions_evaluated":   len(per_question),
            "per_question_analysis": per_question,
            "strengths":             strengths,       # ✅ FIX 3
            "weaknesses":            weaknesses,      # ✅ FIX 3
            "recommendations":       recommendations, # ✅ FIX 3
        }

    def _grade(self, score: float) -> str:
        if score >= 90: return "A+"
        if score >= 80: return "A"
        if score >= 70: return "B"
        if score >= 60: return "C"
        if score >= 50: return "D"
        return "Needs Improvement"

    def _skill_level(self, score: float) -> str:
        if score >= 85: return "Expert"
        if score >= 70: return "Advanced"
        if score >= 55: return "Intermediate"
        if score >= 40: return "Beginner"
        return "Entry Level"

    def _insights(self, avg_tech, avg_conf, avg_comm, avg_rel, per_q):
        strengths, weaknesses, recs = [], [], []

        if avg_tech >= 70:
            strengths.append("Strong technical knowledge demonstrated")
        elif avg_tech < 50:
            weaknesses.append("Technical depth needs improvement")
            recs.append("Revise fundamentals and practice coding problems daily")

        if avg_conf >= 70:
            strengths.append("Confident and clear communication style")
        elif avg_conf < 50:
            weaknesses.append("Lacks confidence in responses")
            recs.append("Reduce filler words; practice speaking answers aloud")

        if avg_comm >= 70:
            strengths.append("Well-structured, clear answers")
        elif avg_comm < 50:
            weaknesses.append("Answer structure needs improvement")
            recs.append("Use the STAR method: Situation → Task → Action → Result")

        if avg_rel >= 60:
            strengths.append("Answers are relevant and on-topic")
        elif avg_rel < 40:
            weaknesses.append("Some answers lacked relevance")
            recs.append("Re-read each question carefully before answering")

        scores = [q.get("score_out_of_10", 0) for q in per_q]
        if scores:
            best_idx  = int(np.argmax(scores))
            worst_idx = int(np.argmin(scores))
            if per_q[best_idx].get("score_out_of_10", 0) >= 7:
                strengths.append(f"Best answer: Q{per_q[best_idx]['question_number']} — {per_q[best_idx]['strength']}")
            recs.append(f"Focus on: Q{per_q[worst_idx]['question_number']} — {per_q[worst_idx]['improvement']}")

        recs.append("Schedule regular mock interviews to build stamina")

        if not strengths:
            strengths.append("You completed the interview — great first step!")
        if not weaknesses:
            weaknesses.append("Keep practising to maintain performance")

        return strengths, weaknesses, recs[:6]

    def _empty_report(self, proctoring_score: float = 100.0) -> Dict:
        return {
            "overall_score":         0,
            "technical_score":       0,
            "confidence_score":      0,
            "communication_score":   0,
            "relevance_score":       0,
            "proctoring_score":      proctoring_score,
            "grade":                 "Incomplete",
            "skill_level":           "Not Assessed",
            "verdict":               "INCOMPLETE",
            "questions_evaluated":   0,
            "per_question_analysis": [],
            "strengths":             [],
            "weaknesses":            ["No answers were submitted"],
            "recommendations":       ["Complete the full interview to receive a report"],
        }