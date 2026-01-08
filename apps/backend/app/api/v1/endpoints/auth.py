from datetime import timedelta, datetime
from dateutil.relativedelta import relativedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token, create_tokens, verify_refresh_token, get_password_hash, verify_password
from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User, UserRole
from app.models.verification import VerificationCode
from app.models.billing import Subscription, SubscriptionPlan, SubscriptionStatus
from app.services.email import email_service
from app.services.watchlist import assign_default_watchlist_to_user
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
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str


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

    # Create free trial subscription (1 month, no credit card required)
    trial_end_date = datetime.utcnow() + relativedelta(months=1)
    subscription = Subscription(
        user_id=str(user.id),
        user_name=user.name,
        user_email=user.email,
        plan=SubscriptionPlan.BASIC,  # Free trial gives basic plan access
        status=SubscriptionStatus.ACTIVE,
        price_monthly=0.0,  # Free during trial
        currency="EUR",
        started_at=datetime.utcnow(),
        expires_at=trial_end_date,
        next_billing_date=trial_end_date,  # First billing after trial ends
        auto_renew=False,  # User must actively subscribe after trial
    )
    await subscription.insert()

    # Assign default watchlist items to the new user
    await assign_default_watchlist_to_user(user)

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

    # Create access and refresh tokens
    access_token, refresh_token = create_tokens(str(user.id))

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
        "refresh_token": refresh_token,
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

    # Create access and refresh tokens
    access_token, refresh_token = create_tokens(str(user.id))

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
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
async def refresh_tokens(request: RefreshTokenRequest) -> Any:
    """Refresh access token using refresh token"""
    user_id = verify_refresh_token(request.refresh_token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user from database
    from beanie import PydanticObjectId
    user = await User.get(PydanticObjectId(user_id))

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
        )

    # Create new access and refresh tokens
    access_token, new_refresh_token = create_tokens(str(user.id))

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
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user info"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        verified=current_user.verified,
        approved=current_user.approved,
    )


@router.post("/logout")
def logout() -> Any:
    """Logout (client should remove token)"""
    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest) -> Any:
    """Request password reset code"""
    user = await User.find_one(User.email == request.email)

    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset code has been sent."}

    # Generate reset code
    if settings.ENVIRONMENT == "development":
        code = settings.TEST_VERIFICATION_CODE
    else:
        code = VerificationCode.generate_code()

    await VerificationCode.create_for_email(
        email=request.email,
        code=code,
        expires_minutes=15
    )

    # Send password reset email
    await email_service.send_password_reset_email(
        to_email=request.email,
        reset_code=code,
        user_name=user.name
    )

    return {"message": "If an account exists with this email, a reset code has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest) -> Any:
    """Reset password using verification code"""
    # Find the user
    user = await User.find_one(User.email == request.email)
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid email or code",
        )

    # Find the verification code
    verification = await VerificationCode.find_one(
        VerificationCode.email == request.email,
        VerificationCode.code == request.code,
        VerificationCode.used == False,
    )

    if not verification:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset code",
        )

    if not verification.is_valid():
        raise HTTPException(
            status_code=400,
            detail="Reset code has expired. Please request a new one.",
        )

    # Mark the code as used
    await verification.mark_used()

    # Update user password
    user.hashed_password = get_password_hash(request.new_password)
    await user.save()

    return {"message": "Password reset successfully. You can now log in with your new password."}
