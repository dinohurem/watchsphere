"""Card payloads for Market, Watchlist, Recently viewed and Search (redesign v3 §4, §5).

Card shape::

    {"id", "ws_code", "brand", "model", "reference", "collection", "image", "thumbnail",
     "change_1m_pct": float|None, "wts_count": int, "wtb_count": int, "retail_pct": float|None}

Numbers come from ``app.services.market_stats.card_stats`` (agent C, single source of truth for
medians / % changes). Until that module is importable the counts fall back to a direct count of
active orders and the percentages stay ``None``.
"""

import logging
from typing import Iterable, Optional

from beanie.operators import In

from app.models.order import Order, OrderStatus, OrderType
from app.models.watch import Watch, WatchStatus

logger = logging.getLogger(__name__)


def watch_image(watch: Watch) -> tuple[Optional[str], Optional[str]]:
    """(image, thumbnail) – cover image first, then the first gallery image."""
    image = watch.cover_image or (watch.images[0] if watch.images else None)
    thumb = (
        watch.cover_image_thumbnail
        or (watch.image_thumbnails[0] if watch.image_thumbnails else None)
        or image
    )
    return image, thumb


def empty_stats() -> dict:
    return {"change_1m_pct": None, "wts_count": 0, "wtb_count": 0, "retail_pct": None}


async def _fallback_counts(ws_codes: list[str]) -> dict[str, dict]:
    out = {c: empty_stats() for c in ws_codes}
    if not ws_codes:
        return out
    pipeline = [
        {"$match": {"ws_code": {"$in": ws_codes}, "status": OrderStatus.ACTIVE.value}},
        {"$group": {"_id": {"ws": "$ws_code", "t": "$order_type"}, "n": {"$sum": 1}}},
    ]
    try:
        rows = await Order.get_motor_collection().aggregate(pipeline).to_list(length=None)
    except Exception as e:
        logger.warning("card count fallback failed: %s", e)
        return out
    for r in rows:
        ws = r["_id"]["ws"]
        if ws not in out:
            continue
        key = "wts_count" if r["_id"]["t"] == OrderType.SELL.value else "wtb_count"
        out[ws][key] = int(r["n"])
    return out


async def stats_for(ws_codes: Iterable[str]) -> dict[str, dict]:
    codes = [c for c in dict.fromkeys(ws_codes) if c]
    if not codes:
        return {}
    try:
        from app.services.market_stats import card_stats  # agent C
    except ImportError:
        return await _fallback_counts(codes)
    try:
        stats = await card_stats(codes) or {}
    except Exception as e:
        logger.error("card_stats failed, using fallback counts: %s", e, exc_info=True)
        return await _fallback_counts(codes)
    return {c: {**empty_stats(), **(stats.get(c) or {})} for c in codes}


def build_card(watch: Watch, stats: Optional[dict]) -> dict:
    image, thumb = watch_image(watch)
    s = {**empty_stats(), **(stats or {})}
    return {
        "id": str(watch.id),
        "ws_code": watch.ws_code,
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "collection": watch.collection,
        "image": image,
        "thumbnail": thumb,
        "change_1m_pct": s.get("change_1m_pct"),
        "wts_count": int(s.get("wts_count") or 0),
        "wtb_count": int(s.get("wtb_count") or 0),
        "retail_pct": s.get("retail_pct"),
    }


async def cards_for_watches(watches: list[Watch]) -> list[dict]:
    stats = await stats_for(w.ws_code for w in watches if w.ws_code)
    return [build_card(w, stats.get(w.ws_code or "")) for w in watches]


async def watches_by_ws_codes(ws_codes: list[str], active_only: bool = True) -> dict[str, Watch]:
    codes = [c for c in dict.fromkeys(ws_codes) if c]
    if not codes:
        return {}
    conds = [In(Watch.ws_code, codes)]
    if active_only:
        conds.append(Watch.status == WatchStatus.ACTIVE)
    watches = await Watch.find(*conds).to_list()
    out: dict[str, Watch] = {}
    for w in watches:
        out.setdefault(w.ws_code, w)
    return out


async def cards_for_ws_codes(ws_codes: list[str], active_only: bool = True) -> list[dict]:
    """Cards in the order of ``ws_codes``; unknown codes are skipped."""
    by_code = await watches_by_ws_codes(ws_codes, active_only=active_only)
    ordered = [by_code[c] for c in dict.fromkeys(ws_codes) if c in by_code]
    return await cards_for_watches(ordered)
