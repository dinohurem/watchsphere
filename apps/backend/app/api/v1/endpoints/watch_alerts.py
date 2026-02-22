"""
Watch alert CRUD endpoints
"""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime

from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.watch_alert import WatchAlert

router = APIRouter()


class WatchAlertCreate(BaseModel):
    ws_code: str
    notify_wts: bool = True
    notify_wtb: bool = True
    target_year: Optional[int] = None
    year_direction: str = "exactly"
    price_threshold: Optional[float] = None
    price_direction: str = "below"


class WatchAlertResponse(BaseModel):
    id: str
    ws_code: str
    notify_wts: bool
    notify_wtb: bool
    target_year: Optional[int]
    year_direction: str
    price_threshold: Optional[float]
    price_direction: str
    is_active: bool
    created_at: datetime


@router.get("/{ws_code}", response_model=Optional[WatchAlertResponse])
async def get_watch_alert(
    ws_code: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get user's alert config for a specific watch"""
    alert = await WatchAlert.find_one(
        WatchAlert.user_id == str(current_user.id),
        WatchAlert.ws_code == ws_code,
    )
    if not alert:
        return None
    return WatchAlertResponse(
        id=str(alert.id),
        ws_code=alert.ws_code,
        notify_wts=alert.notify_wts,
        notify_wtb=alert.notify_wtb,
        target_year=alert.target_year,
        year_direction=alert.year_direction,
        price_threshold=alert.price_threshold,
        price_direction=alert.price_direction,
        is_active=alert.is_active,
        created_at=alert.created_at,
    )


@router.post("", response_model=WatchAlertResponse)
async def create_or_update_watch_alert(
    data: WatchAlertCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create or update alert for a watch"""
    user_id = str(current_user.id)
    alert = await WatchAlert.find_one(
        WatchAlert.user_id == user_id,
        WatchAlert.ws_code == data.ws_code,
    )

    if alert:
        alert.notify_wts = data.notify_wts
        alert.notify_wtb = data.notify_wtb
        alert.target_year = data.target_year
        alert.year_direction = data.year_direction
        alert.price_threshold = data.price_threshold
        alert.price_direction = data.price_direction
        alert.is_active = True
        alert.updated_at = datetime.utcnow()
        await alert.save()
    else:
        alert = WatchAlert(
            user_id=user_id,
            ws_code=data.ws_code,
            notify_wts=data.notify_wts,
            notify_wtb=data.notify_wtb,
            target_year=data.target_year,
            year_direction=data.year_direction,
            price_threshold=data.price_threshold,
            price_direction=data.price_direction,
        )
        await alert.insert()

    return WatchAlertResponse(
        id=str(alert.id),
        ws_code=alert.ws_code,
        notify_wts=alert.notify_wts,
        notify_wtb=alert.notify_wtb,
        target_year=alert.target_year,
        year_direction=alert.year_direction,
        price_threshold=alert.price_threshold,
        price_direction=alert.price_direction,
        is_active=alert.is_active,
        created_at=alert.created_at,
    )


@router.delete("/{ws_code}")
async def delete_watch_alert(
    ws_code: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Remove alert for a watch"""
    alert = await WatchAlert.find_one(
        WatchAlert.user_id == str(current_user.id),
        WatchAlert.ws_code == ws_code,
    )
    if alert:
        await alert.delete()
    return {"ok": True}
