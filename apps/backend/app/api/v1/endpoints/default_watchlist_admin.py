from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user, get_current_user
from app.models.user import User
from app.models.default_watchlist import DefaultWatchlistItem
from app.models.watchlist import WatchlistItemType

router = APIRouter()


# Response Models
class DefaultWatchlistResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    image_url: Optional[str] = None
    item_type: WatchlistItemType
    target_price: Optional[float] = None
    currency: str
    notes: Optional[str] = None
    is_active: bool
    display_order: int
    created_by_id: str
    created_by_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None


# Request Models
class DefaultWatchlistCreate(BaseModel):
    brand: str
    model: str
    reference: Optional[str] = None
    image_url: Optional[str] = None
    item_type: WatchlistItemType = WatchlistItemType.WATCHING
    target_price: Optional[float] = None
    currency: str = "EUR"
    notes: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class DefaultWatchlistUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    image_url: Optional[str] = None
    item_type: Optional[WatchlistItemType] = None
    target_price: Optional[float] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


# ============== PUBLIC ENDPOINTS ==============

@router.get("/public", response_model=List[DefaultWatchlistResponse])
async def get_public_default_watchlist(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get active default watchlist items for regular users"""

    items = await DefaultWatchlistItem.find(
        DefaultWatchlistItem.is_active == True
    ).sort([("display_order", 1), ("created_at", -1)]).to_list()

    return [
        {
            "id": str(item.id),
            "brand": item.brand,
            "model": item.model,
            "reference": item.reference,
            "image_url": item.image_url,
            "item_type": item.item_type,
            "target_price": item.target_price,
            "currency": item.currency,
            "notes": item.notes,
            "is_active": item.is_active,
            "display_order": item.display_order,
            "created_by_id": item.created_by_id,
            "created_by_name": item.created_by_name,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/default-watchlist", response_model=List[DefaultWatchlistResponse])
async def admin_list_default_watchlist(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
) -> Any:
    """List all default watchlist items (Admin only)"""

    if active_only:
        items = await DefaultWatchlistItem.find(
            DefaultWatchlistItem.is_active == True
        ).sort([("display_order", 1), ("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        items = await DefaultWatchlistItem.find_all().sort([("display_order", 1), ("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(item.id),
            "brand": item.brand,
            "model": item.model,
            "reference": item.reference,
            "image_url": item.image_url,
            "item_type": item.item_type,
            "target_price": item.target_price,
            "currency": item.currency,
            "notes": item.notes,
            "is_active": item.is_active,
            "display_order": item.display_order,
            "created_by_id": item.created_by_id,
            "created_by_name": item.created_by_name,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in items
    ]


@router.get("/admin/default-watchlist/{item_id}", response_model=DefaultWatchlistResponse)
async def admin_get_default_watchlist_item(
    item_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get a default watchlist item by ID (Admin only)"""

    item = await DefaultWatchlistItem.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default watchlist item not found"
        )

    return {
        "id": str(item.id),
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "image_url": item.image_url,
        "item_type": item.item_type,
        "target_price": item.target_price,
        "currency": item.currency,
        "notes": item.notes,
        "is_active": item.is_active,
        "display_order": item.display_order,
        "created_by_id": item.created_by_id,
        "created_by_name": item.created_by_name,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.post("/admin/default-watchlist", response_model=DefaultWatchlistResponse)
async def admin_create_default_watchlist_item(
    item_data: DefaultWatchlistCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new default watchlist item (Admin only)"""

    item = DefaultWatchlistItem(
        brand=item_data.brand,
        model=item_data.model,
        reference=item_data.reference,
        image_url=item_data.image_url,
        item_type=item_data.item_type,
        target_price=item_data.target_price,
        currency=item_data.currency,
        notes=item_data.notes,
        is_active=item_data.is_active,
        display_order=item_data.display_order,
        created_by_id=str(current_admin.id),
        created_by_name=current_admin.name,
    )

    await item.insert()

    return {
        "id": str(item.id),
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "image_url": item.image_url,
        "item_type": item.item_type,
        "target_price": item.target_price,
        "currency": item.currency,
        "notes": item.notes,
        "is_active": item.is_active,
        "display_order": item.display_order,
        "created_by_id": item.created_by_id,
        "created_by_name": item.created_by_name,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.patch("/admin/default-watchlist/{item_id}", response_model=DefaultWatchlistResponse)
async def admin_update_default_watchlist_item(
    item_id: str,
    item_update: DefaultWatchlistUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a default watchlist item (Admin only)"""

    item = await DefaultWatchlistItem.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default watchlist item not found"
        )

    # Update fields if provided
    update_data = item_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(item, field, value)

    item.updated_at = datetime.utcnow()
    await item.save()

    return {
        "id": str(item.id),
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "image_url": item.image_url,
        "item_type": item.item_type,
        "target_price": item.target_price,
        "currency": item.currency,
        "notes": item.notes,
        "is_active": item.is_active,
        "display_order": item.display_order,
        "created_by_id": item.created_by_id,
        "created_by_name": item.created_by_name,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.delete("/admin/default-watchlist/{item_id}")
async def admin_delete_default_watchlist_item(
    item_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a default watchlist item (Admin only)"""

    item = await DefaultWatchlistItem.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default watchlist item not found"
        )

    await item.delete()

    return {"message": "Default watchlist item deleted successfully"}


@router.post("/admin/default-watchlist/{item_id}/toggle-active")
async def admin_toggle_default_watchlist_item(
    item_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle active status of a default watchlist item (Admin only)"""

    item = await DefaultWatchlistItem.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Default watchlist item not found"
        )

    item.is_active = not item.is_active
    item.updated_at = datetime.utcnow()
    await item.save()

    return {
        "message": f"Item {'activated' if item.is_active else 'deactivated'} successfully",
        "is_active": item.is_active
    }


@router.get("/admin/default-watchlist/stats")
async def admin_default_watchlist_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get default watchlist statistics (Admin only)"""

    all_items = await DefaultWatchlistItem.find_all().to_list()

    # Count by brand
    brands = {}
    for item in all_items:
        brands[item.brand] = brands.get(item.brand, 0) + 1

    return {
        "total_items": len(all_items),
        "active_items": len([item for item in all_items if item.is_active]),
        "inactive_items": len([item for item in all_items if not item.is_active]),
        "brands": brands,
        "with_target_price": len([item for item in all_items if item.target_price is not None]),
    }
