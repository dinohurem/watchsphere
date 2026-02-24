"""
Watch alert CRUD endpoints
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

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


class WatchAlertUpdate(BaseModel):
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


def _alert_to_response(alert: WatchAlert) -> WatchAlertResponse:
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


@router.get("/{ws_code}", response_model=List[WatchAlertResponse])
async def get_watch_alerts(
    ws_code: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get all user's alerts for a specific watch"""
    alerts = await WatchAlert.find(
        WatchAlert.user_id == str(current_user.id),
        WatchAlert.ws_code == ws_code,
    ).to_list()
    return [_alert_to_response(a) for a in alerts]


@router.post("", response_model=WatchAlertResponse)
async def create_watch_alert(
    data: WatchAlertCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new alert for a watch"""
    alert = WatchAlert(
        user_id=str(current_user.id),
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
    return _alert_to_response(alert)


@router.put("/{alert_id}", response_model=WatchAlertResponse)
async def update_watch_alert(
    alert_id: str,
    data: WatchAlertUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update a specific alert by ID"""
    try:
        alert = await WatchAlert.get(ObjectId(alert_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Alert not found")

    if not alert or alert.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Alert not found")

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
    alert.updated_at = datetime.utcnow()
    await alert.save()
    return _alert_to_response(alert)


@router.delete("/{alert_id}")
async def delete_watch_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Remove a specific alert by ID"""
    try:
        alert = await WatchAlert.get(ObjectId(alert_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Alert not found")

    if not alert or alert.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Alert not found")

    await alert.delete()
    return {"ok": True}
