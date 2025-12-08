from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.watch import Watch, WatchCondition, WatchStatus

router = APIRouter()


# Response Models
class WatchResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    cover_image: Optional[str] = None
    status: WatchStatus
    featured: bool
    dealer_id: str
    dealer_name: Optional[str] = None
    views: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WatchListResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    condition: WatchCondition
    cover_image: Optional[str] = None
    status: WatchStatus
    featured: bool
    dealer_name: Optional[str] = None
    created_at: datetime


# Request Models
class WatchCreate(BaseModel):
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str = "USD"
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    cover_image: Optional[str] = None
    status: WatchStatus = WatchStatus.DRAFT
    featured: bool = False
    dealer_id: Optional[str] = None  # Admin can assign to any dealer


class WatchUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    condition: Optional[WatchCondition] = None
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    cover_image: Optional[str] = None
    status: Optional[WatchStatus] = None
    featured: Optional[bool] = None


# ============== PUBLIC ENDPOINTS ==============

@router.get("", response_model=List[WatchListResponse])
async def list_watches(
    skip: int = 0,
    limit: int = 50,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[WatchCondition] = None,
    search: Optional[str] = None,
) -> Any:
    """List all active watches (public)"""

    # Build query - only show active watches publicly
    query_conditions = [Watch.status == WatchStatus.ACTIVE]

    if brand:
        query_conditions.append(Watch.brand == brand)
    if min_price is not None:
        query_conditions.append(Watch.price >= min_price)
    if max_price is not None:
        query_conditions.append(Watch.price <= max_price)
    if condition:
        query_conditions.append(Watch.condition == condition)

    # Execute query
    watches_query = Watch.find(*query_conditions)

    # Apply text search if provided (search in brand, model, description)
    if search:
        # For now, use regex-based search
        # In production, consider MongoDB text indexes
        watches_query = Watch.find(
            *query_conditions,
            {
                "$or": [
                    {"brand": {"$regex": search, "$options": "i"}},
                    {"model": {"$regex": search, "$options": "i"}},
                    {"reference": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}},
                ]
            }
        )

    # Sort by featured first, then by created_at
    watches = await watches_query.sort([("featured", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition,
            "cover_image": watch.cover_image,
            "status": watch.status,
            "featured": watch.featured,
            "dealer_name": watch.dealer_name,
            "created_at": watch.created_at,
        }
        for watch in watches
    ]


@router.get("/brands", response_model=List[str])
async def list_brands() -> Any:
    """Get list of all watch brands with active listings"""

    # Get distinct brands from active watches
    watches = await Watch.find(Watch.status == WatchStatus.ACTIVE).to_list()
    brands = list(set(watch.brand for watch in watches))
    brands.sort()

    return brands


@router.get("/{watch_id}", response_model=WatchResponse)
async def get_watch(watch_id: str) -> Any:
    """Get watch by ID (public - only active watches)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Only show active watches publicly
    if watch.status != WatchStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Increment view count
    watch.views += 1
    await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/all", response_model=List[WatchResponse])
async def admin_list_all_watches(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[WatchStatus] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
) -> Any:
    """List all watches including drafts (Admin only)"""

    query_conditions = []

    if status_filter:
        query_conditions.append(Watch.status == status_filter)
    if brand:
        query_conditions.append(Watch.brand == brand)
    if dealer_id:
        query_conditions.append(Watch.dealer_id == dealer_id)

    if query_conditions:
        watches = await Watch.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        watches = await Watch.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition,
            "year": watch.year,
            "serial_number": watch.serial_number,
            "description": watch.description,
            "images": watch.images,
            "cover_image": watch.cover_image,
            "status": watch.status,
            "featured": watch.featured,
            "dealer_id": watch.dealer_id,
            "dealer_name": watch.dealer_name,
            "views": watch.views,
            "created_at": watch.created_at,
            "updated_at": watch.updated_at,
            "published_at": watch.published_at,
        }
        for watch in watches
    ]


@router.get("/admin/{watch_id}", response_model=WatchResponse)
async def admin_get_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get any watch by ID (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.post("/admin", response_model=WatchResponse)
async def admin_create_watch(
    watch_data: WatchCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new watch (Admin only)"""

    # Get dealer info if dealer_id provided
    dealer_name = None
    dealer_id = watch_data.dealer_id or str(current_admin.id)

    if watch_data.dealer_id:
        dealer = await User.get(PydanticObjectId(watch_data.dealer_id))
        if dealer:
            dealer_name = dealer.name
    else:
        dealer_name = current_admin.name

    # Create watch
    watch = Watch(
        brand=watch_data.brand,
        model=watch_data.model,
        reference=watch_data.reference,
        price=watch_data.price,
        currency=watch_data.currency,
        condition=watch_data.condition,
        year=watch_data.year,
        serial_number=watch_data.serial_number,
        description=watch_data.description,
        images=watch_data.images,
        cover_image=watch_data.cover_image or (watch_data.images[0] if watch_data.images else None),
        status=watch_data.status,
        featured=watch_data.featured,
        dealer_id=dealer_id,
        dealer_name=dealer_name,
        published_at=datetime.utcnow() if watch_data.status == WatchStatus.ACTIVE else None,
    )

    await watch.insert()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.patch("/admin/{watch_id}", response_model=WatchResponse)
async def admin_update_watch(
    watch_id: str,
    watch_update: WatchUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Update fields if provided
    update_data = watch_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(watch, field, value)

    # Set published_at if status changed to active
    if watch_update.status == WatchStatus.ACTIVE and not watch.published_at:
        watch.published_at = datetime.utcnow()

    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.delete("/admin/{watch_id}")
async def admin_delete_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    await watch.delete()

    return {"message": "Watch deleted successfully"}


@router.post("/admin/{watch_id}/publish")
async def admin_publish_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Publish a draft watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    if watch.status == WatchStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watch is already published"
        )

    watch.status = WatchStatus.ACTIVE
    watch.published_at = datetime.utcnow()
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {"message": "Watch published successfully", "id": str(watch.id)}


@router.get("/admin/stats/summary")
async def admin_watch_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get watch statistics (Admin only)"""

    all_watches = await Watch.find_all().to_list()

    stats = {
        "total_watches": len(all_watches),
        "active_watches": len([w for w in all_watches if w.status == WatchStatus.ACTIVE]),
        "draft_watches": len([w for w in all_watches if w.status == WatchStatus.DRAFT]),
        "sold_watches": len([w for w in all_watches if w.status == WatchStatus.SOLD]),
        "reserved_watches": len([w for w in all_watches if w.status == WatchStatus.RESERVED]),
        "featured_watches": len([w for w in all_watches if w.featured]),
        "total_views": sum(w.views for w in all_watches),
        "brands_count": len(set(w.brand for w in all_watches)),
    }

    return stats
