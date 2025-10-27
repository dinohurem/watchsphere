from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional
from app.models.user import User


class WatchCondition(str, Enum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"


class Watch(Document):
    brand: str = Field(..., index=True)
    model: str
    price: float
    currency: str = "USD"
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = Field(None, unique=True)
    description: Optional[str] = None
    dealer_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "watches"
        indexes = [
            "brand",
            "dealer_id",
            "serial_number",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "brand": "Rolex",
                "model": "Submariner",
                "price": 12500.00,
                "currency": "USD",
                "condition": "excellent",
                "year": 2020,
                "serial_number": "12345ABC",
                "description": "Beautiful Rolex Submariner in excellent condition"
            }
        }
