from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class AppSettings(Document):
    """Singleton document for global app settings."""
    key: str = Field(default="global", unique=True)
    v2_enabled: bool = False
    updated_at: Optional[datetime] = None

    class Settings:
        name = "app_settings"
        indexes = ["key"]
