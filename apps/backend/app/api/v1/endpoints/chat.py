from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType, MessageType
from app.models.chat_group import ConversationMember
from app.services.ai_chat import generate_ai_response

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


# ============== DIRECT CONVERSATIONS ENDPOINTS ==============

class DirectConversationResponse(BaseModel):
    id: str
    name: str
    lastMessage: Optional[str] = None
    timestamp: Optional[str] = None
    unread: int = 0
    avatar: Optional[str] = None


class CreateDirectConversationRequest(BaseModel):
    recipient_id: str


class CreateDirectConversationResponse(BaseModel):
    id: str
    name: str
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

    # Look for existing conversation between these two users
    existing_conversation = await Conversation.find_one(
        Conversation.type == ConversationType.DIRECT,
        {"participant_ids": {"$all": [str(current_user.id), data.recipient_id]}},
        Conversation.is_active == True,
    )

    if existing_conversation:
        return {
            "id": str(existing_conversation.id),
            "name": recipient.name,
            "is_new": False,
        }

    # Create new direct conversation
    conversation = Conversation(
        type=ConversationType.DIRECT,
        name=None,  # Name is determined by the other participant
        participant_ids=[str(current_user.id), data.recipient_id],
        is_active=True,
        created_at=datetime.utcnow(),
    )
    await conversation.insert()

    return {
        "id": str(conversation.id),
        "name": recipient.name,
        "is_new": True,
    }


@router.get("/conversations", response_model=List[DirectConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List user's direct message conversations"""

    # Find all DIRECT conversations where user is a participant
    conversations = await Conversation.find(
        Conversation.type == ConversationType.DIRECT,
        {"participant_ids": str(current_user.id)},
        Conversation.is_active == True,
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
            Message.sender_id != str(current_user.id),
            Message.read == False,
        ).count()

        # Get the other participant's name
        other_participant_id = next(
            (pid for pid in conv.participant_ids if pid != str(current_user.id)),
            None
        )
        conversation_name = conv.name or "Unknown"
        other_avatar = None
        if other_participant_id:
            other_user = await User.get(PydanticObjectId(other_participant_id))
            if other_user:
                conversation_name = other_user.name
                other_avatar = other_user.profile_image_url

        result.append({
            "id": str(conv.id),
            "name": conversation_name,
            "lastMessage": last_msg.content if last_msg else None,
            "timestamp": last_msg.created_at.strftime("%H:%M") if last_msg else None,
            "unread": unread_count,
            "avatar": other_avatar,
        })

    return result


class ConversationDetailResponse(BaseModel):
    id: str
    name: str
    avatar: Optional[str] = None
    other_user_id: Optional[str] = None


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
    limit: int = 50,
) -> Any:
    """Get messages from a direct conversation"""

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

    messages = await Message.find(
        Message.conversation_id == conversation_id
    ).sort([("created_at", 1)]).skip(skip).limit(limit).to_list()

    # Mark messages as read
    for msg in messages:
        if msg.sender_id != str(current_user.id) and not msg.read:
            msg.read = True
            await msg.save()

    # Get participant names
    participant_names = {}
    for pid in conversation.participant_ids:
        if pid == str(current_user.id):
            participant_names[pid] = current_user.name
        else:
            other_user = await User.get(PydanticObjectId(pid))
            if other_user:
                participant_names[pid] = other_user.name
            else:
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

    # Update conversation
    conversation.updated_at = datetime.utcnow()
    await conversation.save()

    return {
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

    result = []
    for group in groups:
        # Get last message
        last_msg = await Message.find(
            Message.conversation_id == str(group.id)
        ).sort([("created_at", -1)]).first_or_none()

        # Get unread count
        unread_count = await Message.find(
            Message.conversation_id == str(group.id),
            Message.sender_id != str(current_user.id),
            Message.read == False,
        ).count()

        # Get member count
        member_count = await ConversationMember.find(
            ConversationMember.conversation_id == str(group.id),
            ConversationMember.is_active == True,
        ).count()

        result.append({
            "id": str(group.id),
            "name": group.name or "Unnamed Group",
            "description": group.description,
            "avatar": group.avatar,
            "lastMessage": last_msg.content if last_msg else None,
            "timestamp": last_msg.created_at.strftime("%H:%M") if last_msg else None,
            "unread": unread_count,
            "memberCount": member_count,
        })

    return result


class GroupDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar: Optional[str] = None
    memberCount: int = 0
    members: List[dict] = []


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

    # Fetch user profiles to get profile_image_url
    member_list = []
    for m in members:
        user = await User.get(PydanticObjectId(m.user_id))
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
    limit: int = 50,
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

    # Mark messages as read
    for msg in messages:
        if msg.sender_id != str(current_user.id) and not msg.read:
            msg.read = True
            await msg.save()

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

    # Update conversation
    group.updated_at = datetime.utcnow()
    await group.save()

    return {
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
