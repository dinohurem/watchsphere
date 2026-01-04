from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType, MessageType
from app.services.ai_chat import generate_ai_response

router = APIRouter()


# Request/Response Models
class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: Optional[str] = None
    content: str
    type: MessageType
    is_ai: bool
    read: bool
    created_at: datetime


class ConversationResponse(BaseModel):
    id: str
    type: ConversationType
    name: Optional[str] = None
    participant_ids: List[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0


class AIConversationCreate(BaseModel):
    initial_message: Optional[str] = None


class AIChatRequest(BaseModel):
    message: str


class AIChatResponse(BaseModel):
    user_message: MessageResponse
    ai_response: MessageResponse


# ============== AI CHAT ENDPOINTS ==============

@router.post("/ai/start", response_model=ConversationResponse)
async def start_ai_conversation(
    data: AIConversationCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Start a new AI chat conversation"""

    # Create AI conversation
    conversation = Conversation(
        type=ConversationType.AI,
        name="WatchSphere AI Assistant",
        participant_ids=[str(current_user.id), "ai_assistant"],
        is_active=True,
        created_at=datetime.utcnow(),
    )
    await conversation.insert()

    # If initial message provided, process it
    last_message = None
    if data.initial_message:
        # Save user message
        user_msg = Message(
            conversation_id=str(conversation.id),
            sender_id=str(current_user.id),
            content=data.initial_message,
            type=MessageType.TEXT,
            read=True,
            created_at=datetime.utcnow(),
        )
        await user_msg.insert()

        # Generate AI response
        ai_response_text = await generate_ai_response(
            user_message=data.initial_message,
            conversation_history=[],
            include_market_context=True,
        )

        # Save AI response
        ai_msg = Message(
            conversation_id=str(conversation.id),
            sender_id="ai_assistant",
            content=ai_response_text,
            type=MessageType.TEXT,
            read=False,
            created_at=datetime.utcnow(),
        )
        await ai_msg.insert()

        last_message = {
            "id": str(ai_msg.id),
            "conversation_id": str(conversation.id),
            "sender_id": "ai_assistant",
            "sender_name": "WatchSphere AI",
            "content": ai_response_text,
            "type": MessageType.TEXT,
            "is_ai": True,
            "read": False,
            "created_at": ai_msg.created_at,
        }

        # Update conversation
        conversation.updated_at = datetime.utcnow()
        await conversation.save()

    return {
        "id": str(conversation.id),
        "type": conversation.type,
        "name": conversation.name,
        "participant_ids": conversation.participant_ids,
        "is_active": conversation.is_active,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "last_message": last_message,
        "unread_count": 1 if last_message else 0,
    }


@router.post("/ai/{conversation_id}/message", response_model=AIChatResponse)
async def send_ai_message(
    conversation_id: str,
    data: AIChatRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Send a message to the AI assistant"""

    # Get conversation
    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.type != ConversationType.AI:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is not an AI conversation"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Save user message
    user_msg = Message(
        conversation_id=conversation_id,
        sender_id=str(current_user.id),
        content=data.message,
        type=MessageType.TEXT,
        read=True,
        created_at=datetime.utcnow(),
    )
    await user_msg.insert()

    # Get conversation history
    history_messages = await Message.find(
        Message.conversation_id == conversation_id
    ).sort([("created_at", 1)]).limit(20).to_list()

    conversation_history = [
        {
            "content": msg.content,
            "is_ai": msg.sender_id == "ai_assistant",
        }
        for msg in history_messages
    ]

    # Generate AI response
    ai_response_text = await generate_ai_response(
        user_message=data.message,
        conversation_history=conversation_history,
        include_market_context=True,
    )

    # Save AI response
    ai_msg = Message(
        conversation_id=conversation_id,
        sender_id="ai_assistant",
        content=ai_response_text,
        type=MessageType.TEXT,
        read=False,
        created_at=datetime.utcnow(),
    )
    await ai_msg.insert()

    # Update conversation
    conversation.updated_at = datetime.utcnow()
    await conversation.save()

    return {
        "user_message": {
            "id": str(user_msg.id),
            "conversation_id": conversation_id,
            "sender_id": str(current_user.id),
            "sender_name": current_user.name,
            "content": data.message,
            "type": MessageType.TEXT,
            "is_ai": False,
            "read": True,
            "created_at": user_msg.created_at,
        },
        "ai_response": {
            "id": str(ai_msg.id),
            "conversation_id": conversation_id,
            "sender_id": "ai_assistant",
            "sender_name": "WatchSphere AI",
            "content": ai_response_text,
            "type": MessageType.TEXT,
            "is_ai": True,
            "read": False,
            "created_at": ai_msg.created_at,
        },
    }


@router.get("/ai/conversations", response_model=List[ConversationResponse])
async def list_ai_conversations(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """List user's AI chat conversations"""

    conversations = await Conversation.find(
        Conversation.type == ConversationType.AI,
        {"participant_ids": str(current_user.id)},
    ).sort([("updated_at", -1)]).skip(skip).limit(limit).to_list()

    result = []
    for conv in conversations:
        # Get last message
        last_msg = await Message.find(
            Message.conversation_id == str(conv.id)
        ).sort([("created_at", -1)]).first_or_none()

        # Get unread count
        unread_count = await Message.find(
            Message.conversation_id == str(conv.id),
            Message.sender_id == "ai_assistant",
            Message.read == False,
        ).count()

        last_message = None
        if last_msg:
            last_message = {
                "id": str(last_msg.id),
                "conversation_id": str(conv.id),
                "sender_id": last_msg.sender_id,
                "sender_name": "WatchSphere AI" if last_msg.sender_id == "ai_assistant" else current_user.name,
                "content": last_msg.content,
                "type": last_msg.type,
                "is_ai": last_msg.sender_id == "ai_assistant",
                "read": last_msg.read,
                "created_at": last_msg.created_at,
            }

        result.append({
            "id": str(conv.id),
            "type": conv.type,
            "name": conv.name,
            "participant_ids": conv.participant_ids,
            "is_active": conv.is_active,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "last_message": last_message,
            "unread_count": unread_count,
        })

    return result


@router.get("/ai/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_ai_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Get messages from an AI conversation"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    messages = await Message.find(
        Message.conversation_id == conversation_id
    ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    # Mark AI messages as read
    for msg in messages:
        if msg.sender_id == "ai_assistant" and not msg.read:
            msg.read = True
            await msg.save()

    return [
        {
            "id": str(msg.id),
            "conversation_id": conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": "WatchSphere AI" if msg.sender_id == "ai_assistant" else current_user.name,
            "content": msg.content,
            "type": msg.type,
            "is_ai": msg.sender_id == "ai_assistant",
            "read": msg.read,
            "created_at": msg.created_at,
        }
        for msg in messages
    ]


@router.delete("/ai/{conversation_id}")
async def delete_ai_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Delete an AI conversation"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Delete all messages
    await Message.find(Message.conversation_id == conversation_id).delete()

    # Delete conversation
    await conversation.delete()

    return {"message": "Conversation deleted successfully"}
