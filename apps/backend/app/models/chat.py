from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"


class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"
    AI = "ai"
    AI_CHAT = "ai_chat"  # User-to-AI assistant chats


class Conversation(Document):
    type: ConversationType
    name: Optional[str] = None  # For group chats
    title: Optional[str] = None  # For AI chats - conversation title
    description: Optional[str] = None  # Group description
    avatar: Optional[str] = None  # Group avatar URL
    created_by: Optional[str] = None  # Admin who created the group
    participant_ids: List[str] = Field(default_factory=list)  # For direct chats
    participants: List[str] = Field(default_factory=list)  # User IDs participating in conversation
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    # Soft delete support - track which users have deleted the conversation
    deleted_for: List[str] = Field(default_factory=list)  # User IDs who deleted this chat
    # Track when messages should be visible from (for users who re-open after delete)
    visible_after: dict = Field(default_factory=dict)  # {user_id: datetime} - messages after this time are visible

    class Settings:
        name = "conversations"
        indexes = [
            "type",
            "created_by",
            "is_active",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "type": "group",
                "name": "Watch Enthusiasts",
                "description": "A group for watch collectors",
                "is_active": True
            }
        }


class Message(Document):
    conversation_id: str = Field(..., index=True)
    sender_id: str = Field(..., index=True)
    content: str
    type: MessageType = MessageType.TEXT
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Reply/quote fields
    reply_to_id: Optional[str] = None
    reply_to_content: Optional[str] = None
    reply_to_sender_name: Optional[str] = None
    reply_to_sender_id: Optional[str] = None

    class Settings:
        name = "messages"
        indexes = [
            "conversation_id",
            "sender_id",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": "123abc",
                "sender_id": "456def",
                "content": "Hello, I'm interested in your Rolex",
                "type": "text",
                "read": False
            }
        }
