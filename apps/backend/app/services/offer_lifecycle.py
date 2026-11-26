"""Offer quality at import time: the guard before publishing, and the life cycle.

Guard (``ws_quality.guard``): every offer the generator produces must be backed by
the dealer's own line: the watch named literally, the price on that line and not a
reference number, the written currency, no dial/bracelet conflict, and a USD price
inside 60-170 % of the watch's reference price. Offers without that evidence are
held for review instead of going live; references-as-prices, adverts, accessories
and "sold" lines are dropped.

Life cycle (``ws_quality.lifecycle``): one live offer per dealer + watch + card
date + condition + side. The price is not part of the identity, so a new price
replaces the old one (kept in ``price_history``). An imported offer expires 10 days
(WTS) / 14 days (WTB) after the dealer last posted it; a repost brings it back.

Both are switched by ``OFFER_GUARD_ENABLED`` / ``OFFER_EXPIRY_ENABLED`` (env).
"""
import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.services.ws_quality import guard as _guard
from app.services.ws_quality import lifecycle as _lifecycle

logger = logging.getLogger(__name__)

WTS_TTL_DAYS = _lifecycle.OFFER_TTL_DAYS
WTB_TTL_DAYS = _lifecycle.WTB_TTL_DAYS
EXPIRY_SWEEP_SECONDS = 3600
# Expired offers stay matchable for a repost (it reactivates them) this long.
REVIVE_WINDOW_DAYS = 60


def _flag(name: str, default: bool = True) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() not in ("0", "false", "no", "off", "")


def guard_enabled() -> bool:
    return _flag("OFFER_GUARD_ENABLED", True)


def expiry_enabled() -> bool:
    return _flag("OFFER_EXPIRY_ENABLED", True)


# --------------------------------------------------------------------------- #
# Life cycle

def ttl_days(order_type: str) -> int:
    return WTB_TTL_DAYS if str(order_type).lower() in ("buy", "wtb") else WTS_TTL_DAYS


def expires_at(order_type: str, message_at: datetime) -> datetime:
    return message_at + timedelta(days=ttl_days(order_type))


def offer_key(order_type: str, ws_code: str, phone: str, month_year: str, condition: str) -> tuple:
    """Identity of an offer. No price and no currency: a new price for the same piece
    replaces the old one. Two pieces of one watch differ in card date or condition."""
    return (
        str(order_type).lower(),
        (ws_code or "").strip().upper(),
        (phone or "").replace(" ", "").strip(),
        (month_year or "").strip().lower(),
        (condition or "").strip().lower(),
    )


_INVISIBLE = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]")


def line_key(text: Optional[str]) -> str:
    """The dealer's line, compared as written: case, spacing and invisible characters ignored.

    This is the identity of an offer: the same dealer posting the same line again (in the same
    group, another group, or an hourly repost) is the same offer."""
    t = _INVISIBLE.sub("", text or "").lower()
    return re.sub(r"[\s\xa0]+", " ", t).strip()


_NUM_RE = re.compile(r"(\d[\d.,]*)\s*([kKmM\u4e07]?)(?![\d])")
_YEAR4_RE = re.compile(r"(?<![\d.,])((?:19|20)\d{2})(?![\d])")
_YEAR2_RE = re.compile(r"(?<![\d.,])(\d{2})\s*[yY](?![a-zA-Z])|\d{1,2}\s*/\s*(\d{2})(?!\d)")


def _number_values(token: str, suffix: str) -> List[float]:
    mult = {"k": 1e3, "m": 1e6, "\u4e07": 1e4}.get(suffix.lower(), 1.0)
    out: List[float] = []
    for variant in (token, token.replace(",", ""), token.replace(".", "").replace(",", ""),
                    token.replace(",", ".")):
        try:
            out.append(float(variant) * mult)
        except ValueError:
            continue
    return out


def reading_matches_line(price: Optional[float], year: Optional[int], text: Optional[str]) -> bool:
    """Does a stored offer's price and year still follow from its dealer line?

    Used before a repost refreshes an old offer: a line with another price, or another written
    year, does not support the offer, so the offer must not be kept alive by it. Lenient on
    purpose: a year is only checked when the line writes one, a price must show up in some
    notation (192k, 1.86m, 105.000, 126,500)."""
    t = text or ""
    if price:
        found = False
        for m in _NUM_RE.finditer(t):
            if any(abs(v - price) <= max(1.0, price * 0.005) for v in _number_values(m.group(1), m.group(2))):
                found = True
                break
        if not found:
            return False
    if year:
        years = {int(m.group(1)) for m in _YEAR4_RE.finditer(t)}
        for m in _YEAR2_RE.finditer(t):
            yy = m.group(1) or m.group(2)
            if yy:
                years.add(2000 + int(yy))
        written = {y for y in years if 1990 <= y <= 2035}
        if written and year not in written:
            return False
    return True


def _imported_filter() -> dict:
    # Dealer offers from WhatsApp carry the sender's number; app users' own orders do not.
    return {"whatsapp_phone": {"$nin": [None, ""]}}


async def expire_stale_orders(now: Optional[datetime] = None) -> int:
    """Flip imported offers nobody reposted within their TTL to ``expired``.

    Status flip, not a delete: a repost reactivates the same order. Offers imported
    before expiry existed have no ``expires_at``; their last post time
    (``created_at``, which a repost moves forward) decides.
    """
    from app.models.order import Order, OrderStatus, OrderType

    if not expiry_enabled():
        return 0
    now = now or datetime.utcnow()
    col = Order.get_motor_collection()
    base = {"status": OrderStatus.ACTIVE.value, **_imported_filter()}
    conditions = [
        {**base, "expires_at": {"$lt": now}},
        {**base, "expires_at": None, "order_type": OrderType.SELL.value,
         "created_at": {"$lt": now - timedelta(days=WTS_TTL_DAYS)}},
        {**base, "expires_at": None, "order_type": OrderType.BUY.value,
         "created_at": {"$lt": now - timedelta(days=WTB_TTL_DAYS)}},
    ]
    total = 0
    touched: set = set()
    for flt in conditions:
        codes = await col.distinct("ws_code", flt)
        res = await col.update_many(flt, {"$set": {"status": OrderStatus.EXPIRED.value, "updated_at": now}})
        if res.modified_count:
            total += res.modified_count
            touched.update(c for c in codes if c)
    if touched:
        from app.services.market_stats import recompute_for_safe

        await recompute_for_safe(sorted(touched))
    if total:
        logger.info("offer expiry: %d offer(s) expired on %d watch(es)", total, len(touched))
    return total


async def expiry_loop() -> None:
    """Background sweep, hourly. Never raises."""
    while True:
        try:
            await expire_stale_orders()
        except Exception as exc:
            logger.warning("offer expiry sweep failed: %s", exc)
        await asyncio.sleep(EXPIRY_SWEEP_SECONDS)


# --------------------------------------------------------------------------- #
# Guard

@dataclass
class GuardResult:
    decision: str  # accept | fix | hold | reject | skipped
    reasons: List[str] = field(default_factory=list)
    currency: Optional[str] = None  # suggested currency for "fix"

    @property
    def publish(self) -> bool:
        return self.decision in ("accept", "fix", "skipped")


REASON_TEXT = {
    "advert": "Advert",
    "part_or_accessory": "Part or accessory, not a watch",
    "sold_or_reserved": "Sold or reserved",
    "price_equals_reference": "The price is the reference number",
    "reference_not_in_text": "The dealer's line does not name this watch",
    "no_price": "No price on the dealer's line",
    "price_not_on_watch_line": "The price is not on this watch's line",
    "currency_ambiguous_in_text": "Two currencies on the line",
    "price_below_band": "Price far below the usual price of this watch",
    "price_above_band": "Price far above the usual price of this watch",
    "price_expanded_x1000_unverified": "Shorthand price (k) could not be confirmed",
}


def describe(reasons: Iterable[str]) -> str:
    out = []
    for r in reasons:
        if r.startswith("different_reference_in_text:"):
            out.append(f"The line names another reference ({r.split(':', 1)[1]})")
        elif r.startswith("variant_conflict"):
            out.append("Dial or bracelet contradicts the WS code (" + r.split(":", 1)[-1].strip() + ")")
        elif r.startswith("currency_in_text_"):
            out.append("Currency corrected from the text")
        elif r.startswith("price_fits_only_as_"):
            out.append(f"Price only fits as {r.rsplit('_', 1)[-1]}")
        else:
            out.append(REASON_TEXT.get(r, r))
    return "; ".join(out)


def set_fx(rates: Dict[str, float]) -> None:
    """Feed the guard the live FX table (units per USD) instead of its built-in one."""
    for cur, per_usd in (rates or {}).items():
        if per_usd:
            _guard.FX_USD[cur.upper()] = 1.0 / float(per_usd)


def reference_prices(orders: Iterable[Any]) -> Dict[str, Tuple[float, int]]:
    """Reference price per WS code for the price band: median USD of live sell offers,
    one value per dealer (their newest). Codes with fewer than 5 dealers get none."""
    newest: Dict[str, Dict[str, Tuple[datetime, float]]] = {}
    for o in orders:
        if getattr(o.order_type, "value", o.order_type) != "sell" or not o.usd_price or not o.ws_code:
            continue
        dealer = (o.whatsapp_phone or o.user_id or "").strip()
        code = o.ws_code.strip().upper()
        ts = o.created_at or datetime.min
        cur = newest.setdefault(code, {}).get(dealer)
        if cur is None or ts > cur[0]:
            newest[code][dealer] = (ts, float(o.usd_price))
    out: Dict[str, Tuple[float, int]] = {}
    for code, by_dealer in newest.items():
        vals = [v for _, v in by_dealer.values()]
        if len(vals) >= _guard.MIN_REFERENCE_OFFERS:
            out[code] = (median(vals), len(vals))
    return out


def catalog_entry(watch: Any) -> dict:
    return {
        "reference": getattr(watch, "reference", None) or "",
        "oem_references": list(getattr(watch, "oem_references", None) or []),
        "aliases": list(getattr(watch, "aliases", None) or []),
        "dial": getattr(watch, "dial", None),
        "bracelet": getattr(watch, "bracelet", None),
    }


def check_row(
    *,
    order_type: str,
    ws_code: str,
    price: Optional[float],
    currency: Optional[str],
    source_line: str,
    message: str,
    watch: Any,
    reference: Optional[Tuple[float, int]],
) -> GuardResult:
    """Run the guard on one import row. Rows without the dealer's text (a hand-made
    CSV) cannot be checked and pass as ``skipped``."""
    if not (source_line or "").strip():
        return GuardResult("skipped")
    side = "WTB" if str(order_type).lower() in ("buy", "wtb") else "WTS"
    ref_usd, ref_n = reference if (reference and side == "WTS") else (None, 0)
    try:
        v = _guard.check_offer(
            side=side, ws_code=ws_code, price=price, currency=currency,
            source_line=source_line, catalog=catalog_entry(watch),
            reference_price_usd=ref_usd, reference_count=ref_n, message=message or "",
        )
    except Exception as exc:  # the guard must never break an import
        logger.warning("offer guard failed on %s: %s", ws_code, exc)
        return GuardResult("skipped", [f"guard_error:{exc}"])
    return GuardResult(v.decision, list(v.reasons), (v.suggestion or {}).get("currency"))
