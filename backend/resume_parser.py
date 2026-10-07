# backend/resume_parser.py
"""
Resume parser with LLM + robust regex fallback.
Fixes:
 - JSON parse failures now fall back to regex extraction
 - LLM token limit increased
 - Handles missing keys gracefully
"""

import re
import os
import json
import logging
import tempfile

logger = logging.getLogger(__name__)


# ── Text extraction ──────────────────────────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> str:
    try:
        import fitz  # PyMuPDF
        text = ""
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
        return text.strip()
    except ImportError:
        logger.error("PyMuPDF not installed — pip install PyMuPDF")
        return ""
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


def extract_text_from_docx(file_path: str) -> str:
    try:
        import docx
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs).strip()
    except ImportError:
        logger.error("python-docx not installed")
        return ""
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        return ""


def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    if ext in (".docx", ".doc"):
        return extract_text_from_docx(file_path)
    try:
        with open(file_path, "r", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Text read error: {e}")
        return ""


# ── Regex fallback parser ─────────────────────────────────────────────────────

def _regex_parse(text: str) -> dict:
    """Best-effort extraction using regex patterns when LLM fails."""
    result = {
        "name": "", "email": "", "phone": "",
        "role": "", "skills": [], "experience": [],
        "education": [], "projects": [],
    }

    # Email
    email_m = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if email_m:
        result["email"] = email_m.group(0)

    # Phone
    phone_m = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    if phone_m:
        result["phone"] = phone_m.group(0).strip()

    # Name — first non-empty line that's short and has 2+ words
    for line in text.splitlines():
        stripped = line.strip()
        if 3 <= len(stripped.split()) <= 5 and not any(c in stripped for c in ["@", "http", "/"]):
            result["name"] = stripped
            break

    # Skills — look for common skill section keywords
    skills_section = re.search(
        r"(?:skills|technologies|tech\s*stack|proficient)[:\s]+(.*?)(?:\n\n|\Z)",
        text, re.IGNORECASE | re.DOTALL
    )
    if skills_section:
        raw_skills = skills_section.group(1)
        # Split by comma, pipe, bullet, newline
        items = re.split(r"[,|\n•·▪◆\-]+", raw_skills)
        result["skills"] = [s.strip() for s in items if 2 <= len(s.strip()) <= 30][:20]

    # Experience
    exp_section = re.search(
        r"(?:experience|work history|employment)[:\s]*(.*?)(?:\n\n\n|\Z)",
        text, re.IGNORECASE | re.DOTALL
    )
    if exp_section:
        lines = [l.strip() for l in exp_section.group(1).splitlines() if l.strip()]
        result["experience"] = lines[:5]

    # Education
    edu_section = re.search(
        r"(?:education|academic|qualification)[:\s]*(.*?)(?:\n\n\n|\Z)",
        text, re.IGNORECASE | re.DOTALL
    )
    if edu_section:
        lines = [l.strip() for l in edu_section.group(1).splitlines() if l.strip()]
        result["education"] = lines[:3]

    # Role — try to find job title
    role_m = re.search(
        r"(?:software|backend|frontend|fullstack|data|ml|devops|cloud|android|ios|java|python|node)\s*\w*\s*(?:engineer|developer|scientist|architect|analyst|intern|lead)",
        text, re.IGNORECASE
    )
    if role_m:
        result["role"] = role_m.group(0).strip().title()

    return result


# ── LLM parser ───────────────────────────────────────────────────────────────

PARSE_TEMPLATE = """\
You are an expert resume parser. Extract information from the resume text below
and return ONLY a valid JSON object — no markdown, no explanation.

Required JSON structure:
{{
  "name":       "Full Name",
  "email":      "email@example.com",
  "phone":      "phone number or empty string",
  "role":       "most recent or target job title",
  "skills":     ["skill1", "skill2"],
  "experience": ["Company A - Role (2022-2024)", "Company B - Role (2020-2022)"],
  "education":  ["B.Tech CS - VIT University (2024)"],
  "projects":   ["Project A - description", "Project B - description"]
}}

Resume Text:
{text}
"""


def _clean_json(raw: str) -> str:
    raw = re.sub(r"```json|```", "", raw).strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    return match.group(0) if match else raw


def _validate_parsed(data: dict) -> dict:
    """Ensure all required keys exist with correct types."""
    defaults = {
        "name": "", "email": "", "phone": "", "role": "",
        "skills": [], "experience": [], "education": [], "projects": [],
    }
    for key, default in defaults.items():
        if key not in data or data[key] is None:
            data[key] = default
        elif isinstance(default, list) and not isinstance(data[key], list):
            data[key] = [str(data[key])] if data[key] else []
        elif isinstance(default, str) and not isinstance(data[key], str):
            data[key] = str(data[key])
    return data


def parse_resume_with_llm(file_path: str, max_retries: int = 2) -> dict:
    """
    Parse resume: tries LLM first, falls back to regex.
    Never returns an error dict — always returns best-effort data.
    """
    text = extract_text(file_path)
    if not text:
        return {
            "error": "Could not extract text from file. Ensure it is a valid PDF or DOCX.",
            **{k: ([] if k in ("skills","experience","education","projects") else "")
               for k in ("name","email","phone","role","skills","experience","education","projects")}
        }

    # ── LLM parse ─────────────────────────────────────────────────────────────
    try:
        from langchain_core.prompts import PromptTemplate
        from backend.llm_groq_config import llm

        prompt = PromptTemplate(input_variables=["text"], template=PARSE_TEMPLATE)
        chain  = prompt | llm

        for attempt in range(max_retries):
            try:
                raw     = chain.invoke({"text": text[:5000]})
                content = raw.content if hasattr(raw, "content") else str(raw)
                cleaned = _clean_json(content)
                parsed  = json.loads(cleaned)
                return _validate_parsed(parsed)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse attempt {attempt+1} failed: {e}")
            except Exception as e:
                logger.error(f"LLM error on attempt {attempt+1}: {e}")
                break  # Don't retry on LLM errors like rate limits

    except Exception as e:
        logger.error(f"LLM import/setup error: {e}")

    # ── Regex fallback ─────────────────────────────────────────────────────────
    logger.info("Using regex fallback for resume parsing")
    fallback = _regex_parse(text)
    fallback["_parsed_by"] = "regex_fallback"
    return _validate_parsed(fallback)
