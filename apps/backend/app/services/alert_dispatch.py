"""Alert matching, Activity entries and bundled push (redesign v3 §7, §8 developer note, §11).

Public entry point (called by the import pipeline once per run with the ids of *really new*
orders, and when an approval-page decision or a manual listing creates one)::

    await dispatch_new_listings(order_ids) -> int   # number of Activity entries created

An alert matches a listing when type, year rule, condition, location and price rule are all
satisfied. Matches are grouped per user per watch per type within one call: one Activity entry
(``Notification`` of type ``alert_match``) and one push per group. The push shows the cheapest
listing and "· +N more" for the rest.

Everything above the "DB" section is pure and unit-tested in tests/test_alert_dispatch.py.
"""

from __future__ import annotations

import logging
import re
from collections import OrderedDict
from datetime import datetime
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------------------------
# Countries
# --------------------------------------------------------------------------------------------

EU_COUNTRIES: frozenset[str] = frozenset({
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
    "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
})

# Orders use "UK" (generator) while the app/ISO uses "GB"; "UAE" appears in old data.
_COUNTRY_CANONICAL = {"GB": "UK", "UAE": "AE", "USA": "US", "EL": "GR"}

COUNTRY_NAMES = {
    "US": "United States", "UK": "United Kingdom", "DE": "Germany", "IT": "Italy",
    "FR": "France", "CH": "Switzerland", "AE": "United Arab Emirates", "HK": "Hong Kong",
    "SG": "Singapore", "JP": "Japan", "AU": "Australia", "CA": "Canada",
    "NL": "Netherlands", "ES": "Spain", "AT": "Austria", "BE": "Belgium",
    "PT": "Portugal", "SE": "Sweden", "DK": "Denmark", "NO": "Norway",
    "PL": "Poland", "CZ": "Czech Republic", "TW": "Taiwan", "KR": "South Korea",
    "TH": "Thailand", "MY": "Malaysia", "PH": "Philippines", "IN": "India",
    "CN": "China", "MO": "Macau", "TR": "Turkey", "SA": "Saudi Arabia", "QA": "Qatar",
    "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman", "IE": "Ireland", "LU": "Luxembourg",
    "MC": "Monaco", "GR": "Greece", "HU": "Hungary", "RO": "Romania", "HR": "Croatia",
}


def canonical_country(code: Optional[str]) -> str:
    c = (code or "").strip().upper()
    return _COUNTRY_CANONICAL.get(c, c)


def normalize_locations(locations: Iterable[str] | None) -> list[str]:
    """Upper-case, canonical codes, "EU" kept, duplicates removed, order preserved."""
    out: list[str] = []
    for loc in locations or []:
        c = canonical_country(loc)
        if c and c not in out:
            out.append(c)
    return out


def location_matches(locations: Iterable[str] | None, country_code: Optional[str]) -> bool:
    locs = normalize_locations(locations)
    if not locs:
        return True  # worldwide
    c = canonical_country(country_code)
    if not c:
        return False
    if c in locs:
        return True
    return "EU" in locs and c in EU_COUNTRIES


def flag_emoji(code: Optional[str]) -> str:
    c = canonical_country(code)
    if c == "UK":
        c = "GB"
    if len(c) != 2 or not c.isalpha():
        return ""
    return "".join(chr(0x1F1E6 + ord(ch) - ord("A")) for ch in c)


def country_name(code: Optional[str], fallback: Optional[str] = None) -> Optional[str]:
    if fallback:
        return fallback
    c = canonical_country(code)
    return COUNTRY_NAMES.get(c, c or None)


# --------------------------------------------------------------------------------------------
# Field helpers
# --------------------------------------------------------------------------------------------


def _val(x: Any) -> Any:
    return getattr(x, "value", x)


def order_kind(order: Any) -> str:
    """'wts' for sell orders, 'wtb' for buy orders."""
    return "wtb" if str(_val(getattr(order, "order_type", ""))).lower() == "buy" else "wts"


_YEAR_RE = re.compile(r"(19\d{2}|20\d{2})")
_MONTH_YEAR_RE = re.compile(r"\b(\d{1,2})\s*[./-]\s*(\d{2}|\d{4})\b")


def order_year_month(order: Any) -> tuple[Optional[int], Optional[int]]:
    """(year, month) of the card date; falls back to parsing ``year_raw`` ("2022+", "11/2023")."""
    year = getattr(order, "year", None)
    month = getattr(order, "watch_month", None)
    if year:
        return int(year), (int(month) if month and 1 <= int(month) <= 12 else None)
    raw = (getattr(order, "year_raw", None) or "").strip()
    if not raw:
        return None, None
    m = _MONTH_YEAR_RE.search(raw)
    if m:
        mon, yr = int(m.group(1)), int(m.group(2))
        if yr < 100:
            yr += 2000
        if 1 <= mon <= 12 and 1900 <= yr <= 2100:
            return yr, mon
    y = _YEAR_RE.search(raw)
    if y:
        return int(y.group(1)), None
    return None, None


def order_condition(order: Any) -> Optional[str]:
    """'Unworn' | 'Used' | None. A WTB without any condition text has no condition."""
    raw = (getattr(order, "condition_raw", None) or "").strip()
    cond = _val(getattr(order, "condition", None))
    if order_kind(order) == "wtb" and not raw:
        return None
    if cond in ("Unworn", "Used"):
        return cond
    low = (raw or str(cond or "")).lower()
    if not low:
        return None
    return "Unworn" if ("unworn" in low or "new" in low or "bnib" in low) else "Used"


def _norm_currency(cur: Optional[str]) -> str:
    c = (cur or "").strip().upper()
    return "USD" if c == "USDT" else c


def convert(amount: Optional[float], from_cur: Optional[str], to_cur: Optional[str],
            rates: Optional[dict]) -> Optional[float]:
    """Pure FX conversion; ``rates`` are units per 1 USD (same contract as app.services.fx)."""
    if amount is None:
        return None
    f, t = _norm_currency(from_cur), _norm_currency(to_cur)
    if f == t:
        return float(amount)
    if not rates:
        return None
    rf = 1.0 if f == "USD" else rates.get(f)
    rt = 1.0 if t == "USD" else rates.get(t)
    if not rf or not rt:
        return None
    return float(amount) / float(rf) * float(rt)


# --------------------------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------------------------


def year_matches(mode: Optional[str], year: Optional[int], month: Optional[int],
                 order_year: Optional[int], order_month: Optional[int]) -> bool:
    """Year rule. 'newer' / 'older' are inclusive ("2022+"). A month is optional on both
    sides; when the listing has no month only the year is compared."""
    mode = (mode or "any").lower()
    if mode == "any" or not year:
        return True
    if not order_year:
        return False
    if mode == "exactly":
        if order_year != year:
            return False
        return not month or order_month is None or order_month == month
    if month and order_month is not None:
        a, b = (order_year, order_month), (year, month)
    else:
        a, b = order_year, year
    if mode == "newer":
        return a >= b
    if mode == "older":
        return a <= b
    return True


def condition_matches(condition: Optional[str], order: Any) -> bool:
    condition = (condition or "any").lower()
    if condition == "any":
        return True
    oc = order_condition(order)
    if oc is None:
        return False
    return oc.lower() == condition


def price_matches(mode: Optional[str], amount: Optional[float], currency: Optional[str],
                  order: Any, rates: Optional[dict]) -> bool:
    mode = (mode or "any").lower()
    if mode == "any" or amount is None:
        return True
    price = getattr(order, "price", None)
    if price is None or price <= 0:
        return False  # "up to" / "only with a target price" need a posted price
    converted = convert(price, getattr(order, "currency", None), currency, rates)
    if converted is None:
        usd = getattr(order, "usd_price", None)
        converted = convert(usd, "USD", currency, rates) if usd else None
    if converted is None:
        return False
    eps = 1e-6
    if mode == "max":
        return converted <= float(amount) + eps
    if mode == "min":
        return converted >= float(amount) - eps
    return True


def alert_matches(alert: Any, order: Any, rates: Optional[dict] = None) -> bool:
    """True when type, year rule, condition, location and price rule are all satisfied."""
    if not getattr(alert, "is_active", True):
        return False
    if (getattr(alert, "ws_code", None) or "") != (getattr(order, "ws_code", None) or ""):
        return False
    if (getattr(alert, "alert_type", None) or "").lower() != order_kind(order):
        return False
    oy, om = order_year_month(order)
    if not year_matches(getattr(alert, "year_mode", "any"), getattr(alert, "year", None),
                        getattr(alert, "month", None), oy, om):
        return False
    if not condition_matches(getattr(alert, "condition", "any"), order):
        return False
    if not location_matches(getattr(alert, "locations", None), getattr(order, "country_code", None)):
        return False
    return price_matches(getattr(alert, "price_mode", "any"), getattr(alert, "price_amount", None),
                         getattr(alert, "currency", None), order, rates)


# --------------------------------------------------------------------------------------------
# Legacy migration (pure part)
# --------------------------------------------------------------------------------------------


def legacy_to_new(alert: Any) -> list[dict]:
    """Field sets for the new shape from a legacy alert (no ``alert_type``).

    notify_wts + notify_wtb → two alerts; price_direction below → WTS "max", above → WTB "min"
    (a rule that has no meaning for the other type becomes "any")."""
    want_wts = getattr(alert, "notify_wts", None)
    want_wtb = getattr(alert, "notify_wtb", None)
    types = []
    if want_wts or want_wts is None:
        types.append("wts")
    if want_wtb or want_wtb is None:
        types.append("wtb")
    if not types:
        types = ["wts"]

    target_year = getattr(alert, "target_year", None)
    direction = (getattr(alert, "year_direction", None) or "exactly").lower()
    year_mode = direction if (target_year and direction in ("newer", "exactly", "older")) else "any"
    threshold = getattr(alert, "price_threshold", None)
    pdir = (getattr(alert, "price_direction", None) or "below").lower()
    currency = _norm_currency(getattr(alert, "currency", None)) or "EUR"

    out = []
    for t in types:
        if threshold and t == "wts" and pdir == "below":
            pm, pa = "max", float(threshold)
        elif threshold and t == "wtb" and pdir == "above":
            pm, pa = "min", float(threshold)
        else:
            pm, pa = "any", None
        out.append({
            "alert_type": t,
            "year_mode": year_mode,
            "year": target_year if year_mode != "any" else None,
            "month": getattr(alert, "target_month", None) if year_mode != "any" else None,
            "condition": (getattr(alert, "condition", None) or "any").lower(),
            "locations": normalize_locations(getattr(alert, "locations", None)),
            "price_mode": pm,
            "price_amount": pa,
            "currency": currency,
        })
    return out


# --------------------------------------------------------------------------------------------
# Text formatting (UI §0.1, §7, §11)
# --------------------------------------------------------------------------------------------

_SYMBOL_AFTER = {"EUR": "€", "GBP": "£", "USD": "$"}


def format_number(value: float) -> str:
    rounded = int(round(abs(value)))
    digits = f"{rounded:,}".replace(",", ".")
    return f"-{digits}" if value < 0 and rounded else digits


def format_price(value: Optional[float], currency: Optional[str]) -> str:
    if value is None:
        return "/"
    code = _norm_currency(currency)
    sym = _SYMBOL_AFTER.get(code)
    return f"{format_number(value)}{sym}" if sym else f"{format_number(value)} {code}".rstrip()


def year_label(kind: str, year: Optional[int]) -> Optional[str]:
    if not year:
        return None
    return f"{year}+" if kind == "wtb" else str(year)


def push_title(kind: str, ws_code: str, count: int) -> str:
    label = kind.upper()
    if count <= 1:
        return f"New {label} · {ws_code}"
    return f"{count} new {label} · {ws_code}"


def push_line_location(country_code: Optional[str], country: Optional[str],
                       year: Optional[str], condition: Optional[str]) -> str:
    flag = flag_emoji(country_code)
    place = " ".join(p for p in (flag, country or "") if p).strip()
    return " · ".join(p for p in (place, year, condition) if p)


def push_line_price(kind: str, price: Optional[float], currency: Optional[str], count: int) -> str:
    label = "Target" if kind == "wtb" else "Price"
    line = f"{label}: {format_price(price if price and price > 0 else None, currency)}"
    if count > 1:
        line += f" · +{count - 1} more"
    return line


def _sort_key_usd(order: Any, rates: Optional[dict]) -> tuple:
    price = getattr(order, "price", None)
    if not price or price <= 0:
        return (1, 0.0)
    usd = getattr(order, "usd_price", None)
    if not usd:
        usd = convert(price, getattr(order, "currency", None), "USD", rates)
    return (0, float(usd if usd is not None else price))


def pick_cheapest(orders: list, rates: Optional[dict] = None):
    """Cheapest priced listing (compared in USD); listings without a price come last."""
    return sorted(orders, key=lambda o: _sort_key_usd(o, rates))[0]


def build_activity_data(kind: str, ws_code: str, orders: list, watch: Any = None,
                        rates: Optional[dict] = None,
                        dealer_phone: Optional[str] = None) -> dict:
    """``data`` of an alert_match Activity entry (the cheapest listing is the headline)."""
    head = pick_cheapest(orders, rates)
    year, _ = order_year_month(head)
    price = getattr(head, "price", None)
    thumb = None
    if watch is not None:
        thumb = (getattr(watch, "cover_image_thumbnail", None) or getattr(watch, "cover_image", None)
                 or ((getattr(watch, "image_thumbnails", None) or [None])[0])
                 or ((getattr(watch, "images", None) or [None])[0]))
    return {
        "kind": kind,
        "ws_code": ws_code,
        "reference": (getattr(watch, "reference", None) if watch is not None else None)
        or getattr(head, "reference", None),
        "brand": (getattr(watch, "brand", None) if watch is not None else None)
        or getattr(head, "brand", None),
        "model": (getattr(watch, "model", None) if watch is not None else None)
        or getattr(head, "model", None),
        "thumbnail": thumb,
        "country_code": getattr(head, "country_code", None),
        "country_name": country_name(getattr(head, "country_code", None),
                                     getattr(head, "country_name", None)),
        "year": year,
        "year_plus": bool(year) and kind == "wtb",
        "condition": order_condition(head),
        "price": float(price) if price and price > 0 else None,
        "currency": _norm_currency(getattr(head, "currency", None)) or None,
        "order_ids": [str(getattr(o, "id", "")) for o in [head] + [o for o in orders if o is not head]],
        "count": len(orders),
        "dealer_phone": dealer_phone if dealer_phone is not None else getattr(head, "whatsapp_phone", None),
        "watch_id": str(watch.id) if watch is not None and getattr(watch, "id", None) else
        getattr(head, "watch_id", None),
    }


def push_texts(data: dict) -> tuple[str, str]:
    """(title, body) of the lock-screen push for an Activity ``data`` dict."""
    kind, count = data["kind"], int(data.get("count") or 1)
    title = push_title(kind, data["ws_code"], count)
    line2 = push_line_location(data.get("country_code"), data.get("country_name"),
                               year_label(kind, data.get("year")), data.get("condition"))
    line3 = push_line_price(kind, data.get("price"), data.get("currency"), count)
    body = "\n".join(p for p in (line2, line3) if p)
    return title, body


def push_payload(data: dict, notification_id: Optional[str] = None) -> dict[str, str]:
    payload = {
        "type": "alert_match",
        "ws_code": data["ws_code"] or "",
        "watch_id": data.get("watch_id") or "",
        "order_ids": ",".join(data.get("order_ids") or []),
        "kind": data["kind"],
    }
    if notification_id:
        payload["notification_id"] = notification_id
    return payload


ALERT_PUSH_CATEGORY = "alert_match"
# Bundled pushes use a second iOS category so the action reads "View listings" (plural).
ALERT_PUSH_CATEGORY_MULTI = "alert_match_multi"


# --------------------------------------------------------------------------------------------
# DB
# --------------------------------------------------------------------------------------------


async def migrate_legacy(alert) -> list:
    """Convert a legacy alert document in place (and insert a sibling when it covered both
    WTS and WTB). Returns the resulting alerts; new-shape alerts are returned unchanged."""
    if getattr(alert, "alert_type", None):
        return [alert]
    from app.models.watch_alert import WatchAlert

    shapes = legacy_to_new(alert)
    result = []
    for i, shape in enumerate(shapes):
        target = alert if i == 0 else WatchAlert(
            user_id=alert.user_id, ws_code=alert.ws_code, is_active=alert.is_active,
            created_at=alert.created_at,
        )
        for k, v in shape.items():
            setattr(target, k, v)
        for legacy in ("notify_wts", "notify_wtb", "target_month", "target_year",
                       "year_direction", "price_threshold", "price_direction"):
            setattr(target, legacy, None)
        target.updated_at = datetime.utcnow()
        try:
            if i == 0:
                await target.save()
            else:
                await target.insert()
        except Exception as e:
            logger.error("Legacy alert migration failed for %s: %s", getattr(alert, "id", "?"), e)
        result.append(target)
    return result


async def migrate_all(alerts: list) -> list:
    out = []
    for a in alerts:
        out.extend(await migrate_legacy(a))
    return out


async def _load_rates() -> dict:
    try:
        from app.services.fx import load_rates  # agent C
    except ImportError:
        return {"USD": 1.0, "USDT": 1.0}
    try:
        return await load_rates() or {"USD": 1.0}
    except Exception as e:
        logger.error("FX rates unavailable for alert matching: %s", e)
        return {"USD": 1.0}


async def dispatch_new_listings(order_ids: list[str],
                                exclude_user_ids: Optional[Iterable[str]] = None) -> int:
    """Match alerts against new orders, create Activity entries and send bundled pushes.

    Never raises – a failure here must not break an import. Returns the number of Activity
    entries created."""
    try:
        return await _dispatch(order_ids, set(exclude_user_ids or []))
    except Exception as e:
        logger.error("Alert dispatch failed: %s", e, exc_info=True)
        return 0


async def _dispatch(order_ids: list[str], exclude: set[str]) -> int:
    from beanie import PydanticObjectId
    from beanie.operators import In

    from app.models.notification import Notification, NotificationType
    from app.models.order import Order, OrderStatus
    from app.models.user import User, UserRole
    from app.models.watch import Watch
    from app.models.watch_alert import WatchAlert
    from app.services.notifications import send_push_to_user

    oids = []
    for oid in dict.fromkeys(order_ids or []):
        try:
            oids.append(PydanticObjectId(str(oid)))
        except Exception:
            continue
    if not oids:
        return 0

    orders = await Order.find(In(Order.id, oids)).to_list()
    orders = [o for o in orders if o.ws_code and _val(o.status) == OrderStatus.ACTIVE.value]
    if not orders:
        return 0
    ws_codes = sorted({o.ws_code for o in orders})

    alerts = await WatchAlert.find(In(WatchAlert.ws_code, ws_codes), WatchAlert.is_active == True).to_list()  # noqa: E712
    if not alerts:
        return 0
    alerts = await migrate_all(alerts)

    user_ids = {a.user_id for a in alerts if a.user_id not in exclude}
    users = {}
    if user_ids:
        valid = []
        for uid in user_ids:
            try:
                valid.append(PydanticObjectId(uid))
            except Exception:
                pass
        for u in await User.find(In(User.id, valid)).to_list():
            if not u.is_active or not (u.approved or u.role == UserRole.ADMIN):
                continue
            if not getattr(u, "notify_alert_matches", True):
                continue  # "WTS & WTB alerts" toggle off → no Activity entry, no push
            users[str(u.id)] = u
    if not users:
        return 0

    rates = await _load_rates() if any(a.price_mode != "any" for a in alerts) or len(orders) > 1 else None

    groups: "OrderedDict[tuple[str, str, str], OrderedDict[str, Any]]" = OrderedDict()
    for order in orders:
        for alert in alerts:
            if alert.user_id not in users or alert.ws_code != order.ws_code:
                continue
            if order.user_id == alert.user_id:
                continue  # own listing
            if alert_matches(alert, order, rates):
                key = (alert.user_id, order.ws_code, order_kind(order))
                groups.setdefault(key, OrderedDict())[str(order.id)] = order

    if not groups:
        return 0

    watches = {}
    for w in await Watch.find(In(Watch.ws_code, ws_codes)).to_list():
        watches.setdefault(w.ws_code, w)

    created = 0
    for (user_id, ws_code, kind), matched in groups.items():
        user = users[user_id]
        data = build_activity_data(kind, ws_code, list(matched.values()), watches.get(ws_code), rates)
        if not data.get("dealer_phone"):
            data["dealer_phone"] = await _dealer_phone(data["order_ids"][0], matched)
        title, body = push_texts(data)
        notification = Notification(
            user_id=user_id,
            type=NotificationType.ALERT_MATCH,
            title=title,
            body=body,
            reference=data.get("reference"),
            ws_code=ws_code,
            order_id=data["order_ids"][0],
            price=data.get("price"),
            currency=data.get("currency") or "EUR",
            data=data,
        )
        await notification.insert()
        created += 1
        try:
            await send_push_to_user(
                user, title=title, body=body,
                data=push_payload(data, str(notification.id)),
                notification_type="alert_match",
                category_id=(
                    ALERT_PUSH_CATEGORY_MULTI
                    if len(data.get("order_ids") or []) > 1
                    else ALERT_PUSH_CATEGORY
                ),
            )
        except Exception as e:
            logger.error("Alert push to %s failed: %s", user_id, e)
    logger.info("Alert dispatch: %d orders, %d Activity entries", len(orders), created)
    return created


async def _dealer_phone(order_id: str, matched: dict) -> Optional[str]:
    order = matched.get(order_id)
    if order is None or not getattr(order, "user_id", None):
        return None
    try:
        from beanie import PydanticObjectId
        from app.models.user import User

        u = await User.get(PydanticObjectId(order.user_id))
        return u.whatsapp_phone if u else None
    except Exception:
        return None
