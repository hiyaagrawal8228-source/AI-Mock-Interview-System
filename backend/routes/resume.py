# backend/routes/resume.py
"""
Resume management with full versioning.
Fixes:
 - Don't fail upload if LLM parse fails (use fallback data)
 - Proper error messages
 - Handle _parsed_by field from fallback
"""

import os
import tempfile
import logging
from datetime import datetime
from pymongo import DESCENDING

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from bson import ObjectId

from backend.auth import get_current_user
from backend.database import users_collection, resumes_collection
from backend.resume_parser import parse_resume_with_llm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["resume"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}
MAX_FILE_SIZE_MB   = 10


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


def _get_next_version(user_id: str) -> int:
    latest = resumes_collection.find_one(
        {"userId": user_id},
        sort=[("version", DESCENDING)]
    )
    return (latest["version"] + 1) if latest else 1


@router.post("/upload")
async def upload_resume(
    resume: UploadFile = File(...),
    user: str = Depends(get_current_user),
):
    """
    Upload a new resume version.
    - Parses with LLM (falls back to regex if LLM fails)
    - Never rejects a valid file due to parse failure
    """
    # Validate extension
    ext = os.path.splitext(resume.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read + size check
    content = await resume.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max {MAX_FILE_SIZE_MB} MB."
        )

    if len(content) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty.")

    # Write to temp file and parse
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parsed = parse_resume_with_llm(tmp_path)
    except Exception as e:
        logger.error(f"Resume parse error: {e}")
        parsed = {
            "name": "", "email": "", "phone": "", "role": "",
            "skills": [], "experience": [], "education": [], "projects": [],
            "_parsed_by": "error_fallback"
        }
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    # Don't reject — always store whatever we got
    # But surface a warning if parsing completely failed
    parse_warning = None
    if parsed.get("error"):
        parse_warning = parsed["error"]
        # Clear the error key so it doesn't pollute the doc
        parsed.pop("error", None)

    # Deactivate previous resumes
    resumes_collection.update_many(
        {"userId": user, "isActive": True},
        {"$set": {"isActive": False}}
    )

    version = _get_next_version(user)

    doc = {
        "userId":       user,
        "version":      version,
        "isActive":     True,
        "fileName":     resume.filename or "resume",
        "fileSizeMB":   round(size_mb, 2),
        "uploadedAt":   datetime.utcnow().isoformat(),
        "parsedBy":     parsed.pop("_parsed_by", "llm"),
        "name":         parsed.get("name", ""),
        "email":        parsed.get("email", ""),
        "phone":        parsed.get("phone", ""),
        "role":         parsed.get("role", ""),
        "skills":       parsed.get("skills", []),
        "experience":   parsed.get("experience", []),
        "education":    parsed.get("education", []),
        "projects":     parsed.get("projects", []),
        "rawParsed":    parsed,
    }
    result = resumes_collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    # Sync skills/role to user profile
    update_fields: dict = {"updatedAt": datetime.utcnow().isoformat()}
    if parsed.get("skills"):
        update_fields["skills"] = parsed["skills"]
    if parsed.get("role"):
        update_fields["role"] = parsed["role"]
    if update_fields:
        users_collection.update_one({"clerkId": user}, {"$set": update_fields})

    response = {
        "message":     f"Resume v{version} uploaded and set as active",
        "version":     version,
        "resume_id":   doc["_id"],
        "parsed_data": parsed,
    }
    if parse_warning:
        response["parse_warning"] = parse_warning

    return response


@router.get("/list")
def list_resumes(user: str = Depends(get_current_user)):
    docs = list(
        resumes_collection
        .find({"userId": user}, {"rawParsed": 0})
        .sort("version", DESCENDING)
    )
    return [_serialize(d) for d in docs]


@router.get("/active")
def get_active_resume(user: str = Depends(get_current_user)):
    doc = resumes_collection.find_one({"userId": user, "isActive": True})
    if not doc:
        raise HTTPException(status_code=404, detail="No active resume. Please upload one.")
    return _serialize(doc)


@router.put("/{resume_id}/activate")
def activate_resume(resume_id: str, user: str = Depends(get_current_user)):
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    target = resumes_collection.find_one({"_id": oid, "userId": user})
    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")

    resumes_collection.update_many({"userId": user}, {"$set": {"isActive": False}})
    resumes_collection.update_one({"_id": oid},      {"$set": {"isActive": True}})

    return {"message": f"Resume v{target['version']} is now active"}


@router.delete("/{resume_id}")
def delete_resume(resume_id: str, user: str = Depends(get_current_user)):
    try:
        oid = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    target = resumes_collection.find_one({"_id": oid, "userId": user})
    if not target:
        raise HTTPException(status_code=404, detail="Resume not found")

    total = resumes_collection.count_documents({"userId": user})
    if total <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your only resume. Upload a new one first."
        )

    resumes_collection.delete_one({"_id": oid})

    if target.get("isActive"):
        latest = resumes_collection.find_one(
            {"userId": user},
            sort=[("version", DESCENDING)]
        )
        if latest:
            resumes_collection.update_one(
                {"_id": latest["_id"]},
                {"$set": {"isActive": True}}
            )

    return {"message": "Resume deleted successfully"}
