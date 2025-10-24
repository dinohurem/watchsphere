from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType, MessageType
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


# Pydantic schemas
class MessageCreate(BaseModel):
    content: str
    type: MessageType = MessageType.TEXT


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    type: MessageType
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    type: ConversationType
    name: str | None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """List user's conversations"""
    # Simplified: return all conversations
    # In production, filter by user participation
    conversations = db.query(Conversation).all()
    return conversations


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
def create_conversation(
    type: ConversationType,
    name: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new conversation"""
    conversation = Conversation(
        id=str(uuid.uuid4()),
        type=type,
        name=name,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get messages in a conversation"""
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return messages


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
def send_message(
    conversation_id: str,
    message_in: MessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Send a message to a conversation"""
    # Check if conversation exists
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=message_in.content,
        type=message_in.type,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
