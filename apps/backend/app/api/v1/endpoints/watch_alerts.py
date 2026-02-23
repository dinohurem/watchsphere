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
    target_month: Optional[int] = None
    target_year: Optional[int] = None
    year_direction: str = "exactly"
    condition: str = "any"
    locations: list[str] = []
    price_threshold: Optional[float] = None
    price_direction: str = "below"
    currency: str = "USD"


class WatchAlertResponse(BaseModel):
    id: str
    ws_code: str
    notify_wts: bool
    notify_wtb: bool
    target_month: Optional[int]
    target_year: Optional[int]
    year_direction: str
    condition: str
    locations: list[str]
    price_threshold: Optional[float]
    price_direction: str
    currency: str
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
        target_month=alert.target_month,
        target_year=alert.target_year,
        year_direction=alert.year_direction,
        condition=alert.condition or "any",
        locations=alert.locations or [],
        price_threshold=alert.price_threshold,
        price_direction=alert.price_direction,
        currency=alert.currency or "USD",
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
        alert.target_month = data.target_month
        alert.target_year = data.target_year
        alert.year_direction = data.year_direction
        alert.condition = data.condition
        alert.locations = data.locations
        alert.price_threshold = data.price_threshold
        alert.price_direction = data.price_direction
        alert.currency = data.currency
        alert.is_active = True
        alert.updated_at = datetime.utcnow()
        await alert.save()
    else:
        alert = WatchAlert(
            user_id=user_id,
            ws_code=data.ws_code,
            notify_wts=data.notify_wts,
            notify_wtb=data.notify_wtb,
            target_month=data.target_month,
            target_year=data.target_year,
            year_direction=data.year_direction,
            condition=data.condition,
            locations=data.locations,
            price_threshold=data.price_threshold,
            price_direction=data.price_direction,
            currency=data.currency,
        )
        await alert.insert()

    return WatchAlertResponse(
        id=str(alert.id),
        ws_code=alert.ws_code,
        notify_wts=alert.notify_wts,
        notify_wtb=alert.notify_wtb,
        target_month=alert.target_month,
        target_year=alert.target_year,
        year_direction=alert.year_direction,
        condition=alert.condition or "any",
        locations=alert.locations or [],
        price_threshold=alert.price_threshold,
        price_direction=alert.price_direction,
        currency=alert.currency or "USD",
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
