"""
Image upload endpoints
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from typing import Optional
from pydantic import BaseModel

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.services.storage import (
    upload_profile_image,
    upload_watch_image,
    upload_news_image,
    upload_market_image,
    upload_chat_image,
    upload_watchlist_image,
    upload_group_avatar,
    delete_image_with_thumbnail
)

router = APIRouter()


# Response models
class ImageUploadResponse(BaseModel):
    url: str
    thumbnail_url: Optional[str] = None
    path: str
    thumbnail_path: Optional[str] = None


# Allowed image types
ALLOWED_CONTENT_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


async def validate_image(file: UploadFile) -> bytes:
    """Validate and read uploaded image"""
    # Check content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: JPEG, PNG, WebP, GIF"
        )

    # Read file
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // 1024 // 1024}MB"
        )

    return content


@router.post("/profile", response_model=ImageUploadResponse)
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload or update user profile picture"""
    content = await validate_image(file)

    try:
        result = await upload_profile_image(content, str(current_user.id))

        # Update user profile with new image URLs
        current_user.profile_image_url = result['url']
        current_user.profile_image_thumbnail_url = result.get('thumbnail_url')
        await current_user.save()

        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/watch", response_model=ImageUploadResponse)
async def upload_watch_picture(
    file: UploadFile = File(...),
    watch_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Upload a watch/listing image"""
    content = await validate_image(file)

    try:
        result = await upload_watch_image(content, watch_id)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/news", response_model=ImageUploadResponse)
async def upload_news_picture(
    file: UploadFile = File(...),
    article_id: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Upload a news article image (admin only)"""
    content = await validate_image(file)

    try:
        result = await upload_news_image(content, article_id)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/market", response_model=ImageUploadResponse)
async def upload_market_picture(
    file: UploadFile = File(...),
    reference: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Upload a market data image (admin only)"""
    content = await validate_image(file)

    try:
        result = await upload_market_image(content, reference)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/watchlist", response_model=ImageUploadResponse)
async def upload_watchlist_picture(
    file: UploadFile = File(...),
    item_id: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Upload a watchlist item image (admin only)"""
    content = await validate_image(file)

    try:
        result = await upload_watchlist_image(content, item_id)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/chat/{chat_id}", response_model=ImageUploadResponse)
async def upload_chat_picture(
    chat_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a chat image"""
    content = await validate_image(file)

    try:
        result = await upload_chat_image(content, chat_id)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.post("/group-avatar", response_model=ImageUploadResponse)
async def upload_group_avatar_picture(
    file: UploadFile = File(...),
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Upload a chat group avatar image (admin only)"""
    content = await validate_image(file)

    try:
        result = await upload_group_avatar(content, group_id)
        return ImageUploadResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


@router.delete("")
async def delete_uploaded_image(
    path: str,
    thumbnail_path: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Delete an uploaded image"""
    # TODO: Add authorization check to ensure user owns the image

    success = await delete_image_with_thumbnail(path, thumbnail_path)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or could not be deleted"
        )

    return {"message": "Image deleted successfully"}
