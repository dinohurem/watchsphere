from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class DisputeStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class IssueStatus(str, Enum):
    OPEN = "open"
    COMPLETED = "completed"


class Dispute(Document):
    user_id: str
    user_name: str
    user_email: str
    watch_reference: str
    watch_brand: Optional[str] = None
    watch_model: Optional[str] = None
    description: str
    status: DisputeStatus = DisputeStatus.OPEN
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "disputes"
        indexes = [
            "user_id",
            "status",
        ]


class Issue(Document):
    user_id: str
    user_name: str
    user_email: str
    title: str
    description: str
    status: IssueStatus = IssueStatus.OPEN
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "issues"
        indexes = [
            "user_id",
            "status",
        ]
