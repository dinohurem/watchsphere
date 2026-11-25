"""Approval page, tab "Suspicious prices": the queue of held-back offers.

    GET  /approval/suspicious-prices                     the queue (stored flags, no recomputation)
    GET  /approval/suspicious-prices/filter-options      brands and counts per cause
    POST /approval/suspicious-prices/decide              approve | reject | fix_currency | correct_price
                                                         for ids or "all matching the filters"
    POST /approval/suspicious-prices/scan-existing       check the active offers of today (dry run first)

An offer lands here when it is created with a price far from the others of the same watch,
year and condition (``price_flags.check_new_orders``): status ``held``, flag in ``price_flag``.
Decisions are recorded as an undoable batch (same history and undo as the decision files).
"""
import re
from datetime import datetime
from typing import Any, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.v1.endpoints.approval_file import Snapper, apply_price_decisions
from app.core.deps import get_current_admin_user
from app.models.approval_file import ApprovalFileBatch
from app.models.order import Order, OrderStatus, OrderType
from app.models.user import User
from app.services import fx
from app.services import market_stats as ms
from app.services import price_actions, price_flags

router = APIRouter()

CHUNK = 500
DEFAULT_LIMIT = 5000
MAX_LIMIT = 20000

# Default: too cheap first (negative deviation first): cheap wrong offers are the main problem.
SORTS = {
    "cheap_first": [("price_flag.deviation_pct", 1)],
    "expensive_first": [("price_flag.deviation_pct", -1)],
    "newest": [("created_at", -1)],
    "ws_code": [("ws_code", 1), ("price_flag.deviation_pct", 1)],
}
DEFAULT_SORT = "cheap_first"


def held_sort(sort: Optional[str]) -> list:
    return SORTS.get(sort or DEFAULT_SORT, SORTS[DEFAULT_SORT]) + [("_id", 1)]


def held_filter(cause: Optional[str] = None, brand: Optional[str] = None, ws_code: Optional[str] = None,
                direction: Optional[str] = None) -> dict:
    q: dict = {"status": OrderStatus.HELD.value, "order_type": OrderType.SELL.value,
               "price_flag": {"$ne": None}}
    if cause and cause in price_flags.CAUSES:
        q["price_flag.cause"] = cause
    if brand and brand.strip():
        q["brand"] = {"$regex": f"^{re.escape(brand.strip())}$", "$options": "i"}
    if ws_code and ws_code.strip():
        q["ws_code"] = {"$regex": re.escape(ws_code.strip()), "$options": "i"}
    if direction == "cheap":
        q["price_flag.deviation_pct"] = {"$lt": 0}
    elif direction == "expensive":
        q["price_flag.deviation_pct"] = {"$gt": 0}
    return q


def _payload(d: dict, currency: str, rates: dict) -> dict:
    flag = d.get("price_flag") or {}
    med = flag.get("median_usd")
    price_usd = fx.convert(d.get("price"), d.get("currency") or "USD", "USD", rates) if d.get("price") else None
    cond = d.get("condition")
    return {
        "id": str(d["_id"]),
        "ws_code": d.get("ws_code"),
        "brand": d.get("brand"),
        "model": d.get("model"),
        "price": d.get("price"),
        "currency": d.get("currency"),
        "converted": round(fx.convert(price_usd, "USD", currency, rates), 2) if price_usd else None,
        "median": round(fx.convert(med, "USD", currency, rates), 2) if med else None,
        "offer_count": flag.get("offer_count"),
        "deviation_pct": flag.get("deviation_pct"),
        "basis_year": flag.get("basis_year"),
        "tolerance_pct": flag.get("tolerance_pct"),
        "cause": flag.get("cause"),
        "suggested_currency": flag.get("suggested_currency"),
        "suggested_price": flag.get("suggested_price"),
        "peers_currency": flag.get("peers_currency"),
        "other_line_ws_code": flag.get("other_line_ws_code"),
        "flagged_at": flag.get("flagged_at"),
        "condition": getattr(cond, "value", cond),
        "year": d.get("year"),
        "month": d.get("watch_month"),
        "created_at": d.get("created_at"),
        "dealer_phone": d.get("whatsapp_phone"),
        "source_group": d.get("source_group"),
        "source_text": d.get("source_text") or d.get("notes"),
        "remarks": d.get("remarks"),
    }


@router.get("/suspicious-prices")
async def suspicious_prices(
    currency: str = Query("EUR"),
    cause: Optional[str] = None,
    brand: Optional[str] = None,
    ws_code: Optional[str] = None,
    direction: Optional[str] = Query(None, pattern="^(cheap|expensive)$"),
    sort: str = Query(DEFAULT_SORT),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """The stored queue, sorted by cause / deviation. ``total`` is what "select all" decides."""
    currency = currency.upper()
    rates = await fx.load_rates()
    col = Order.get_motor_collection()
    q = held_filter(cause, brand, ws_code, direction)
    docs = [d async for d in col.find(q).sort(held_sort(sort)).skip(offset).limit(limit)]
    return {
        "items": [_payload(d, currency, rates) for d in docs],
        "total": await col.count_documents(q),
        "currency": currency,
    }


@router.get("/suspicious-prices/filter-options")
async def suspicious_filter_options(current_admin: User = Depends(get_current_admin_user)) -> Any:
    col = Order.get_motor_collection()
    base = held_filter()
    brands = await col.distinct("brand", base)
    rows = await col.aggregate([{"$match": base}, {"$group": {"_id": "$price_flag.cause", "n": {"$sum": 1}}}]).to_list(None)
    counts = {c: 0 for c in price_flags.CAUSES}
    counts.update({r["_id"]: r["n"] for r in rows if r["_id"]})
    return {"brands": sorted(b for b in brands if b), "causes": counts, "total": sum(counts.values())}


# --- decisions ---------------------------------------------------------------

class PriceFilters(BaseModel):
    cause: Optional[str] = None
    brand: Optional[str] = None
    ws_code: Optional[str] = None
    direction: Optional[str] = None


class PriceDecide(BaseModel):
    decision: str = Field(..., description="approve | reject | fix_currency | correct_price")
    value: Optional[str] = Field(None, description="ISO code / number, or 'suggested'")
    ids: List[str] = Field(default_factory=list)
    all_matching: bool = False
    filters: PriceFilters = Field(default_factory=PriceFilters)
    exclude_ids: List[str] = Field(default_factory=list)
    limit: int = Field(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    after_id: Optional[str] = None


def _oids(values: List[str]) -> list:
    out = []
    for v in values:
        try:
            out.append(PydanticObjectId(v))
        except Exception:
            pass
    return out


async def _refresh(codes: set) -> None:
    await ms.recompute_for_safe(sorted(c for c in codes if c))


@router.post("/suspicious-prices/decide")
async def decide_prices(
    req: PriceDecide,
    background: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """One decision for one offer, a ticked selection, or everything matching the filters.
    Recorded as a batch (``batch_id``) that "Decisions by file" lists and can undo."""
    if req.decision not in price_actions.PRICE_DECISIONS:
        raise HTTPException(status_code=400, detail="Unknown decision")
    if req.decision in ("fix_currency", "correct_price") and not req.value:
        raise HTTPException(status_code=400, detail="value is required")
    if req.decision == "fix_currency" and req.value.lower() != "suggested":
        rates = await fx.load_rates()
        if (fx.normalize_currency(req.value) or "") not in rates:
            raise HTTPException(status_code=400, detail=f"Unknown currency '{req.value}'")
    if req.decision == "correct_price" and req.value.lower() != "suggested" \
            and price_actions.parse_price(req.value) is None:
        raise HTTPException(status_code=400, detail="Price must be a positive number")
    if not req.all_matching and not req.ids:
        raise HTTPException(status_code=400, detail="Nothing selected")

    col = Order.get_motor_collection()
    query = held_filter(req.filters.cause, req.filters.brand, req.filters.ws_code, req.filters.direction) \
        if req.all_matching else {**held_filter(), "_id": {"$in": _oids(req.ids)}}
    if req.all_matching and req.exclude_ids:
        query["_id"] = {"$nin": _oids(req.exclude_ids)}
    after = _oids([req.after_id])[0] if req.after_id and _oids([req.after_id]) else None

    ids: list = []
    last = after
    remaining = 0
    cur = col.find({**query, **({"_id": {**query.get("_id", {}), "$gt": after}} if after else {})}, {"_id": 1}).sort("_id", 1)
    async for d in cur:
        if len(ids) >= req.limit:
            remaining += 1
            continue
        ids.append(d["_id"])
        last = d["_id"]
    if not ids:
        return {"ok": True, "decided": 0, "failed_count": 0, "failed": {}, "remaining": 0, "batch_id": None}

    label = f"Suspicious prices: {req.decision}{' ' + req.value if req.value else ''} on {len(ids)} offers"
    batch = ApprovalFileBatch(
        file_name=label, created_by=str(current_admin.id) if current_admin.id else "",
        created_by_name=getattr(current_admin, "name", None), status="committing",
        summary={"apply_total": len(ids), "kind": "suspicious-prices"},
    )
    await batch.insert()
    bid = str(batch.id)
    snap = Snapper(bid)
    touched: set = set()
    done: list = []
    failed: dict = {}
    for i in range(0, len(ids), CHUNK):
        d, f = await apply_price_decisions(ids[i:i + CHUNK], req.decision, req.value or "", current_admin, snap, touched)
        await snap.finish()
        touched.update(snap.touched_codes)
        snap.touched_codes = set()
        done.extend(d)
        failed.update(f)
    batch.status = "committed"
    batch.committed_at = datetime.utcnow()
    batch.result = {"done": {f"prices:{req.decision}": len(done)}, "failed": len(failed),
                    "committed_by": str(current_admin.id)}
    await batch.save()
    background.add_task(_refresh, touched)
    return {
        "ok": not failed, "decided": len(done), "failed_count": len(failed),
        "failed": dict(list(failed.items())[:20]), "remaining": remaining,
        "next_after": str(last) if remaining and last else None, "batch_id": bid,
    }


@router.post("/suspicious-prices/scan-existing")
async def scan_existing(
    dry_run: bool = Query(True),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Check the active WTS offers that exist today and hold the suspicious ones.

    Existing offers are never hidden by a deploy alone: run it with ``dry_run=true`` first
    (counts per cause, nothing changes), then with ``dry_run=false``. Offers an admin already
    approved are skipped. Undo: approve or fix them in the queue."""
    return await price_flags.scan_active(dry_run=dry_run)
