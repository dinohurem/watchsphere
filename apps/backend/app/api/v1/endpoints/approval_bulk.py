"""Approval page: bulk decisions on the AI decisions and Unsure tabs.

    GET  /approval/filter-options?tab=ai|unsure     brands, chat groups, reasons to filter by
    POST /approval/bulk/decide                      decide many cases at once

A selection is either explicit (``ids`` for AI decisions, ``keys`` = identical-text groups for
Unsure) or "everything matching the filters" (``all_matching``, minus what was unticked). The
server resolves it, so the browser never sends 30,000 ids and never decides item by item.
Every item goes through the same decide logic as a click (see approval.py).
"""
from typing import Any, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.v1.endpoints.approval import (
    apply_ai_action, apply_ai_confirm_many, apply_unsure_action, review_filter,
)
from app.core.deps import get_current_admin_user
from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus
from app.models.user import User
from app.models.watch import Watch
from app.services import market_stats as ms

router = APIRouter()

CHUNK = 500
DEFAULT_LIMIT = 2000
MAX_LIMIT = 20000

# Spellings the decision file and the UI use -> the action the approval code knows.
ACTION_ALIASES = {"not_in_catalogue": "not_in_catalog"}


class Filters(BaseModel):
    brand: Optional[str] = None
    group: Optional[str] = None
    reason: Optional[str] = None


class BulkDecide(BaseModel):
    tab: str = Field(..., description="ai | unsure")
    action: str = Field(..., description="ai: confirm | correct | not_in_catalog | discard; "
                                         "unsure: confirm | pick | not_in_catalog | discard")
    ws_code: Optional[str] = None
    ids: List[str] = Field(default_factory=list)          # ai: item ids
    keys: List[str] = Field(default_factory=list)         # unsure: identical-text group keys
    all_matching: bool = False
    filters: Filters = Field(default_factory=Filters)
    exclude_ids: List[str] = Field(default_factory=list)
    exclude_keys: List[str] = Field(default_factory=list)
    limit: int = Field(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    after_id: Optional[str] = None  # continue after this item id (from the previous ``next_after``)


def _oid(value: str):
    try:
        return PydanticObjectId(value)
    except Exception:
        return None


def _oids(values: List[str]) -> list:
    out = []
    for v in values:
        try:
            out.append(PydanticObjectId(v))
        except Exception:
            pass
    return out


def group_clause(keys: List[str]) -> dict:
    """Items of the given Unsure groups (a group key is the normalised text, or the item id
    for an item without text)."""
    return {"$or": [
        {"text_key": {"$in": keys}},
        {"_id": {"$in": _oids(keys)}, "text_key": {"$in": [None, ""]}},
    ]}


def selection_query(req: BulkDecide) -> dict:
    ai = req.tab == "ai"
    q: dict = {
        "kind": (ReviewKind.AI_DECISION if ai else ReviewKind.UNSURE).value,
        "status": ReviewStatus.PENDING.value,
    }
    if req.all_matching:
        q.update(review_filter(req.filters.brand, req.filters.group, req.filters.reason, ai=ai))
        clauses = []
        if req.exclude_ids:
            clauses.append({"_id": {"$nin": _oids(req.exclude_ids)}})
        if req.exclude_keys:
            clauses.append({"$nor": [group_clause(req.exclude_keys)]})
        if clauses:
            q["$and"] = clauses
    elif ai:
        q["_id"] = {"$in": _oids(req.ids)}
    else:
        q.update(group_clause(req.keys))
    return q


# --- shared by the bulk endpoint and the decision file ------------------------

def normalize_action(action: str) -> str:
    return ACTION_ALIASES.get(action, action)


async def decide_ai_items(items: list[PipelineItem], admin: User, action: str,
                          ws_code: Optional[str], touched: set) -> tuple[int, dict, list[str]]:
    """-> (decided, {item id: reason}, ids of items created). Same logic as the click."""
    action = normalize_action(action)
    if action not in ("confirm", "correct", "not_in_catalog", "discard"):
        raise HTTPException(status_code=400, detail="Unknown action")
    if action == "confirm":
        return await apply_ai_confirm_many(items, admin), {}, []
    done = 0
    failed: dict = {}
    created: list[str] = []
    for item in items:
        try:
            res = await apply_ai_action(item, admin, action, ws_code, touched=touched)
        except HTTPException as exc:
            if exc.status_code == 400 and action == "correct":
                raise  # a bad WS code fails every row the same way
            failed[str(item.id)] = str(exc.detail)
            continue
        created.extend(res["created_items"])
        done += 1
    return done, failed, created


async def decide_unsure_items(items: list[PipelineItem], admin: User, action: str,
                              ws_code: Optional[str]) -> tuple[int, list[str], dict]:
    """-> (decided, new order ids, {item id: reason}). ``confirm`` takes each item's first
    suggested WS code (the generator's best candidate); ``correct``/``pick`` take ``ws_code``."""
    action = normalize_action(action)
    if action == "correct":
        action = "pick"
    if action == "confirm":
        by_code: dict[str, list[PipelineItem]] = {}
        failed: dict = {}
        for i in items:
            code = ((i.candidates or [{}])[0] or {}).get("ws_code")
            if code:
                by_code.setdefault(code, []).append(i)
            else:
                failed[str(i.id)] = "No suggested WS code to confirm"
        new_ids: list[str] = []
        done = 0
        for code, group in by_code.items():
            ids, bad = await apply_unsure_action(group, admin, "pick", code)
            new_ids.extend(ids)
            failed.update(bad)
            done += len(group) - len(bad)
        return done, new_ids, failed
    if action not in ("pick", "not_in_catalog", "discard"):
        raise HTTPException(status_code=400, detail="Unknown action")
    new_ids, failed = await apply_unsure_action(items, admin, action, ws_code, fast=True)
    return len(items) - len(failed), new_ids, failed


# --- endpoints ---------------------------------------------------------------

@router.get("/filter-options")
async def filter_options(
    tab: str = Query("ai", pattern="^(ai|unsure)$"),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """What the three filters of a tab can be set to (pending items only)."""
    ai = tab == "ai"
    base = {"kind": (ReviewKind.AI_DECISION if ai else ReviewKind.UNSURE).value,
            "status": ReviewStatus.PENDING.value}
    coll = PipelineItem.get_motor_collection()
    brands = await coll.distinct("row.Marke", base)
    groups = await coll.distinct("group_name", base)
    rows = await coll.aggregate([
        {"$match": {**base, ("ai_reason" if ai else "reason"): {"$nin": [None, ""]}}},
        {"$group": {"_id": "$ai_reason" if ai else "$reason", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 50},
    ]).to_list(length=50)
    return {
        "brands": sorted(b for b in brands if isinstance(b, str) and b.strip()),
        "groups": sorted(g for g in groups if g),
        "reasons": [{"reason": r["_id"], "count": r["n"]} for r in rows],
    }


@router.post("/bulk/decide")
async def bulk_decide(
    req: BulkDecide,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Decide everything in the selection, in chunks. Items that cannot be decided (no sender
    phone, price quarantine, ...) stay in the queue and are listed in ``failed``. The slow
    actions stop after ``limit`` items; ``remaining`` > 0 tells the page to call again with
    ``after_id`` = ``next_after`` (so items that cannot be decided are not retried forever)."""
    if req.tab not in ("ai", "unsure"):
        raise HTTPException(status_code=400, detail="tab must be ai or unsure")
    if not req.all_matching and not (req.ids if req.tab == "ai" else req.keys):
        raise HTTPException(status_code=400, detail="Nothing selected")
    action = normalize_action(req.action)
    if action in ("correct", "pick") and not req.ws_code:
        raise HTTPException(status_code=400, detail="ws_code is required")
    if req.ws_code and not await Watch.find_one({"ws_code": req.ws_code}):
        raise HTTPException(status_code=404, detail=f"Watch {req.ws_code} not found")

    query = selection_query(req)
    coll = PipelineItem.get_motor_collection()
    touched: set = set()
    decided = 0
    new_orders: list[str] = []
    failed: dict = {}
    last_id = _oid(req.after_id) if req.after_id else None
    processed = 0
    while processed < req.limit:
        q = dict(query)
        if last_id is not None:
            q["_id"] = {**q.get("_id", {}), "$gt": last_id} if isinstance(q.get("_id"), dict) else {"$gt": last_id}
        ids = [d["_id"] async for d in coll.find(q, {"_id": 1}).sort("_id", 1).limit(min(CHUNK, req.limit - processed))]
        if not ids:
            break
        last_id = ids[-1]
        processed += len(ids)
        items = await PipelineItem.find({"_id": {"$in": ids}}).to_list()
        if req.tab == "ai":
            n, bad, _ = await decide_ai_items(items, current_admin, action, req.ws_code, touched)
        else:
            n, orders, bad = await decide_unsure_items(items, current_admin, action, req.ws_code)
            new_orders.extend(orders)
        decided += n
        failed.update(bad)
    if touched:
        await ms.recompute_for(sorted(c for c in touched if c))
    remaining = 0
    if processed >= req.limit and last_id is not None:
        rest = dict(query)
        rest["_id"] = {**rest["_id"], "$gt": last_id} if isinstance(rest.get("_id"), dict) else {"$gt": last_id}
        remaining = await PipelineItem.find(rest).count()
    return {
        "ok": not failed,
        "decided": decided,
        "failed_count": len(failed),
        "failed": dict(list(failed.items())[:20]),
        "new_orders": len(new_orders),
        "remaining": remaining,
        "next_after": str(last_id) if remaining else None,
    }
