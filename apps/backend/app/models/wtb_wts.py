from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class GenerationMode(str, Enum):
    WTS = "wts"
    WTB = "wtb"


class RunStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class WtbWtsRun(Document):
    """A single WTS/WTB file generation run"""
    filename: str
    group_name: str
    mode: GenerationMode
    reference_month: int  # 1-12
    reference_year: int   # e.g. 2026

    status: RunStatus = RunStatus.PENDING
    error_message: Optional[str] = None

    # GridFS file IDs for generated CSVs (expire after 30 min)
    matched_csv_gridfs_id: Optional[str] = None
    needs_review_csv_gridfs_id: Optional[str] = None
    not_in_database_csv_gridfs_id: Optional[str] = None
    suggested_csv_gridfs_id: Optional[str] = None
    # Rows that could only be assigned correctly through image analysis
    matched_via_image_csv_gridfs_id: Optional[str] = None
    files_expire_at: Optional[datetime] = None

    # Stats
    total_messages: int = 0
    detected_posts: int = 0
    matched_count: int = 0
    needs_review_count: int = 0
    not_in_database_count: int = 0
    fuzzy_matched_count: int = 0
    ai_matched_count: int = 0
    suggested_additions_count: int = 0
    # Image-analysis layer stats
    matched_via_image_count: int = 0
    image_analyzed_count: int = 0
    image_enriched_count: int = 0

    # Progress tracking
    progress_percent: int = 0
    progress_stage: str = ""
    progress_detail: str = ""

    # Admin tracking
    imported_by: str = Field(..., index=True)
    imported_by_name: str

    # If this is a reprocess, link to the original run
    reprocessed_from: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Settings:
        name = "wtb_wts_runs"
        indexes = [
            "imported_by",
            "status",
            "created_at",
            "mode",
        ]
