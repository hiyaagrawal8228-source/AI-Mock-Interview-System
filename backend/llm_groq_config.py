# backend/llm_groq_config.py
import os
import logging
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("DEFAULT_GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError(
        "DEFAULT_GROQ_API_KEY not found in environment.\n"
        "Get your key at https://console.groq.com and add it to backend/.env"
    )

# Fast model for question generation, parsing, evaluation
llm = ChatGroq(
    groq_api_key = GROQ_API_KEY,
    model        = "llama-3.1-8b-instant",
    temperature  = 0.7,
    max_tokens   = 1024,   # increased from 512 to avoid truncated JSON
)

# Powerful model for code evaluation and detailed feedback
code_llm = ChatGroq(
    groq_api_key = GROQ_API_KEY,
    model        = "llama-3.3-70b-versatile",
    temperature  = 0.4,
    max_tokens   = 2048,
)

logger.info("✅ Groq LLM configured")
