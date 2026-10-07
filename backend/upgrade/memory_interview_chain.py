# backend/memory_interview_chain.py
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm

_question_prompt = ChatPromptTemplate.from_template("""
You are an interviewer generating the next technical question for the candidate.

Inputs:
- Role:                   {role}
- Controller decision:    {decision}
- Previous question:      "{prev_question}"
- Candidate answer:       "{candidate_answer}"
- Resume excerpt:         {resume_excerpt}
- Recently covered topics:{recent_topics}

Decision rules:
1. depth_probe           → deeper sub-question on the SAME topic
2. concept_clarification → ask candidate to clarify a vague/incorrect part
3. edge_case             → ask about edge cases / performance boundaries
4. follow_up_question    → logical next question in the SAME topic
5. topic_transition      → pick a NEW topic from resume skills (avoid recent_topics)

Output ONLY the question. No preamble, no numbering, no explanation.
""")


def generate_technical_question(
    role: str,
    decision: str,
    prev_question: str,
    candidate_answer: str,
    resume_excerpt: str,
    recent_topics: list[str],
) -> str:
    prompt = _question_prompt.format(
        role=role or "general",
        decision=decision,
        prev_question=prev_question or "",
        candidate_answer=candidate_answer or "",
        resume_excerpt=resume_excerpt[:1200],
        recent_topics=", ".join(recent_topics) if recent_topics else "none",
    )
    return llm.invoke(prompt).content.strip()
