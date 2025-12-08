from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class NewsStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class News(Document):
    # Content
    title: str = Field(..., index=True)
    slug: str = Field(..., unique=True, index=True)
    content: str  # HTML or Markdown content
    excerpt: Optional[str] = None  # Short summary for previews

    # Media
    cover_image: Optional[str] = None

    # Author
    author_id: str = Field(..., index=True)
    author_name: str  # Denormalized for display

    # Status & Publishing
    status: NewsStatus = NewsStatus.DRAFT
    published_at: Optional[datetime] = None

    # Categorization
    tags: List[str] = Field(default_factory=list)

    # Stats
    views: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "news"
        indexes = [
            "title",
            "slug",
            "author_id",
            "status",
            "published_at",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "title": "New Rolex Submariner Released",
                "slug": "new-rolex-submariner-released",
                "content": "<p>Rolex has announced...</p>",
                "excerpt": "Rolex unveils their latest Submariner model with significant upgrades.",
                "cover_image": "https://example.com/image.jpg",
                "author_id": "123456",
                "author_name": "Admin",
                "status": "published",
                "tags": ["rolex", "submariner", "new-release"]
            }
        }
