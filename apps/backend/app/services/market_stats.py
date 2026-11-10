"""Market data: medians, % changes, market-vs-retail (generator spec §9).

This is the ONE place that computes medians and percentages, so the detail page,
trend sheet, retail sheet and market cards always show the same number.

Rules (spec §9):
1. Only WTS listings feed medians; prices converted with the current FX table.
2. Duplicates count once: same dealer + same watch + same price.
3. Listings excluded in the price check (``excluded_from_median``) are ignored.
4. Fresh = Unworn and card date at most 3 months old relative to the listing
   date; Used = everything else.
5. Fewer than 3 listings → no median (app shows "Not enough data").
6. The Used median / chart is one median over all years, but the Used % change
   compares the same year with the same year and averages those changes.
7. Market vs retail: worldwide median of all Fresh WTS listings vs each country's
   list price; the card shows the average over countries with a list price.

Results are precomputed into ``WatchMarketStats`` (USD) and converted on read.
The pure helpers at the top are unit-tested in tests/test_market_stats.py.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median as _median
from typing import Iterable, Optional

from app.core.market_constants import LIST_PRICE_COUNTRIES, PERIOD_DAYS
from app.services.fx import convert, load_rates

logger = logging.getLogger(__name__)

MIN_LISTINGS = 3
FRESH_MAX_MONTHS = 3
PERIODS = ["1W", "1M", "3M", "1Y", "ALL"]
# Chart bucket size per period (days).
SERIES_BUCKET_DAYS = {"1W": 1, "1M": 3, "3M": 7, "1Y": 30, "ALL": 30}

# Outlier bands (same as the generator's price guardrail).
OUTLIER_SAME_YEAR = 0.25
OUTLIER_NEIGHBOUR_YEAR = 0.35


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #

@dataclass
class Listing:
    id: str
    ws_code: str
    order_type: str  # "sell" (WTS) | "buy" (WTB)
    dealer: str
    price: Optional[float]
    currency: Optional[str]
    price_usd: Optional[float]
    condition: Optional[str]  # "Unworn" | "Used"
    year: Optional[int]
    month: Optional[int]
    created_at: datetime
    excluded: bool = False
    active: bool = True
    extra: dict = field(default_factory=dict)


def median_or_none(values: Iterable[float], min_count: int = MIN_LISTINGS) -> Optional[float]:
    vals = [float(v) for v in values if v is not None]
    if len(vals) < min_count:
        return None
    return float(_median(vals))


def pct_change(current: Optional[float], previous: Optional[float]) -> Optional[float]:
    if current is None or previous is None or previous == 0:
        return None
    return (current - previous) / previous * 100.0


def months_between(card_year: int, card_month: int, ref: datetime) -> int:
    """Whole months from the card date to the reference date (negative = card later)."""
    return (ref.year - card_year) * 12 + (ref.month - card_month)


def is_fresh(
    condition: Optional[str],
    card_year: Optional[int],
    card_month: Optional[int],
    listing_date: datetime,
) -> bool:
    """Fresh = Unworn and card date ≤ 3 months old at the listing date.

    The card month must be known — a year alone cannot prove the card is at most
    three months old, so such listings count as Used (spec §9.5).
    """
    if (condition or "").strip().lower() != "unworn":
        return False
    if not card_year or not card_month or not (1 <= card_month <= 12):
        return False
    return months_between(card_year, card_month, listing_date) <= FRESH_MAX_MONTHS


def dedup_listings(listings: Iterable[Listing]) -> list[Listing]:
    """Same dealer + same watch + same price counts once (newest kept)."""
    best: dict[tuple, Listing] = {}
    passthrough: list[Listing] = []
    for item in listings:
        if not item.dealer or item.price is None:
            passthrough.append(item)
            continue
        key = (
            item.dealer.strip(),
            (item.ws_code or "").strip().upper(),
            round(float(item.price), 2),
            (item.currency or "").strip().upper(),
        )
        prev = best.get(key)
        if prev is None or item.created_at > prev.created_at:
            best[key] = item
    return list(best.values()) + passthrough


def median_eligible(listings: Iterable[Listing]) -> list[Listing]:
    """WTS, priced in a known currency, not excluded, deduplicated."""
    eligible = [
        l for l in listings
        if l.order_type == "sell" and not l.excluded and l.price_usd is not None and l.price_usd > 0
    ]
    return dedup_listings(eligible)


def split_fresh_used(listings: Iterable[Listing]) -> tuple[list[Listing], list[Listing]]:
    fresh, used = [], []
    for l in listings:
        (fresh if is_fresh(l.condition, l.year, l.month, l.created_at) else used).append(l)
    return fresh, used


def same_year_change_pct(
    current: Iterable[tuple[Optional[int], float]],
    previous: Iterable[tuple[Optional[int], float]],
) -> Optional[float]:
    """Used % change: compare each year with the same year, then average.

    Inputs are (year, price) pairs. A year contributes only if it has listings in
    both windows. Overall at least MIN_LISTINGS on each side, otherwise None.
    """
    cur = list(current)
    prev = list(previous)
    if len(cur) < MIN_LISTINGS or len(prev) < MIN_LISTINGS:
        return None
    by_year_cur: dict[Optional[int], list[float]] = {}
    by_year_prev: dict[Optional[int], list[float]] = {}
    for y, p in cur:
        by_year_cur.setdefault(y, []).append(p)
    for y, p in prev:
        by_year_prev.setdefault(y, []).append(p)
    changes = []
    for y, prices in by_year_cur.items():
        if y not in by_year_prev:
            continue
        c = pct_change(float(_median(prices)), float(_median(by_year_prev[y])))
        if c is not None:
            changes.append(c)
    if not changes:
        return None
    return sum(changes) / len(changes)


def window_bounds(period: str, now: datetime, first_seen: Optional[datetime]) -> tuple[datetime, datetime, datetime]:
    """(previous_start, current_start, now). ALL splits the full history in half."""
    days = PERIOD_DAYS.get(period)
    if days is None:
        start = first_seen or now
        half = (now - start) / 2
        return start, start + half, now
    span = timedelta(days=days)
    return now - 2 * span, now - span, now


def build_series(listings: list[Listing], start: datetime, now: datetime, bucket_days: int) -> list[dict]:
    """Bucket medians (USD) from ``start`` to ``now``; empty buckets are skipped."""
    if not listings:
        return []
    bucket = timedelta(days=bucket_days)
    points = []
    edge = start
    while edge < now:
        nxt = min(edge + bucket, now)
        vals = [l.price_usd for l in listings if edge <= l.created_at < nxt or (nxt == now and l.created_at == now)]
        if vals:
            points.append({"date": nxt.strftime("%Y-%m-%d"), "median_usd": float(_median(vals))})
        edge = nxt
    return points


def period_stats(listings: list[Listing], period: str, now: datetime) -> dict:
    """Fresh/Used medians, changes and series for one period (USD)."""
    eligible = median_eligible(listings)
    first_seen = min((l.created_at for l in eligible), default=None)
    prev_start, cur_start, end = window_bounds(period, now, first_seen)
    if PERIOD_DAYS.get(period) is None:
        current = eligible  # ALL: the displayed median covers the whole history
        cur_half = [l for l in eligible if l.created_at >= cur_start]
        prev_half = [l for l in eligible if l.created_at < cur_start]
    else:
        current = [l for l in eligible if cur_start <= l.created_at <= end]
        cur_half = current
        prev_half = [l for l in eligible if prev_start <= l.created_at < cur_start]

    fresh_cur, used_cur = split_fresh_used(current)
    fresh_ch_cur, used_ch_cur = split_fresh_used(cur_half)
    fresh_prev, used_prev = split_fresh_used(prev_half)

    fresh_median = median_or_none(l.price_usd for l in fresh_cur)
    used_median = median_or_none(l.price_usd for l in used_cur)
    fresh_change = pct_change(
        median_or_none(l.price_usd for l in fresh_ch_cur),
        median_or_none(l.price_usd for l in fresh_prev),
    )
    used_change = same_year_change_pct(
        [(l.year, l.price_usd) for l in used_ch_cur],
        [(l.year, l.price_usd) for l in used_prev],
    )

    # Trend chip: WTS change = Fresh and Used changes weighted by current counts.
    parts = [(fresh_change, len(fresh_ch_cur)), (used_change, len(used_ch_cur))]
    parts = [(c, n) for c, n in parts if c is not None and n > 0]
    wts_change = (sum(c * n for c, n in parts) / sum(n for _, n in parts)) if parts else None

    series_start = cur_start if PERIOD_DAYS.get(period) is not None else (first_seen or now)
    bucket = SERIES_BUCKET_DAYS.get(period, 7)
    return {
        "enough_data": fresh_median is not None or used_median is not None,
        "wts_change_pct": _round(wts_change),
        "fresh": {
            "median_usd": fresh_median,
            "change_pct": _round(fresh_change),
            "count": len(fresh_cur),
            "series": build_series(fresh_cur, series_start, now, bucket),
        },
        "used": {
            "median_usd": used_median,
            "change_pct": _round(used_change),
            "count": len(used_cur),
            "series": build_series(used_cur, series_start, now, bucket),
        },
    }


def retail_breakdown(
    fresh_median_usd: Optional[float],
    list_prices: dict[str, float],
    discontinued: bool,
    rates: dict[str, float],
    currency: str = "USD",
) -> dict:
    """Market vs retail per country, in the fixed 13-country order (spec §9.8)."""
    countries = []
    pcts = []
    fresh_conv = convert(fresh_median_usd, "USD", currency, rates) if fresh_median_usd else None
    for c in LIST_PRICE_COUNTRIES:
        row = {
            "code": c["code"],
            "name": c["name"],
            "tax_label": c["tax_label"],
            "list_currency": c["currency"],
            "list_price": None,
            "list_price_converted": None,
            "vs_retail_pct": None,
            "status": "no_data",
        }
        if discontinued:
            row["status"] = "discontinued"
            countries.append(row)
            continue
        lp = (list_prices or {}).get(c["code"])
        if lp:
            row["list_price"] = float(lp)
            row["list_price_converted"] = _round(convert(lp, c["currency"], currency, rates), 2)
            row["status"] = "ok"
            lp_usd = convert(lp, c["currency"], "USD", rates)
            if fresh_median_usd and lp_usd:
                pct = (fresh_median_usd / lp_usd - 1) * 100.0
                row["vs_retail_pct"] = _round(pct)
                pcts.append(pct)
        countries.append(row)

    if discontinued:
        status = "discontinued"
    elif pcts:
        status = "ok"
    else:
        status = "no_data"
    return {
        "status": status,
        "currency": currency,
        "fresh_median": _round(fresh_conv, 2),
        "avg_vs_retail_pct": _round(sum(pcts) / len(pcts)) if pcts else None,
        "countries": countries,
    }


def outlier_check(target: Listing, peers: list[Listing]) -> Optional[dict]:
    """Compare a listing with the median of the same condition + year.

    Same year needs ≥2 other listings (±25 %); otherwise the nearest year with
    ≥2 listings is used (±35 %). Returns {"median_usd", "deviation_pct",
    "basis_year", "tolerance_pct", "is_outlier"} or None when there is no basis.
    Mirrors the generator's price guardrail so the two never disagree.
    """
    if target.price_usd is None:
        return None
    cond = (target.condition or "").lower()
    others = [
        p for p in peers
        if p.id != target.id and (p.condition or "").lower() == cond and p.price_usd
    ]
    by_year: dict[Optional[int], list[float]] = {}
    for p in others:
        by_year.setdefault(p.year, []).append(p.price_usd)

    basis = None
    tolerance = OUTLIER_SAME_YEAR
    if len(by_year.get(target.year, [])) >= 2:
        basis = target.year
    elif target.year is not None:
        for offset in range(1, 11):
            for y in (target.year + offset, target.year - offset):
                if len(by_year.get(y, [])) >= 2:
                    basis = y
                    break
            if basis is not None:
                break
        tolerance = OUTLIER_NEIGHBOUR_YEAR
    if basis is None and not (target.year is None and len(by_year.get(None, [])) >= 2):
        return None
    values = by_year.get(basis, [])
    med = float(_median(values))
    deviation = (target.price_usd - med) / med * 100.0 if med else 0.0
    return {
        "median_usd": med,
        "deviation_pct": round(deviation, 1),
        "basis_year": basis,
        "tolerance_pct": int(tolerance * 100),
        "is_outlier": abs(deviation) > tolerance * 100,
    }


def _round(value: Optional[float], digits: int = 1) -> Optional[float]:
    return round(value, digits) if value is not None else None


# --------------------------------------------------------------------------- #
# DB side
# --------------------------------------------------------------------------- #

def listing_from_order(o, rates: dict[str, float]) -> Listing:
    """Order (document or raw dict) → Listing with a current-rate USD price."""
    get = (lambda k, d=None: o.get(k, d)) if isinstance(o, dict) else (lambda k, d=None: getattr(o, k, d))
    otype = get("order_type")
    otype = getattr(otype, "value", otype)
    cond = get("condition")
    cond = getattr(cond, "value", cond)
    status = get("status")
    status = getattr(status, "value", status)
    price = get("price")
    usd = convert(price, get("currency") or "USD", "USD", rates) if price is not None else None
    oid = get("_id") if isinstance(o, dict) else get("id")
    return Listing(
        id=str(oid),
        ws_code=(get("ws_code") or "").strip(),
        order_type=otype or "",
        dealer=(get("whatsapp_phone") or get("user_id") or "").strip(),
        price=price,
        currency=get("currency"),
        price_usd=usd,
        condition=cond,
        year=get("year"),
        month=get("watch_month"),
        created_at=get("created_at") or datetime.utcnow(),
        excluded=bool(get("excluded_from_median")),
        active=(status or "active") == "active",
    )


ORDER_PROJECTION = {
    "order_type": 1, "ws_code": 1, "whatsapp_phone": 1, "user_id": 1, "price": 1,
    "currency": 1, "condition": 1, "year": 1, "watch_month": 1, "created_at": 1,
    "excluded_from_median": 1, "status": 1,
}


async def _load_listings(ws_codes: list[str], rates: dict[str, float]) -> dict[str, list[Listing]]:
    from app.models.order import Order

    out: dict[str, list[Listing]] = {c: [] for c in ws_codes}
    cursor = Order.get_motor_collection().find({"ws_code": {"$in": ws_codes}}, ORDER_PROJECTION)
    async for doc in cursor:
        l = listing_from_order(doc, rates)
        out.setdefault(l.ws_code, []).append(l)
    return out


async def _watch_info(ws_codes: list[str]) -> dict[str, dict]:
    from app.models.watch import Watch

    info: dict[str, dict] = {}
    cursor = Watch.get_motor_collection().find(
        {"ws_code": {"$in": ws_codes}},
        {"ws_code": 1, "brand": 1, "list_prices": 1, "discontinued": 1},
    )
    async for doc in cursor:
        info.setdefault(doc["ws_code"], doc)
    return info


def compute_stats(ws_code: str, listings: list[Listing], watch: Optional[dict],
                  rates: dict[str, float], now: datetime) -> dict:
    """Everything stored on WatchMarketStats for one ws_code (pure)."""
    active = [l for l in listings if l.active]
    month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)
    recent = [l for l in listings if l.created_at >= month_ago]
    previous = [l for l in listings if two_months_ago <= l.created_at < month_ago]

    periods = {p: period_stats(listings, p, now) for p in PERIODS}

    fresh_all, _ = split_fresh_used(median_eligible(active))
    fresh_median_usd = median_or_none(l.price_usd for l in fresh_all)
    retail = retail_breakdown(
        fresh_median_usd,
        (watch or {}).get("list_prices") or {},
        bool((watch or {}).get("discontinued")),
        rates,
    )
    prev_n = len(previous)
    cur_n = len(recent)
    activity = (cur_n - prev_n) / max(prev_n, 1) * 100.0 if (cur_n or prev_n) else None
    return {
        "ws_code": ws_code,
        "brand": (watch or {}).get("brand"),
        "wts_count": sum(1 for l in active if l.order_type == "sell"),
        "wtb_count": sum(1 for l in active if l.order_type == "buy"),
        "change_1m_pct": periods["1M"]["wts_change_pct"],
        "retail_pct": retail["avg_vs_retail_pct"],
        "retail_status": retail["status"],
        "fresh_median_usd": fresh_median_usd,
        "listings_1m": cur_n,
        "listings_prev_1m": prev_n,
        "activity_change_pct": _round(activity),
        "wtb_1m": sum(1 for l in recent if l.order_type == "buy"),
        "periods": periods,
        "computed_at": now,
    }


async def recompute_for(ws_codes: list[str]) -> None:
    from app.models.market_stats import WatchMarketStats

    codes = sorted({c.strip() for c in ws_codes if c and c.strip()})
    if not codes:
        return
    rates = await load_rates()
    now = datetime.utcnow()
    collection = WatchMarketStats.get_motor_collection()
    for i in range(0, len(codes), 200):
        chunk = codes[i:i + 200]
        listings = await _load_listings(chunk, rates)
        watches = await _watch_info(chunk)
        for code in chunk:
            data = compute_stats(code, listings.get(code, []), watches.get(code), rates, now)
            await collection.update_one({"ws_code": code}, {"$set": data}, upsert=True)


async def recompute_all() -> int:
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order

    codes = [c for c in await Order.get_motor_collection().distinct("ws_code") if c]
    await recompute_for(codes)
    # Drop stats for ws_codes that no longer have any listing.
    await WatchMarketStats.get_motor_collection().delete_many({"ws_code": {"$nin": codes}})
    logger.info("market_stats: recomputed %d ws_code(s)", len(codes))
    return len(codes)


async def recompute_for_safe(ws_codes: list[str]) -> None:
    """Fire-and-forget variant for request paths: never raises."""
    try:
        await recompute_for(ws_codes)
    except Exception as exc:
        logger.exception("market_stats: recompute failed for %s: %s", ws_codes[:5], exc)


async def _get_stats(ws_code: str):
    from app.models.market_stats import WatchMarketStats

    doc = await WatchMarketStats.find_one({"ws_code": ws_code})
    if doc is None:
        await recompute_for([ws_code])
        doc = await WatchMarketStats.find_one({"ws_code": ws_code})
    return doc


def _conv(value: Optional[float], currency: str, rates: dict[str, float], digits: int = 2) -> Optional[float]:
    return _round(convert(value, "USD", currency, rates), digits) if value is not None else None


async def price_trend(ws_code: str, period: str, currency: str) -> dict:
    period = (period or "1M").upper()
    if period not in PERIODS:
        period = "1M"
    currency = (currency or "EUR").upper()
    rates = await load_rates()
    doc = await _get_stats(ws_code)
    p = (doc.periods if doc else {}).get(period) or {}

    def side(name: str) -> dict:
        s = p.get(name) or {}
        return {
            "median": _conv(s.get("median_usd"), currency, rates),
            "change_pct": s.get("change_pct"),
            "count": s.get("count", 0),
            "series": [
                {"date": pt["date"], "median": _conv(pt["median_usd"], currency, rates)}
                for pt in s.get("series", [])
            ],
        }

    return {
        "period": period,
        "currency": currency,
        "enough_data": bool(p.get("enough_data")),
        "wts_change_pct": p.get("wts_change_pct"),
        "fresh": side("fresh"),
        "used": side("used"),
    }


async def retail_comparison(ws_code: str, currency: str) -> dict:
    from app.models.watch import Watch

    currency = (currency or "EUR").upper()
    rates = await load_rates()
    doc = await _get_stats(ws_code)
    watch = await Watch.find_one({"ws_code": ws_code})
    return retail_breakdown(
        doc.fresh_median_usd if doc else None,
        (watch.list_prices if watch else {}) or {},
        bool(watch.discontinued) if watch else False,
        rates,
        currency,
    )


async def card_stats(ws_codes: list[str]) -> dict[str, dict]:
    from app.models.market_stats import WatchMarketStats

    codes = [c for c in dict.fromkeys(ws_codes) if c]
    if not codes:
        return {}
    docs = await WatchMarketStats.find({"ws_code": {"$in": codes}}).to_list()
    found = {d.ws_code: d for d in docs}
    missing = [c for c in codes if c not in found]
    if missing and len(missing) <= 50:
        await recompute_for(missing)
        for d in await WatchMarketStats.find({"ws_code": {"$in": missing}}).to_list():
            found[d.ws_code] = d
    out = {}
    for c in codes:
        d = found.get(c)
        out[c] = {
            "change_1m_pct": d.change_1m_pct if d else None,
            "wts_count": d.wts_count if d else 0,
            "wtb_count": d.wtb_count if d else 0,
            "retail_pct": d.retail_pct if d else None,
        }
    return out


async def show_signal(signal: str, brand: Optional[str] = None, direction: Optional[str] = None,
                      limit: int = 40, offset: int = 0) -> list[str]:
    from app.models.market_stats import WatchMarketStats

    signal = (signal or "top_movers").lower()
    direction = (direction or "most").lower()
    query: dict = {}
    if brand:
        query["brand"] = brand
    if signal == "most_requested":
        query["wtb_1m"] = {"$gt": 0}
        sort = [("wtb_1m", -1), ("wtb_count", -1)]
    elif signal == "rising":
        query["change_1m_pct"] = {"$gt": 0}
        sort = [("change_1m_pct", -1)]
    elif signal == "falling":
        query["change_1m_pct"] = {"$lt": 0}
        sort = [("change_1m_pct", 1)]
    elif signal == "above_retail":
        query["retail_pct"] = {"$gt": 0}
        sort = [("retail_pct", -1 if direction != "least" else 1)]
    elif signal == "below_retail":
        query["retail_pct"] = {"$lt": 0}
        sort = [("retail_pct", 1 if direction != "least" else -1)]
    else:  # top_movers: relative change in WTS+WTB listing count, month over month
        query["activity_change_pct"] = {"$ne": None}
        sort = [("activity_change_pct", -1), ("listings_1m", -1)]
    sort.append(("ws_code", 1))
    cursor = (
        WatchMarketStats.get_motor_collection()
        .find(query, {"ws_code": 1})
        .sort(sort)
        .skip(max(offset, 0))
        .limit(max(min(limit, 500), 1))
    )
    return [d["ws_code"] async for d in cursor]


async def median_listings(ws_code: str, period: str = "1M") -> list[Listing]:
    """Listings that are in the ws_code's median right now (price check page)."""
    from app.models.order import Order

    rates = await load_rates()
    days = PERIOD_DAYS.get((period or "1M").upper())
    query: dict = {"ws_code": ws_code, "order_type": "sell"}
    if days is not None:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=days)}
    docs = await Order.find(query).to_list()
    listings = []
    for o in docs:
        l = listing_from_order(o, rates)
        l.extra = {"order": o}
        listings.append(l)
    return listings
