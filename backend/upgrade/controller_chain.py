# backend/controller_chain.py
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm

# ── HR controller ────────────────────────────────────────────────────────────

_hr_controller_prompt = ChatPromptTemplate.from_template("""
You are the decision-making controller for an HR interview system.

Analyse the previous HR question and the candidate's answer, then choose
EXACTLY ONE action label from the list below.

Labels:
- probe          → ask deeper about same topic
- clarify        → answer was vague or unclear
- example        → ask for a real life example / incident
- next_topic     → move to a completely new HR competency
- behavior_check → ask a STAR-style behavioural question

Previous question:
\"\"\"{question}\"\"\"

Candidate answer:
\"\"\"{answer}\"\"\"

Respond with ONLY the label. No explanation.
""")

_HR_VALID = {"probe", "clarify", "example", "next_topic", "behavior_check"}


def get_controller_decision(question: str, answer: str) -> str:
    raw = llm.invoke(
        _hr_controller_prompt.format(question=question, answer=answer)
    ).content.strip().lower().split()[0]
    return raw if raw in _HR_VALID else "probe"


# ── Technical controller ─────────────────────────────────────────────────────

_tech_controller_prompt = ChatPromptTemplate.from_template("""
You are the decision-making controller for a technical interview system.

Given the context below, decide EXACTLY ONE action:

- depth_probe            → ask a deeper sub-question on the same topic
- concept_clarification  → ask candidate to clarify unclear / incorrect logic
- edge_case              → ask about corner cases or performance boundaries
- follow_up_question     → ask the next logical conceptual step
- topic_transition       → switch to a new technical topic from the resume / role

Rules:
- If the previous topic is in recent_topics → prefer topic_transition
- Vague / wrong answer           → concept_clarification
- Good but shallow answer        → depth_probe
- Solid answer                   → follow_up_question or edge_case
- Use resume skills to pick new topics for topic_transition

Previous question:  \"\"\"{prev_question}\"\"\"
Candidate answer:   \"\"\"{candidate_answer}\"\"\"
Role:               {role}
Resume skills:      {resume_excerpt}
Recent topics:      {recent_topics}

Respond with ONLY the label. No explanation.
""")

_TECH_VALID = {
    "depth_probe", "concept_clarification", "edge_case",
    "follow_up_question", "topic_transition",
}


def get_tech_controller_decision(
    prev_question: str,
    candidate_answer: str,
    role: str,
    resume_excerpt: str,
    recent_topics: list[str],
) -> str:
    raw = llm.invoke(
        _tech_controller_prompt.format(
            prev_question=prev_question or "",
            candidate_answer=candidate_answer or "",
            role=role or "general",
            resume_excerpt=resume_excerpt[:1000],
            recent_topics=", ".join(recent_topics) if recent_topics else "none",
        )
    ).content.strip().lower().split()[0]
    return raw if raw in _TECH_VALID else "follow_up_question"
