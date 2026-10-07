# backend/routes/user.py
from fastapi import APIRouter, Depends, HTTPException
from backend.auth import get_current_user, get_current_user_full
from backend.database import users_collection
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/user", tags=["user"])


class UserProfileUpdate(BaseModel):
    name:                    Optional[str]       = None
    phone:                   Optional[str]       = None
    linkedin:                Optional[str]       = None
    github:                  Optional[str]       = None
    role:                    Optional[str]       = None
    college:                 Optional[str]       = None
    degree:                  Optional[str]       = None
    graduationYear:          Optional[str]       = None
    areasOfInterest:         Optional[List[str]] = None
    skills:                  Optional[List[str]] = None
    targetCompanies:         Optional[List[str]] = None
    preferredInterviewTypes: Optional[List[str]] = None
    groq_api_key:            Optional[str]       = None


@router.get("/profile")
def get_profile(user_data: dict = Depends(get_current_user_full)):
    return user_data


@router.put("/profile")
def update_profile(
    profile_data: UserProfileUpdate,
    user: str = Depends(get_current_user),
):
    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    update_data["updatedAt"]       = datetime.utcnow().isoformat()
    update_data["profileCompleted"] = True

    result = users_collection.update_one({"clerkId": user}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated = users_collection.find_one({"clerkId": user})
    updated["_id"] = str(updated["_id"])
    return {"message": "Profile updated successfully", "user": updated}


@router.delete("/profile")
def delete_profile(user: str = Depends(get_current_user)):
    result = users_collection.update_one(
        {"clerkId": user},
        {"$set": {"deleted": True, "deletedAt": datetime.utcnow().isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Profile deleted successfully"}


@router.get("/check-profile")
def check_profile_completion(user: str = Depends(get_current_user)):
    user_data = users_collection.find_one({"clerkId": user})
    if not user_data:
        return {"profileCompleted": False}

    essential  = ["name", "college", "degree", "graduationYear", "role"]
    completed  = all(user_data.get(f) for f in essential)
    return {
        "profileCompleted": completed,
        "hasName":      bool(user_data.get("name")),
        "hasEducation": bool(user_data.get("college") and user_data.get("degree")),
        "hasRole":      bool(user_data.get("role")),
    }
