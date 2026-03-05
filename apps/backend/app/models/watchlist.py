from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class WatchlistItemType(str, Enum):
    WANT_TO_BUY = "want_to_buy"
    WANT_TO_SELL = "want_to_sell"
    WATCHING = "watching"


class WatchlistRecord(Document):
    """User watchlist records for tracking watches they're interested in"""
    user_id: str = Field(..., index=True)
    user_name: str  # Denormalized
    user_email: str  # Denormalized

    # Item type
    item_type: WatchlistItemType = WatchlistItemType.WATCHING

    # Watch details (can be linked to a specific watch or just brand/model)
    watch_id: Optional[str] = None  # Link to specific watch listing
    brand: str
    model: str
    reference: Optional[str] = None
    ws_code: Optional[str] = None

    # Price tracking
    target_price: Optional[float] = None
    currency: str = "USD"
    price_alert_enabled: bool = False

    # Notes
    notes: Optional[str] = None

    # Status
    is_active: bool = True

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "watchlist_records"
        indexes = [
            "user_id",
            "item_type",
            "brand",
            "is_active",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123abc",
                "user_name": "John Doe",
                "user_email": "john@example.com",
                "item_type": "want_to_buy",
                "brand": "Rolex",
                "model": "Submariner",
                "reference": "126610LN",
                "target_price": 12000,
                "currency": "USD",
                "price_alert_enabled": True,
                "notes": "Looking for black dial version"
            }
        }
