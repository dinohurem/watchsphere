from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import logging

from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType, MessageType
from app.models.chat_group import ConversationMember
from app.services.ai_chat import generate_ai_response
from app.services.broadcast import broadcast_service

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models
class MessageCreate(BaseModel):
    content: str
    reply_to_id: Optional[str] = None


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
    reply_to_id: Optional[str] = None
    reply_to_content: Optional[str] = None
    reply_to_sender_name: Optional[str] = None
    reply_to_sender_id: Optional[str] = None


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

    if not conversations:
        return []

    conv_ids = [str(conv.id) for conv in conversations]

    # Batch-fetch last messages using aggregation
    last_messages_pipeline = [
        {"$match": {"conversation_id": {"$in": conv_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$conversation_id", "doc": {"$first": "$$ROOT"}}},
    ]
    last_msgs_raw = await Message.aggregate(last_messages_pipeline).to_list()
    last_msgs_map = {}
    for item in last_msgs_raw:
        doc = item["doc"]
        last_msgs_map[doc["conversation_id"]] = doc

    # Batch-fetch unread counts using aggregation
    unread_pipeline = [
        {"$match": {"conversation_id": {"$in": conv_ids}, "sender_id": "ai_assistant", "read": False}},
        {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
    ]
    unread_raw = await Message.aggregate(unread_pipeline).to_list()
    unread_map = {item["_id"]: item["count"] for item in unread_raw}

    result = []
    for conv in conversations:
        conv_id_str = str(conv.id)
        last_msg_doc = last_msgs_map.get(conv_id_str)
        unread_count = unread_map.get(conv_id_str, 0)

        last_message = None
        if last_msg_doc:
            last_message = {
                "id": str(last_msg_doc["_id"]),
                "conversation_id": conv_id_str,
                "sender_id": last_msg_doc["sender_id"],
                "sender_name": "WatchSphere AI" if last_msg_doc["sender_id"] == "ai_assistant" else current_user.name,
                "content": last_msg_doc["content"],
                "type": last_msg_doc["type"],
                "is_ai": last_msg_doc["sender_id"] == "ai_assistant",
                "read": last_msg_doc["read"],
                "created_at": last_msg_doc["created_at"],
            }

        result.append({
            "id": conv_id_str,
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

    # Mark AI messages as read (bulk update)
    await Message.find(
        Message.conversation_id == conversation_id,
        Message.sender_id == "ai_assistant",
        Message.read == False,
    ).update({"$set": {"read": True}})

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


# ============== DIRECT CONVERSATIONS ENDPOINTS ==============

class DirectConversationResponse(BaseModel):
    id: str
    name: str
    lastMessage: Optional[str] = None
    timestamp: Optional[str] = None
    unread: int = 0
    avatar: Optional[str] = None
    participant_id: Optional[str] = None  # The other participant's user ID


class CreateDirectConversationRequest(BaseModel):
    recipient_id: str


class CreateDirectConversationResponse(BaseModel):
    id: str
    name: str
    avatar: Optional[str] = None
    is_new: bool = False


@router.post("/conversations/direct", response_model=CreateDirectConversationResponse)
async def create_or_get_direct_conversation(
    data: CreateDirectConversationRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create or get an existing direct conversation with a user"""

    # Check if recipient exists
    recipient = await User.get(PydanticObjectId(data.recipient_id))
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found"
        )

    # Check if they're trying to message themselves
    if str(current_user.id) == data.recipient_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a conversation with yourself"
        )

    user_id = str(current_user.id)

    # Look for existing conversation between these two users
    existing_conversation = await Conversation.find_one(
        Conversation.type == ConversationType.DIRECT,
        {"participant_ids": {"$all": [user_id, data.recipient_id]}},
        Conversation.is_active == True,
    )

    if existing_conversation:
        # If user had deleted this conversation, re-enable it for them
        if user_id in existing_conversation.deleted_for:
            existing_conversation.deleted_for.remove(user_id)
            # Keep visible_after to hide old messages
            await existing_conversation.save()

        return {
            "id": str(existing_conversation.id),
            "name": recipient.name or recipient.email or "User",
            "avatar": recipient.profile_image_url or recipient.profile_image_thumbnail_url,
            "is_new": False,
        }

    # Create new direct conversation
    conversation = Conversation(
        type=ConversationType.DIRECT,
        name=None,  # Name is determined by the other participant
        participant_ids=[user_id, data.recipient_id],
        is_active=True,
        created_at=datetime.utcnow(),
    )
    await conversation.insert()

    return {
        "id": str(conversation.id),
        "name": recipient.name or recipient.email or "User",
        "avatar": recipient.profile_image_url or recipient.profile_image_thumbnail_url,
        "is_new": True,
    }


@router.get("/conversations", response_model=List[DirectConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List user's direct message conversations"""

    user_id = str(current_user.id)

    # Find all DIRECT conversations where user is a participant AND not deleted for them
    conversations = await Conversation.find(
        Conversation.type == ConversationType.DIRECT,
        {"participant_ids": user_id},
        {"deleted_for": {"$ne": user_id}},  # Exclude conversations deleted by this user
        Conversation.is_active == True,
    ).sort([("updated_at", -1)]).skip(skip).limit(limit).to_list()

    if not conversations:
        return []

    conv_ids = [str(conv.id) for conv in conversations]

    # Build visible_after map for this user
    visible_after_map = {}
    for conv in conversations:
        if conv.visible_after and user_id in conv.visible_after:
            visible_after_map[str(conv.id)] = datetime.fromisoformat(conv.visible_after[user_id])

    # Separate conversations with and without visible_after for efficient querying
    conv_ids_no_filter = [cid for cid in conv_ids if cid not in visible_after_map]
    conv_ids_with_filter = [cid for cid in conv_ids if cid in visible_after_map]

    # Batch-fetch last messages for conversations WITHOUT visible_after
    last_msgs_map = {}
    if conv_ids_no_filter:
        last_msgs_pipeline = [
            {"$match": {"conversation_id": {"$in": conv_ids_no_filter}}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$conversation_id", "doc": {"$first": "$$ROOT"}}},
        ]
        last_msgs_raw = await Message.aggregate(last_msgs_pipeline).to_list()
        for item in last_msgs_raw:
            doc = item["doc"]
            last_msgs_map[doc["conversation_id"]] = doc

    # For conversations WITH visible_after, we still need per-conversation queries
    # because each has a different cutoff time
    for cid in conv_ids_with_filter:
        va = visible_after_map[cid]
        last_msg = await Message.find(
            Message.conversation_id == cid,
            Message.created_at > va,
        ).sort([("created_at", -1)]).first_or_none()
        if last_msg:
            last_msgs_map[cid] = {
                "_id": last_msg.id,
                "conversation_id": cid,
                "content": last_msg.content,
                "created_at": last_msg.created_at,
            }

    # Batch-fetch unread counts for conversations WITHOUT visible_after
    unread_map = {}
    if conv_ids_no_filter:
        unread_pipeline = [
            {"$match": {"conversation_id": {"$in": conv_ids_no_filter}, "sender_id": {"$ne": user_id}, "read": False}},
            {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
        ]
        unread_raw = await Message.aggregate(unread_pipeline).to_list()
        for item in unread_raw:
            unread_map[item["_id"]] = item["count"]

    # For conversations WITH visible_after, per-conversation unread count
    for cid in conv_ids_with_filter:
        va = visible_after_map[cid]
        count = await Message.find(
            Message.conversation_id == cid,
            Message.sender_id != user_id,
            Message.read == False,
            Message.created_at > va,
        ).count()
        unread_map[cid] = count

    # Batch-fetch all other participants' user profiles
    other_participant_ids = []
    conv_to_other = {}
    for conv in conversations:
        other_pid = next((pid for pid in conv.participant_ids if pid != user_id), None)
        conv_to_other[str(conv.id)] = other_pid
        if other_pid:
            other_participant_ids.append(other_pid)

    # Deduplicate and batch fetch
    unique_other_ids = list(set(other_participant_ids))
    users_map = {}
    if unique_other_ids:
        other_users = await User.find(
            {"_id": {"$in": [PydanticObjectId(uid) for uid in unique_other_ids]}}
        ).to_list()
        for u in other_users:
            users_map[str(u.id)] = u

    result = []
    for conv in conversations:
        conv_id_str = str(conv.id)
        other_pid = conv_to_other.get(conv_id_str)
        other_user = users_map.get(other_pid) if other_pid else None

        conversation_name = conv.name or "Unknown"
        other_avatar = None
        if other_user:
            conversation_name = other_user.name
            other_avatar = other_user.profile_image_url

        last_msg_doc = last_msgs_map.get(conv_id_str)
        unread_count = unread_map.get(conv_id_str, 0)

        result.append({
            "id": conv_id_str,
            "name": conversation_name,
            "lastMessage": last_msg_doc["content"] if last_msg_doc else None,
            "timestamp": last_msg_doc["created_at"].strftime("%H:%M") if last_msg_doc else None,
            "unread": unread_count,
            "avatar": other_avatar,
            "participant_id": other_pid,
        })

    return result


class ConversationDetailResponse(BaseModel):
    id: str
    name: str
    avatar: Optional[str] = None
    other_user_id: Optional[str] = None


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_as_read(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark all messages in a conversation as read"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation or conversation.type != ConversationType.DIRECT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Mark all unread messages from other users as read
    await Message.find(
        Message.conversation_id == conversation_id,
        Message.sender_id != str(current_user.id),
        Message.read == False,
    ).update({"$set": {"read": True}})

    # Broadcast unread count update (now 0)
    await broadcast_service.broadcast_unread_update(
        str(current_user.id), conversation_id, 0
    )

    return {"message": "Conversation marked as read"}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Soft delete a conversation for the current user only"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation or conversation.type != ConversationType.DIRECT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    user_id = str(current_user.id)

    # Add user to deleted_for list if not already there
    if user_id not in conversation.deleted_for:
        conversation.deleted_for.append(user_id)

    # Set visible_after to current time - if user re-opens chat, only show new messages
    conversation.visible_after[user_id] = datetime.utcnow().isoformat()

    await conversation.save()

    # Broadcast unread count update (now 0 since conversation is deleted)
    await broadcast_service.broadcast_unread_update(user_id, conversation_id, 0)

    return {"message": "Conversation deleted successfully"}


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_details(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get details of a single direct conversation including other user's info"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation or conversation.type != ConversationType.DIRECT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Get the other participant's info
    other_participant_id = next(
        (pid for pid in conversation.participant_ids if pid != str(current_user.id)),
        None
    )

    conversation_name = "Unknown"
    other_avatar = None

    if other_participant_id:
        other_user = await User.get(PydanticObjectId(other_participant_id))
        if other_user:
            conversation_name = other_user.name
            other_avatar = other_user.profile_image_url

    return {
        "id": str(conversation.id),
        "name": conversation_name,
        "avatar": other_avatar,
        "other_user_id": other_participant_id,
    }


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 500,  # Increased limit to ensure all messages are loaded
) -> Any:
    """Get messages from a direct conversation"""

    user_id = str(current_user.id)
    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation or conversation.type != ConversationType.DIRECT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if user_id not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Check if user has a visible_after timestamp (re-opened after delete)
    visible_after = None
    if conversation.visible_after and user_id in conversation.visible_after:
        visible_after = datetime.fromisoformat(conversation.visible_after[user_id])
        logger.warning(f"get_conversation_messages: User {user_id} has visible_after={visible_after} - messages before this will be filtered!")

    # Get messages (filtering by visible_after if set)
    # First, let's count ALL messages for this conversation to debug
    total_count = await Message.find(Message.conversation_id == conversation_id).count()
    logger.info(f"get_conversation_messages: conversation_id={conversation_id}, user_id={user_id}, TOTAL messages in DB: {total_count}")
    if visible_after:
        logger.info(f"get_conversation_messages: filtering by visible_after={visible_after}")
        messages = await Message.find(
            Message.conversation_id == conversation_id,
            Message.created_at > visible_after,
        ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()
    else:
        messages = await Message.find(
            Message.conversation_id == conversation_id
        ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    logger.info(f"get_conversation_messages: found {len(messages)} messages for conversation_id={conversation_id}")
    if messages:
        logger.info(f"get_conversation_messages: first msg id={messages[0].id}, content={messages[0].content[:30] if messages[0].content else 'N/A'}")
        logger.info(f"get_conversation_messages: last msg id={messages[-1].id}, content={messages[-1].content[:30] if messages[-1].content else 'N/A'}")

    # Mark messages as read (bulk update instead of per-message save)
    await Message.find(
        Message.conversation_id == conversation_id,
        Message.sender_id != user_id,
        Message.read == False,
    ).update({"$set": {"read": True}})
    # Update in-memory objects to reflect the bulk update
    for msg in messages:
        if msg.sender_id != user_id and not msg.read:
            msg.read = True

    # Batch-fetch participant names
    other_pids = [pid for pid in conversation.participant_ids if pid != user_id]
    participant_names = {user_id: current_user.name}
    if other_pids:
        other_users = await User.find(
            {"_id": {"$in": [PydanticObjectId(pid) for pid in other_pids]}}
        ).to_list()
        for u in other_users:
            participant_names[str(u.id)] = u.name
        # Fill in any missing participants
        for pid in other_pids:
            if pid not in participant_names:
                participant_names[pid] = "Unknown"

    return [
        {
            "id": str(msg.id),
            "conversation_id": conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": participant_names.get(msg.sender_id, "Unknown"),
            "content": msg.content,
            "type": msg.type,
            "is_ai": False,
            "read": msg.read,
            "created_at": msg.created_at,
            "reply_to_id": msg.reply_to_id,
            "reply_to_content": msg.reply_to_content,
            "reply_to_sender_name": msg.reply_to_sender_name,
            "reply_to_sender_id": msg.reply_to_sender_id,
        }
        for msg in messages
    ]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_conversation_message(
    conversation_id: str,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Send a message to a direct conversation"""

    conversation = await Conversation.get(PydanticObjectId(conversation_id))

    if not conversation or conversation.type != ConversationType.DIRECT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    if str(current_user.id) not in conversation.participant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation"
        )

    # Handle reply - get the original message details if reply_to_id is provided
    reply_to_content = None
    reply_to_sender_name = None
    reply_to_sender_id = None
    if data.reply_to_id:
        try:
            original_msg = await Message.get(PydanticObjectId(data.reply_to_id))
            if original_msg and original_msg.conversation_id == conversation_id:
                reply_to_content = original_msg.content
                reply_to_sender_id = original_msg.sender_id
                # Get sender name
                if original_msg.sender_id == str(current_user.id):
                    reply_to_sender_name = current_user.name
                else:
                    sender = await User.get(PydanticObjectId(original_msg.sender_id))
                    reply_to_sender_name = sender.name if sender else "Unknown"
        except Exception:
            pass  # If we can't find the original message, just skip the reply info

    # Save message
    logger.info(f"send_conversation_message: Saving message to conversation_id={conversation_id}")
    message = Message(
        conversation_id=conversation_id,
        sender_id=str(current_user.id),
        content=data.content,
        type=MessageType.TEXT,
        read=False,
        created_at=datetime.utcnow(),
        reply_to_id=data.reply_to_id,
        reply_to_content=reply_to_content,
        reply_to_sender_name=reply_to_sender_name,
        reply_to_sender_id=reply_to_sender_id,
    )
    await message.insert()
    logger.info(f"send_conversation_message: Saved message id={message.id}, conversation_id={message.conversation_id}, content={data.content[:50]}")

    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()
    await conversation.save()

    # Prepare response data
    response_data = {
        "id": str(message.id),
        "conversation_id": conversation_id,
        "sender_id": str(current_user.id),
        "sender_name": current_user.name,
        "content": data.content,
        "type": MessageType.TEXT,
        "is_ai": False,
        "read": False,
        "created_at": message.created_at,
        "reply_to_id": message.reply_to_id,
        "reply_to_content": message.reply_to_content,
        "reply_to_sender_name": message.reply_to_sender_name,
        "reply_to_sender_id": message.reply_to_sender_id,
    }

    # Broadcast to all connected clients (WebSocket + Socket.IO)
    # Using camelCase consistently for all platforms
    broadcast_data = {
        "id": str(message.id),
        "conversationId": conversation_id,
        "senderId": str(current_user.id),
        "senderName": current_user.name,
        "senderAvatar": current_user.profile_image_url or current_user.profile_image_thumbnail_url,
        "content": data.content,
        "type": "text",
        "status": "sent",
        "timestamp": message.created_at.isoformat(),
        "replyTo": message.reply_to_id,
        "replyToContent": message.reply_to_content,
        "replyToSenderName": message.reply_to_sender_name,
        "replyToSenderId": message.reply_to_sender_id,
        "tempId": None,
    }
    logger.info(f"send_conversation_message: About to broadcast to participants {conversation.participant_ids}")
    await broadcast_service.broadcast_message(
        conversation_id, broadcast_data, str(current_user.id),
        participant_ids=conversation.participant_ids
    )
    logger.info(f"send_conversation_message: Broadcast complete")

    # Broadcast unread count update to other participant(s)
    for participant_id in conversation.participant_ids:
        if participant_id != str(current_user.id):
            # Get updated unread count for this participant
            unread_count = await Message.find(
                Message.conversation_id == conversation_id,
                Message.sender_id != participant_id,
                Message.read == False,
            ).count()
            await broadcast_service.broadcast_unread_update(
                participant_id, conversation_id, unread_count
            )

    return response_data


# ============== GROUP CHAT ENDPOINTS ==============

class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar: Optional[str] = None
    lastMessage: Optional[str] = None
    timestamp: Optional[str] = None
    unread: int = 0
    memberCount: int = 0


@router.get("/groups", response_model=List[GroupResponse])
async def list_user_groups(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List groups the current user is a member of"""

    # Find all groups where user is an active member
    memberships = await ConversationMember.find(
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    ).to_list()

    group_ids = [m.conversation_id for m in memberships]

    if not group_ids:
        return []

    # Get the group conversations
    groups = await Conversation.find(
        {"_id": {"$in": [PydanticObjectId(gid) for gid in group_ids]}},
        Conversation.type == ConversationType.GROUP,
        Conversation.is_active == True,
    ).sort([("updated_at", -1)]).skip(skip).limit(limit).to_list()

    if not groups:
        return []

    group_ids = [str(g.id) for g in groups]
    user_id_str = str(current_user.id)

    # Batch-fetch last messages using aggregation
    last_msgs_pipeline = [
        {"$match": {"conversation_id": {"$in": group_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$conversation_id", "doc": {"$first": "$$ROOT"}}},
    ]
    last_msgs_raw = await Message.aggregate(last_msgs_pipeline).to_list()
    last_msgs_map = {}
    for item in last_msgs_raw:
        doc = item["doc"]
        last_msgs_map[doc["conversation_id"]] = doc

    # Batch-fetch unread counts using aggregation
    unread_pipeline = [
        {"$match": {"conversation_id": {"$in": group_ids}, "sender_id": {"$ne": user_id_str}, "read": False}},
        {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
    ]
    unread_raw = await Message.aggregate(unread_pipeline).to_list()
    unread_map = {item["_id"]: item["count"] for item in unread_raw}

    # Batch-fetch member counts using aggregation
    member_count_pipeline = [
        {"$match": {"conversation_id": {"$in": group_ids}, "is_active": True}},
        {"$group": {"_id": "$conversation_id", "count": {"$sum": 1}}},
    ]
    member_count_raw = await ConversationMember.aggregate(member_count_pipeline).to_list()
    member_count_map = {item["_id"]: item["count"] for item in member_count_raw}

    result = []
    for group in groups:
        gid = str(group.id)
        last_msg_doc = last_msgs_map.get(gid)

        result.append({
            "id": gid,
            "name": group.name or "Unnamed Group",
            "description": group.description,
            "avatar": group.avatar,
            "lastMessage": last_msg_doc["content"] if last_msg_doc else None,
            "timestamp": last_msg_doc["created_at"].strftime("%H:%M") if last_msg_doc else None,
            "unread": unread_map.get(gid, 0),
            "memberCount": member_count_map.get(gid, 0),
        })

    return result


class GroupDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar: Optional[str] = None
    memberCount: int = 0
    members: List[dict] = []


@router.post("/groups/{group_id}/read")
async def mark_group_as_read(
    group_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Mark all messages in a group as read"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if user is a member
    membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Mark all unread messages from other users as read
    await Message.find(
        Message.conversation_id == group_id,
        Message.sender_id != str(current_user.id),
        Message.read == False,
    ).update({"$set": {"read": True}})

    # Broadcast unread count update (now 0)
    await broadcast_service.broadcast_unread_update(
        str(current_user.id), group_id, 0
    )

    return {"message": "Group marked as read"}


@router.delete("/groups/{group_id}")
async def leave_or_delete_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Leave a group (soft delete for the user)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    user_id = str(current_user.id)

    # Check if user is a member
    membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == user_id,
        ConversationMember.is_active == True,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Deactivate the membership (soft delete)
    membership.is_active = False
    await membership.save()

    # Broadcast unread count update (now 0)
    await broadcast_service.broadcast_unread_update(user_id, group_id, 0)

    return {"message": "Left group successfully"}


@router.get("/groups/{group_id}", response_model=GroupDetailResponse)
async def get_group_details(
    group_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get group details"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if user is a member
    membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Get members
    members = await ConversationMember.find(
        ConversationMember.conversation_id == group_id,
        ConversationMember.is_active == True,
    ).to_list()

    # Batch-fetch user profiles for all members
    member_user_ids = [PydanticObjectId(m.user_id) for m in members]
    member_users = await User.find({"_id": {"$in": member_user_ids}}).to_list()
    users_by_id = {str(u.id): u for u in member_users}

    member_list = []
    for m in members:
        user = users_by_id.get(m.user_id)
        member_list.append({
            "id": m.user_id,
            "name": m.user_name,
            "role": m.role.value if m.role else "member",
            "profile_image_url": user.profile_image_url if user else None,
        })

    return {
        "id": str(group.id),
        "name": group.name or "Unnamed Group",
        "description": group.description,
        "avatar": group.avatar,
        "memberCount": len(members),
        "members": member_list,
    }


class MemberProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    profile_image_url: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    telegram_username: Optional[str] = None


@router.get("/groups/{group_id}/members/{user_id}", response_model=MemberProfileResponse)
async def get_group_member_profile(
    group_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get profile info for a group member (for contact options)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if current user is a member
    current_membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    )

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Check if target user is a member
    target_membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == user_id,
        ConversationMember.is_active == True,
    )

    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this group"
        )

    # Get full user profile
    target_user = await User.get(PydanticObjectId(user_id))

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": str(target_user.id),
        "name": target_user.name,
        "email": target_user.email,
        "role": target_membership.role.value if target_membership.role else "member",
        "profile_image_url": target_user.profile_image_url,
        "whatsapp_phone": target_user.whatsapp_phone,
        "telegram_username": target_user.telegram_username,
    }


@router.get("/groups/{group_id}/messages", response_model=List[MessageResponse])
async def get_group_messages(
    group_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 500,  # Increased limit to ensure all messages are loaded
) -> Any:
    """Get messages from a group conversation"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if user is a member
    membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    messages = await Message.find(
        Message.conversation_id == group_id
    ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    # Mark messages as read (bulk update instead of per-message save)
    await Message.find(
        Message.conversation_id == group_id,
        Message.sender_id != str(current_user.id),
        Message.read == False,
    ).update({"$set": {"read": True}})
    # Update in-memory objects to reflect the bulk update
    for msg in messages:
        if msg.sender_id != str(current_user.id) and not msg.read:
            msg.read = True

    # Get member names for sender lookup
    members = await ConversationMember.find(
        ConversationMember.conversation_id == group_id,
    ).to_list()
    member_names = {m.user_id: m.user_name for m in members}

    return [
        {
            "id": str(msg.id),
            "conversation_id": group_id,
            "sender_id": msg.sender_id,
            "sender_name": member_names.get(msg.sender_id, "Unknown"),
            "content": msg.content,
            "type": msg.type,
            "is_ai": False,
            "read": msg.read,
            "created_at": msg.created_at,
            "reply_to_id": msg.reply_to_id,
            "reply_to_content": msg.reply_to_content,
            "reply_to_sender_name": msg.reply_to_sender_name,
            "reply_to_sender_id": msg.reply_to_sender_id,
        }
        for msg in messages
    ]


@router.post("/groups/{group_id}/messages", response_model=MessageResponse)
async def send_group_message(
    group_id: str,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Send a message to a group conversation"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Check if user is a member
    membership = await ConversationMember.find_one(
        ConversationMember.conversation_id == group_id,
        ConversationMember.user_id == str(current_user.id),
        ConversationMember.is_active == True,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )

    # Handle reply - get the original message details if reply_to_id is provided
    reply_to_content = None
    reply_to_sender_name = None
    reply_to_sender_id = None
    if data.reply_to_id:
        try:
            original_msg = await Message.get(PydanticObjectId(data.reply_to_id))
            if original_msg and original_msg.conversation_id == group_id:
                reply_to_content = original_msg.content
                reply_to_sender_id = original_msg.sender_id
                # Get sender name from members
                members = await ConversationMember.find(
                    ConversationMember.conversation_id == group_id,
                ).to_list()
                member_names = {m.user_id: m.user_name for m in members}
                reply_to_sender_name = member_names.get(original_msg.sender_id, "Unknown")
        except Exception:
            pass  # If we can't find the original message, just skip the reply info

    # Save message
    message = Message(
        conversation_id=group_id,
        sender_id=str(current_user.id),
        content=data.content,
        type=MessageType.TEXT,
        read=False,
        created_at=datetime.utcnow(),
        reply_to_id=data.reply_to_id,
        reply_to_content=reply_to_content,
        reply_to_sender_name=reply_to_sender_name,
        reply_to_sender_id=reply_to_sender_id,
    )
    await message.insert()

    # Update conversation timestamp
    group.updated_at = datetime.utcnow()
    await group.save()

    # Prepare response data
    response_data = {
        "id": str(message.id),
        "conversation_id": group_id,
        "sender_id": str(current_user.id),
        "sender_name": current_user.name,
        "content": data.content,
        "type": MessageType.TEXT,
        "is_ai": False,
        "read": False,
        "created_at": message.created_at,
        "reply_to_id": message.reply_to_id,
        "reply_to_content": message.reply_to_content,
        "reply_to_sender_name": message.reply_to_sender_name,
        "reply_to_sender_id": message.reply_to_sender_id,
    }

    # Broadcast to all connected clients (WebSocket + Socket.IO)
    # Using camelCase consistently for all platforms
    broadcast_data = {
        "id": str(message.id),
        "conversationId": group_id,
        "senderId": str(current_user.id),
        "senderName": current_user.name,
        "senderAvatar": current_user.profile_image_url or current_user.profile_image_thumbnail_url,
        "content": data.content,
        "type": "text",
        "status": "sent",
        "timestamp": message.created_at.isoformat(),
        "replyTo": message.reply_to_id,
        "replyToContent": message.reply_to_content,
        "replyToSenderName": message.reply_to_sender_name,
        "replyToSenderId": message.reply_to_sender_id,
        "tempId": None,
    }

    # Get all group member IDs for direct delivery
    group_members = await ConversationMember.find(
        ConversationMember.conversation_id == group_id,
        ConversationMember.is_active == True,
    ).to_list()
    member_ids = [m.user_id for m in group_members]

    await broadcast_service.broadcast_message(
        group_id, broadcast_data, str(current_user.id),
        participant_ids=member_ids
    )

    # Broadcast unread count update to all group members except sender
    for member_id in member_ids:
        if member_id != str(current_user.id):
            # Get updated unread count for this member
            unread_count = await Message.find(
                Message.conversation_id == group_id,
                Message.sender_id != member_id,
                Message.read == False,
            ).count()
            await broadcast_service.broadcast_unread_update(
                member_id, group_id, unread_count
            )

    return response_data
