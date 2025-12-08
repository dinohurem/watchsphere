from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class ImportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class WhatsAppImport(Document):
    """WhatsApp chat import records"""
    filename: str
    group_name: str

    # Import status
    status: ImportStatus = ImportStatus.PENDING
    error_message: Optional[str] = None

    # Stats
    total_messages: int = 0
    extracted_watches: int = 0

    # Admin who imported
    imported_by: str = Field(..., index=True)
    imported_by_name: str

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "whatsapp_imports"
        indexes = [
            "imported_by",
            "status",
            "created_at",
        ]


class WhatsAppMessage(Document):
    """Individual messages from WhatsApp import"""
    import_id: str = Field(..., index=True)

    timestamp: datetime
    sender: str
    content: str
    has_media: bool = False
    media_type: Optional[str] = None  # image, video, etc.

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "whatsapp_messages"
        indexes = [
            "import_id",
            "timestamp",
            "sender",
        ]


class ExtractedWatchListing(Document):
    """Watch listings extracted from WhatsApp messages"""
    import_id: str = Field(..., index=True)
    message_id: Optional[str] = None

    # Watch info
    brand: Optional[str] = None
    reference: Optional[str] = None
    model: Optional[str] = None

    # Pricing
    price: Optional[float] = None
    currency: str = "USD"

    # Details
    condition: Optional[str] = None
    seller_name: Optional[str] = None
    raw_text: str  # Original message text

    # Embedding for semantic search
    embedding: Optional[List[float]] = None

    # Timestamps
    message_timestamp: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "extracted_watch_listings"
        indexes = [
            "import_id",
            "brand",
            "reference",
        ]
