from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime
import secrets
import string

from app.core.deps import get_current_admin_user
from app.core.security import get_password_hash
from app.models.user import User, UserRole, AuthProvider
from app.services.email import email_service

router = APIRouter()


# Response models
class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    verified: bool
    approved: bool
    is_active: bool
    created_at: datetime
    auth_provider: AuthProvider = AuthProvider.EMAIL
    average_rating: float = 0.0
    review_count: int = 0

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_users: int
    total_dealers: int
    total_collectors: int
    total_admins: int
    verified_users: int
    active_users: int
    pending_approval: int


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
        "pending_approval": len([u for u in all_users if not u.approved and u.role != UserRole.ADMIN]),
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
            "approved": user.approved,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "auth_provider": user.auth_provider,
            "average_rating": user.average_rating,
            "review_count": user.review_count,
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
        "approved": user.approved,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "auth_provider": user.auth_provider,
        "average_rating": user.average_rating,
        "review_count": user.review_count,
    }


class UserUpdate(BaseModel):
    verified: bool | None = None
    approved: bool | None = None
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
    if user_update.approved is not None:
        user.approved = user_update.approved
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
        "approved": user.approved,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "auth_provider": user.auth_provider,
        "average_rating": user.average_rating,
        "review_count": user.review_count,
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


@router.get("/users/pending", response_model=List[UserListResponse])
async def list_pending_users(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List all users pending approval (Admin only)"""

    # Find users who are not approved and not admins
    users = await User.find(
        User.approved == False,
        User.role != UserRole.ADMIN
    ).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "auth_provider": user.auth_provider,
            "average_rating": user.average_rating,
            "review_count": user.review_count,
        }
        for user in users
    ]


@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Approve a user account (Admin only)"""
    from beanie import PydanticObjectId

    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already approved"
        )

    user.approved = True
    user.updated_at = datetime.utcnow()
    await user.save()

    # Send account confirmation email
    await email_service.send_account_confirmation_email(
        to_email=user.email,
        user_name=user.name
    )

    return {
        "message": "User approved successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "approved": user.approved,
        }
    }


@router.post("/users/{user_id}/reject")
async def reject_user(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Reject a user account (Admin only)"""
    from beanie import PydanticObjectId

    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Deactivate the user
    user.approved = False
    user.is_active = False
    user.updated_at = datetime.utcnow()
    await user.save()

    return {
        "message": "User rejected successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "approved": user.approved,
            "is_active": user.is_active,
        }
    }


class AdminInviteRequest(BaseModel):
    email: EmailStr
    name: str


def generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@router.post("/invite-admin")
async def invite_admin(
    request: AdminInviteRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Invite a new admin user (Admin only)"""

    # Check if user already exists
    existing_user = await User.find_one(User.email == request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )

    # Generate temporary password
    temp_password = generate_temp_password()

    # Create admin user
    user = User(
        email=request.email,
        hashed_password=get_password_hash(temp_password),
        name=request.name,
        role=UserRole.ADMIN,
        verified=True,  # Auto-verify admin invites
        approved=True,  # Auto-approve admin invites
        is_active=True,
    )
    await user.insert()

    # Send admin invite email
    await email_service.send_admin_invite_email(
        to_email=request.email,
        inviter_name=current_admin.name,
        temp_password=temp_password
    )

    return {
        "message": "Admin invitation sent successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
        }
    }


class AdminReinviteRequest(BaseModel):
    email: EmailStr


@router.post("/reinvite-admin")
async def reinvite_admin(
    request: AdminReinviteRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Re-invite an existing admin user with a new password (Admin only)"""

    # Find the admin user
    user = await User.find_one(User.email == request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an admin"
        )

    # Generate new temporary password
    temp_password = generate_temp_password()

    # Update user password
    user.hashed_password = get_password_hash(temp_password)
    user.updated_at = datetime.utcnow()
    await user.save()

    # Send admin invite email with new credentials
    await email_service.send_admin_invite_email(
        to_email=user.email,
        inviter_name=current_admin.name,
        temp_password=temp_password
    )

    return {
        "message": "Re-invitation sent successfully",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
        }
    }
