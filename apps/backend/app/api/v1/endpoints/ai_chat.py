from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType, MessageType

router = APIRouter()


# Pydantic schemas
class CreateAIChatRequest(BaseModel):
    title: Optional[str] = None
    initial_message: Optional[str] = None


class AddMessageRequest(BaseModel):
    content: str
    is_ai: bool = False


class AIChatResponse(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_message: Optional[str] = None
    first_user_message: Optional[str] = None  # The first message sent by user (for display as title)
    message_count: int = 0


class AIMessageResponse(BaseModel):
    id: str
    content: str
    is_user: bool
    created_at: datetime


@router.post("/ai-chats", response_model=AIChatResponse)
async def create_ai_chat(
    request: CreateAIChatRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new AI chat conversation"""

    conversation = Conversation(
        type=ConversationType.AI_CHAT,
        title=request.title,
        participants=[str(current_user.id)],
        created_by=str(current_user.id),
        created_at=datetime.utcnow(),
    )
    await conversation.insert()

    message_count = 0
    last_message = None

    # Add initial message if provided
    if request.initial_message:
        message = Message(
            conversation_id=str(conversation.id),
            sender_id=str(current_user.id),
            content=request.initial_message,
            type=MessageType.TEXT,
            created_at=datetime.utcnow(),
        )
        await message.insert()
        message_count = 1
        last_message = request.initial_message[:100]

        # Update title from initial message if not provided
        if not request.title:
            conversation.title = request.initial_message[:50] + ("..." if len(request.initial_message) > 50 else "")
            await conversation.save()

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "last_message": last_message,
        "message_count": message_count,
    }


@router.get("/ai-chats", response_model=List[AIChatResponse])
async def list_ai_chats(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all AI chat conversations for the current user"""

    conversations = await Conversation.find(
        Conversation.type == ConversationType.AI_CHAT,
        Conversation.participants == [str(current_user.id)],
    ).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    result = []
    for conv in conversations:
        # Get message count
        msg_count = await Message.find(
            Message.conversation_id == str(conv.id)
        ).count()

        # Get last message
        last_msg = await Message.find(
            Message.conversation_id == str(conv.id)
        ).sort([("created_at", -1)]).first_or_none()

        # Get first user message (for display as title)
        first_user_msg = await Message.find(
            Message.conversation_id == str(conv.id),
            Message.sender_id != "ai_assistant",
        ).sort([("created_at", 1)]).first_or_none()

        result.append({
            "id": str(conv.id),
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "last_message": last_msg.content[:100] if last_msg else None,
            "first_user_message": first_user_msg.content if first_user_msg else None,
            "message_count": msg_count,
        })

    return result


@router.get("/ai-chats/{chat_id}", response_model=AIChatResponse)
async def get_ai_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific AI chat conversation"""

    conversation = await Conversation.get(PydanticObjectId(chat_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    # Check user has access
    if str(current_user.id) not in conversation.participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Get message count
    msg_count = await Message.find(
        Message.conversation_id == str(conversation.id)
    ).count()

    # Get last message
    last_msg = await Message.find(
        Message.conversation_id == str(conversation.id)
    ).sort([("created_at", -1)]).first_or_none()

    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "last_message": last_msg.content[:100] if last_msg else None,
        "message_count": msg_count,
    }


@router.get("/ai-chats/{chat_id}/messages", response_model=List[AIMessageResponse])
async def get_ai_chat_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Get messages from an AI chat conversation"""

    conversation = await Conversation.get(PydanticObjectId(chat_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    # Check user has access
    if str(current_user.id) not in conversation.participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    messages = await Message.find(
        Message.conversation_id == chat_id
    ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(msg.id),
            "content": msg.content,
            "is_user": msg.sender_id != "ai_assistant",
            "created_at": msg.created_at,
        }
        for msg in messages
    ]


@router.post("/ai-chats/{chat_id}/messages", response_model=AIMessageResponse)
async def add_ai_chat_message(
    chat_id: str,
    request: AddMessageRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Add a message to an AI chat conversation"""

    conversation = await Conversation.get(PydanticObjectId(chat_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    # Check user has access
    if str(current_user.id) not in conversation.participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Determine sender_id based on is_ai flag
    sender_id = "ai_assistant" if request.is_ai else str(current_user.id)

    message = Message(
        conversation_id=chat_id,
        sender_id=sender_id,
        content=request.content,
        type=MessageType.TEXT,
        created_at=datetime.utcnow(),
    )
    await message.insert()

    # Update conversation updated_at
    conversation.updated_at = datetime.utcnow()

    # Update title from first user message if not set
    if not conversation.title and not request.is_ai:
        conversation.title = request.content[:50] + ("..." if len(request.content) > 50 else "")

    await conversation.save()

    return {
        "id": str(message.id),
        "content": message.content,
        "is_user": not request.is_ai,
        "created_at": message.created_at,
    }


@router.delete("/ai-chats/{chat_id}")
async def delete_ai_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete an AI chat conversation and all its messages"""

    conversation = await Conversation.get(PydanticObjectId(chat_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )

    # Check user has access
    if str(current_user.id) not in conversation.participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Delete all messages in the conversation
    await Message.find(Message.conversation_id == chat_id).delete()

    # Delete the conversation
    await conversation.delete()

    return {"message": "Chat deleted successfully"}
