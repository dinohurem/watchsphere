from datetime import timedelta, datetime
import logging
from dateutil.relativedelta import relativedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token, create_tokens, verify_refresh_token, get_password_hash, verify_password
from app.core.deps import get_current_active_user, get_current_user
from app.models.user import User, UserRole, AuthProvider
from app.models.verification import VerificationCode
from app.services.phone import normalize_phone

logger = logging.getLogger(__name__)
from app.models.billing import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.auth_handoff import AuthHandoffToken
from app.services.email import email_service
from app.services.watchlist import assign_default_watchlist_to_user
from pydantic import BaseModel, EmailStr
import jwt as pyjwt
import httpx

router = APIRouter()


# Pydantic schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    whatsapp_phone: str
    # Signup no longer collects a username; the WhatsApp number stands in as the
    # display name unless a caller supplies one explicitly.
    name: Optional[str] = None
    role: UserRole = UserRole.COLLECTOR


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    verified: bool
    approved: bool
    auth_provider: AuthProvider = AuthProvider.EMAIL

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


class PasswordlessCodeRequest(BaseModel):
    """Identify the account by its WhatsApp number; the code goes to email."""
    whatsapp_phone: str


class PasswordlessVerifyRequest(BaseModel):
    whatsapp_phone: str
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


async def _issue_email_code(email: str, user_name: Optional[str] = None) -> bool:
    """Generate a one-time code and email it. Returns whether it was sent.

    Email is the only channel: the WhatsApp number identifies the account but
    never receives anything. Callers must not discard the result — a swallowed
    failure leaves the user waiting for a code that was never sent, which is
    indistinguishable from success.
    """
    code = VerificationCode.generate_code()
    await VerificationCode.create_for_email(
        email=email,
        code=code,
        expires_minutes=settings.EMAIL_OTP_EXPIRY_MINUTES,
    )
    sent = await email_service.send_verification_email(
        to_email=email,
        verification_code=code,
        user_name=user_name,
    )
    if not sent:
        logger.error(
            "Verification code for %s was generated but NOT delivered - check "
            "POSTMARK_API_KEY and the sender signature for %s",
            email, settings.EMAIL_FROM,
        )
    return sent


@router.post("/register", response_model=TokenData, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate) -> Any:
    """Register a new user and send a WhatsApp verification code."""
    # Check if user exists
    existing_user = await User.find_one(User.email == user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists",
        )

    phone = normalize_phone(user_in.whatsapp_phone)
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid WhatsApp number including the country code",
        )

    # The number is a login identifier, so it must be unique.
    if await User.find_one(User.whatsapp_phone == phone):
        raise HTTPException(
            status_code=400,
            detail="A user with this WhatsApp number already exists",
        )

    # Create new user (unverified but approved)
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        name=user_in.name or phone,
        whatsapp_phone=phone,
        role=user_in.role,
        verified=False,
        approved=True,
        auth_provider=AuthProvider.EMAIL,
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

    # Generate and email the verification code. The account exists regardless,
    # so a delivery failure is logged rather than failing the request - the user
    # can still resend from the verification screen.
    await _issue_email_code(user.email, user.name)

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
            "auth_provider": user.auth_provider,
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
    """Verify the signed-in user with the code emailed at signup."""
    verification = await VerificationCode.find_one(
        VerificationCode.email == current_user.email,
        VerificationCode.code == request.code,
        VerificationCode.used == False,
    )
    if not verification or not verification.is_valid():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    await verification.mark_used()
    current_user.verified = True
    current_user.approved = True
    await current_user.save()
    return {"message": "Verified successfully", "verified": True, "approved": True}


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Re-send the signup code to the user's email address."""
    elapsed = await VerificationCode.seconds_since_last_for_email(current_user.email)
    cooldown = settings.EMAIL_OTP_RESEND_COOLDOWN_SECONDS
    if elapsed is not None and elapsed < cooldown:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {cooldown - elapsed} seconds before requesting another code",
        )

    if not await _issue_email_code(current_user.email, current_user.name):
        raise HTTPException(
            status_code=502,
            detail="We could not send the code right now. Please try again shortly.",
        )
    return {"message": "Verification code sent", "channel": "email"}


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
            "auth_provider": current_user.auth_provider,
        },
    }


@router.post("/login", response_model=TokenData)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """Login with email and password"""
    user = await User.find_one(User.email == form_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check if user registered via OAuth - they should use OAuth login
    if user.auth_provider != AuthProvider.EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This account uses {user.auth_provider.value} sign-in. Please use the {user.auth_provider.value.title()} button to log in.",
        )

    if not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
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
            "auth_provider": user.auth_provider,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/passwordless/request-code")
async def request_passwordless_code(request: PasswordlessCodeRequest) -> Any:
    """Email a sign-in code to the account holding this WhatsApp number.

    The number identifies the account, the code goes to that account's email
    address. Always reports success: revealing whether a number is registered
    would turn this endpoint into an account-enumeration oracle, and naming the
    destination address would leak it outright.
    """
    phone = normalize_phone(request.whatsapp_phone)
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid WhatsApp number including the country code",
        )

    user = await User.find_one(User.whatsapp_phone == phone)
    if user:
        # Throttle resends. A 429 here would betray that the number is
        # registered, so a throttled request silently skips sending and still
        # returns the same body as every other call.
        elapsed = await VerificationCode.seconds_since_last_for_email(user.email)
        cooldown = settings.EMAIL_OTP_RESEND_COOLDOWN_SECONDS
        if elapsed is None or elapsed >= cooldown:
            await _issue_email_code(user.email, user.name)
        else:
            logger.info("Sign-in code for %s throttled, %ss since last", phone, elapsed)

    return {
        "message": "If that number has an account, we have emailed it a code.",
        "expires_in_minutes": settings.EMAIL_OTP_EXPIRY_MINUTES,
        "resend_after_seconds": settings.EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
    }


@router.post("/passwordless/verify-code", response_model=TokenData)
async def verify_passwordless_code(request: PasswordlessVerifyRequest) -> Any:
    """Exchange an emailed code for tokens - passwordless login."""
    phone = normalize_phone(request.whatsapp_phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = await User.find_one(User.whatsapp_phone == phone)
    # One message for every failure mode: wrong code, expired, unknown number.
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    verification = await VerificationCode.find_one(
        VerificationCode.email == user.email,
        VerificationCode.code == request.code,
        VerificationCode.used == False,
    )
    if not verification or not verification.is_valid():
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    await verification.mark_used()

    # Reading the code proves control of the address on file.
    if not user.verified:
        user.verified = True
        user.updated_at = datetime.utcnow()
        await user.save()

    access_token, refresh_token = create_tokens(str(user.id))
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
            "auth_provider": user.auth_provider,
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
            "auth_provider": user.auth_provider,
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
        auth_provider=current_user.auth_provider,
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

    # Generate reset code (always random)
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


async def _create_oauth_user_response(user: User, is_new_user: bool = False) -> dict:
    """Helper to create OAuth response with tokens"""
    access_token, refresh_token = create_tokens(str(user.id))
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
            "auth_provider": user.auth_provider,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
    }


# Mobile-to-Web Auth Handoff
class MobileHandoffRequest(BaseModel):
    redirect_to: str = "billing"  # Where to redirect after auth (e.g., "billing", "profile")


class MobileHandoffResponse(BaseModel):
    handoff_token: str
    redirect_url: str


class RedeemHandoffRequest(BaseModel):
    token: str


@router.post("/mobile-handoff", response_model=MobileHandoffResponse)
async def generate_mobile_handoff_token(
    request: MobileHandoffRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generate a one-time auth token for mobile-to-web authentication handoff.

    This allows mobile users to seamlessly open the web app already logged in.
    The token is valid for 5 minutes and can only be used once.
    """
    # Create handoff token valid for 5 minutes
    handoff = await AuthHandoffToken.create_for_user(
        user_id=str(current_user.id),
        redirect_to=request.redirect_to,
        expires_minutes=5
    )

    # Map redirect_to to actual web paths
    redirect_paths = {
        "billing": "/app/profile/billing",
        "profile": "/app/profile",
        "settings": "/app/profile/settings",
    }
    redirect_path = redirect_paths.get(request.redirect_to, "/app/profile/billing")

    return {
        "handoff_token": handoff.token,
        "redirect_url": f"/auth/handoff?token={handoff.token}&redirect={redirect_path}",
    }


@router.post("/redeem-handoff", response_model=TokenData)
async def redeem_handoff_token(request: RedeemHandoffRequest) -> Any:
    """Redeem a mobile handoff token and get access/refresh tokens.

    This endpoint is called by the web app to exchange the one-time handoff token
    for full authentication tokens.
    """
    from beanie import PydanticObjectId

    # Find the handoff token
    handoff = await AuthHandoffToken.find_one(
        AuthHandoffToken.token == request.token,
        AuthHandoffToken.used == False,
    )

    if not handoff:
        raise HTTPException(
            status_code=400,
            detail="Invalid or already used handoff token",
        )

    if not handoff.is_valid():
        raise HTTPException(
            status_code=400,
            detail="Handoff token has expired. Please try again from the mobile app.",
        )

    # Mark the token as used
    await handoff.mark_used()

    # Get the user
    user = await User.get(PydanticObjectId(handoff.user_id))

    if not user:
        raise HTTPException(
            status_code=400,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User account is inactive",
        )

    # Create new access and refresh tokens
    access_token, refresh_token = create_tokens(str(user.id))

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "verified": user.verified,
            "approved": user.approved,
            "auth_provider": user.auth_provider,
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }
