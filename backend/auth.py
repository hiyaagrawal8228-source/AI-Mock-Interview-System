# backend/auth.py
from fastapi import HTTPException, Header
from backend.database import users_collection
from typing import Optional
from datetime import datetime


def get_current_user(
    x_user_id: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
) -> str:
    """
    Extracts Clerk user from request headers sent by the React frontend.
    Auto-creates a MongoDB user document on first login.
    Returns: clerkId string
    """
    if not x_user_id or not x_user_email:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in.",
        )

    user = users_collection.find_one({"clerkId": x_user_id})

    if not user:
        new_user = {
            "clerkId":                 x_user_id,
            "email":                   x_user_email,
            "name":                    "",
            "phone":                   "",
            "linkedin":                "",
            "github":                  "",
            "role":                    "",
            "college":                 "",
            "degree":                  "",
            "graduationYear":          "",
            "areasOfInterest":         [],
            "skills":                  [],
            "education":               [],
            "experience":              [],
            "projects":                [],
            "targetCompanies":         [],
            "preferredInterviewTypes": [],
            "profileCompleted":        False,
            "groq_api_key":            None,
            "createdAt":               datetime.utcnow().isoformat(),
        }
        users_collection.insert_one(new_user)

    return x_user_id


def get_current_user_full(
    x_user_id: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
) -> dict:
    """Returns the full MongoDB user document."""
    clerk_id = get_current_user(x_user_id, x_user_email)
    user = users_collection.find_one({"clerkId": clerk_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    return user
