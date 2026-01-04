from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class OrderType(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderCondition(str, Enum):
    UNWORN = "Unworn"
    USED = "Used"


class OrderStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class Order(Document):
    """
    Order model for buy/sell orders in the order book.
    Each order represents a user's intent to buy or sell a specific watch model.
    """
    # Order info
    order_type: OrderType  # buy or sell

    # Watch reference (by model/reference, not specific watch)
    brand: str = Field(..., index=True)
    model: str
    reference: str = Field(..., index=True)  # Reference number (e.g., 126610LN)

    # Optional link to specific watch listing (for sell orders)
    watch_id: Optional[str] = None

    # Order details
    price: float  # User's asking/offering price
    currency: str = "EUR"
    condition: OrderCondition = OrderCondition.UNWORN

    # Location/Market
    country_code: str = Field(..., index=True)  # ISO country code (e.g., "US", "IT", "UAE")
    country_name: Optional[str] = None  # Full country name

    # User info
    user_id: str = Field(..., index=True)
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    # Status
    status: OrderStatus = OrderStatus.ACTIVE

    # Optional details
    notes: Optional[str] = None
    has_box: bool = False
    has_papers: bool = False

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Settings:
        name = "orders"
        indexes = [
            "brand",
            "reference",
            "country_code",
            "user_id",
            "order_type",
            "status",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "order_type": "sell",
                "brand": "Rolex",
                "model": "Submariner Date",
                "reference": "126610LN",
                "price": 104500,
                "currency": "EUR",
                "condition": "Unworn",
                "country_code": "US",
                "country_name": "United States",
                "user_id": "user123",
                "status": "active"
            }
        }
