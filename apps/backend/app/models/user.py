from beanie import Document
from pydantic import Field, EmailStr
from datetime import datetime
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    DEALER = "dealer"
    COLLECTOR = "collector"
    ADMIN = "admin"


class User(Document):
    email: EmailStr = Field(..., unique=True)
    hashed_password: str
    name: str
    role: UserRole = UserRole.COLLECTOR
    verified: bool = False
    approved: bool = False  # Admin must approve before user can login
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = [
            "email",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "email": "dealer@watchsphere.com",
                "name": "John Doe",
                "role": "dealer",
                "verified": True,
                "approved": True,
                "is_active": True
            }
        }
