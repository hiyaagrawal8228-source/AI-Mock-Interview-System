# backend/database.py
"""
Redesigned MongoDB schema:
  - users            : user profiles
  - resumes          : multiple resumes per user (versioned)
  - interviews       : interview sessions
  - questions        : per-interview questions
  - answers          : raw + evaluated answers
  - proctoring_logs  : per-frame violations
  - reports          : final compiled reports
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure
import os
from dotenv import load_dotenv
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGO_URL")
DB_NAME     = os.getenv("DB_NAME", "ai_interviewsim")

if not MONGODB_URI:
    raise ValueError("MONGO_URL not set in .env")

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    logger.info("✅ MongoDB connected")
except ConnectionFailure as e:
    logger.error(f"❌ MongoDB failed: {e}")
    raise

db = client[DB_NAME]

# ── Collections ────────────────────────────────────────────────────────────────
users_collection         = db["users"]
resumes_collection       = db["resumes"]          # NEW — versioned resumes
interviews_collection    = db["interviews"]
questions_collection     = db["questions"]         # NEW — per-interview questions
answers_collection       = db["answers"]           # NEW — raw + evaluated answers
proctoring_collection    = db["proctoring_logs"]   # NEW — violation logs
reports_collection       = db["reports"]           # NEW — final reports

# ── Indexes ────────────────────────────────────────────────────────────────────
users_collection.create_index([("clerkId", ASCENDING)], unique=True)
users_collection.create_index([("email",   ASCENDING)])

# Resumes: userId + version + isActive
resumes_collection.create_index([("userId",   ASCENDING)])
resumes_collection.create_index([("userId",   ASCENDING), ("version",  DESCENDING)])
resumes_collection.create_index([("userId",   ASCENDING), ("isActive", ASCENDING)])

interviews_collection.create_index([("userId", ASCENDING)])
interviews_collection.create_index([("date",   DESCENDING)])
interviews_collection.create_index([("status", ASCENDING)])

questions_collection.create_index([("interviewId", ASCENDING)])
questions_collection.create_index([("order",       ASCENDING)])

answers_collection.create_index([("interviewId", ASCENDING)])
answers_collection.create_index([("questionId",  ASCENDING)])

proctoring_collection.create_index([("interviewId", ASCENDING)])
proctoring_collection.create_index([("timestamp",   DESCENDING)])

reports_collection.create_index([("interviewId", ASCENDING)], unique=True)
reports_collection.create_index([("userId",      ASCENDING)])


def get_db():
    return db
