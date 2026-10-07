# backend/hr_interview_chain.py
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_groq_config import llm

_hr_prompt = ChatPromptTemplate.from_template("""
You are a professional HR interviewer conducting a behavioural round for the role: {role}.

Controller decision: **{decision}**

Previous question:
\"\"\"{prev_question}\"\"\"

Candidate answer:
\"\"\"{last_answer}\"\"\"

Based on the decision:
- probe          → ask a deeper follow-up on the same topic
- clarify        → ask what part of the answer was unclear
- example        → ask for a real-world incident (STAR format)
- next_topic     → move to a new HR competency area
- behavior_check → ask a STAR-style situational question

Rules:
- Ask EXACTLY ONE HR question
- No explanation or extra text
- Natural, professional, conversational tone
""")


def generate_hr_question(
    role: str,
    prev_question: str,
    last_answer: str,
    decision: str,
) -> str:
    return llm.invoke(
        _hr_prompt.format(
            role=role,
            decision=decision,
            prev_question=prev_question,
            last_answer=last_answer or "",
        )
    ).content.strip()
