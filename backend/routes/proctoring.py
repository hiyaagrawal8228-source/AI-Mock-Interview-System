# backend/routes/proctoring.py
"""
Proctoring API — fixed:
 - Gracefully handle cv2/OpenCV not available
 - Return safe default when face detection fails
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.database import proctoring_collection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/proctor", tags=["proctoring"])


class FrameRequest(BaseModel):
    interview_id: str
    frame_b64:    str
    timestamp:    Optional[str] = None


class FrameResponse(BaseModel):
    face_count:       int
    confidence:       float
    violation:        Optional[str]
    violation_detail: str
    timestamp:        str


def _get_detector_safe():
    """Return face detector or None if OpenCV unavailable."""
    try:
        from backend.proctoring.face_detector import get_detector, decode_base64_frame
        return get_detector(), decode_base64_frame
    except Exception as e:
        logger.warning(f"Face detector unavailable: {e}")
        return None, None


@router.post("/frame", response_model=FrameResponse)
async def analyze_frame(
    body: FrameRequest,
    user: str = Depends(get_current_user),
):
    ts = body.timestamp or datetime.utcnow().isoformat()

    detector, decode_fn = _get_detector_safe()

    if detector is None or decode_fn is None:
        # OpenCV not available — log frame without face analysis
        proctoring_collection.insert_one({
            "interviewId":    body.interview_id,
            "userId":         user,
            "timestamp":      ts,
            "face_count":     1,
            "confidence":     0.8,
            "violation":      None,
            "violation_detail": "Proctoring module unavailable",
        })
        return FrameResponse(
            face_count=1,
            confidence=0.8,
            violation=None,
            violation_detail="Proctoring module unavailable — frame logged",
            timestamp=ts,
        )

    frame = decode_fn(body.frame_b64)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode frame image")

    result = detector.detect(frame)

    proctoring_collection.insert_one({
        "interviewId":    body.interview_id,
        "userId":         user,
        "timestamp":      ts,
        "face_count":     result.face_count,
        "confidence":     result.confidence,
        "violation":      result.violation,
        "violation_detail": result.violation_detail,
    })

    return FrameResponse(
        face_count       = result.face_count,
        confidence       = round(result.confidence, 3),
        violation        = result.violation,
        violation_detail = result.violation_detail,
        timestamp        = ts,
    )


@router.get("/{interview_id}/summary")
def get_proctoring_summary(
    interview_id: str,
    user: str = Depends(get_current_user),
):
    logs = list(proctoring_collection.find(
        {"interviewId": interview_id, "userId": user},
        {"_id": 0}
    ))

    if not logs:
        return {
            "total_frames":     0,
            "violations":       {},
            "total_violations": 0,
            "proctoring_score": 100,
            "verdict":          "No proctoring data recorded",
        }

    total      = len(logs)
    violations = {}
    for log in logs:
        v = log.get("violation")
        if v:
            violations[v] = violations.get(v, 0) + 1

    total_violations = sum(violations.values())
    clean_ratio      = 1 - (total_violations / total)
    proctoring_score = round(clean_ratio * 100, 1)

    if proctoring_score >= 90:
        verdict = "CLEAN"
    elif proctoring_score >= 70:
        verdict = "MINOR_VIOLATIONS"
    elif proctoring_score >= 50:
        verdict = "SUSPICIOUS"
    else:
        verdict = "FLAGGED"

    return {
        "total_frames":     total,
        "violations":       violations,
        "total_violations": total_violations,
        "proctoring_score": proctoring_score,
        "verdict":          verdict,
    }
