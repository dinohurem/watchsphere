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


class ReportStatus(str, Enum):
    OPEN = "open"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ReportedType(str, Enum):
    CONVERSATION = "conversation"
    GROUP = "group"
    USER = "user"


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


class Report(Document):
    reporter_id: str
    reporter_name: str
    reporter_email: str
    reported_type: ReportedType
    reported_id: str
    reported_name: str
    reason: str
    description: Optional[str] = None
    status: ReportStatus = ReportStatus.OPEN
    admin_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "reports"
        indexes = [
            "reporter_id",
            "reported_id",
            "status",
        ]
