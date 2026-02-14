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


class Watch(Document):
    # Basic info
    brand: str = Field(..., index=True)
    model: str
    reference: Optional[str] = None  # Reference number (e.g., 126610LN)

    # Pricing (optional — price derived from orders)
    price: float = 0
    currency: str = "EUR"

    # Condition & Details (optional — live on orders now)
    condition: Optional[WatchCondition] = None
    year: Optional[int] = None
    serial_number: Optional[str] = Field(None, unique=True)
    description: Optional[str] = None

    # New catalog fields
    collection: Optional[str] = None
    oem_references: List[str] = Field(default_factory=list)
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)

    # Images - URLs to Firebase Storage
    images: List[str] = Field(default_factory=list)  # Full-size image URLs
    image_thumbnails: List[str] = Field(default_factory=list)  # Thumbnail URLs
    image_paths: List[str] = Field(default_factory=list)  # Storage paths for deletion
    cover_image: Optional[str] = None  # Primary display image
    cover_image_thumbnail: Optional[str] = None

    # Status & Visibility
    status: WatchStatus = WatchStatus.DRAFT
    featured: bool = False

    # Ownership
    dealer_id: str = Field(..., index=True)
    dealer_name: Optional[str] = None  # Denormalized for display

    # Stats
    views: int = 0
    order_count: int = 0  # Total buy/sell orders for trending calculation

    # Market/Trending
    trending: bool = False  # Admin can manually flag watches as trending
    price_history: List[float] = Field(default_factory=list)  # Historical prices for charts
    price_change: float = 0.0  # Percentage change

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
