from beanie import Document
from pydantic import Field
from datetime import datetime, timedelta
from typing import Optional
import secrets


class AuthHandoffToken(Document):
    """One-time tokens for mobile-to-web authentication handoff"""
    user_id: str = Field(..., index=True)
    token: str = Field(..., index=True)
    redirect_to: str = "billing"  # Where to redirect after auth (e.g., "billing", "profile")
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "auth_handoff_tokens"
        indexes = [
            "user_id",
            "token",
        ]

    @classmethod
    def generate_token(cls) -> str:
        """Generate a secure random token"""
        return secrets.token_urlsafe(32)

    @classmethod
    async def create_for_user(
        cls,
        user_id: str,
        redirect_to: str = "billing",
        expires_minutes: int = 5
    ) -> "AuthHandoffToken":
        """Create a new handoff token for a user, invalidating any existing ones"""
        # Invalidate any existing unused tokens for this user
        await cls.find(
            cls.user_id == user_id,
            cls.used == False
        ).update({"$set": {"used": True}})

        # Create new token
        handoff = cls(
            user_id=user_id,
            token=cls.generate_token(),
            redirect_to=redirect_to,
            expires_at=datetime.utcnow() + timedelta(minutes=expires_minutes),
        )
        await handoff.insert()
        return handoff

    def is_valid(self) -> bool:
        """Check if the token is still valid (not expired and not used)"""
        return not self.used and datetime.utcnow() < self.expires_at

    async def mark_used(self) -> None:
        """Mark the token as used"""
        self.used = True
        await self.save()
