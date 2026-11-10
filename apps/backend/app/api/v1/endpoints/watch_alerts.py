"""
Watch alert CRUD endpoints (redesign v3 §8).

One alert per type (WTS or WTB); several alerts per watch are allowed.
Legacy alerts (notify_wts / notify_wtb) are migrated lazily when read.
"""

from typing import Any, List, Optional
from datetime import datetime

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator, model_validator

from app.core.deps import get_current_active_user
from app.core.market_constants import APP_CURRENCIES
from app.models.user import User
from app.models.watch import Watch
from app.models.watch_alert import ALERT_TYPES, CONDITIONS, YEAR_MODES, WatchAlert
from app.services.alert_dispatch import migrate_all, normalize_locations

router = APIRouter()

MAX_ALERTS_PER_USER = 500


class WatchAlertIn(BaseModel):
    """Body of POST (with ws_code) and PUT (ws_code ignored)."""

    ws_code: Optional[str] = None
    alert_type: str = "wts"
    year_mode: str = "any"
    year: Optional[int] = None
    month: Optional[int] = None
    condition: str = "any"
    locations: List[str] = []
    price_mode: str = "any"
    price_amount: Optional[float] = None
    currency: Optional[str] = None

    @field_validator("alert_type", "year_mode", "condition", "price_mode", mode="before")
    @classmethod
    def _lower(cls, v):
        return (v or "").strip().lower() if isinstance(v, str) or v is None else v

    @field_validator("currency", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.strip().upper() if isinstance(v, str) and v.strip() else None

    @model_validator(mode="after")
    def _check(self):
        if self.alert_type not in ALERT_TYPES:
            raise ValueError("alert_type must be 'wts' or 'wtb'")
        if self.year_mode not in YEAR_MODES:
            raise ValueError("year_mode must be any, newer, exactly or older")
        if self.year_mode == "any":
            self.year, self.month = None, None
        else:
            if self.year is None or not 1900 <= self.year <= 2100:
                raise ValueError("year is required for this year rule")
            if self.month is not None and not 1 <= self.month <= 12:
                raise ValueError("month must be 1-12")
        if self.condition not in CONDITIONS:
            raise ValueError("condition must be any, unworn or used")

        locs = normalize_locations(self.locations)
        for loc in locs:
            if loc != "EU" and not (len(loc) == 2 and loc.isalpha()):
                raise ValueError(f"invalid location '{loc}'")
        self.locations = locs

        allowed = ("any", "max") if self.alert_type == "wts" else ("any", "min")
        if self.price_mode not in allowed:
            raise ValueError(
                f"price_mode for {self.alert_type.upper()} must be one of {', '.join(allowed)}"
            )
        if self.price_mode == "any":
            self.price_amount = None
        elif self.price_amount is None or self.price_amount <= 0:
            raise ValueError("price_amount must be a positive number")

        if self.currency is not None and self.currency not in APP_CURRENCIES:
            raise ValueError(f"currency must be one of {', '.join(APP_CURRENCIES)}")
        return self


class WatchAlertResponse(BaseModel):
    id: str
    ws_code: str
    alert_type: str
    year_mode: str
    year: Optional[int] = None
    month: Optional[int] = None
    condition: str
    locations: List[str]
    price_mode: str
    price_amount: Optional[float] = None
    currency: str
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None


def _to_response(alert: WatchAlert, watch: Optional[Watch]) -> WatchAlertResponse:
    return WatchAlertResponse(
        id=str(alert.id),
        ws_code=alert.ws_code,
        alert_type=alert.alert_type or "wts",
        year_mode=alert.year_mode or "any",
        year=alert.year,
        month=alert.month,
        condition=alert.condition or "any",
        locations=alert.locations or [],
        price_mode=alert.price_mode or "any",
        price_amount=alert.price_amount,
        currency=alert.currency or "EUR",
        brand=watch.brand if watch else None,
        model=watch.model if watch else None,
        reference=watch.reference if watch else None,
        is_active=alert.is_active,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


async def _watch_map(ws_codes: List[str]) -> dict:
    codes = [c for c in set(ws_codes) if c]
    if not codes:
        return {}
    out: dict = {}
    for w in await Watch.find(In(Watch.ws_code, codes)).to_list():
        out.setdefault(w.ws_code, w)
    return out


async def _get_own(alert_id: str, user: User) -> WatchAlert:
    try:
        alert = await WatchAlert.get(PydanticObjectId(alert_id))
    except Exception:
        alert = None
    if not alert or alert.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


def _apply(alert: WatchAlert, data: WatchAlertIn, user: User) -> None:
    alert.alert_type = data.alert_type
    alert.year_mode = data.year_mode
    alert.year = data.year
    alert.month = data.month
    alert.condition = data.condition
    alert.locations = data.locations
    alert.price_mode = data.price_mode
    alert.price_amount = data.price_amount
    alert.currency = data.currency or alert.currency or user.preferred_currency or "EUR"


@router.get("", response_model=List[WatchAlertResponse])
async def list_my_alerts(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """All alerts of the user across all watches, newest first (P5 "My alerts")."""
    alerts = await WatchAlert.find(WatchAlert.user_id == str(current_user.id)).to_list()
    alerts = await migrate_all(alerts)
    alerts.sort(key=lambda a: a.created_at or datetime.min, reverse=True)
    watches = await _watch_map([a.ws_code for a in alerts])
    return [_to_response(a, watches.get(a.ws_code)) for a in alerts]


@router.get("/{ws_code:path}", response_model=List[WatchAlertResponse])
async def get_watch_alerts(
    ws_code: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """All of the user's alerts for one watch (WTS first, then WTB; newest first)."""
    alerts = await WatchAlert.find(
        WatchAlert.user_id == str(current_user.id),
        WatchAlert.ws_code == ws_code,
    ).to_list()
    alerts = await migrate_all(alerts)
    alerts.sort(key=lambda a: a.created_at or datetime.min, reverse=True)
    alerts.sort(key=lambda a: 0 if a.alert_type == "wts" else 1)
    watches = await _watch_map([ws_code])
    return [_to_response(a, watches.get(ws_code)) for a in alerts]


@router.post("", response_model=WatchAlertResponse)
async def create_watch_alert(
    data: WatchAlertIn,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a new alert for a watch."""
    ws_code = (data.ws_code or "").strip()
    if not ws_code:
        raise HTTPException(status_code=422, detail="ws_code is required")
    watch = await Watch.find_one(Watch.ws_code == ws_code)
    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")
    if await WatchAlert.find(WatchAlert.user_id == str(current_user.id)).count() >= MAX_ALERTS_PER_USER:
        raise HTTPException(status_code=400, detail="Too many alerts")

    alert = WatchAlert(user_id=str(current_user.id), ws_code=ws_code)
    _apply(alert, data, current_user)
    await alert.insert()
    return _to_response(alert, watch)


@router.put("/{alert_id}", response_model=WatchAlertResponse)
async def update_watch_alert(
    alert_id: str,
    data: WatchAlertIn,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Replace an alert's rules (ws_code cannot change)."""
    alert = await _get_own(alert_id, current_user)
    _apply(alert, data, current_user)
    for legacy in ("notify_wts", "notify_wtb", "target_month", "target_year",
                   "year_direction", "price_threshold", "price_direction"):
        setattr(alert, legacy, None)
    alert.updated_at = datetime.utcnow()
    await alert.save()
    watches = await _watch_map([alert.ws_code])
    return _to_response(alert, watches.get(alert.ws_code))


@router.delete("/{alert_id}")
async def delete_watch_alert(
    alert_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Remove an alert."""
    alert = await _get_own(alert_id, current_user)
    await alert.delete()
    return {"ok": True}
