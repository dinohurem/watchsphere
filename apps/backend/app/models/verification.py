from beanie import Document
from pydantic import Field, EmailStr
from datetime import datetime, timedelta
from typing import Optional
import random
import string


class VerificationCode(Document):
    """Verification codes for signup and passwordless login.

    A code is addressed to either an email or a WhatsApp phone number, so both
    fields are optional and exactly one is set per document.
    """
    email: Optional[EmailStr] = Field(default=None, index=True)
    phone: Optional[str] = Field(default=None, index=True)
    code: str
    expires_at: datetime
    used: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "verification_codes"
        indexes = [
            "email",
            "phone",
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

    @classmethod
    async def create_for_phone(
        cls,
        phone: str,
        code: Optional[str] = None,
        expires_minutes: int = 10
    ) -> "VerificationCode":
        """Create a code for a WhatsApp number, invalidating any existing ones."""
        await cls.find(
            cls.phone == phone,
            cls.used == False
        ).update({"$set": {"used": True}})

        verification = cls(
            phone=phone,
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
