"""
WatchAlert model for per-watch notification preferences
"""

from typing import Optional
from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field


class WatchAlert(Document):
    """User alert configuration for a specific watch variant"""

    user_id: Indexed(str)
    ws_code: Indexed(str)  # the watch variant to monitor
    notify_wts: bool = True
    notify_wtb: bool = True
    target_year: Optional[int] = None
    year_direction: str = "exactly"  # "newer", "exactly", "older"
    price_threshold: Optional[float] = None
    price_direction: str = "below"  # "below" or "above"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "watch_alerts"
        indexes = [
            "user_id",
            "ws_code",
            [("user_id", 1), ("ws_code", 1)],
        ]
