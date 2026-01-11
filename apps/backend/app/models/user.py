from beanie import Document
from pydantic import Field, EmailStr
from datetime import datetime
from enum import Enum
from typing import Optional, List


class UserRole(str, Enum):
    DEALER = "dealer"
    COLLECTOR = "collector"
    ADMIN = "admin"


class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"
    APPLE = "apple"


class User(Document):
    email: EmailStr = Field(..., unique=True)
    hashed_password: Optional[str] = None  # Optional for OAuth users
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.COLLECTOR
    verified: bool = False
    approved: bool = False  # Admin must approve before user can login
    is_active: bool = True

    # OAuth provider info
    auth_provider: AuthProvider = AuthProvider.EMAIL
    oauth_provider_id: Optional[str] = None  # Provider's user ID (Google sub, Apple sub)

    # Profile image
    profile_image_url: Optional[str] = None
    profile_image_thumbnail_url: Optional[str] = None

    # Social contact info
    whatsapp_phone: Optional[str] = None  # WhatsApp phone number
    telegram_username: Optional[str] = None  # Telegram @username

    # FCM tokens for push notifications (multiple devices)
    fcm_tokens: List[str] = Field(default_factory=list)

    # Notification preferences
    notifications_enabled: bool = True
    notify_price_changes: bool = True
    notify_buy_offers: bool = True
    notify_messages: bool = True

    # Review stats (cached for performance)
    average_rating: float = 0.0
    review_count: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = [
            "email",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "email": "dealer@watchsphere.com",
                "name": "John Doe",
                "role": "dealer",
                "verified": True,
                "approved": True,
                "is_active": True,
                "auth_provider": "email"
            }
        }
