"""
Firebase Storage service for optimized image uploads
"""

import io
import uuid
from typing import Optional, Tuple
from PIL import Image
from firebase_admin import storage
from app.core.firebase import get_storage_bucket


# Image optimization settings
MAX_IMAGE_SIZE = (1920, 1920)  # Max dimensions
THUMBNAIL_SIZE = (400, 400)    # Thumbnail dimensions
JPEG_QUALITY = 85              # JPEG compression quality
WEBP_QUALITY = 80              # WebP compression quality


def optimize_image(
    image_data: bytes,
    max_size: Tuple[int, int] = MAX_IMAGE_SIZE,
    quality: int = JPEG_QUALITY,
    format: str = "WEBP"
) -> bytes:
    """
    Optimize an image for web/mobile use.

    - Resizes if larger than max_size while maintaining aspect ratio
    - Converts to WebP format for better compression
    - Strips EXIF data for privacy
    """
    img = Image.open(io.BytesIO(image_data))

    # Convert to RGB if necessary (for PNG with transparency)
    if img.mode in ('RGBA', 'P'):
        # Create white background for transparent images
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if needed
    img.thumbnail(max_size, Image.Resampling.LANCZOS)

    # Save optimized image
    output = io.BytesIO()
    if format.upper() == "WEBP":
        img.save(output, format='WEBP', quality=quality, method=6)
    else:
        img.save(output, format='JPEG', quality=quality, optimize=True)

    return output.getvalue()


def create_thumbnail(
    image_data: bytes,
    size: Tuple[int, int] = THUMBNAIL_SIZE
) -> bytes:
    """Create a thumbnail version of an image"""
    return optimize_image(image_data, max_size=size, quality=WEBP_QUALITY)


async def upload_image(
    image_data: bytes,
    folder: str,
    filename: Optional[str] = None,
    optimize: bool = True,
    create_thumb: bool = True
) -> dict:
    """
    Upload an image to Firebase Storage with optimization.

    Args:
        image_data: Raw image bytes
        folder: Storage folder (e.g., 'watches', 'news', 'profiles')
        filename: Optional custom filename (without extension)
        optimize: Whether to optimize the image
        create_thumb: Whether to create a thumbnail

    Returns:
        dict with 'url' and optionally 'thumbnail_url'
    """
    bucket = get_storage_bucket()

    # Generate unique filename if not provided
    if not filename:
        filename = str(uuid.uuid4())

    result = {}

    # Optimize main image
    if optimize:
        optimized_data = optimize_image(image_data)
        extension = "webp"
        content_type = "image/webp"
    else:
        optimized_data = image_data
        # Try to detect format
        img = Image.open(io.BytesIO(image_data))
        extension = img.format.lower() if img.format else "jpg"
        content_type = f"image/{extension}"

    # Upload main image
    main_path = f"{folder}/{filename}.{extension}"
    blob = bucket.blob(main_path)
    blob.upload_from_string(optimized_data, content_type=content_type)
    blob.make_public()
    result['url'] = blob.public_url
    result['path'] = main_path

    # Create and upload thumbnail
    if create_thumb:
        thumb_data = create_thumbnail(image_data)
        thumb_path = f"{folder}/thumbnails/{filename}.webp"
        thumb_blob = bucket.blob(thumb_path)
        thumb_blob.upload_from_string(thumb_data, content_type="image/webp")
        thumb_blob.make_public()
        result['thumbnail_url'] = thumb_blob.public_url
        result['thumbnail_path'] = thumb_path

    return result


async def upload_profile_image(image_data: bytes, user_id: str) -> dict:
    """Upload a user profile image"""
    return await upload_image(
        image_data,
        folder="profiles",
        filename=f"user_{user_id}",
        create_thumb=True
    )


async def upload_watch_image(image_data: bytes, watch_id: Optional[str] = None) -> dict:
    """Upload a watch/listing image"""
    filename = f"watch_{watch_id}" if watch_id else None
    return await upload_image(
        image_data,
        folder="watches",
        filename=filename,
        create_thumb=True
    )


async def upload_news_image(image_data: bytes, article_id: Optional[str] = None) -> dict:
    """Upload a news article image"""
    filename = f"article_{article_id}" if article_id else None
    return await upload_image(
        image_data,
        folder="news",
        filename=filename,
        create_thumb=True
    )


async def upload_market_image(image_data: bytes, reference: Optional[str] = None) -> dict:
    """Upload a market data image"""
    filename = f"market_{reference}" if reference else None
    return await upload_image(
        image_data,
        folder="market",
        filename=filename,
        create_thumb=True
    )


async def upload_watchlist_image(image_data: bytes, item_id: Optional[str] = None) -> dict:
    """Upload a watchlist item image"""
    filename = f"watchlist_{item_id}" if item_id else None
    return await upload_image(
        image_data,
        folder="watchlist",
        filename=filename,
        create_thumb=True
    )


async def upload_chat_image(image_data: bytes, chat_id: str) -> dict:
    """Upload a chat/message image"""
    return await upload_image(
        image_data,
        folder=f"chats/{chat_id}",
        create_thumb=False  # No thumbnail for chat images
    )


async def upload_group_avatar(image_data: bytes, group_id: Optional[str] = None) -> dict:
    """Upload a chat group avatar image"""
    filename = f"group_{group_id}" if group_id else None
    return await upload_image(
        image_data,
        folder="group-avatars",
        filename=filename,
        create_thumb=True
    )


async def delete_image(path: str) -> bool:
    """Delete an image from storage"""
    try:
        bucket = get_storage_bucket()
        blob = bucket.blob(path)
        blob.delete()
        return True
    except Exception:
        return False


async def delete_image_with_thumbnail(path: str, thumbnail_path: Optional[str] = None) -> bool:
    """Delete an image and its thumbnail"""
    main_deleted = await delete_image(path)

    if thumbnail_path:
        await delete_image(thumbnail_path)
    elif path:
        # Try to construct thumbnail path
        parts = path.rsplit('/', 1)
        if len(parts) == 2:
            folder, filename = parts
            thumb_path = f"{folder}/thumbnails/{filename.rsplit('.', 1)[0]}.webp"
            await delete_image(thumb_path)

    return main_deleted
