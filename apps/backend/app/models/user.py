from beanie import Document
from pydantic import Field, EmailStr
from pymongo import IndexModel, ASCENDING
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
    notifications_enabled: bool = True  # Push notifications master toggle
    email_notifications_enabled: bool = True  # Email notifications master toggle
    notify_price_changes: bool = True  # Price alerts
    notify_buy_offers: bool = True  # New buy order offers
    notify_messages: bool = True  # Chat messages
    # Redesign v3 (P4): "WTS & WTB alerts" toggle – alert matches create Activity entries + push
    notify_alert_matches: bool = True

    # Redesign v3 (0.2): one app currency, synced across devices (EUR, HKD, AED, GBP, CHF,
    # USD, CNY, JPY, SGD). None until the app sends the region default.
    preferred_currency: Optional[str] = None

    # Redesign v3 (13): not used yet; unique when set, introduced with Trade.
    username: Optional[str] = None

    # Redesign v3 (H1): last opened references, newest first (max 5 WS codes).
    recently_viewed: List[str] = Field(default_factory=list)

    # Review stats (cached for performance)
    average_rating: float = 0.0
    review_count: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "users"
        indexes = [
            "email",
            # unique only among users that actually have a username
            IndexModel(
                [("username", ASCENDING)],
                name="username_unique",
                unique=True,
                partialFilterExpression={"username": {"$type": "string"}},
            ),
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
