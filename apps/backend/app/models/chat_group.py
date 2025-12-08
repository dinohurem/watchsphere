from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class MemberRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"


class ConversationMember(Document):
    """Tracks membership in group conversations"""
    conversation_id: str = Field(..., index=True)
    user_id: str = Field(..., index=True)
    user_name: str  # Denormalized for display
    user_email: str  # Denormalized for display
    role: MemberRole = MemberRole.MEMBER
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Settings:
        name = "conversation_members"
        indexes = [
            "conversation_id",
            "user_id",
            [("conversation_id", 1), ("user_id", 1)],  # Compound index
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "123abc",
                "user_id": "456def",
                "user_name": "John Doe",
                "user_email": "john@example.com",
                "role": "member",
                "is_active": True
            }
        }
