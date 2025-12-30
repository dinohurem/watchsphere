from beanie import Document
from pydantic import Field, EmailStr
from datetime import datetime, timedelta
from typing import Optional
import random
import string


class VerificationCode(Document):
    """Email verification codes for user signup"""
    email: EmailStr = Field(..., index=True)
    code: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "verification_codes"
        indexes = [
            "email",
            "code",
        ]

    @classmethod
    def generate_code(cls, length: int = 6) -> str:
        """Generate a random numeric verification code"""
        return ''.join(random.choices(string.digits, k=length))

    @classmethod
    async def create_for_email(
        cls,
        email: str,
        code: Optional[str] = None,
        expires_minutes: int = 15
    ) -> "VerificationCode":
        """Create a new verification code for an email, invalidating any existing ones"""
        # Invalidate any existing unused codes for this email
        await cls.find(
            cls.email == email,
            cls.used == False
        ).update({"$set": {"used": True}})

        # Create new code
        verification = cls(
            email=email,
            code=code or cls.generate_code(),
            expires_at=datetime.utcnow() + timedelta(minutes=expires_minutes),
        )
        await verification.insert()
        return verification

    def is_valid(self) -> bool:
        """Check if the code is still valid (not expired and not used)"""
        return not self.used and datetime.utcnow() < self.expires_at

    async def mark_used(self) -> None:
        """Mark the verification code as used"""
        self.used = True
        await self.save()
