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
from app.services.whatsapp_otp import normalize_phone, send_verification_code

logger = logging.getLogger(__name__)
from app.models.billing import Subscription, SubscriptionPlan, SubscriptionStatus
from app.models.auth_handoff import AuthHandoffToken
from app.services.email import email_service
from app.services.watchlist import assign_default_watchlist_to_user
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
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


class WhatsAppCodeRequest(BaseModel):
    whatsapp_phone: str


class WhatsAppVerifyRequest(BaseModel):
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


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    access_token: Optional[str] = None


class AppleAuthRequest(BaseModel):
    id_token: str
    user_name: Optional[str] = None  # Apple only provides name on first sign-in


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

    # Generate and send the verification code over WhatsApp
    code = VerificationCode.generate_code()

    await VerificationCode.create_for_phone(
        phone=phone,
        code=code,
        expires_minutes=settings.WHATSAPP_OTP_EXPIRY_MINUTES,
    )

    await send_verification_code(phone, code)

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

    # Mark the user as verified AND approved (email verification = approval)
    current_user.verified = True
    current_user.approved = True
    await current_user.save()

    return {
        "message": "Email verified successfully",
        "verified": True,
        "approved": True,
    }


@router.post("/resend-verification")
async def resend_verification_code(
    current_user: User = Depends(get_current_user),  # Use get_current_user to allow unapproved users
) -> Any:
    """Resend the verification code.

    Signup verifies over WhatsApp, so the resend must use the same channel -
    otherwise the resent code would never match what the client is verifying
    against. Falls back to email for accounts with no number on file.
    """
    if current_user.verified:
        raise HTTPException(
            status_code=400,
            detail="Account is already verified",
        )

    # Generate new verification code (always random)
    code = VerificationCode.generate_code()

    if current_user.whatsapp_phone:
        elapsed = await VerificationCode.seconds_since_last_for_phone(current_user.whatsapp_phone)
        cooldown = settings.WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS
        if elapsed is not None and elapsed < cooldown:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {cooldown - elapsed} seconds before requesting another code",
            )
        await VerificationCode.create_for_phone(
            phone=current_user.whatsapp_phone,
            code=code,
            expires_minutes=settings.WHATSAPP_OTP_EXPIRY_MINUTES,
        )
        await send_verification_code(current_user.whatsapp_phone, code)
        return {"message": "Verification code sent on WhatsApp", "channel": "whatsapp"}

    await VerificationCode.create_for_email(
        email=current_user.email,
        code=code,
        expires_minutes=15
    )
    await email_service.send_verification_email(
        to_email=current_user.email,
        verification_code=code,
        user_name=current_user.name
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


@router.post("/whatsapp/request-code")
async def request_whatsapp_code(request: WhatsAppCodeRequest) -> Any:
    """Send a login/verification code to a WhatsApp number.

    Always reports success. Revealing whether a number is registered would turn
    this endpoint into an account-enumeration oracle.
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
        elapsed = await VerificationCode.seconds_since_last_for_phone(phone)
        cooldown = settings.WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS
        if elapsed is None or elapsed >= cooldown:
            code = VerificationCode.generate_code()
            await VerificationCode.create_for_phone(
                phone=phone,
                code=code,
                expires_minutes=settings.WHATSAPP_OTP_EXPIRY_MINUTES,
            )
            await send_verification_code(phone, code)
        else:
            logger.info("WhatsApp code for %s throttled, %ss since last", phone, elapsed)

    return {
        "message": "If that number has an account, a code has been sent on WhatsApp.",
        "expires_in_minutes": settings.WHATSAPP_OTP_EXPIRY_MINUTES,
        "resend_after_seconds": settings.WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS,
    }


@router.post("/whatsapp/verify-code", response_model=TokenData)
async def verify_whatsapp_code(request: WhatsAppVerifyRequest) -> Any:
    """Exchange a WhatsApp code for tokens - passwordless login and signup verification."""
    phone = normalize_phone(request.whatsapp_phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid WhatsApp number")

    verification = await VerificationCode.find_one(
        VerificationCode.phone == phone,
        VerificationCode.code == request.code,
        VerificationCode.used == False,
    )
    # One message for every failure mode: wrong code, expired code, unknown number.
    if not verification or not verification.is_valid():
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = await User.find_one(User.whatsapp_phone == phone)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    await verification.mark_used()

    # Passing the WhatsApp challenge proves ownership of the number.
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


@router.post("/google", response_model=TokenData)
async def google_auth(request: GoogleAuthRequest) -> Any:
    """Authenticate with Google ID token or access token"""
    google_user_id = None
    email = None
    name = None
    email_verified = False

    # Validate that at least one token is provided
    if not request.id_token and not request.access_token:
        raise HTTPException(
            status_code=400,
            detail="Either id_token or access_token must be provided",
        )

    try:
        # If access_token is provided, use it directly
        if request.access_token:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {request.access_token}"}
                )
                if response.status_code == 200:
                    userinfo = response.json()
                    google_user_id = userinfo.get("sub")
                    email = userinfo.get("email")
                    name = userinfo.get("name", email.split("@")[0] if email else "User")
                    email_verified = userinfo.get("email_verified", False)
                else:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid Google access token",
                    )
        # If id_token is provided, verify it
        elif request.id_token:
            try:
                idinfo = id_token.verify_oauth2_token(
                    request.id_token,
                    google_requests.Request(),
                    settings.GOOGLE_CLIENT_ID
                )
                google_user_id = idinfo["sub"]
                email = idinfo.get("email")
                name = idinfo.get("name", email.split("@")[0] if email else "User")
                email_verified = idinfo.get("email_verified", False)
            except ValueError:
                # If ID token verification fails, try as access token (for backwards compatibility)
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {request.id_token}"}
                    )
                    if response.status_code == 200:
                        userinfo = response.json()
                        google_user_id = userinfo.get("sub")
                        email = userinfo.get("email")
                        name = userinfo.get("name", email.split("@")[0] if email else "User")
                        email_verified = userinfo.get("email_verified", False)
                    else:
                        raise HTTPException(
                            status_code=401,
                            detail="Invalid Google token",
                        )

        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email not provided by Google",
            )

        # Check if user exists with this email
        existing_user = await User.find_one(User.email == email)

        if existing_user:
            # User exists - check if they used a different auth method
            if existing_user.auth_provider == AuthProvider.EMAIL:
                raise HTTPException(
                    status_code=400,
                    detail="An account with this email already exists. Please login with your email and password.",
                )
            elif existing_user.auth_provider == AuthProvider.APPLE:
                raise HTTPException(
                    status_code=400,
                    detail="An account with this email uses Apple Sign-In. Please use the Apple button to log in.",
                )

            # Check if user is active
            if not existing_user.is_active:
                raise HTTPException(status_code=400, detail="Account is inactive")

            # Update OAuth provider ID if not set
            if not existing_user.oauth_provider_id:
                existing_user.oauth_provider_id = google_user_id
                await existing_user.save()

            return await _create_oauth_user_response(existing_user, is_new_user=False)

        # Create new user
        new_user = User(
            email=email,
            name=name,
            auth_provider=AuthProvider.GOOGLE,
            oauth_provider_id=google_user_id,
            verified=email_verified,
            approved=True,
            is_active=True,
        )
        await new_user.insert()

        # Create free trial subscription
        trial_end_date = datetime.utcnow() + relativedelta(months=1)
        subscription = Subscription(
            user_id=str(new_user.id),
            user_name=new_user.name,
            user_email=new_user.email,
            plan=SubscriptionPlan.BASIC,
            status=SubscriptionStatus.ACTIVE,
            price_monthly=0.0,
            currency="EUR",
            started_at=datetime.utcnow(),
            expires_at=trial_end_date,
            next_billing_date=trial_end_date,
            auto_renew=False,
        )
        await subscription.insert()

        # Assign default watchlist
        await assign_default_watchlist_to_user(new_user)

        # Send welcome email
        await email_service.send_welcome_email(
            to_email=new_user.email,
            user_name=new_user.name.split()[0] if new_user.name else "there"
        )

        return await _create_oauth_user_response(new_user, is_new_user=True)

    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=401,
            detail="Invalid Google token",
        )


@router.post("/apple", response_model=TokenData)
async def apple_auth(request: AppleAuthRequest) -> Any:
    """Authenticate with Apple ID token"""
    try:
        # Decode the Apple ID token (without full verification for now)
        # In production, you should verify against Apple's public keys
        # Get Apple's public keys
        async with httpx.AsyncClient() as client:
            response = await client.get("https://appleid.apple.com/auth/keys")
            apple_keys = response.json()

        # Decode the token header to get the key ID
        unverified_header = pyjwt.get_unverified_header(request.id_token)
        kid = unverified_header.get("kid")

        # Find the matching key
        rsa_key = None
        for key in apple_keys.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = key
                break

        if not rsa_key:
            raise HTTPException(
                status_code=401,
                detail="Unable to find appropriate Apple key",
            )

        # Construct the public key
        from jwt import algorithms
        public_key = algorithms.RSAAlgorithm.from_jwk(rsa_key)

        # Verify and decode the token
        decoded = pyjwt.decode(
            request.id_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com",
        )

        apple_user_id = decoded.get("sub")
        email = decoded.get("email")
        email_verified = decoded.get("email_verified", "false") == "true"

        if not email:
            raise HTTPException(
                status_code=400,
                detail="Email not provided by Apple",
            )

        # Apple only provides the name on first sign-in, so we need to handle this
        name = request.user_name or email.split("@")[0]

        # Check if user exists with this email
        existing_user = await User.find_one(User.email == email)

        if existing_user:
            # User exists - check if they used a different auth method
            if existing_user.auth_provider == AuthProvider.EMAIL:
                raise HTTPException(
                    status_code=400,
                    detail="An account with this email already exists. Please login with your email and password.",
                )
            elif existing_user.auth_provider == AuthProvider.GOOGLE:
                raise HTTPException(
                    status_code=400,
                    detail="An account with this email uses Google Sign-In. Please use the Google button to log in.",
                )

            # Check if user is active
            if not existing_user.is_active:
                raise HTTPException(status_code=400, detail="Account is inactive")

            # Update OAuth provider ID if not set
            if not existing_user.oauth_provider_id:
                existing_user.oauth_provider_id = apple_user_id
                await existing_user.save()

            return await _create_oauth_user_response(existing_user, is_new_user=False)

        # Create new user
        new_user = User(
            email=email,
            name=name,
            auth_provider=AuthProvider.APPLE,
            oauth_provider_id=apple_user_id,
            verified=email_verified,
            approved=True,
            is_active=True,
        )
        await new_user.insert()

        # Create free trial subscription
        trial_end_date = datetime.utcnow() + relativedelta(months=1)
        subscription = Subscription(
            user_id=str(new_user.id),
            user_name=new_user.name,
            user_email=new_user.email,
            plan=SubscriptionPlan.BASIC,
            status=SubscriptionStatus.ACTIVE,
            price_monthly=0.0,
            currency="EUR",
            started_at=datetime.utcnow(),
            expires_at=trial_end_date,
            next_billing_date=trial_end_date,
            auto_renew=False,
        )
        await subscription.insert()

        # Assign default watchlist
        await assign_default_watchlist_to_user(new_user)

        # Send welcome email
        await email_service.send_welcome_email(
            to_email=new_user.email,
            user_name=new_user.name.split()[0] if new_user.name else "there"
        )

        return await _create_oauth_user_response(new_user, is_new_user=True)

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Apple token has expired",
        )
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid Apple token",
        )


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
