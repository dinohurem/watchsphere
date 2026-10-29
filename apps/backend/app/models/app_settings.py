from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class AppSettings(Document):
    """Singleton document for global app settings."""
    key: str = Field(default="global", unique=True)
    v2_enabled: bool = False
    # Off means every signed-in user gets full access and no client shows the
    # upgrade prompt. Billing records and subscriptions are kept either way.
    paywall_enabled: bool = False
    updated_at: Optional[datetime] = None

    class Settings:
        name = "app_settings"
        indexes = ["key"]

    @classmethod
    async def get_global(cls) -> "AppSettings":
        """Get the global settings singleton, creating it if it doesn't exist."""
        settings = await cls.find_one(cls.key == "global")
        if not settings:
            settings = cls(key="global")
            await settings.insert()
        return settings
