from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class ActivityType(str, Enum):
    # User events
    USER_REGISTERED = "user_registered"
    USER_APPROVED = "user_approved"
    USER_REJECTED = "user_rejected"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"

    # Watch events
    WATCH_LISTED = "watch_listed"
    WATCH_UPDATED = "watch_updated"
    WATCH_DELETED = "watch_deleted"
    WATCH_SOLD = "watch_sold"

    # Order events
    BUY_ORDER_PLACED = "buy_order_placed"
    SELL_ORDER_PLACED = "sell_order_placed"
    ORDER_CONFIRMED = "order_confirmed"
    ORDER_CANCELLED = "order_cancelled"
    TRANSACTION_COMPLETED = "transaction_completed"

    # Watchlist events
    WATCHLIST_ADDED = "watchlist_added"
    WATCHLIST_REMOVED = "watchlist_removed"

    # Chat events
    CONVERSATION_STARTED = "conversation_started"
    GROUP_CREATED = "group_created"
    AI_CHAT_SESSION = "ai_chat_session"

    # Admin events
    ADMIN_ACTION = "admin_action"


class EntityType(str, Enum):
    USER = "user"
    WATCH = "watch"
    ORDER = "order"
    TRANSACTION = "transaction"
    WATCHLIST = "watchlist"
    CONVERSATION = "conversation"
    NEWS = "news"
    BILLING = "billing"


class ActivityLog(Document):
    """Activity log for tracking major events in the system"""
    # Actor
    user_id: Optional[str] = Field(None, index=True)
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    # Activity details
    activity_type: ActivityType = Field(..., index=True)
    description: str

    # Related entity
    entity_type: Optional[EntityType] = None
    entity_id: Optional[str] = None

    # Additional context
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "activity_logs"
        indexes = [
            "user_id",
            "activity_type",
            "entity_type",
            "created_at",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123abc",
                "user_name": "John Doe",
                "user_email": "john@example.com",
                "activity_type": "watch_listed",
                "description": "Listed Rolex Submariner for $12,500",
                "entity_type": "watch",
                "entity_id": "456def",
                "metadata": {"brand": "Rolex", "model": "Submariner", "price": 12500}
            }
        }
