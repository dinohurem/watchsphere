from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserRole
from pydantic import BaseModel, EmailStr

router = APIRouter()


# Pydantic schemas
class ProfileUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    verified: bool
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user profile"""
    return current_user


@router.put("/", response_model=ProfileResponse)
def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update user profile"""
    if profile_in.name:
        current_user.name = profile_in.name

    if profile_in.email:
        # Check if email is already taken
        existing_user = db.query(User).filter(
            User.email == profile_in.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = profile_in.email

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    password_in: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Change user password"""
    if not verify_password(password_in.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    current_user.hashed_password = get_password_hash(password_in.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
