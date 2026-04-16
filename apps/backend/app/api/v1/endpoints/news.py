from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import re

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.news import News, NewsStatus

router = APIRouter()


# Response Models
class NewsResponse(BaseModel):
    id: str
    title: str
    slug: str
    content: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    images: List[str] = []
    author_id: str
    author_name: str
    status: NewsStatus
    published_at: Optional[datetime] = None
    tags: List[str] = []
    views: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NewsListResponse(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    author_name: str
    status: NewsStatus
    published_at: Optional[datetime] = None
    tags: List[str] = []
    views: int
    created_at: datetime


# Request Models
class NewsCreate(BaseModel):
    title: str
    content: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    images: List[str] = []
    status: NewsStatus = NewsStatus.DRAFT
    tags: List[str] = []


class NewsUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    images: Optional[List[str]] = None
    status: Optional[NewsStatus] = None
    tags: Optional[List[str]] = None


def generate_slug(title: str) -> str:
    """Generate a URL-friendly slug from title"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


# ============== PUBLIC ENDPOINTS ==============

@router.get("", response_model=List[NewsListResponse])
async def list_news(
    skip: int = 0,
    limit: int = 20,
    tag: Optional[str] = None,
) -> Any:
    """List all published news articles (public)"""

    query_conditions = [News.status == NewsStatus.PUBLISHED]

    if tag:
        query_conditions.append({"tags": tag})

    news_list = await News.find(*query_conditions).sort([("published_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(article.id),
            "title": article.title,
            "slug": article.slug,
            "excerpt": article.excerpt,
            "cover_image": article.cover_image,
            "author_name": article.author_name,
            "status": article.status,
            "published_at": article.published_at,
            "tags": article.tags,
            "views": article.views,
            "created_at": article.created_at,
        }
        for article in news_list
    ]


@router.get("/tags", response_model=List[str])
async def list_tags() -> Any:
    """Get list of all tags used in published news"""

    news_list = await News.find(News.status == NewsStatus.PUBLISHED).to_list()
    all_tags = set()
    for article in news_list:
        all_tags.update(article.tags)

    return sorted(list(all_tags))


@router.get("/{slug_or_id}", response_model=NewsResponse)
async def get_news(slug_or_id: str) -> Any:
    """Get news article by slug or ID (public - only published)"""

    # Try to find by slug first
    article = await News.find_one(News.slug == slug_or_id, News.status == NewsStatus.PUBLISHED)

    # If not found, try by ID
    if not article:
        try:
            article = await News.get(PydanticObjectId(slug_or_id))
            if article and article.status != NewsStatus.PUBLISHED:
                article = None
        except Exception:
            pass

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )

    # Increment view count
    article.views += 1
    await article.save()

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "excerpt": article.excerpt,
        "cover_image": article.cover_image,
        "images": article.images,
        "author_id": article.author_id,
        "author_name": article.author_name,
        "status": article.status,
        "published_at": article.published_at,
        "tags": article.tags,
        "views": article.views,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/all", response_model=List[NewsResponse])
async def admin_list_all_news(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[NewsStatus] = None,
) -> Any:
    """List all news including drafts (Admin only)"""

    if status_filter:
        news_list = await News.find(News.status == status_filter).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        news_list = await News.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(article.id),
            "title": article.title,
            "slug": article.slug,
            "content": article.content,
            "excerpt": article.excerpt,
            "cover_image": article.cover_image,
            "images": article.images,
            "author_id": article.author_id,
            "author_name": article.author_name,
            "status": article.status,
            "published_at": article.published_at,
            "tags": article.tags,
            "views": article.views,
            "created_at": article.created_at,
            "updated_at": article.updated_at,
        }
        for article in news_list
    ]


@router.get("/admin/{article_id}", response_model=NewsResponse)
async def admin_get_news(
    article_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get any news article by ID (Admin only)"""

    article = await News.get(PydanticObjectId(article_id))

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "excerpt": article.excerpt,
        "cover_image": article.cover_image,
        "images": article.images,
        "author_id": article.author_id,
        "author_name": article.author_name,
        "status": article.status,
        "published_at": article.published_at,
        "tags": article.tags,
        "views": article.views,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }


@router.post("/admin", response_model=NewsResponse)
async def admin_create_news(
    news_data: NewsCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new news article (Admin only)"""

    # Generate slug from title
    base_slug = generate_slug(news_data.title)
    slug = base_slug

    # Check for slug uniqueness
    counter = 1
    while await News.find_one(News.slug == slug):
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Create article
    article = News(
        title=news_data.title,
        slug=slug,
        content=news_data.content,
        excerpt=news_data.excerpt,
        cover_image=news_data.cover_image,
        images=news_data.images,
        author_id=str(current_admin.id),
        author_name=current_admin.name,
        status=news_data.status,
        tags=news_data.tags,
        published_at=datetime.utcnow() if news_data.status == NewsStatus.PUBLISHED else None,
    )

    await article.insert()

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "excerpt": article.excerpt,
        "cover_image": article.cover_image,
        "images": article.images,
        "author_id": article.author_id,
        "author_name": article.author_name,
        "status": article.status,
        "published_at": article.published_at,
        "tags": article.tags,
        "views": article.views,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }


@router.patch("/admin/{article_id}", response_model=NewsResponse)
async def admin_update_news(
    article_id: str,
    news_update: NewsUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a news article (Admin only)"""

    article = await News.get(PydanticObjectId(article_id))

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )

    # Update fields if provided
    update_data = news_update.model_dump(exclude_unset=True)

    # Regenerate slug if title changed
    if 'title' in update_data and update_data['title'] != article.title:
        base_slug = generate_slug(update_data['title'])
        slug = base_slug
        counter = 1
        while True:
            existing = await News.find_one(News.slug == slug)
            if not existing or str(existing.id) == article_id:
                break
            slug = f"{base_slug}-{counter}"
            counter += 1
        article.slug = slug

    for field, value in update_data.items():
        setattr(article, field, value)

    # Set published_at if status changed to published
    if news_update.status == NewsStatus.PUBLISHED and not article.published_at:
        article.published_at = datetime.utcnow()

    article.updated_at = datetime.utcnow()
    await article.save()

    return {
        "id": str(article.id),
        "title": article.title,
        "slug": article.slug,
        "content": article.content,
        "excerpt": article.excerpt,
        "cover_image": article.cover_image,
        "images": article.images,
        "author_id": article.author_id,
        "author_name": article.author_name,
        "status": article.status,
        "published_at": article.published_at,
        "tags": article.tags,
        "views": article.views,
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }


@router.delete("/admin/{article_id}")
async def admin_delete_news(
    article_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a news article (Admin only)"""

    article = await News.get(PydanticObjectId(article_id))

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )

    await article.delete()

    return {"message": "News article deleted successfully"}


@router.post("/admin/{article_id}/publish")
async def admin_publish_news(
    article_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Publish a draft news article (Admin only)"""

    article = await News.get(PydanticObjectId(article_id))

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )

    if article.status == NewsStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article is already published"
        )

    article.status = NewsStatus.PUBLISHED
    article.published_at = datetime.utcnow()
    article.updated_at = datetime.utcnow()
    await article.save()

    return {"message": "Article published successfully", "id": str(article.id)}
