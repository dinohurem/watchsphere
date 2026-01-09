from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

from app.models.watchlist import WatchlistItemType


class DefaultWatchlistItem(Document):
    """Default watchlist items that are assigned to new users upon registration"""
    # Watch details
    brand: str
    model: str
    reference: Optional[str] = None

    # Image URL (first/primary image displayed to users)
    image_url: Optional[str] = None

    # Item type (default to watching for new users)
    item_type: WatchlistItemType = WatchlistItemType.WATCHING

    # Optional target price info
    target_price: Optional[float] = None
    currency: str = "EUR"

    # Notes/description for the default item
    notes: Optional[str] = None

    # Whether this item is active and should be assigned to new users
    is_active: bool = True

    # Order for display (lower = first)
    display_order: int = 0

    # Created by admin
    created_by_id: str
    created_by_name: str

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "default_watchlist_items"
        indexes = [
            "brand",
            "is_active",
            "display_order",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "brand": "Rolex",
                "model": "Submariner",
                "reference": "126610LN",
                "item_type": "watching",
                "target_price": 12000,
                "currency": "EUR",
                "notes": "Popular entry-level luxury watch",
                "is_active": True,
                "display_order": 1,
                "created_by_id": "admin123",
                "created_by_name": "Admin User"
            }
        }
