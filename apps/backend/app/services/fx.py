"""Central exchange rates (generator spec §8).

Every conversion in the backend — order ``usd_price``, medians, the AI chat's EUR
approximations, the generator's price checks and the app's 9 display currencies —
reads the same table, stored in MongoDB (``FxRate``) and refreshed daily from the
ECB reference rates (via api.frankfurter.dev). If the source is unreachable the
last stored table stays in use; on a fresh database the hard-coded ``SEED_RATES``
below are written as the starting point.

Rates are expressed as *units of currency per 1 USD*. USDT is pinned to USD.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx

from app.core.market_constants import APP_CURRENCIES, SUPPORTED_CURRENCIES

logger = logging.getLogger(__name__)

# Fallback / seed table (units per 1 USD), the fixed rates used across the codebase
# before the central table existed. Only used until the first successful refresh.
SEED_RATES: dict[str, float] = {
    "USD": 1.0,
    "USDT": 1.0,
    "EUR": 0.92,
    "HKD": 7.8,
    "GBP": 0.79,
    "CHF": 0.88,
    "AED": 3.6725,
    "CNY": 7.2,
    "JPY": 152.0,
    "SGD": 1.34,
}

# The ECB does not quote AED; the dirham is pegged to the dollar.
PEGGED_RATES: dict[str, float] = {"AED": 3.6725, "USDT": 1.0, "USD": 1.0}

# Spellings dealers and older imports use → ISO code.
CURRENCY_ALIASES: dict[str, str] = {
    "RMB": "CNY",
    "CNH": "CNY",
    "HK$": "HKD",
    "HKD$": "HKD",
    "US$": "USD",
    "$": "USD",
    "€": "EUR",
    "EURO": "EUR",
    "EUROS": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "YEN": "JPY",
    "SFR": "CHF",
    "DHS": "AED",
    "DH": "AED",
    "AED$": "AED",
    "S$": "SGD",
    "SG$": "SGD",
}

SOURCE_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_TTL_SECONDS = 600
# A table older than this is refreshed by the startup task.
STALE_AFTER = timedelta(hours=26)

_cache: Optional[dict[str, float]] = None
_cache_updated_at: Optional[datetime] = None
_cache_loaded_at: float = 0.0


def normalize_currency(currency: Optional[str]) -> Optional[str]:
    """ISO code for a currency label, or None when empty."""
    if not currency:
        return None
    c = currency.strip().upper()
    return CURRENCY_ALIASES.get(c, c)


def convert(
    amount: Optional[float],
    from_cur: Optional[str],
    to_cur: Optional[str],
    rates: dict[str, float],
) -> Optional[float]:
    """Convert ``amount`` between currencies using a units-per-USD table.

    Pure. Returns None when the amount is missing or either currency is unknown —
    an unknown currency must never be silently treated as USD.
    """
    if amount is None:
        return None
    src = normalize_currency(from_cur) or "USD"
    dst = normalize_currency(to_cur) or "USD"
    if src == dst:
        return float(amount)
    src_rate = rates.get(src)
    dst_rate = rates.get(dst)
    if not src_rate or not dst_rate:
        return None
    return float(amount) / src_rate * dst_rate


def _complete(rates: dict[str, float]) -> dict[str, float]:
    """Fill pegs and any currency the source skipped from the seed table."""
    out = {k.upper(): float(v) for k, v in rates.items() if v}
    out.update(PEGGED_RATES)
    for cur in SUPPORTED_CURRENCIES:
        if cur not in out and cur in SEED_RATES:
            out[cur] = SEED_RATES[cur]
    return out


def _set_cache(rates: dict[str, float], updated_at: Optional[datetime]) -> None:
    global _cache, _cache_updated_at, _cache_loaded_at
    _cache = rates
    _cache_updated_at = updated_at
    _cache_loaded_at = time.monotonic()


def cached_rates() -> dict[str, float]:
    """Synchronous access for code that cannot await: last loaded table or seed."""
    return dict(_cache) if _cache else dict(SEED_RATES)


async def load_rates(force: bool = False) -> dict[str, float]:
    """Current rate table (units per 1 USD). Cached in-process for ~10 minutes."""
    if (
        not force
        and _cache is not None
        and time.monotonic() - _cache_loaded_at < CACHE_TTL_SECONDS
    ):
        return dict(_cache)

    from app.models.fx_rate import FxRate

    try:
        doc = await FxRate.find_one({"base": "USD"})
    except Exception as exc:  # DB not initialised (scripts, tests) → seed
        logger.debug("fx: rate table unavailable, using seed (%s)", exc)
        return dict(SEED_RATES)

    if doc is None:
        doc = FxRate(base="USD", rates=_complete(SEED_RATES), source="seed")
        try:
            await doc.insert()
        except Exception as exc:
            logger.warning("fx: could not seed rate table: %s", exc)
    rates = _complete(doc.rates or {})
    _set_cache(rates, doc.updated_at)
    return dict(rates)


async def rates_updated_at() -> Optional[datetime]:
    await load_rates()
    return _cache_updated_at


async def to_usd(amount: Optional[float], currency: Optional[str]) -> Optional[float]:
    if amount is None:
        return None
    rates = await load_rates()
    value = convert(amount, currency or "USD", "USD", rates)
    return round(value, 2) if value is not None else None


async def _fetch_from_source() -> tuple[dict[str, float], Optional[str]]:
    wanted = [c for c in APP_CURRENCIES if c not in ("USD", "AED")]
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(SOURCE_URL, params={"from": "USD", "to": ",".join(wanted)})
        resp.raise_for_status()
        data = resp.json()
    rates = {k.upper(): float(v) for k, v in (data.get("rates") or {}).items() if v}
    missing = [c for c in wanted if c not in rates]
    if missing:
        raise ValueError(f"source returned no rate for {missing}")
    return rates, data.get("date")


async def refresh_rates_from_source() -> dict[str, float]:
    """Fetch today's ECB rates and store them. Falls back to the stored table.

    Does not recompute derived data — callers use ``refresh_and_recompute`` for that.
    """
    from app.models.fx_rate import FxRate, FxRateHistory

    try:
        fetched, source_date = await _fetch_from_source()
    except Exception as exc:
        logger.warning("fx: refresh failed, keeping stored rates: %s", exc)
        return await load_rates(force=True)

    rates = _complete(fetched)
    now = datetime.utcnow()
    doc = await FxRate.find_one({"base": "USD"})
    if doc is None:
        doc = FxRate(base="USD")
    doc.rates = rates
    doc.source = "ecb"
    doc.source_date = source_date
    doc.updated_at = now
    await doc.save()
    try:
        await FxRateHistory(rates=rates, source="ecb", source_date=source_date, fetched_at=now).insert()
    except Exception as exc:
        logger.debug("fx: history insert failed: %s", exc)
    _set_cache(rates, now)
    logger.info("fx: refreshed %d rates (ECB %s)", len(rates), source_date)
    return dict(rates)


async def recompute_order_usd_prices() -> int:
    """Recompute ``Order.usd_price`` for every order from its original price + currency.

    Needed for "cheapest first" across currencies (spec §8.3). Orders with an
    unknown currency get ``usd_price = None`` rather than a wrong number.
    """
    from pymongo import UpdateOne

    from app.models.order import Order

    rates = await load_rates(force=True)
    collection = Order.get_motor_collection()
    ops: list = []
    updated = 0
    cursor = collection.find({}, {"price": 1, "currency": 1, "usd_price": 1})
    async for doc in cursor:
        price = doc.get("price")
        usd = None
        if price is not None:
            value = convert(price, doc.get("currency") or "USD", "USD", rates)
            usd = round(value, 2) if value is not None else None
        if usd != doc.get("usd_price"):
            ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": {"usd_price": usd}}))
        if len(ops) >= 1000:
            res = await collection.bulk_write(ops, ordered=False)
            updated += res.modified_count
            ops = []
    if ops:
        res = await collection.bulk_write(ops, ordered=False)
        updated += res.modified_count
    logger.info("fx: recomputed usd_price on %d order(s)", updated)
    return updated


async def refresh_and_recompute() -> dict:
    """Daily job: refresh rates, then recompute every derived USD price and the
    precomputed market stats (medians are converted with the current rate)."""
    rates = await refresh_rates_from_source()
    orders_updated = await recompute_order_usd_prices()
    stats_updated = 0
    try:
        from app.services.market_stats import recompute_all

        stats_updated = await recompute_all()
    except Exception as exc:
        logger.exception("fx: market stats recompute failed: %s", exc)
    return {
        "rates": rates,
        "updated_at": _cache_updated_at.isoformat() if _cache_updated_at else None,
        "orders_updated": orders_updated,
        "stats_updated": stats_updated,
    }


async def refresh_if_stale() -> None:
    """Startup hook: refresh when the stored table is older than a day."""
    try:
        updated_at = await rates_updated_at()
        from app.models.fx_rate import FxRate

        doc = await FxRate.find_one({"base": "USD"})
        if doc is None or doc.source == "seed" or not updated_at or (
            datetime.utcnow() - updated_at > STALE_AFTER
        ):
            await refresh_and_recompute()
    except Exception as exc:
        logger.warning("fx: startup refresh skipped: %s", exc)
