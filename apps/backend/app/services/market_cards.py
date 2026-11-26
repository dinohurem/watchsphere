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
    return {"change_1m_pct": None, "change_1w_pct": None, "wts_count": 0, "wtb_count": 0, "retail_pct": None}


async def _fallback_counts(ws_codes: list[str]) -> dict[str, dict]:
    out = {c: empty_stats() for c in ws_codes}
    if not ws_codes:
        return out
    live = await _live_counts(ws_codes)
    for ws, counts in (live or {}).items():
        if ws in out:
            out[ws].update(counts)
    return out


async def _live_counts(ws_codes: list[str]) -> Optional[dict[str, dict]]:
    """All-time WTS/WTB order counts per ws_code (active and expired: an expired offer
    stays in the history), straight from the orders (None if the query fails)."""
    if not ws_codes:
        return {}
    pipeline = [
        {"$match": {"ws_code": {"$in": ws_codes},
                    "status": {"$in": [OrderStatus.ACTIVE.value, OrderStatus.EXPIRED.value]}}},
        {"$group": {"_id": {"ws": "$ws_code", "t": "$order_type"}, "n": {"$sum": 1}}},
    ]
    try:
        rows = await Order.get_motor_collection().aggregate(pipeline).to_list(length=None)
    except Exception as e:
        logger.warning("live card counts failed: %s", e)
        return None
    counts: dict[str, dict] = {}
    for r in rows:
        key = "wts_count" if r["_id"]["t"] == OrderType.SELL.value else "wtb_count"
        counts.setdefault(r["_id"]["ws"], {})[key] = int(r["n"])
    return counts


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
    out = {c: {**empty_stats(), **(stats.get(c) or {})} for c in codes}
    # WTS/WTB counts are always live. The stored stats are only refreshed on imports, edits and
    # the daily run, so their counts drift as listings change; the watch page counts live orders,
    # and a card showing the stored number made the page count jump on open.
    live = await _live_counts(codes)
    if live is not None:
        for c in codes:
            out[c]["wts_count"] = live.get(c, {}).get("wts_count", 0)
            out[c]["wtb_count"] = live.get(c, {}).get("wtb_count", 0)
    return out


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
        # Weekly change. change_1m_pct keeps its legacy name so existing app builds show the
        # weekly value; change_1w_pct is the honest name for new clients.
        "change_1m_pct": s.get("change_1w_pct"),
        "change_1w_pct": s.get("change_1w_pct"),
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


# --------------------------------------------------------------------------- #
# Lowest ask per watch variant (used by /market/aggregated)
# --------------------------------------------------------------------------- #

async def lowest_asks(watches: list[Watch]) -> dict[str, dict]:
    """Cheapest ACTIVE sell offer per watch, keyed by ``str(watch.id)``.

    Offers are matched on the watch's own ws_code (variant level; the reference only for a watch
    without a ws_code). Prices are compared in USD at the current rates and the winner is returned
    in ITS OWN currency: ``{"price", "currency", "price_usd"}``. Offers whose currency has no rate
    are skipped rather than guessed. A watch with no active offer is absent from the result.
    """
    from app.services.fx import convert, load_rates

    codes = list({w.ws_code for w in watches if w.ws_code})
    refs = list({w.reference for w in watches if not w.ws_code and w.reference})
    if not codes and not refs:
        return {}
    ors = []
    if codes:
        ors.append({"ws_code": {"$in": codes}})
    if refs:
        ors.append({"reference": {"$in": refs}, "ws_code": {"$in": [None, ""]}})
    query = {"order_type": OrderType.SELL.value, "status": OrderStatus.ACTIVE.value,
             "price": {"$gt": 0}, "$or": ors}
    rates = await load_rates()
    best_ws: dict[str, dict] = {}
    best_ref: dict[str, dict] = {}
    cursor = Order.get_motor_collection().find(
        query, {"ws_code": 1, "reference": 1, "price": 1, "currency": 1})
    async for o in cursor:
        usd = convert(o.get("price"), o.get("currency") or "USD", "USD", rates)
        if usd is None:
            continue
        row = {"price": o["price"], "currency": o.get("currency") or "USD", "price_usd": usd}
        ws = (o.get("ws_code") or "").strip()
        bucket, key = (best_ws, ws) if ws else (best_ref, o.get("reference"))
        if key and (key not in bucket or usd < bucket[key]["price_usd"]):
            bucket[key] = row
    out: dict[str, dict] = {}
    for w in watches:
        row = best_ws.get(w.ws_code) if w.ws_code else best_ref.get(w.reference)
        if row:
            out[str(w.id)] = row
    return out


async def real_price_history(currency_by_code: dict[str, str]) -> dict[str, list[float]]:
    """Recorded median series (1M, else 1W) per ws_code, in the given currency. Never invented:
    a code with no recorded series is absent."""
    from app.models.market_stats import WatchMarketStats
    from app.services.fx import convert, load_rates

    codes = [c for c in currency_by_code if c]
    if not codes:
        return {}
    rates = await load_rates()
    out: dict[str, list[float]] = {}
    for doc in await WatchMarketStats.find({"ws_code": {"$in": codes}}).to_list():
        for period in ("1M", "1W"):
            p = (doc.periods or {}).get(period) or {}
            series = (p.get("fresh") or {}).get("series") or (p.get("used") or {}).get("series") or []
            vals = [convert(pt.get("median_usd"), "USD", currency_by_code.get(doc.ws_code, "USD"), rates)
                    for pt in series]
            vals = [round(v, 2) for v in vals if v is not None]
            if vals:
                out[doc.ws_code] = vals
                break
    return out
