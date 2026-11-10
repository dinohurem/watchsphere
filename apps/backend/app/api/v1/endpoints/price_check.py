"""Admin price check page (generator spec §9, "Price check page").

Search a WS code → the listings currently in its median, split Fresh / Used, with
outliers highlighted against the median of the same condition and year (±25 %,
else the nearest year ±35 %). Per listing: correct price, exclude from median,
delete. Every change recomputes the stats for that WS code.
"""
from datetime import datetime, timedelta
from typing import Any, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import get_current_admin_user
from app.core.market_constants import PERIOD_DAYS
from app.models.order import Order, OrderType
from app.models.user import User
from app.models.watch import Watch
from app.services import fx
from app.services import market_stats as ms

router = APIRouter()


def watch_summary(w: Optional[Watch]) -> Optional[dict]:
    if not w:
        return None
    return {
        "id": str(w.id),
        "ws_code": w.ws_code,
        "brand": w.brand,
        "model": w.model,
        "reference": w.reference,
        "image": w.cover_image_thumbnail or w.cover_image or (w.images[0] if w.images else None),
        "status": w.status.value if hasattr(w.status, "value") else w.status,
    }


def listing_payload(l: ms.Listing, currency: str, rates: dict, outlier: Optional[dict]) -> dict:
    o: Order = l.extra.get("order")
    return {
        "id": l.id,
        "ws_code": l.ws_code,
        "price": l.price,
        "currency": l.currency,
        "converted": round(fx.convert(l.price_usd, "USD", currency, rates), 2) if l.price_usd else None,
        "price_usd": l.price_usd,
        "condition": l.condition,
        "year": l.year,
        "month": l.month,
        "fresh": ms.is_fresh(l.condition, l.year, l.month, l.created_at),
        "created_at": l.created_at,
        "dealer_phone": getattr(o, "whatsapp_phone", None),
        "dealer_name": getattr(o, "user_name", None),
        "country_code": getattr(o, "country_code", None),
        "source_text": getattr(o, "source_text", None) or getattr(o, "notes", None),
        "source_group": getattr(o, "source_group", None),
        "remarks": getattr(o, "remarks", None),
        "match_method": getattr(o, "match_method", None),
        "excluded": l.excluded,
        "active": l.active,
        "outlier": (
            {
                **outlier,
                "median": round(fx.convert(outlier["median_usd"], "USD", currency, rates), 2),
            }
            if outlier else None
        ),
    }


async def suspicious_listings(currency: str, period: str = "1M", limit: int = 200) -> list[dict]:
    """All WTS listings far from the median of their WS code + condition + year,
    worst first (approval page tab 6)."""
    rates = await fx.load_rates()
    days = PERIOD_DAYS.get(period.upper())
    query: dict = {"order_type": OrderType.SELL.value, "ws_code": {"$nin": [None, ""]}, "price": {"$ne": None}}
    if days is not None:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=days)}
    orders = await Order.find(query).to_list()
    by_ws: dict[str, list[ms.Listing]] = {}
    for o in orders:
        l = ms.listing_from_order(o, rates)
        l.extra = {"order": o}
        by_ws.setdefault(l.ws_code, []).append(l)
    flagged = []
    for ws, items in by_ws.items():
        pool = ms.median_eligible(items)
        for l in pool:
            res = ms.outlier_check(l, pool)
            if res and res["is_outlier"]:
                flagged.append(listing_payload(l, currency, rates, res))
    flagged.sort(key=lambda x: abs(x["outlier"]["deviation_pct"]), reverse=True)
    return flagged[:limit]


@router.get("/search")
async def search_ws_codes(
    q: str = Query(..., min_length=1),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    import re

    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    watches = await Watch.find(
        {"$or": [{"ws_code": rx}, {"reference": rx}, {"model": rx}, {"aliases": rx}]}
    ).limit(25).to_list()
    return [watch_summary(w) for w in watches]


@router.get("/watch/{ws_code:path}")
async def price_check(
    ws_code: str,
    period: str = Query("1M"),
    currency: str = Query("EUR"),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    currency = currency.upper()
    rates = await fx.load_rates()
    listings = await ms.median_listings(ws_code, period)
    pool = ms.median_eligible(listings)
    pool_ids = {l.id for l in pool}
    fresh, used = ms.split_fresh_used(pool)

    def side(items: list[ms.Listing]) -> dict:
        med = ms.median_or_none(l.price_usd for l in items)
        rows = [listing_payload(l, currency, rates, ms.outlier_check(l, pool)) for l in items]
        rows.sort(key=lambda r: r["converted"] or 0)
        return {
            "median": round(fx.convert(med, "USD", currency, rates), 2) if med else None,
            "count": len(items),
            "listings": rows,
        }

    others = [
        listing_payload(l, currency, rates, None) | {
            "not_counted_reason": (
                "excluded" if l.excluded else "no price / unknown currency" if not l.price_usd else "duplicate"
            )
        }
        for l in listings if l.id not in pool_ids
    ]
    watch = await Watch.find_one({"ws_code": ws_code})
    return {
        "ws_code": ws_code,
        "watch": watch_summary(watch),
        "period": period.upper(),
        "currency": currency,
        "fresh": side(fresh),
        "used": side(used),
        "not_counted": others,
    }


async def _order_or_404(order_id: str) -> Order:
    try:
        order = await Order.get(PydanticObjectId(order_id))
    except Exception:
        order = None
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


class CorrectPrice(BaseModel):
    price: float
    currency: Optional[str] = None


class ExcludeRequest(BaseModel):
    excluded: bool = True


@router.post("/orders/{order_id}/correct-price")
async def correct_price(
    order_id: str,
    payload: CorrectPrice,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Fix the price in the app and in the median."""
    if payload.price <= 0:
        raise HTTPException(status_code=400, detail="Price must be positive")
    order = await _order_or_404(order_id)
    order.price = payload.price
    if payload.currency:
        cur = fx.normalize_currency(payload.currency)
        rates = await fx.load_rates()
        if cur not in rates:
            raise HTTPException(status_code=400, detail=f"Unknown currency {payload.currency}")
        order.currency = cur
    order.usd_price = await fx.to_usd(order.price, order.currency)
    order.updated_at = datetime.utcnow()
    await order.save()
    if order.ws_code:
        await ms.recompute_for([order.ws_code])
    return {"ok": True, "id": str(order.id), "price": order.price, "currency": order.currency,
            "usd_price": order.usd_price}


@router.post("/orders/{order_id}/exclude")
async def exclude_from_median(
    order_id: str,
    payload: ExcludeRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Listing stays in the app but does not count for medians."""
    order = await _order_or_404(order_id)
    order.excluded_from_median = payload.excluded
    order.updated_at = datetime.utcnow()
    await order.save()
    if order.ws_code:
        await ms.recompute_for([order.ws_code])
    return {"ok": True, "id": str(order.id), "excluded": order.excluded_from_median}


@router.delete("/orders/{order_id}")
async def delete_listing(
    order_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Remove the listing everywhere."""
    order = await _order_or_404(order_id)
    ws_code = order.ws_code
    await order.delete()
    if ws_code:
        await ms.recompute_for([ws_code])
    return {"ok": True, "id": order_id}


@router.post("/recompute-all")
async def recompute_all_stats(current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Recompute WatchMarketStats for every WS code (also runs after each FX refresh)."""
    return {"ws_codes": await ms.recompute_all()}
