from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.chat import Conversation, ConversationType
from app.models.chat_group import ConversationMember, MemberRole

router = APIRouter()


# Response Models
class MemberResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    role: MemberRole
    joined_at: datetime
    is_active: bool


class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    avatar: Optional[str] = None
    created_by: Optional[str] = None
    is_active: bool
    member_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class GroupDetailResponse(GroupResponse):
    members: List[MemberResponse]


# Request Models
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    avatar: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar: Optional[str] = None
    is_active: Optional[bool] = None


class AddMembersRequest(BaseModel):
    user_ids: List[str]


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/groups", response_model=List[GroupResponse])
async def admin_list_groups(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
) -> Any:
    """List all chat groups (Admin only)"""

    query_conditions = [Conversation.type == ConversationType.GROUP]

    if not include_inactive:
        query_conditions.append(Conversation.is_active == True)

    groups = await Conversation.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    result = []
    for group in groups:
        member_count = await ConversationMember.find(
            ConversationMember.conversation_id == str(group.id),
            ConversationMember.is_active == True
        ).count()

        result.append({
            "id": str(group.id),
            "name": group.name or "Unnamed Group",
            "description": group.description,
            "avatar": group.avatar,
            "created_by": group.created_by,
            "is_active": group.is_active,
            "member_count": member_count,
            "created_at": group.created_at,
            "updated_at": group.updated_at,
        })

    return result


@router.get("/admin/groups/{group_id}", response_model=GroupDetailResponse)
async def admin_get_group(
    group_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get group details with members (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    members = await ConversationMember.find(
        ConversationMember.conversation_id == str(group.id)
    ).to_list()

    return {
        "id": str(group.id),
        "name": group.name or "Unnamed Group",
        "description": group.description,
        "avatar": group.avatar,
        "created_by": group.created_by,
        "is_active": group.is_active,
        "member_count": len([m for m in members if m.is_active]),
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "members": [
            {
                "id": str(m.id),
                "user_id": m.user_id,
                "user_name": m.user_name,
                "user_email": m.user_email,
                "role": m.role,
                "joined_at": m.joined_at,
                "is_active": m.is_active,
            }
            for m in members
        ]
    }


@router.post("/admin/groups", response_model=GroupResponse)
async def admin_create_group(
    group_data: GroupCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new chat group (Admin only)"""

    group = Conversation(
        type=ConversationType.GROUP,
        name=group_data.name,
        description=group_data.description,
        avatar=group_data.avatar,
        created_by=str(current_admin.id),
        is_active=True,
    )

    await group.insert()

    # Add admin as first member
    admin_member = ConversationMember(
        conversation_id=str(group.id),
        user_id=str(current_admin.id),
        user_name=current_admin.name,
        user_email=current_admin.email,
        role=MemberRole.ADMIN,
    )
    await admin_member.insert()

    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "avatar": group.avatar,
        "created_by": group.created_by,
        "is_active": group.is_active,
        "member_count": 1,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


@router.patch("/admin/groups/{group_id}", response_model=GroupResponse)
async def admin_update_group(
    group_id: str,
    group_update: GroupUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a chat group (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    update_data = group_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)

    group.updated_at = datetime.utcnow()
    await group.save()

    member_count = await ConversationMember.find(
        ConversationMember.conversation_id == str(group.id),
        ConversationMember.is_active == True
    ).count()

    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "avatar": group.avatar,
        "created_by": group.created_by,
        "is_active": group.is_active,
        "member_count": member_count,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


@router.delete("/admin/groups/{group_id}")
async def admin_delete_group(
    group_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a chat group (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Delete all members
    await ConversationMember.find(
        ConversationMember.conversation_id == str(group.id)
    ).delete()

    # Delete group
    await group.delete()

    return {"message": "Group deleted successfully"}


@router.post("/admin/groups/{group_id}/members")
async def admin_add_members(
    group_id: str,
    request: AddMembersRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Add members to a chat group (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    added = []
    for user_id in request.user_ids:
        # Check if already a member
        existing = await ConversationMember.find_one(
            ConversationMember.conversation_id == str(group.id),
            ConversationMember.user_id == user_id
        )

        if existing:
            if not existing.is_active:
                existing.is_active = True
                await existing.save()
                added.append(user_id)
            continue

        # Get user info
        user = await User.get(PydanticObjectId(user_id))
        if not user:
            continue

        # Add member
        member = ConversationMember(
            conversation_id=str(group.id),
            user_id=user_id,
            user_name=user.name,
            user_email=user.email,
            role=MemberRole.MEMBER,
        )
        await member.insert()
        added.append(user_id)

    return {"message": f"Added {len(added)} members", "added": added}


@router.delete("/admin/groups/{group_id}/members/{user_id}")
async def admin_remove_member(
    group_id: str,
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Remove a member from a chat group (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    member = await ConversationMember.find_one(
        ConversationMember.conversation_id == str(group.id),
        ConversationMember.user_id == user_id
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    # Soft delete - mark as inactive
    member.is_active = False
    await member.save()

    return {"message": "Member removed successfully"}


@router.patch("/admin/groups/{group_id}/members/{user_id}/role")
async def admin_update_member_role(
    group_id: str,
    user_id: str,
    role: MemberRole,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a member's role in a chat group (Admin only)"""

    group = await Conversation.get(PydanticObjectId(group_id))

    if not group or group.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    member = await ConversationMember.find_one(
        ConversationMember.conversation_id == str(group.id),
        ConversationMember.user_id == user_id
    )

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    member.role = role
    await member.save()

    return {"message": "Member role updated successfully", "role": role}


@router.get("/admin/groups/stats")
async def admin_group_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get chat group statistics (Admin only)"""

    all_groups = await Conversation.find(Conversation.type == ConversationType.GROUP).to_list()
    all_members = await ConversationMember.find_all().to_list()

    active_groups = [g for g in all_groups if g.is_active]
    active_members = [m for m in all_members if m.is_active]

    return {
        "total_groups": len(all_groups),
        "active_groups": len(active_groups),
        "total_members": len(all_members),
        "active_members": len(active_members),
        "avg_members_per_group": round(len(active_members) / len(active_groups), 1) if active_groups else 0,
    }
