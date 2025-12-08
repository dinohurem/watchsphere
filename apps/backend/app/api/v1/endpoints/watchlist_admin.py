from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.watchlist import WatchlistRecord, WatchlistItemType

router = APIRouter()


class WatchlistResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    item_type: WatchlistItemType
    watch_id: Optional[str] = None
    brand: str
    model: str
    reference: Optional[str] = None
    target_price: Optional[float] = None
    currency: str
    price_alert_enabled: bool
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime


@router.get("/admin/watchlist", response_model=List[WatchlistResponse])
async def admin_list_watchlist(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = None,
    item_type: Optional[WatchlistItemType] = None,
    brand: Optional[str] = None,
) -> Any:
    """List all watchlist records (Admin only)"""

    query_conditions = []

    if user_id:
        query_conditions.append(WatchlistRecord.user_id == user_id)
    if item_type:
        query_conditions.append(WatchlistRecord.item_type == item_type)
    if brand:
        query_conditions.append(WatchlistRecord.brand == brand)

    if query_conditions:
        records = await WatchlistRecord.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        records = await WatchlistRecord.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(r.id),
            "user_id": r.user_id,
            "user_name": r.user_name,
            "user_email": r.user_email,
            "item_type": r.item_type,
            "watch_id": r.watch_id,
            "brand": r.brand,
            "model": r.model,
            "reference": r.reference,
            "target_price": r.target_price,
            "currency": r.currency,
            "price_alert_enabled": r.price_alert_enabled,
            "notes": r.notes,
            "is_active": r.is_active,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.get("/admin/watchlist/user/{user_id}", response_model=List[WatchlistResponse])
async def admin_get_user_watchlist(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get all watchlist records for a specific user (Admin only)"""

    records = await WatchlistRecord.find(
        WatchlistRecord.user_id == user_id
    ).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(r.id),
            "user_id": r.user_id,
            "user_name": r.user_name,
            "user_email": r.user_email,
            "item_type": r.item_type,
            "watch_id": r.watch_id,
            "brand": r.brand,
            "model": r.model,
            "reference": r.reference,
            "target_price": r.target_price,
            "currency": r.currency,
            "price_alert_enabled": r.price_alert_enabled,
            "notes": r.notes,
            "is_active": r.is_active,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.delete("/admin/watchlist/{record_id}")
async def admin_delete_watchlist_record(
    record_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a watchlist record (Admin only)"""

    record = await WatchlistRecord.get(PydanticObjectId(record_id))

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist record not found"
        )

    await record.delete()

    return {"message": "Watchlist record deleted successfully"}


@router.get("/admin/watchlist/stats")
async def admin_watchlist_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get watchlist statistics (Admin only)"""

    all_records = await WatchlistRecord.find_all().to_list()

    # Count by type
    by_type = {
        item_type.value: len([r for r in all_records if r.item_type == item_type])
        for item_type in WatchlistItemType
    }

    # Count by brand
    brands = {}
    for r in all_records:
        brands[r.brand] = brands.get(r.brand, 0) + 1

    # Top brands
    top_brands = sorted(brands.items(), key=lambda x: x[1], reverse=True)[:10]

    # Active alerts
    active_alerts = len([r for r in all_records if r.price_alert_enabled and r.is_active])

    return {
        "total_records": len(all_records),
        "active_records": len([r for r in all_records if r.is_active]),
        "by_type": by_type,
        "top_brands": dict(top_brands),
        "active_alerts": active_alerts,
        "unique_users": len(set(r.user_id for r in all_records)),
    }
