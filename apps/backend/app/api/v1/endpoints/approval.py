"""Approval page backend (generator spec §2).

Tabs: AI decisions · Unsure · Alias suggestions · New watches · Discarded ·
Suspicious prices (approval_prices.py). Everything here is admin-only.
"""
import re
from datetime import datetime, timedelta
from typing import Any, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo import UpdateOne

from app.api.v1.endpoints.price_check import watch_summary
from app.core.deps import get_current_admin_user
from app.models.order import Order, OrderStatus
from app.models.pipeline import (
    AliasStatus, AliasSuggestion, PipelineItem, ReviewKind, ReviewStatus,
)
from app.models.user import User
from app.models.watch import Watch
from app.services import market_stats as ms
from app.services import pipeline as pipeline_service

router = APIRouter()


# --- helpers ----------------------------------------------------------------

async def _watches_by_code(codes: list[str]) -> dict[str, Watch]:
    codes = [c for c in set(codes) if c]
    if not codes:
        return {}
    watches = await Watch.find({"ws_code": {"$in": codes}}).to_list()
    return {w.ws_code: w for w in watches}


def _item_payload(item: PipelineItem, watches: Optional[dict] = None) -> dict:
    watches = watches or {}
    return {
        "id": str(item.id),
        "kind": item.kind.value,
        "status": item.status.value,
        "mode": item.mode,
        "group_name": item.group_name,
        "source_text": item.source_text,
        "image_url": pipeline_service.image_url(item.image_id),
        "sender_phone": item.sender_phone,
        "message_at": item.message_at,
        "row": item.row,
        "candidates": item.candidates,
        "reason": item.reason,
        "ai_ws_code": item.ai_ws_code,
        "ai_reason": item.ai_reason,
        "ai_watch": watch_summary(watches.get(item.ai_ws_code)) if item.ai_ws_code else None,
        "order_id": item.order_id,
        "resolution": item.resolution,
        "resolved_ws_code": item.resolved_ws_code,
        "resolved_at": item.resolved_at,
        "created_at": item.created_at,
        "expires_at": item.expires_at,
    }


async def _get_watch(ws_code: str) -> Watch:
    watch = await Watch.find_one({"ws_code": ws_code})
    if not watch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Watch {ws_code} not found")
    return watch


async def _items(ids: List[str], kind: Optional[ReviewKind] = None) -> list[PipelineItem]:
    try:
        oids = [PydanticObjectId(i) for i in ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item id")
    query: dict = {"_id": {"$in": oids}}
    if kind:
        query["kind"] = kind.value
    items = await PipelineItem.find(query).to_list()
    if not items:
        raise HTTPException(status_code=404, detail="Items not found")
    return items


def _rx(value: str, exact: bool = False) -> dict:
    pat = re.escape(value.strip())
    return {"$regex": f"^{pat}$" if exact else pat, "$options": "i"}


def review_filter(brand: Optional[str] = None, group: Optional[str] = None,
                  reason: Optional[str] = None, ai: bool = False) -> dict:
    """Mongo clauses for the brand / chat group / reason filters of the AI and Unsure tabs.

    Brand is the generator's ``Marke``; the reason is the AI's reason on the AI tab and the
    unsure reason on the Unsure tab (substring, case-insensitive)."""
    q: dict = {}
    if brand and brand.strip():
        q["row.Marke"] = _rx(brand, exact=True)
    if group and group.strip():
        q["group_name"] = group.strip()
    if reason and reason.strip():
        q["ai_reason" if ai else "reason"] = _rx(reason)
    return q


def _resolve(item: PipelineItem, admin: User, resolution: str, ws_code: Optional[str] = None) -> None:
    item.status = ReviewStatus.RESOLVED
    item.resolution = resolution
    item.resolved_ws_code = ws_code
    item.resolved_by = str(admin.id)
    item.resolved_at = datetime.utcnow()
    if item.kind == ReviewKind.NOT_IN_DATABASE:
        item.expires_at = None  # only waiting suggestions expire; decisions are kept


_RESOLVE_FIELDS = ("status", "resolution", "resolved_ws_code", "resolved_by", "resolved_at", "expires_at")
_NOT_IN_CATALOG_FIELDS = ("kind", "guessed_reference", "guessed_brand", "expires_at")
_DISCARD_FIELDS = ("kind", "reason") + _RESOLVE_FIELDS


def _plain(value: Any) -> Any:
    return getattr(value, "value", value)


async def save_fields(items: list[PipelineItem], fields: tuple, chunk: int = 1000) -> None:
    """Write the given fields of many in-memory items with a few bulk writes (an item per round
    trip does not scale to tens of thousands of rows)."""
    coll = PipelineItem.get_motor_collection()
    for n in range(0, len(items), chunk):
        ops = [UpdateOne({"_id": i.id}, {"$set": {f: _plain(getattr(i, f)) for f in fields}})
               for i in items[n:n + chunk]]
        if ops:
            await coll.bulk_write(ops, ordered=False)


async def apply_ai_confirm_many(items: list[PipelineItem], admin: User) -> int:
    """Confirm AI decisions in bulk: the orders already carry the AI's watch, only the items change."""
    for i in items:
        _resolve(i, admin, "confirmed", i.ai_ws_code)
    await save_fields(items, _RESOLVE_FIELDS)
    return len(items)


async def _import_items_as(
    items: list[PipelineItem], watch: Watch, admin: User
) -> tuple[list[str], list[PipelineItem], dict[str, str]]:
    """Create listings for approval-page decisions. Counts as new now (spec §1.11).

    Items are imported one by one so only those that really produced (or refreshed) a listing
    are reported as done. Returns (new order ids, items done, {item id: reason} for the rest:
    no sender phone, price quarantine, unmatched)."""
    from app.api.v1.endpoints.whatsapp import dispatch_new_listings_safe

    new_ids: list[str] = []
    done: list[PipelineItem] = []
    failed: dict[str, str] = {}
    for item in items:
        row = dict(item.row or {})
        row["WS-Code"] = watch.ws_code
        if not row.get("Nachrichten Art"):
            row["Nachrichten Art"] = item.mode
        if not row.get("Nummer") and item.sender_phone:
            row["Nummer"] = item.sender_phone
        if not row.get("Gruppe") and item.group_name:
            row["Gruppe"] = item.group_name
        row["_import"] = {
            "match_method": "manual",
            "source_text": item.source_text,
            "source_image": pipeline_service.image_url(item.image_id),
            "source_group": item.group_name,
            "source_run_id": item.run_id,
        }
        result = await pipeline_service.import_rows([row], admin, "approval-page.csv", item.group_name)
        created = list(result.get("new_order_ids") or [])
        refreshed = list(result.get("refreshed_order_ids") or [])
        if created or refreshed:
            new_ids.extend(created)
            done.append(item)
            continue
        if result.get("no_phone_row_list"):
            failed[str(item.id)] = "No sender phone number - listing not created"
        elif result.get("quarantined_row_list"):
            flag = (result["quarantined_row_list"][0] or {}).get("Preis-Flag") or "price outlier"
            failed[str(item.id)] = f"Price check: {flag}"
        else:
            failed[str(item.id)] = "Import did not create a listing"
    await dispatch_new_listings_safe(new_ids)
    return new_ids, done, failed


def _apply_watch(order: Order, watch: Watch) -> None:
    order.ws_code = watch.ws_code
    order.brand = watch.brand
    order.model = watch.model
    order.reference = watch.reference or watch.ws_code
    order.watch_id = str(watch.id)
    order.aliases = watch.aliases or []
    order.collection = watch.collection
    order.updated_at = datetime.utcnow()


# --- summary ----------------------------------------------------------------

@router.get("/summary")
async def summary(current_admin: User = Depends(get_current_admin_user)) -> Any:
    week_ago = datetime.utcnow() - timedelta(days=7)
    new_watch_refs = await PipelineItem.get_motor_collection().distinct(
        "guessed_reference",
        {"kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value},
    )
    unsure_keys = await PipelineItem.get_motor_collection().distinct(
        "text_key", {"kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value}
    )
    return {
        "ai_decisions": await PipelineItem.find(
            {"kind": ReviewKind.AI_DECISION.value, "status": ReviewStatus.PENDING.value}).count(),
        "ai_decisions_7d": await PipelineItem.find(
            {"kind": ReviewKind.AI_DECISION.value, "created_at": {"$gte": week_ago}}).count(),
        "unsure": len(unsure_keys),
        "aliases": await AliasSuggestion.find({"status": AliasStatus.PENDING.value}).count(),
        "new_watches": len([r for r in new_watch_refs if r]),
        "discarded": await PipelineItem.find({"kind": ReviewKind.DISCARDED.value}).count(),
        "suspicious_prices": await Order.find({"status": OrderStatus.HELD.value, "order_type": "sell"}).count(),
    }


@router.get("/images/{image_id}")
async def get_image(image_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    try:
        data, ctype = await pipeline_service.get_image(image_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "private, max-age=86400"})


@router.get("/watch-search")
async def watch_search(
    q: str = Query(..., min_length=1),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    watches = await Watch.find(
        {"$or": [{"ws_code": rx}, {"reference": rx}, {"model": rx}, {"aliases": rx}, {"oem_references": rx}]}
    ).limit(25).to_list()
    return [watch_summary(w) for w in watches]


# --- Tab 1: AI decisions ----------------------------------------------------

@router.get("/ai-decisions")
async def ai_decisions(
    status_filter: str = Query("pending", alias="status"),
    brand: Optional[str] = None,
    group: Optional[str] = None,
    reason: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    query: dict = {"kind": ReviewKind.AI_DECISION.value, **review_filter(brand, group, reason, ai=True)}
    if status_filter in ("pending", "resolved"):
        query["status"] = status_filter
    items = await PipelineItem.find(query).sort("-created_at").skip(offset).limit(limit).to_list()
    watches = await _watches_by_code([i.ai_ws_code for i in items if i.ai_ws_code])
    return {"items": [_item_payload(i, watches) for i in items],
            "total": await PipelineItem.find(query).count()}


class AiCorrectRequest(BaseModel):
    action: str = Field(..., description="confirm | correct | not_in_catalog | discard")
    ws_code: Optional[str] = None


async def apply_ai_action(
    item: PipelineItem, admin: User, action: str, ws_code: Optional[str] = None,
    touched: Optional[set] = None,
) -> dict:
    """One AI decision: the listing in the app changes immediately.

    Used by the click, the bulk endpoint and the decision file, so all three do exactly the
    same. ``touched``: collect the WS codes whose stats need a refresh instead of recomputing
    straight away (bulk callers recompute once at the end). Returns the ids of created items."""
    order = None
    if item.order_id:
        try:
            order = await Order.get(PydanticObjectId(item.order_id))
        except Exception:
            order = None
    old_ws = order.ws_code if order else item.ai_ws_code
    created: list[str] = []

    async def refresh(codes: list) -> None:
        codes = [c for c in codes if c]
        if touched is not None:
            touched.update(codes)
        elif codes:
            await ms.recompute_for(codes)

    if action == "confirm":
        _resolve(item, admin, "confirmed", item.ai_ws_code)
    elif action == "correct":
        if not ws_code:
            raise HTTPException(status_code=400, detail="ws_code is required")
        watch = await _get_watch(ws_code)
        if order:
            _apply_watch(order, watch)
            order.match_method = "manual"
            await order.save()
        _resolve(item, admin, "corrected", watch.ws_code)
        await refresh([old_ws, watch.ws_code])
    elif action in ("not_in_catalog", "discard"):
        if order:
            await order.delete()
        await refresh([old_ws])
        _resolve(item, admin, action)
        if action == "not_in_catalog":
            new_item = PipelineItem(
                kind=ReviewKind.NOT_IN_DATABASE, mode=item.mode, group_name=item.group_name,
                upload_id=item.upload_id, run_id=item.run_id, source_text=item.source_text,
                text_key=item.text_key, image_id=item.image_id, sender_phone=item.sender_phone,
                message_at=item.message_at, row=item.row, candidates=item.candidates,
                guessed_reference=(item.row or {}).get("Referenz") or (item.row or {}).get("WS-Code"),
                guessed_brand=(item.row or {}).get("Marke"),
                expires_at=pipeline_service.not_in_database_expiry(),
            )
            await new_item.insert()
            created.append(str(new_item.id))
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    await item.save()
    return {"created_items": created}


@router.post("/ai-decisions/{item_id}")
async def ai_decision_action(
    item_id: str,
    payload: AiCorrectRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    item = (await _items([item_id], ReviewKind.AI_DECISION))[0]
    await apply_ai_action(item, current_admin, payload.action, payload.ws_code)
    return {"ok": True, "item": _item_payload(item)}


# --- Tab 2: Unsure ----------------------------------------------------------

def unsure_group_pipeline(match: dict) -> list[dict]:
    """Pending unsure items grouped by identical text, in the database (31k rows do not fit a
    request). An item without text stays alone (its own id is the group key)."""
    blank = {"$eq": [{"$ifNull": ["$text_key", ""]}, ""]}
    return [
        {"$match": match},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"k": {"$ifNull": ["$text_key", ""]}, "i": {"$cond": [blank, "$_id", None]}},
            "item_ids": {"$push": "$_id"},
            "count": {"$sum": {"$ifNull": ["$occurrences", 1]}},
            "source_text": {"$first": "$source_text"},
            "image_id": {"$max": "$image_id"},
            "candidates": {"$first": "$candidates"},
            "reason": {"$first": "$reason"},
            "mode": {"$first": "$mode"},
            "row": {"$first": "$row"},
            "groups": {"$addToSet": "$group_name"},
            "phones": {"$addToSet": "$sender_phone"},
            "latest_at": {"$first": "$created_at"},
            "message_at": {"$max": "$message_at"},
        }},
    ]


def unsure_group_key(g: dict) -> str:
    return g["_id"]["k"] or str(g["_id"]["i"])


@router.get("/unsure")
async def unsure(
    brand: Optional[str] = None,
    group: Optional[str] = None,
    reason: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Pending rows grouped by identical text (one decision for all). ``total`` counts groups,
    ``item_total`` the items behind them (what "select all" will decide)."""
    match = {"kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value,
             **review_filter(brand, group, reason)}
    coll = PipelineItem.get_motor_collection()
    page = [{"$sort": {"count": -1, "latest_at": 1}}, {"$skip": offset}, {"$limit": limit}]
    rows = await coll.aggregate(unsure_group_pipeline(match) + page).to_list(length=limit)
    counted = await coll.aggregate(unsure_group_pipeline(match)[:2] + [
        {"$group": {"_id": {"k": {"$ifNull": ["$text_key", ""]},
                            "i": {"$cond": [{"$eq": [{"$ifNull": ["$text_key", ""]}, ""]}, "$_id", None]}}}},
        {"$count": "n"},
    ]).to_list(length=1)
    total = counted[0]["n"] if counted else 0
    ordered = []
    for g in rows:
        ordered.append({
            "key": unsure_group_key(g),
            "item_ids": [str(i) for i in g["item_ids"]],
            "count": g["count"],
            "source_text": g["source_text"],
            "image_url": pipeline_service.image_url(g["image_id"]) if g.get("image_id") else None,
            "candidates": g.get("candidates") or [],
            "reason": g.get("reason"),
            "mode": g.get("mode"),
            "groups": sorted(x for x in g["groups"] if x),
            "phones": sorted(x for x in g["phones"] if x),
            "row": g.get("row"),
            "latest_at": g.get("latest_at"),
        })
    codes = [c.get("ws_code") for g in ordered for c in (g["candidates"] or []) if c.get("ws_code")]
    watches = await _watches_by_code(codes)
    for g in ordered:
        g["candidates"] = [
            {**c, "watch": watch_summary(watches.get(c.get("ws_code")))} for c in (g["candidates"] or [])[:3]
        ]
    item_total = await PipelineItem.find(match).count()
    return {"groups": ordered, "total": total, "item_total": item_total}


class DecideRequest(BaseModel):
    item_ids: List[str]
    action: str = Field(..., description="pick | not_in_catalog | discard")
    ws_code: Optional[str] = None


def discard_fields() -> dict:
    return {
        "kind": ReviewKind.DISCARDED.value,
        "reason": "Discarded on the approval page",
        "expires_at": datetime.utcnow() + timedelta(days=pipeline_service.DISCARD_TTL_DAYS),
    }


def not_in_catalog_fields(item: PipelineItem) -> dict:
    row = item.row or {}
    return {
        "kind": ReviewKind.NOT_IN_DATABASE.value,
        "guessed_reference": item.guessed_reference or row.get("Referenz") or row.get("WS-Code"),
        "guessed_brand": item.guessed_brand or row.get("Marke"),
        "expires_at": pipeline_service.not_in_database_expiry(),
    }


async def apply_unsure_action(
    items: list[PipelineItem], admin: User, action: str, ws_code: Optional[str] = None,
    fast: bool = False,
) -> tuple[list[str], dict[str, str]]:
    """Decide pending unsure items (any texts). Returns (new order ids, {item id: reason}).
    ``fast``: write not-in-catalogue / discard with bulk writes (bulk callers)."""
    new_ids: list[str] = []
    failed: dict[str, str] = {}
    if action == "pick":
        if not ws_code:
            raise HTTPException(status_code=400, detail="ws_code is required")
        watch = await _get_watch(ws_code)
        new_ids, done, failed = await _import_items_as(items, watch, admin)
        for i in done:
            _resolve(i, admin, "picked", watch.ws_code)
        for i in items:
            if str(i.id) in failed:
                i.reason = failed[str(i.id)]
    elif action == "not_in_catalog":
        for i in items:
            for k, v in not_in_catalog_fields(i).items():
                setattr(i, k, ReviewKind(v) if k == "kind" else v)
    elif action == "discard":
        for i in items:
            for k, v in discard_fields().items():
                setattr(i, k, ReviewKind(v) if k == "kind" else v)
            _resolve(i, admin, "discarded")
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    if fast and action in ("not_in_catalog", "discard"):
        await save_fields(items, _NOT_IN_CATALOG_FIELDS if action == "not_in_catalog" else _DISCARD_FIELDS)
    else:
        for i in items:
            await i.save()
    return new_ids, failed


@router.post("/unsure/decide")
async def unsure_decide(
    payload: DecideRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    items = await _items(payload.item_ids)
    items = [i for i in items if i.status == ReviewStatus.PENDING]
    if not items:
        raise HTTPException(status_code=409, detail="Already decided")
    new_ids, failed = await apply_unsure_action(items, current_admin, payload.action, payload.ws_code)
    return {"ok": not failed, "updated": len(items), "new_order_ids": new_ids, "failed": failed}


# --- Tab 3: Alias suggestions -----------------------------------------------

@router.get("/aliases")
async def aliases(
    status_filter: str = Query("pending", alias="status"),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    query = {"status": status_filter} if status_filter in ("pending", "approved", "rejected") else {}
    items = await AliasSuggestion.find(query).sort("-hits").limit(500).to_list()
    watches = await _watches_by_code([a.ws_code for a in items])
    return [
        {
            "id": str(a.id),
            "alias": a.alias,
            "ws_code": a.ws_code,
            "watch": watch_summary(watches.get(a.ws_code)),
            "status": a.status.value,
            "count": a.hits,
            "examples": a.examples,
            "created_at": a.created_at,
        }
        for a in items
    ]


class AliasDecision(BaseModel):
    ids: List[str]
    action: str = Field(..., description="approve | reject | assign")
    ws_code: Optional[str] = None


async def apply_alias_action(
    items: list[AliasSuggestion], admin: User, action: str, ws_code: Optional[str] = None
) -> int:
    """An alias is only ever added to a watch here (spec §2.3). Returns how many were decided."""
    target = None
    if action == "assign":
        if not ws_code:
            raise HTTPException(status_code=400, detail="ws_code is required")
        target = await _get_watch(ws_code)
    elif action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Unknown action")

    updated = 0
    for a in items:
        if action == "reject":
            a.status = AliasStatus.REJECTED
        else:
            watch = target or await Watch.find_one({"ws_code": a.ws_code})
            if not watch:
                continue
            existing = {x.strip().lower() for x in (watch.aliases or [])}
            if a.alias.strip().lower() not in existing:
                watch.aliases = list(watch.aliases or []) + [a.alias.strip()]
                watch.updated_at = datetime.utcnow()
                await watch.save()
            if target and a.ws_code != target.ws_code:
                clash = await AliasSuggestion.find_one({"alias_key": a.alias_key, "ws_code": target.ws_code})
                if clash and clash.id != a.id:
                    await clash.delete()
                a.ws_code = target.ws_code
            a.status = AliasStatus.APPROVED
        a.resolved_by = str(admin.id)
        a.resolved_at = datetime.utcnow()
        await a.save()
        updated += 1
    return updated


@router.post("/aliases/decide")
async def aliases_decide(
    payload: AliasDecision,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Multi-select."""
    try:
        oids = [PydanticObjectId(i) for i in payload.ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    items = await AliasSuggestion.find({"_id": {"$in": oids}}).to_list()
    updated = await apply_alias_action(items, current_admin, payload.action, payload.ws_code)
    return {"ok": True, "updated": updated}


# --- Tab 4: New watches -----------------------------------------------------

@router.get("/new-watches")
async def new_watches(current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Suggestions from the not-in-database archive, grouped by reference."""
    items = await PipelineItem.find(
        {"kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value}
    ).sort("-created_at").to_list()
    groups: dict[str, dict] = {}
    for i in items:
        ref = (i.guessed_reference or "").strip()
        key = ref.upper() or "(no reference)"
        g = groups.setdefault(key, {
            "reference": ref or None, "brand": i.guessed_brand, "count": 0,
            "dealers": set(), "examples": [], "item_ids": [], "image_url": None,
            "last_seen": i.created_at,
        })
        g["count"] += i.occurrences or 1
        g["item_ids"].append(str(i.id))
        if i.sender_phone:
            g["dealers"].add(i.sender_phone)
        if not g["brand"] and i.guessed_brand:
            g["brand"] = i.guessed_brand
        if len(g["examples"]) < 3 and i.source_text and i.source_text not in g["examples"]:
            g["examples"].append(i.source_text)
        if not g["image_url"] and i.image_id:
            g["image_url"] = pipeline_service.image_url(i.image_id)
    out = []
    for g in groups.values():
        g["dealers"] = len(g["dealers"])
        out.append(g)
    out.sort(key=lambda g: (-g["count"], -g["dealers"]))
    return out


class NewWatchAction(BaseModel):
    item_ids: List[str]
    action: str = Field(..., description="dismiss | import")
    ws_code: Optional[str] = None


async def apply_new_watch_action(
    items: list[PipelineItem], admin: User, action: str, ws_code: Optional[str] = None
) -> tuple[list[str], dict[str, str]]:
    """dismiss → archived; import → the watch now exists, create the listings."""
    new_ids: list[str] = []
    failed: dict[str, str] = {}
    if action == "import":
        if not ws_code:
            raise HTTPException(status_code=400, detail="ws_code is required")
        watch = await _get_watch(ws_code)
        new_ids, done, failed = (
            await _import_items_as(items, watch, admin) if items else ([], [], {})
        )
        for i in done:
            _resolve(i, admin, "picked", watch.ws_code)
        for i in items:
            if str(i.id) in failed:
                i.reason = failed[str(i.id)]
    elif action == "dismiss":
        for i in items:
            _resolve(i, admin, "dismissed")
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    for i in items:
        await i.save()
    return new_ids, failed


@router.post("/new-watches/decide")
async def new_watches_decide(
    payload: NewWatchAction,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    items = [i for i in await _items(payload.item_ids, ReviewKind.NOT_IN_DATABASE)
             if i.status == ReviewStatus.PENDING]
    new_ids, failed = await apply_new_watch_action(items, current_admin, payload.action, payload.ws_code)
    return {"ok": not failed, "updated": len(items), "new_order_ids": new_ids, "failed": failed}


# --- Tab 5: Discarded -------------------------------------------------------

@router.get("/discarded")
async def discarded(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    query = {"kind": ReviewKind.DISCARDED.value}
    items = await PipelineItem.find(query).sort("-created_at").skip(offset).limit(limit).to_list()
    return {"items": [_item_payload(i) for i in items], "total": await PipelineItem.find(query).count()}
