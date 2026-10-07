# backend/routes/interview.py
"""
Interview session management — fixed:
 - _id serialization in end_interview (was calling .get("_id") before serialize)
 - ObjectId sort key for proctoring
 - Handle voice answer when Whisper unavailable
 - Guard against 0 answers in report
"""

import os
import tempfile
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from bson import ObjectId
from pymongo import ASCENDING

from backend.auth import get_current_user
from backend.database import (
    users_collection, resumes_collection,
    interviews_collection, questions_collection,
    answers_collection, proctoring_collection, reports_collection,
)
from backend.question_generator import QuestionGenerator, calculate_question_count
from backend.evaluation_engine import EvaluationEngine
from backend.confidence_utils import get_confidence_score
from backend.speech_to_text import transcribe

logger  = logging.getLogger(__name__)
router  = APIRouter(prefix="/api/interview", tags=["interview"])
_engine = EvaluationEngine()


def _oid(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _get_interview_or_404(interview_id: str, user: str) -> dict:
    try:
        oid = ObjectId(interview_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid interview ID")
    doc = interviews_collection.find_one({"_id": oid, "userId": user})
    if not doc:
        raise HTTPException(status_code=404, detail="Interview not found")
    return doc


# ── Setup ─────────────────────────────────────────────────────────────────────

class SetupRequest(BaseModel):
    role:           str
    interview_type: str
    duration:       int
    difficulty:     str = "medium"


@router.post("/setup")
def setup_interview(body: SetupRequest, user: str = Depends(get_current_user)):
    resume = resumes_collection.find_one({"userId": user, "isActive": True})
    skills = resume.get("skills", []) if resume else []
    if not skills:
        skills = ["general programming", "problem solving"]

    max_q = calculate_question_count(body.duration)
    q_gen = QuestionGenerator(
        skills        = skills,
        difficulty    = body.difficulty,
        max_questions = max_q,
        role          = body.role,
    )

    interview_doc = {
        "userId":        user,
        "role":          body.role,
        "interviewType": body.interview_type,
        "duration":      body.duration,
        "difficulty":    body.difficulty,
        "skills":        skills,
        "maxQuestions":  max_q,
        "currentIndex":  0,
        "status":        "active",
        "startedAt":     datetime.utcnow().isoformat(),
        "endedAt":       None,
    }
    result       = interviews_collection.insert_one(interview_doc)
    interview_id = str(result.inserted_id)

    all_questions = q_gen.generate_all(interview_id)
    first_q = all_questions[0] if all_questions else "Tell me about yourself."

    return {
        "interview_id":    interview_id,
        "first_question":  first_q,
        "total_questions": max_q,
        "difficulty":      body.difficulty,
        "skills":          skills,
    }


# ── Text answer ───────────────────────────────────────────────────────────────

class TextAnswerRequest(BaseModel):
    interview_id: str
    question_id:  Optional[str] = None
    answer_text:  str
    focus_score:  float = 1.0


@router.post("/answer/text")
def submit_text_answer(body: TextAnswerRequest, user: str = Depends(get_current_user)):
    if not body.answer_text or not body.answer_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Answer cannot be empty. Please type your response before submitting."
        )

    interview = _get_interview_or_404(body.interview_id, user)
    if interview["status"] != "active":
        raise HTTPException(status_code=400, detail="Interview is not active")

    idx = interview["currentIndex"]
    q_doc = questions_collection.find_one({"interviewId": body.interview_id, "order": idx})
    question_text = q_doc["text"] if q_doc else "General question"
    question_id   = str(q_doc["_id"]) if q_doc else None

    eval_result = _engine.evaluate_single_answer(
        question        = question_text,
        answer          = body.answer_text.strip(),
        audio_confidence= 0.5,
        role            = interview.get("role", ""),
        question_number = idx + 1,
    )

    answers_collection.insert_one({
        "interviewId":  body.interview_id,
        "questionId":   question_id,
        "userId":       user,
        "order":        idx,
        "questionText": question_text,
        "answerType":   "text",
        "rawAnswer":    body.answer_text.strip(),
        "focusScore":   body.focus_score,
        "evaluation":   eval_result,
        "submittedAt":  datetime.utcnow().isoformat(),
    })

    new_idx = idx + 1
    interviews_collection.update_one(
        {"_id": ObjectId(body.interview_id)},
        {"$set": {"currentIndex": new_idx}},
    )

    next_q_doc = questions_collection.find_one({"interviewId": body.interview_id, "order": new_idx})

    if next_q_doc:
        return {
            "status":          "continue",
            "next_question":   next_q_doc["text"],
            "next_order":      new_idx,
            "total_questions": interview["maxQuestions"],
            "evaluation":      eval_result,
        }
    return {
        "status":     "complete",
        "message":    "All questions answered. Click 'End Interview' to see your report.",
        "evaluation": eval_result,
    }


# ── Voice answer (NO FFMPEG, NO LOCAL WHISPER) ───────────────────────────────

from fastapi import UploadFile, File, Form, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from uuid import uuid4
import tempfile, os

from backend.speech_to_text import transcribe

@router.post("/answer/voice")
async def submit_voice_answer(
    interview_id: str = Form(...),
    focus_score: float = Form(1.0),
    audio: UploadFile = File(...),
    user: str = Depends(get_current_user),
):
    interview = _get_interview_or_404(interview_id, user)

    if interview["status"] != "active":
        raise HTTPException(status_code=400, detail="Interview is not active")

    # ✅ Force safe extension (important fix)
    tmp_path = os.path.join(
        tempfile.gettempdir(),
        f"voice_{uuid4().hex}.wav"   # force wav
    )

    content = await audio.read()

    if len(content) < 2000:
        raise HTTPException(
            status_code=422,
            detail="Audio too short. Please speak clearly."
        )

    # ✅ Write binary safely
    with open(tmp_path, "wb") as f:
        f.write(content)

    # ✅ DEBUG (very important)
    print("Audio saved at:", tmp_path, "Size:", len(content))

    # ── Transcription ─────────────────────────
    print(f"📁 Audio saved at: {tmp_path}")
    transcription = transcribe(tmp_path)
    print(f"📝 Transcription: {transcription}")

    try:
        os.remove(tmp_path)
    except Exception:
        pass

    if not transcription:
        raise HTTPException(
            status_code=422,
            detail="Could not transcribe audio. Try speaking clearly or use text."
        )

    # ── Continue your logic ───────────────────
    idx = interview["currentIndex"]
    q_doc = questions_collection.find_one({"interviewId": interview_id, "order": idx})

    question_text = q_doc["text"] if q_doc else "General question"
    question_id = str(q_doc["_id"]) if q_doc else None

    eval_result = _engine.evaluate_single_answer(
        question=question_text,
        answer=transcription,
        audio_confidence=1.0,
        role=interview.get("role", ""),
        question_number=idx + 1,
    )

    answers_collection.insert_one({
        "interviewId": interview_id,
        "questionId": question_id,
        "userId": user,
        "order": idx,
        "questionText": question_text,
        "answerType": "voice",
        "rawAnswer": transcription,
        "audioConfidence": 1.0,
        "focusScore": focus_score,
        "evaluation": eval_result,
    })
    
    # ✅ FIX: increment question index (MISSING)
    new_idx = idx + 1

    interviews_collection.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"currentIndex": new_idx}},
    )

    # Get next question
    next_q_doc = questions_collection.find_one({
        "interviewId": interview_id,
        "order": new_idx
    })

    if next_q_doc:
        return {
            "status": "continue",
            "next_question": next_q_doc["text"],
            "next_order": new_idx,
            "total_questions": interview["maxQuestions"],
            "transcription": transcription,
            "evaluation": eval_result,
        }

    # If no more questions
    return {
        "status": "complete",
        "message": "All questions answered. Click 'End Interview' to see your report.",
        "transcription": transcription,
        "evaluation": eval_result,
    }

    # return {
    #     "status": "ok",
    #     "transcription": transcription,
    #     "evaluation": eval_result,
    # }
    
    
# ── End interview + generate report ──────────────────────────────────────────

@router.post("/{interview_id}/end")
def end_interview(interview_id: str, user: str = Depends(get_current_user)):
    interview = _get_interview_or_404(interview_id, user)

    interviews_collection.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"status": "ended", "endedAt": datetime.utcnow().isoformat()}},
    )

    answers = list(answers_collection.find(
        {"interviewId": interview_id},
        sort=[("order", ASCENDING)]
    ))

    qa_pairs    = [{"question": a["questionText"], "answer": a["rawAnswer"]} for a in answers]
    audio_confs = [a.get("audioConfidence", 0.5) for a in answers]

    # Proctoring summary
    proc_logs = list(proctoring_collection.find({"interviewId": interview_id}))
    total_p   = len(proc_logs)
    viols     = sum(1 for l in proc_logs if l.get("violation"))
    proctoring_score = round((1 - viols / total_p) * 100, 1) if total_p else 100.0
    proc_violations  = {}
    for l in proc_logs:
        v = l.get("violation")
        if v:
            proc_violations[v] = proc_violations.get(v, 0) + 1

    # Run evaluation
    report = _engine.evaluate_interview(
        qa_pairs,
        audio_confidences     = audio_confs,
        role                  = interview.get("role", ""),
        proctoring_score      = proctoring_score,
    )

    report_doc = {
        "interviewId":   interview_id,
        "userId":        user,
        "role":          interview.get("role", ""),
        "interviewType": interview.get("interviewType", ""),
        "difficulty":    interview.get("difficulty", ""),
        "generatedAt":   datetime.utcnow().isoformat(),
        "proctoring": {
            "score":        proctoring_score,
            "total_frames": total_p,
            "violations":   proc_violations,
            "verdict":      "CLEAN" if proctoring_score >= 90 else "FLAGGED",
        },
        **report,
    }

    # Upsert report
    reports_collection.replace_one(
        {"interviewId": interview_id},
        report_doc,
        upsert=True,
    )

    # Fetch inserted doc to get _id
    saved = reports_collection.find_one({"interviewId": interview_id}) or {}
    report_doc["_id"] = str(saved.get("_id", ""))

    print("FINAL REPORT:", report_doc)
    return report_doc


# ── Get report ────────────────────────────────────────────────────────────────

@router.get("/{interview_id}/report")
def get_report(interview_id: str, user: str = Depends(get_current_user)):
    doc = reports_collection.find_one({"interviewId": interview_id, "userId": user})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Report not found. End the interview first to generate a report."
        )
    return _oid(doc)


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/history")
def get_history(user: str = Depends(get_current_user)):
    docs = list(
        interviews_collection
        .find({"userId": user}, {"currentIndex": 0})
        .sort("startedAt", -1)
        .limit(50)
    )
    return [_oid(d) for d in docs]


@router.get("/{interview_id}")
def get_interview(interview_id: str, user: str = Depends(get_current_user)):
    return _oid(_get_interview_or_404(interview_id, user))
