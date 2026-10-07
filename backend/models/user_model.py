# backend/models/user_model.py
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


class EducationItem(BaseModel):
    degree: str
    institution: str
    year: str


class ExperienceItem(BaseModel):
    title: str
    company: str
    duration: str
    description: str


class ProjectItem(BaseModel):
    title: str
    tech: List[str]
    description: str


class UserSchema(BaseModel):
    clerkId: str
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    role: Optional[str] = ""
    college: Optional[str] = ""
    degree: Optional[str] = ""
    graduationYear: Optional[str] = ""
    areasOfInterest: List[str] = []
    skills: List[str] = []
    targetCompanies: List[str] = []
    preferredInterviewTypes: List[str] = []
    education: List[EducationItem] = []
    experience: List[ExperienceItem] = []
    projects: List[ProjectItem] = []
    groq_api_key: Optional[str] = None
    profileCompleted: bool = False
    createdAt: datetime = datetime.utcnow()
