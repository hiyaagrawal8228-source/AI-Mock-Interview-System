# backend/feedback_utils.py
import json
import re
from langchain_core.prompts import PromptTemplate
from backend.llm_groq_config import llm, code_llm


# ── HR Feedback ──────────────────────────────────────────────────────────────

_HR_TEMPLATE = """
You are an expert HR recruiter evaluating a behavioural interview transcript.

{transcript}

Score the candidate in each category OUT OF 100 (0 = extremely poor, 100 = exceptional).

Return ONLY a valid JSON object (no markdown):
{{
  "relevance":     <int>,
  "clarity":       <int>,
  "depth":         <int>,
  "examples":      <int>,
  "communication": <int>,
  "overall":       <int>,
  "summary":       "<2-3 sentence assessment>",
  "strengths":     ["<point 1>", "<point 2>", "<point 3>"],
  "improvements":  ["<point 1>", "<point 2>", "<point 3>"]
}}
"""


def generate_hr_feedback(history: list[dict]) -> dict:
    transcript = "\n".join(
        f"Q: {item['question']}\nA: {item['answer'] or '(no answer)'}"
        for item in history if item.get("question")
    )

    chain    = PromptTemplate(input_variables=["transcript"], template=_HR_TEMPLATE) | llm
    raw_text = chain.invoke({"transcript": transcript})
    content  = raw_text.content if hasattr(raw_text, "content") else str(raw_text)
    content  = re.sub(r"```json|```", "", content).strip()

    try:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        return json.loads(match.group(0)) if match else _fallback_hr()
    except Exception:
        return _fallback_hr()


def _fallback_hr() -> dict:
    return {
        "relevance": 0, "clarity": 0, "depth": 0, "examples": 0,
        "communication": 0, "overall": 0,
        "summary": "Feedback generation failed. Please retry.",
        "strengths": [], "improvements": [],
    }


# ── Coding Feedback ──────────────────────────────────────────────────────────

_CODE_TEMPLATE = """
You are a senior software engineer evaluating a coding submission.

Problem:
{description}

Function Signature:
{function_signature}

Candidate's Code:
{code}

Evaluate on: Correctness, Code Clarity, Edge Case Handling, Time & Space Complexity.

Return ONLY a valid JSON object (no markdown):
{{
  "correctness":  <0-100>,
  "clarity":      <0-100>,
  "edge_cases":   <0-100>,
  "efficiency":   <0-100>,
  "overall":      <0-100>,
  "summary":      "<2-3 sentence assessment>"
}}
"""


def generate_coding_feedback(history: list[dict]) -> dict:
    if not history:
        return _fallback_code()

    latest   = history[-1]
    problem  = latest.get("problem", {})
    code     = latest.get("code", "")

    chain = (
        PromptTemplate(
            input_variables=["description", "function_signature", "code"],
            template=_CODE_TEMPLATE,
        )
        | code_llm
    )
    raw_text = chain.invoke({
        "description":        problem.get("description", ""),
        "function_signature": problem.get("function_signature", ""),
        "code":               code,
    })
    content = raw_text.content if hasattr(raw_text, "content") else str(raw_text)
    content = re.sub(r"```json|```", "", content).strip()

    try:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        return json.loads(match.group(0)) if match else _fallback_code()
    except Exception:
        return _fallback_code()


def _fallback_code() -> dict:
    return {
        "correctness": 0, "clarity": 0, "edge_cases": 0,
        "efficiency": 0, "overall": 0,
        "summary": "Feedback generation failed. Please retry.",
    }
