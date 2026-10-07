# backend/routes/dashboard.py
"""
Dashboard — fixed to use new schema fields (overall_score from reports, etc.)
"""

from fastapi import APIRouter, Depends
from backend.auth import get_current_user
from backend.database import interviews_collection, reports_collection
from datetime import datetime, timedelta
from typing import Any, Dict
from bson import ObjectId

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("/stats")
def get_dashboard_stats(user: str = Depends(get_current_user)) -> Dict[str, Any]:
    all_interviews = list(interviews_collection.find({"userId": user}))
    total          = len(all_interviews)

    # Fetch scores from reports collection (new schema)
    interview_ids = [str(i["_id"]) for i in all_interviews]
    reports = list(reports_collection.find({"userId": user})) if interview_ids else []

    overall_scores = [r.get("overall_score", 0) for r in reports if r.get("overall_score")]
    avg_score = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0

    one_week_ago = datetime.utcnow() - timedelta(days=7)

    def _parse_date(iso: str):
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00"))
        except Exception:
            return datetime.min

    this_week = sum(
        1 for i in all_interviews
        if _parse_date(i.get("startedAt", "")) > one_week_ago
    )

    # Last active
    last_active = None
    if all_interviews:
        latest = max(all_interviews, key=lambda x: x.get("startedAt", ""), default=None)
        if latest:
            last_active = latest.get("startedAt")

    # Recent interview stats
    recent_interview = None
    if reports:
        latest_report = max(reports, key=lambda x: x.get("generatedAt", ""), default=None)
        if latest_report:
            recent_interview = {
                "role":  latest_report.get("role", ""),
                "date":  latest_report.get("generatedAt", ""),
                "score": latest_report.get("overall_score", 0),
                "grade": latest_report.get("grade", ""),
            }

    return {
        "totalInterviews":  total,
        "averageScore":     avg_score,
        "avgConfidence":    avg_score,   # compat
        "thisWeek":         this_week,
        "lastActive":       last_active,
        "recentInterview":  recent_interview,
        "completedCount":   len(reports),
    }


@router.get("/history")
def get_history(user: str = Depends(get_current_user)):
    docs = list(
        interviews_collection
        .find({"userId": user})
        .sort("startedAt", -1)
        .limit(50)
    )
    return [_serialize(d) for d in docs]


@router.get("/performance-trend")
def performance_trend(user: str = Depends(get_current_user)):
    reports = list(
        reports_collection
        .find({"userId": user}, {"overall_score": 1, "technical_score": 1,
                                  "confidence_score": 1, "generatedAt": 1, "role": 1})
        .sort("generatedAt", 1)
    )
    return [
        {
            "date":       r.get("generatedAt"),
            "score":      round(r.get("overall_score", 0), 1),
            "technical":  round(r.get("technical_score", 0), 1),
            "confidence": round(r.get("confidence_score", 0), 1),
            "role":       r.get("role", ""),
        }
        for r in reports
    ]


@router.get("/recent-interviews")
def recent_interviews(user: str = Depends(get_current_user), limit: int = 5):
    docs = list(
        interviews_collection
        .find({"userId": user})
        .sort("startedAt", -1)
        .limit(limit)
    )
    return [_serialize(d) for d in docs]
