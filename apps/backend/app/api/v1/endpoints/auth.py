from datetime import timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User, UserRole
from app.models.verification import VerificationCode
from app.services.email import email_service
from pydantic import BaseModel, EmailStr

router = APIRouter()


# Pydantic schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.COLLECTOR


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    verified: bool
    approved: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str


class VerifyEmailRequest(BaseModel):
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class CompleteOnboardingRequest(BaseModel):
    first_name: str
    last_name: str
    gender: Optional[str] = None
    role: str
    watch_count: int = 0
    notifications_enabled: bool = False


@router.post("/register", response_model=TokenData, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate) -> Any:
    """Register a new user and send verification email"""
    # Check if user exists
    existing_user = await User.find_one(User.email == user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists",
        )

    # Create new user (unverified)
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        name=user_in.name,
        role=user_in.role,
        verified=False,
        approved=False,
    )
    await user.insert()

    # Generate and send verification code
    # Use test code in development, random code in production
    if settings.ENVIRONMENT == "development":
        code = settings.TEST_VERIFICATION_CODE
    else:
        code = VerificationCode.generate_code()

    verification = await VerificationCode.create_for_email(
        email=user_in.email,
        code=code,
        expires_minutes=15
    )

    # Send verification email
    await email_service.send_verification_email(
        to_email=user_in.email,
        verification_code=code,
        user_name=user_in.name
    )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
        },
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    current_user: User = Depends(get_current_user),  # Use get_current_user to allow unapproved users
) -> Any:
    """Verify user email with the verification code"""
    # Find the verification code for this user's email
    verification = await VerificationCode.find_one(
        VerificationCode.email == current_user.email,
        VerificationCode.code == request.code,
        VerificationCode.used == False,
    )

    if not verification:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code",
        )

    if not verification.is_valid():
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )

    # Mark the code as used
    await verification.mark_used()

    # Mark the user as verified
    current_user.verified = True
    await current_user.save()

    return {
        "message": "Email verified successfully",
        "verified": True,
    }


@router.post("/resend-verification")
async def resend_verification_code(
    current_user: User = Depends(get_current_user),  # Use get_current_user to allow unapproved users
) -> Any:
    """Resend verification code to user's email"""
    if current_user.verified:
        raise HTTPException(
            status_code=400,
            detail="Email is already verified",
        )

    # Generate new verification code
    if settings.ENVIRONMENT == "development":
        code = settings.TEST_VERIFICATION_CODE
    else:
        code = VerificationCode.generate_code()

    await VerificationCode.create_for_email(
        email=current_user.email,
        code=code,
        expires_minutes=15
    )

    # Send verification email
    await email_service.send_verification_email(
        to_email=current_user.email,
        verification_code=code,
        user_name=current_user.name
    )

    return {"message": "Verification code sent"}


@router.post("/complete-onboarding")
async def complete_onboarding(
    request: CompleteOnboardingRequest,
    current_user: User = Depends(get_current_user),  # Use get_current_user to allow unapproved users
) -> Any:
    """Complete user onboarding with additional profile information"""
    # Update user profile
    current_user.name = f"{request.first_name} {request.last_name}"

    # Update role if valid
    try:
        if request.role in [r.value for r in UserRole]:
            current_user.role = UserRole(request.role)
    except ValueError:
        pass  # Keep existing role if invalid

    await current_user.save()

    # Send welcome email
    await email_service.send_welcome_email(
        to_email=current_user.email,
        user_name=request.first_name
    )

    return {
        "message": "Onboarding completed successfully",
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "verified": current_user.verified,
            "approved": current_user.approved,
        },
    }


@router.post("/login", response_model=TokenData)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """Login with email and password"""
    user = await User.find_one(User.email == form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Check approval status (skip for admin users)
    if not user.approved and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending approval. Please wait for admin approval.",
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
        },
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user info"""
    return current_user


@router.post("/logout")
def logout() -> Any:
    """Logout (client should remove token)"""
    return {"message": "Successfully logged out"}
