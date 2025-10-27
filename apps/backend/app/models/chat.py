from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"


class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"
    AI = "ai"


class Conversation(Document):
    type: ConversationType
    name: Optional[str] = None  # For group chats
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "conversations"

    class Config:
        json_schema_extra = {
            "example": {
                "type": "direct",
                "name": "Chat with John"
            }
        }


class Message(Document):
    conversation_id: str = Field(..., index=True)
    sender_id: str = Field(..., index=True)
    content: str
    type: MessageType = MessageType.TEXT
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
