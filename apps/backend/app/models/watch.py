from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List
from app.models.user import User


class WatchCondition(str, Enum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    NOS = "nos"  # New Old Stock


class WatchStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SOLD = "sold"
    RESERVED = "reserved"
    ARCHIVED = "archived"


class Watch(Document):
    # Basic info
    brand: str = Field(..., index=True)
    model: str
    reference: Optional[str] = None  # Reference number (e.g., 126610LN)

    # Pricing
    price: float
    currency: str = "USD"

    # Condition & Details
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = Field(None, unique=True)
    description: Optional[str] = None

    # Images
    images: List[str] = Field(default_factory=list)  # URLs to images
    cover_image: Optional[str] = None  # Primary display image

    # Status & Visibility
    status: WatchStatus = WatchStatus.DRAFT
    featured: bool = False

    # Ownership
    dealer_id: str = Field(..., index=True)
    dealer_name: Optional[str] = None  # Denormalized for display

    # Stats
    views: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Settings:
        name = "watches"
        indexes = [
            "brand",
            "dealer_id",
            "serial_number",
            "status",
            "reference",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "brand": "Rolex",
                "model": "Submariner",
                "reference": "126610LN",
                "price": 12500.00,
                "currency": "USD",
                "condition": "excellent",
                "year": 2020,
                "serial_number": "12345ABC",
                "description": "Beautiful Rolex Submariner in excellent condition",
                "images": ["https://example.com/image1.jpg"],
                "status": "active"
            }
        }
