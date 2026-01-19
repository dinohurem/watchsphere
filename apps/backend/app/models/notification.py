"""
Notification model for storing user notifications
"""

from typing import Optional
from datetime import datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field


class NotificationType(str, Enum):
    """Types of notifications"""
    NEW_OFFER = "new_offer"  # Buy order placed on user's listing
    PRICE_ALERT_UP = "price_alert_up"  # Price increased alert
    PRICE_ALERT_DOWN = "price_alert_down"  # Price decreased alert
    OFFER_ACCEPTED = "offer_accepted"  # User's offer was accepted
    OFFER_REJECTED = "offer_rejected"  # User's offer was rejected
    NEW_MESSAGE = "new_message"  # New direct message
    GROUP_MESSAGE = "group_message"  # New group message
    LISTING_SOLD = "listing_sold"  # User's listing was sold
    WATCHLIST_ALERT = "watchlist_alert"  # Watchlist item update
    BUY_ORDER_OFFER = "buy_order_offer"  # New listing matches buyer's bid
    PRICE_UNDERCUT = "price_undercut"  # Another seller listed at lower price


class Notification(Document):
    """User notification model"""

    # Core fields
    user_id: Indexed(str)  # The user who receives this notification
    type: NotificationType
    title: str
    body: str

    # Reference data for navigation
    reference: Optional[str] = None  # Watch reference (e.g., "126610LN")
    order_id: Optional[str] = None  # Related order ID for navigation
    conversation_id: Optional[str] = None  # Related conversation ID

    # Additional metadata
    price: Optional[float] = None  # Price if applicable
    currency: str = "EUR"
    from_user_id: Optional[str] = None  # User who triggered the notification
    from_user_name: Optional[str] = None
    from_user_avatar: Optional[str] = None

    # Status
    is_read: bool = False

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None

    class Settings:
        name = "notifications"
        indexes = [
            "user_id",
            "type",
            "is_read",
            "created_at",
        ]
