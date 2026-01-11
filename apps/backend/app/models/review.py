from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional


class Review(Document):
    """User reviews - users can review other users"""
    # Reviewer (who is giving the review)
    reviewer_id: str = Field(..., index=True)
    reviewer_name: str
    reviewer_email: str
    reviewer_profile_image: Optional[str] = None

    # Reviewed user (who is being reviewed)
    reviewed_user_id: str = Field(..., index=True)
    reviewed_user_name: str
    reviewed_user_email: str

    # Review content
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    comment: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "reviews"
        indexes = [
            "reviewer_id",
            "reviewed_user_id",
            "created_at",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "reviewer_id": "123abc",
                "reviewer_name": "John Doe",
                "reviewer_email": "john@example.com",
                "reviewed_user_id": "456def",
                "reviewed_user_name": "Jane Smith",
                "reviewed_user_email": "jane@example.com",
                "rating": 5,
                "comment": "Great seller, fast shipping!"
            }
        }
