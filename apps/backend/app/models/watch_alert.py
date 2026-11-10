"""
WatchAlert – per-user, per-watch alert (redesign v3 §8).

One alert = one type (WTS or WTB). A user may have several alerts per watch.

Rules
- year_mode: any | newer | exactly | older, with ``year`` and an optional ``month``
  ("newer" is inclusive and shown as "2022+")
- condition: any | unworn | used
- locations: country codes, "EU" allowed, empty = worldwide
- price_mode: any | max (WTS "Up to a target price") | min (WTB "Only with a target price ≥")
  with ``price_amount`` in ``currency``

Legacy documents (``notify_wts`` / ``notify_wtb``, ``target_year``, ``price_threshold`` …) have
no ``alert_type`` and are migrated lazily on read (``app.services.alert_dispatch.migrate_legacy``).
"""

from typing import Optional
from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field


ALERT_TYPES = ("wts", "wtb")
YEAR_MODES = ("any", "newer", "exactly", "older")
CONDITIONS = ("any", "unworn", "used")
PRICE_MODES = ("any", "max", "min")


class WatchAlert(Document):
    """User alert configuration for a specific watch variant"""

    user_id: Indexed(str)
    ws_code: Indexed(str)  # the watch variant to monitor

    # --- current shape ---
    alert_type: Optional[str] = None  # "wts" | "wtb"; None = legacy doc, migrate on read
    year_mode: str = "any"
    year: Optional[int] = None
    month: Optional[int] = None  # 1-12, optional
    condition: str = "any"
    locations: list[str] = Field(default_factory=list)  # empty = worldwide; "EU" allowed
    price_mode: str = "any"
    price_amount: Optional[float] = None
    currency: str = "EUR"

    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # --- legacy fields (read only, kept so old documents still load) ---
    notify_wts: Optional[bool] = None
    notify_wtb: Optional[bool] = None
    target_month: Optional[int] = None
    target_year: Optional[int] = None
    year_direction: Optional[str] = None
    price_threshold: Optional[float] = None
    price_direction: Optional[str] = None

    class Settings:
        name = "watch_alerts"
        indexes = [
            "user_id",
            "ws_code",
            [("user_id", 1), ("ws_code", 1)],
            [("ws_code", 1), ("is_active", 1)],
        ]
