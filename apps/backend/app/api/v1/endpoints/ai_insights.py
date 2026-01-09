from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType

router = APIRouter()


class AIConversationResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    title: Optional[str] = None
    message_count: int
    created_at: datetime
    last_message_at: Optional[datetime] = None


class AIMessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: Optional[str] = None
    content: str
    is_ai: bool
    created_at: datetime


@router.get("/admin/insights/ai-chats", response_model=List[AIConversationResponse])
async def admin_list_ai_chats(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
    user_id: Optional[str] = None,
    days: Optional[int] = None,
) -> Any:
    """List all AI chat conversations (Admin only)"""

    query_conditions = [Conversation.type == ConversationType.AI_CHAT]

    if user_id:
        query_conditions.append(Conversation.participants.contains([user_id]))
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query_conditions.append(Conversation.created_at >= cutoff)

    conversations = await Conversation.find(
        *query_conditions
    ).sort([("updated_at", -1)]).skip(skip).limit(limit).to_list()

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

        # Get user info
        user_name = None
        user_email = None
        user_id_val = None

        if conv.participants:
            user_id_val = conv.participants[0] if conv.participants else None
            if user_id_val:
                user = await User.get(PydanticObjectId(user_id_val))
                if user:
                    user_name = user.name
                    user_email = user.email

        result.append({
            "id": str(conv.id),
            "user_id": user_id_val or "",
            "user_name": user_name,
            "user_email": user_email,
            "title": conv.title,
            "message_count": msg_count,
            "created_at": conv.created_at,
            "last_message_at": last_msg.created_at if last_msg else None,
        })

    return result


@router.get("/admin/insights/ai-chats/{conversation_id}/messages", response_model=List[AIMessageResponse])
async def admin_get_ai_chat_messages(
    conversation_id: str,
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Get messages from an AI chat conversation (Admin only)"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if conversation.type != ConversationType.AI_CHAT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is not an AI chat conversation"
        )

    messages = await Message.find(
        Message.conversation_id == conversation_id
    ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    result = []
    for msg in messages:
        sender_name = None
        is_ai = msg.sender_id == "ai_assistant"

        if not is_ai:
            user = await User.get(PydanticObjectId(msg.sender_id))
            if user:
                sender_name = user.name

        result.append({
            "id": str(msg.id),
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": sender_name if not is_ai else "AI Assistant",
            "content": msg.content,
            "is_ai": is_ai,
            "created_at": msg.created_at,
        })

    return result


@router.get("/admin/insights/ai-chats/stats")
async def admin_ai_chat_stats(
    current_admin: User = Depends(get_current_admin_user),
    days: int = 30,
) -> Any:
    """Get AI chat statistics (Admin only)"""

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total AI conversations
    total_conversations = await Conversation.find(
        Conversation.type == ConversationType.AI_CHAT
    ).count()

    # Recent AI conversations
    recent_conversations = await Conversation.find(
        Conversation.type == ConversationType.AI_CHAT,
        Conversation.created_at >= cutoff
    ).count()

    # Get all recent AI chat IDs
    recent_chats = await Conversation.find(
        Conversation.type == ConversationType.AI_CHAT,
        Conversation.created_at >= cutoff
    ).to_list()

    chat_ids = [str(c.id) for c in recent_chats]

    # Total messages in AI chats
    total_messages = 0
    ai_messages = 0
    user_messages = 0

    for chat_id in chat_ids:
        messages = await Message.find(Message.conversation_id == chat_id).to_list()
        total_messages += len(messages)
        for msg in messages:
            if msg.sender_id == "ai_assistant":
                ai_messages += 1
            else:
                user_messages += 1

    # Unique users
    unique_users = set()
    for conv in recent_chats:
        if conv.participants:
            for p in conv.participants:
                if p != "ai_assistant":
                    unique_users.add(p)

    # Messages per day
    by_day = {}
    for conv in recent_chats:
        day = conv.created_at.strftime("%Y-%m-%d")
        by_day[day] = by_day.get(day, 0) + 1

    return {
        "period_days": days,
        "total_conversations": total_conversations,
        "recent_conversations": recent_conversations,
        "total_messages": total_messages,
        "ai_messages": ai_messages,
        "user_messages": user_messages,
        "unique_users": len(unique_users),
        "avg_messages_per_chat": round(total_messages / recent_conversations, 1) if recent_conversations > 0 else 0,
        "conversations_by_day": dict(sorted(by_day.items())),
    }


@router.get("/admin/insights/references")
async def admin_get_whatsapp_references(
    current_admin: User = Depends(get_current_admin_user),
    brand: Optional[str] = None,
    reference: Optional[str] = None,
    limit: int = 20,
) -> Any:
    """Get WhatsApp market references for AI validation (Admin only)"""

    from app.models.whatsapp_import import ExtractedWatchListing

    query_conditions = []

    if brand:
        query_conditions.append({"brand": {"$regex": brand, "$options": "i"}})
    if reference:
        query_conditions.append({"reference": {"$regex": reference, "$options": "i"}})

    if query_conditions:
        listings = await ExtractedWatchListing.find(
            *query_conditions
        ).sort([("message_timestamp", -1)]).limit(limit).to_list()
    else:
        listings = await ExtractedWatchListing.find_all().sort(
            [("message_timestamp", -1)]
        ).limit(limit).to_list()

    return {
        "total": len(listings),
        "references": [
            {
                "id": str(lst.id),
                "brand": lst.brand,
                "reference": lst.reference,
                "price": lst.price,
                "currency": lst.currency,
                "condition": lst.condition,
                "seller_name": lst.seller_name,
                "raw_text": lst.raw_text,
                "message_timestamp": lst.message_timestamp,
            }
            for lst in listings
        ]
    }
