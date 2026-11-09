from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from beanie import PydanticObjectId
from app.core.config import settings
from app.models.user import User

security = HTTPBearer()

# Redesign v3 §10.2: an unapproved account can sign in, but until the team approves it the
# app only shows the pending screen. These are the only endpoints it may use meanwhile.
PENDING_APPROVAL_DETAIL = "account_pending_approval"
_PENDING_ALLOWED_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/support/",
)
_PENDING_ALLOWED_EXACT = {
    "/api/v1/auth",
    "/api/v1/profile/me",
    "/api/v1/support",
    "/api/v1/fx/rates",
    # Register the device while pending so pushes work right after approval.
    "/api/v1/profile/fcm-token",
}


def is_pending_allowed_path(path: str) -> bool:
    """True when an unapproved (pending) user may call this path."""
    p = (path or "").rstrip("/") or "/"
    if p in _PENDING_ALLOWED_EXACT:
        return True
    return any((p + "/").startswith(prefix) for prefix in _PENDING_ALLOWED_PREFIXES)


def _enforce_approval(request: Request | None, user: User) -> None:
    from app.models.user import UserRole

    if user.approved or user.role == UserRole.ADMIN:
        return
    path = request.url.path if request is not None else ""
    if is_pending_allowed_path(path):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PENDING_APPROVAL_DETAIL)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    """Get current authenticated user.

    Unapproved users are rejected with 403 ``account_pending_approval`` everywhere except
    auth, ``/profile/me``, ``/support/*`` and ``/fx/rates``.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # MongoDB/Beanie query
    user = await User.get(PydanticObjectId(user_id))
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    _enforce_approval(request, user)
    return user


async def get_current_active_user(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user (must be approved unless admin, see get_current_user)."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    _enforce_approval(request, current_user)
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current admin user (admin access only)"""
    from app.models.user import UserRole

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
