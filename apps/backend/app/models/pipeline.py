"""Automatic generator pipeline + approval page (generator spec §1, §2)."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class UploadStatus(str, Enum):
    RECEIVED = "received"      # durably stored, not processed yet
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class PipelineUpload(Document):
    """One chat export sent by the Mac mini (``_chat.txt`` + ``<group>_Medien.zip``)."""
    group_name: str
    chat_gridfs_id: str
    media_gridfs_id: Optional[str] = None
    chat_sha256: str
    chat_bytes: int = 0
    media_bytes: int = 0
    status: UploadStatus = UploadStatus.RECEIVED
    attempts: int = 0
    error: Optional[str] = None
    # Messages newer than this watermark were processed by this upload.
    processed_from: Optional[datetime] = None
    processed_to: Optional[datetime] = None
    new_messages: int = 0
    run_ids: Dict[str, str] = Field(default_factory=dict)  # {"WTS": run_id, "WTB": run_id}
    stats: Dict[str, Any] = Field(default_factory=dict)
    received_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None

    class Settings:
        name = "pipeline_uploads"
        indexes = [
            "group_name",
            "status",
            "chat_sha256",
            [("received_at", -1)],
        ]


class PipelineGroupState(Document):
    """Per-group watermark: every export contains the whole history, so only
    messages newer than ``last_message_at`` are run through the generator."""
    group_name: str
    last_message_at: Optional[datetime] = None
    last_upload_at: Optional[datetime] = None
    uploads: int = 0

    class Settings:
        name = "pipeline_group_state"
        indexes = [IndexModel([("group_name", ASCENDING)], unique=True)]


class ReviewKind(str, Enum):
    AI_DECISION = "ai_decision"          # tab 1: imported by the AI
    UNSURE = "unsure"                    # tab 2: waiting for an admin decision
    NOT_IN_DATABASE = "not_in_database"  # tab 4 source: archive for new-watch suggestions
    DISCARDED = "discarded"              # tab 5: auto-deleted after 30 days


class ReviewStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"


class PipelineItem(Document):
    """One generator row that did not go straight into the app (or was imported by AI)."""
    kind: ReviewKind
    status: ReviewStatus = ReviewStatus.PENDING
    mode: str = "WTS"  # WTS | WTB
    group_name: Optional[str] = None
    upload_id: Optional[str] = None
    run_id: Optional[str] = None

    source_text: Optional[str] = None
    # Normalised text — identical texts are grouped on the Unsure tab.
    text_key: Optional[str] = None
    image_id: Optional[str] = None  # GridFS id in the pipeline_images bucket
    sender_phone: Optional[str] = None
    message_at: Optional[datetime] = None

    # The generator's CSV row (German headers) + its candidates.
    row: Dict[str, Any] = Field(default_factory=dict)
    candidates: List[Dict[str, Any]] = Field(default_factory=list)
    reason: Optional[str] = None  # discard reason / why it is unsure

    # AI decision (tab 1)
    ai_ws_code: Optional[str] = None
    ai_reason: Optional[str] = None
    order_id: Optional[str] = None

    # Not-in-database archive: reference/brand guessed by the generator
    guessed_reference: Optional[str] = None
    guessed_brand: Optional[str] = None

    resolution: Optional[str] = None  # picked | not_in_catalog | discarded | corrected | confirmed
    resolved_ws_code: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    # TTL: discarded rows disappear after 30 days.
    expires_at: Optional[datetime] = None

    class Settings:
        name = "pipeline_items"
        indexes = [
            [("kind", 1), ("status", 1), ("created_at", -1)],
            [("kind", 1), ("text_key", 1)],
            "guessed_reference",
            "order_id",
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]


class AliasStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AliasSuggestion(Document):
    """A new spelling found by the AI. Never added to a watch without approval."""
    alias: str
    alias_key: str  # lower-cased, whitespace-collapsed
    ws_code: str
    status: AliasStatus = AliasStatus.PENDING
    hits: int = 1  # how often the AI used this spelling
    examples: List[str] = Field(default_factory=list)  # up to 5 source texts
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Settings:
        name = "alias_suggestions"
        indexes = [
            IndexModel([("alias_key", ASCENDING), ("ws_code", ASCENDING)], unique=True),
            "status",
        ]


class PipelineReportState(Document):
    """When the last daily report was sent (one row)."""
    key: str = "daily"
    last_sent_at: Optional[datetime] = None

    class Settings:
        name = "pipeline_report_state"
