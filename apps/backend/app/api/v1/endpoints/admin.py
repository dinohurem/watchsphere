from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.deps import get_current_admin_user
from app.models.user import User, UserRole

router = APIRouter()


# Response models
class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    verified: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_users: int
    total_dealers: int
    total_collectors: int
    total_admins: int
    verified_users: int
    active_users: int


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_admin: User = Depends(get_current_admin_user)
) -> Any:
    """Get dashboard statistics (Admin only)"""

    # Get all users
    all_users = await User.find_all().to_list()

    stats = {
        "total_users": len(all_users),
        "total_dealers": len([u for u in all_users if u.role == UserRole.DEALER]),
        "total_collectors": len([u for u in all_users if u.role == UserRole.COLLECTOR]),
        "total_admins": len([u for u in all_users if u.role == UserRole.ADMIN]),
        "verified_users": len([u for u in all_users if u.verified]),
        "active_users": len([u for u in all_users if u.is_active]),
    }

    return stats


@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all users (Admin only)"""

    users = await User.find_all().skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserListResponse)
async def get_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get user by ID (Admin only)"""
    from beanie import PydanticObjectId

    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "verified": user.verified,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


class UserUpdate(BaseModel):
    verified: bool | None = None
    is_active: bool | None = None
    role: UserRole | None = None


@router.patch("/users/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update user (Admin only)"""
    from beanie import PydanticObjectId

    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if user_update.verified is not None:
        user.verified = user_update.verified
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    if user_update.role is not None:
        user.role = user_update.role

    user.updated_at = datetime.utcnow()
    await user.save()

    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "verified": user.verified,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete user (Admin only)"""
    from beanie import PydanticObjectId

    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent deleting yourself
    if str(user.id) == str(current_admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    await user.delete()

    return {"message": "User deleted successfully"}
