"""Approval page: decisions by file.

    GET  /approval/file/export/{tab}            download the cases of a tab as CSV (streamed)
    POST /approval/file/preview                 upload the filled file -> what would happen; changes nothing
    POST /approval/file/{batch_id}/commit       run the previewed batch (admin types the count)
    POST /approval/file/{batch_id}/undo         put everything back
    GET  /approval/file                         last 50 batches
    GET  /approval/file/{batch_id}/skipped.csv

Same pattern as the orders bulk fix. A decision in the file runs through the very same
function as the click (approval.py / price_actions.py). Before a row is applied, the documents
it can change are copied into ``approval_file_snapshots`` (an order that is rejected is
archived there completely); undo restores them and removes what the commit created.
"""
import csv
import io
import logging
import re
from datetime import datetime, timedelta
from typing import Any, AsyncIterator, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.v1.endpoints import approval as ap
from app.api.v1.endpoints.approval_bulk import decide_ai_items, decide_unsure_items, group_clause
from app.core.deps import get_current_admin_user
from app.models.approval_file import ApprovalFileBatch, ApprovalFileItem, ApprovalFileSnapshot
from app.models.order import Order, OrderStatus, OrderType
from app.models.order_fix import OrderArchive
from app.models.pipeline import AliasStatus, AliasSuggestion, PipelineItem, ReviewKind, ReviewStatus
from app.models.user import User
from app.models.watch import Watch
from app.services import approval_plan as plan
from app.services import fx
from app.services import market_stats as ms
from app.services import price_actions

logger = logging.getLogger(__name__)
router = APIRouter()

PREVIEW_TTL = timedelta(minutes=60)
CHUNK = 500
UNSURE_CHUNK = 100
MAX_UPLOAD_BYTES = 60 * 1024 * 1024

# Fields a decision can change, per collection (the before-state kept for undo) and the few
# values that prove, at undo time, that the document still looks the way the commit left it.
SNAP_FIELDS = {
    "pipeline_items": ("kind", "status", "reason", "resolution", "resolved_ws_code", "resolved_by",
                       "resolved_at", "expires_at", "guessed_reference", "guessed_brand"),
    "alias_suggestions": ("status", "ws_code", "resolved_by", "resolved_at"),
    "watches": ("aliases", "updated_at"),
}
GUARD_FIELDS = {
    "pipeline_items": ("status", "kind", "resolution", "resolved_ws_code"),
    "alias_suggestions": ("status", "ws_code"),
    "watches": ("aliases",),
    "orders": ("status", "ws_code", "price", "currency", "price_approved"),
}
COLLECTIONS = {"pipeline_items": PipelineItem, "alias_suggestions": AliasSuggestion,
               "watches": Watch, "orders": Order}


class CommitBody(BaseModel):
    confirm_apply_total: int


def _oid(s: Any) -> Optional[PydanticObjectId]:
    try:
        return PydanticObjectId(str(s))
    except Exception:
        return None


def _oids(values) -> list:
    return [o for o in map(_oid, values) if o]


def _coll(name: str):
    return COLLECTIONS[name].get_motor_collection()


async def _batch_or_404(batch_id: str) -> ApprovalFileBatch:
    oid = _oid(batch_id)
    batch = await ApprovalFileBatch.get(oid) if oid else None
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


async def _claim(batch: ApprovalFileBatch, from_status: str, to_status: str) -> None:
    """Flip the batch status atomically so two clicks cannot run it twice."""
    res = await ApprovalFileBatch.get_motor_collection().update_one(
        {"_id": batch.id, "status": from_status}, {"$set": {"status": to_status}}
    )
    if not res.modified_count:
        raise HTTPException(status_code=409, detail=f"Batch is already {batch.status}")
    batch.status = to_status


# --- CSV export (download) -----------------------------------------------------

def _date(d) -> str:
    return d.strftime("%Y-%m-%d %H:%M") if isinstance(d, datetime) else ""


def _csv_chunk(rows: List[list]) -> str:
    buf = io.StringIO()
    csv.writer(buf, delimiter=";").writerows(rows)
    return buf.getvalue()


def _row(tab: str, **v) -> list:
    return [tab] + [v.get(c, "") for c in plan.HEADER[1:]]


async def _export_ai(f: dict) -> AsyncIterator[list]:
    q = {"kind": ReviewKind.AI_DECISION.value, "status": ReviewStatus.PENDING.value,
         **ap.review_filter(f.get("brand"), f.get("group"), f.get("reason"), ai=True)}
    async for d in PipelineItem.get_motor_collection().find(q).sort("created_at", -1):
        others = [c for c in plan.candidate_codes(d.get("candidates")) if c != d.get("ai_ws_code")]
        yield _row("ai", id=str(d["_id"]), original_text=d.get("source_text") or "",
                   dealer=d.get("sender_phone") or "", chat_group=d.get("group_name") or "",
                   date=_date(d.get("message_at") or d.get("created_at")),
                   suggested_ws_code=d.get("ai_ws_code") or "", other_candidates="|".join(others),
                   info=d.get("ai_reason") or "", version=plan.ai_version(d))


async def _export_unsure(f: dict) -> AsyncIterator[list]:
    match = {"kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value,
             **ap.review_filter(f.get("brand"), f.get("group"), f.get("reason"))}
    pipe = ap.unsure_group_pipeline(match) + [{"$sort": {"count": -1, "latest_at": 1}}]
    async for g in PipelineItem.get_motor_collection().aggregate(pipe):
        key = ap.unsure_group_key(g)
        codes = plan.candidate_codes(g.get("candidates"))
        yield _row("unsure", id=key, original_text=g.get("source_text") or "",
                   dealer="|".join(sorted(x for x in g["phones"] if x)),
                   chat_group="|".join(sorted(x for x in g["groups"] if x)),
                   date=_date(g.get("message_at") or g.get("latest_at")),
                   suggested_ws_code=codes[0] if codes else "", other_candidates="|".join(codes[1:]),
                   info=f"{g['count']}x same text; {g.get('reason') or ''}".strip("; "),
                   version=plan.unsure_version(key, g.get("candidates"), g.get("reason")))


async def _export_aliases(f: dict) -> AsyncIterator[list]:
    async for d in AliasSuggestion.get_motor_collection().find(
        {"status": AliasStatus.PENDING.value}
    ).sort("hits", -1):
        yield _row("aliases", id=str(d["_id"]), original_text=d.get("alias") or "",
                   date=_date(d.get("created_at")), suggested_ws_code=d.get("ws_code") or "",
                   info=f"used {d.get('hits', 1)}x: " + " / ".join((d.get("examples") or [])[:2]),
                   version=plan.alias_version(d))


def _group_key_of_reference(ref: Optional[str]) -> str:
    return (ref or "").strip().upper() or "(no reference)"


async def _export_new_watches(f: dict) -> AsyncIterator[list]:
    groups: Dict[str, dict] = {}
    cur = PipelineItem.get_motor_collection().find(
        {"kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value},
        {"guessed_reference": 1, "guessed_brand": 1, "source_text": 1, "sender_phone": 1,
         "group_name": 1, "occurrences": 1, "created_at": 1, "message_at": 1},
    ).sort("created_at", -1)
    async for d in cur:
        key = _group_key_of_reference(d.get("guessed_reference"))
        g = groups.setdefault(key, {"ref": (d.get("guessed_reference") or "").strip(), "brand": None,
                                    "count": 0, "phones": set(), "groups": set(), "text": "",
                                    "last": d.get("message_at") or d.get("created_at")})
        g["count"] += d.get("occurrences") or 1
        g["brand"] = g["brand"] or d.get("guessed_brand")
        g["text"] = g["text"] or d.get("source_text") or ""
        if d.get("sender_phone"):
            g["phones"].add(d["sender_phone"])
        if d.get("group_name"):
            g["groups"].add(d["group_name"])
    for key, g in sorted(groups.items(), key=lambda kv: -kv[1]["count"]):
        yield _row("new_watches", id=key, original_text=g["text"], dealer="|".join(sorted(g["phones"])[:5]),
                   chat_group="|".join(sorted(g["groups"])[:5]), date=_date(g["last"]),
                   suggested_ws_code=g["ref"],
                   info=f"{g['brand'] or 'unknown brand'}; {g['count']} listing(s), {len(g['phones'])} dealer(s)",
                   version=plan.new_watch_version(key, g["brand"]))


async def _export_prices(f: dict) -> AsyncIterator[list]:
    from app.api.v1.endpoints.approval_prices import held_filter, held_sort

    currency = (f.get("currency") or "EUR").upper()
    rates = await fx.load_rates()
    cursor = Order.get_motor_collection().find(
        held_filter(f.get("cause"), f.get("brand"), f.get("ws_code"), f.get("direction"))
    ).sort(held_sort(f.get("sort")))
    async for d in cursor:
        flag = d.get("price_flag") or {}
        med = flag.get("median_usd")
        hint = []
        if flag.get("suggested_currency"):
            hint.append(f"suggested currency {flag['suggested_currency']}")
        if flag.get("suggested_price"):
            hint.append(f"suggested price {flag['suggested_price']}")
        if flag.get("peers_currency"):
            hint.append(f"the other offers look like {flag['peers_currency']}")
        yield _row("prices", id=str(d["_id"]), original_text=d.get("source_text") or "",
                   dealer=d.get("whatsapp_phone") or "", chat_group=d.get("source_group") or "",
                   date=_date(d.get("created_at")), suggested_ws_code=d.get("ws_code") or "",
                   price=d.get("price") if d.get("price") is not None else "",
                   currency=d.get("currency") or "",
                   median=round(fx.convert(med, "USD", currency, rates), 2) if med else "",
                   median_currency=currency, offer_count=flag.get("offer_count", ""),
                   info="; ".join([f"{flag.get('cause')}", f"{flag.get('deviation_pct')}% vs median"] + hint),
                   version=plan.price_version(d))


EXPORTERS = {"ai": _export_ai, "unsure": _export_unsure, "aliases": _export_aliases,
             "new_watches": _export_new_watches, "prices": _export_prices}


@router.get("/export/{tab}")
async def export_cases(
    tab: str,
    brand: Optional[str] = None,
    group: Optional[str] = None,
    reason: Optional[str] = None,
    cause: Optional[str] = None,
    ws_code: Optional[str] = None,
    direction: Optional[str] = None,
    sort: Optional[str] = None,
    currency: str = Query("EUR"),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """One row per case, empty ``decision`` / ``new_value`` columns for the admin to fill in.
    AI / Unsure take brand, group, reason; Suspicious prices take brand, cause, ws_code, direction."""
    if tab not in EXPORTERS:
        raise HTTPException(status_code=404, detail="Unknown tab")
    filters = {"brand": brand, "group": group, "reason": reason, "currency": currency, "cause": cause,
               "ws_code": ws_code, "direction": direction, "sort": sort}

    async def body() -> AsyncIterator[str]:
        yield chr(0xFEFF) + _csv_chunk([plan.HEADER])
        batch: List[list] = []
        async for r in EXPORTERS[tab](filters):
            batch.append(r)
            if len(batch) >= 500:
                yield _csv_chunk(batch)
                batch = []
        if batch:
            yield _csv_chunk(batch)

    return StreamingResponse(
        body(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="approval_{tab}_{datetime.utcnow():%Y%m%d}.csv"'},
    )


# --- current state of the cases (preview and commit both use it) ---------------

async def load_states(tab: str, ids: List[str]) -> Dict[tuple, plan.State]:
    """(tab, case id) -> State for every case that still exists and is waiting."""
    out: Dict[tuple, plan.State] = {}
    if tab == "ai":
        cur = PipelineItem.get_motor_collection().find(
            {"_id": {"$in": _oids(ids)}, "kind": ReviewKind.AI_DECISION.value,
             "status": ReviewStatus.PENDING.value})
        async for d in cur:
            out[(tab, str(d["_id"]))] = plan.State(
                plan.ai_version(d), {"item_ids": [d["_id"]], "suggested": d.get("ai_ws_code")})
    elif tab == "unsure":
        match = {"kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value, **group_clause(ids)}
        async for g in PipelineItem.get_motor_collection().aggregate(ap.unsure_group_pipeline(match)):
            key = ap.unsure_group_key(g)
            codes = plan.candidate_codes(g.get("candidates"))
            out[(tab, key)] = plan.State(
                plan.unsure_version(key, g.get("candidates"), g.get("reason")),
                {"item_ids": list(g["item_ids"]), "suggested": codes[0] if codes else None})
    elif tab == "aliases":
        async for d in AliasSuggestion.get_motor_collection().find(
            {"_id": {"$in": _oids(ids)}, "status": AliasStatus.PENDING.value}
        ):
            out[(tab, str(d["_id"]))] = plan.State(plan.alias_version(d), {"item_ids": [d["_id"]]})
    elif tab == "new_watches":
        coll = PipelineItem.get_motor_collection()
        for key in ids:
            if key == "(no reference)":
                ref_q: dict = {"$or": [{"guessed_reference": None}, {"guessed_reference": ""}]}
            else:
                ref_q = {"guessed_reference": {"$regex": rf"^\s*{re.escape(key)}\s*$", "$options": "i"}}
            docs = [d async for d in coll.find(
                {"kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value, **ref_q},
                {"guessed_brand": 1}).sort("created_at", -1)]
            if docs:
                brand = next((d.get("guessed_brand") for d in docs if d.get("guessed_brand")), None)
                out[(tab, key)] = plan.State(plan.new_watch_version(key, brand),
                                             {"item_ids": [d["_id"] for d in docs]})
    elif tab == "prices":
        async for d in Order.get_motor_collection().find(
            {"_id": {"$in": _oids(ids)}, "status": OrderStatus.HELD.value,
             "order_type": OrderType.SELL.value, "price_flag": {"$ne": None}},
            {"ws_code": 1, "price": 1, "currency": 1, "price_flag": 1},
        ):
            flag = d.get("price_flag") or {}
            out[(tab, str(d["_id"]))] = plan.State(plan.price_version(d), {
                "order_ids": [d["_id"]], "suggested_currency": flag.get("suggested_currency"),
                "suggested_price": flag.get("suggested_price")})
    return out


async def load_all_states(rows: List[plan.Row]) -> Dict[tuple, plan.State]:
    out: Dict[tuple, plan.State] = {}
    for tab in plan.TABS:
        ids = sorted({r.case_id for r in rows if r.tab == tab})
        step = UNSURE_CHUNK if tab in ("unsure", "new_watches") else CHUNK
        for i in range(0, len(ids), step):
            out.update(await load_states(tab, ids[i:i + step]))
    return out


async def _watch_codes(codes) -> set:
    codes = [c for c in set(codes) if c]
    known: set = set()
    for i in range(0, len(codes), CHUNK):
        for w in await Watch.find({"ws_code": {"$in": codes[i:i + CHUNK]}}).to_list():
            known.add(w.ws_code)
    return known


# --- snapshots ---------------------------------------------------------------

class Snapper:
    """Copies what a chunk is about to change, then records how it looks afterwards."""

    def __init__(self, batch_id: str):
        self.batch_id = batch_id
        self.pending: Dict[tuple, dict] = {}
        self.touched_codes: set = set()

    async def before(self, coll: str, ids) -> None:
        ids = [i for i in ids if i]
        if not ids:
            return
        fields = SNAP_FIELDS.get(coll)
        async for d in _coll(coll).find({"_id": {"$in": ids}}):
            if coll == "orders":
                self.touched_codes.add(d.get("ws_code"))
            self.pending[(coll, d["_id"])] = d if fields is None else {f: d.get(f) for f in fields}

    async def finish(self) -> None:
        by_coll: Dict[str, list] = {}
        for (coll, oid) in self.pending:
            by_coll.setdefault(coll, []).append(oid)
        docs = []
        for coll, ids in by_coll.items():
            now = {d["_id"]: d async for d in _coll(coll).find({"_id": {"$in": ids}})}
            for oid in ids:
                cur = now.get(oid)
                after = {"__deleted__": True} if cur is None else {k: cur.get(k) for k in GUARD_FIELDS[coll]}
                if cur is not None and coll == "orders":
                    self.touched_codes.add(cur.get("ws_code"))
                docs.append(ApprovalFileSnapshot(batch_id=self.batch_id, line=0, coll=coll, doc_id=str(oid),
                                                 doc=self.pending[(coll, oid)], after=after))
        for i in range(0, len(docs), CHUNK):
            await ApprovalFileSnapshot.insert_many(docs[i:i + CHUNK])
        self.pending = {}

    async def created(self, coll: str, ids) -> None:
        docs = [ApprovalFileSnapshot(batch_id=self.batch_id, line=0, coll=f"created:{coll}",
                                     doc_id=str(i), doc={}) for i in ids]
        for i in range(0, len(docs), CHUNK):
            await ApprovalFileSnapshot.insert_many(docs[i:i + CHUNK])


async def _log(admin: User, description: str, batch_id: str, **metadata: Any) -> None:
    try:
        from app.api.v1.endpoints.activity import log_activity
        from app.models.activity_log import ActivityType, EntityType

        await log_activity(
            ActivityType.ADMIN_ACTION, description, user=admin, entity_type=EntityType.ORDER,
            entity_id=batch_id, metadata={"approval_file": True, **metadata}, platform="admin",
        )
    except Exception as exc:  # the audit trail must not break the operation
        logger.warning("approval-file activity log failed: %s", exc)


async def _refresh(ws_codes: set) -> None:
    await ms.recompute_for_safe(sorted(c for c in ws_codes if c))


def _batch_row(b: ApprovalFileBatch) -> dict:
    return {
        "batch_id": str(b.id), "file_name": b.file_name, "status": b.status, "created_at": b.created_at,
        "created_by_name": b.created_by_name, "committed_at": b.committed_at, "undone_at": b.undone_at,
        "apply": b.summary.get("apply"), "apply_total": b.summary.get("apply_total"),
        "skipped": b.summary.get("skipped"), "result": b.result,
    }


async def _expire_old_previews() -> None:
    cutoff = datetime.utcnow() - PREVIEW_TTL
    for b in await ApprovalFileBatch.find({"status": "previewed", "created_at": {"$lt": cutoff}}).to_list():
        await ApprovalFileItem.get_motor_collection().delete_many({"batch_id": str(b.id)})
        b.status = "expired"
        await b.save()


# --- preview -----------------------------------------------------------------

@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Read the file, compare every row with the case as it is now, store the plan. Changes nothing."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 60 MB")
    rows, untouched, errors = plan.parse_file(data)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors[:50]})
    await _expire_old_previews()

    states = await load_all_states(rows)
    known = await _watch_codes(r.new_value for r in rows
                               if r.decision in ("correct", "assign", "import") and r.new_value)
    currencies = set((await fx.load_rates()).keys())
    items = plan.build_plan(rows, states, known, currencies)
    summary = plan.summarize(items, untouched)

    batch = ApprovalFileBatch(
        file_name=file.filename or "approval_decisions.csv",
        created_by=str(current_admin.id) if current_admin.id else "",
        created_by_name=getattr(current_admin, "name", None),
        summary=summary,
    )
    await batch.insert()
    bid = str(batch.id)
    docs = [
        ApprovalFileItem(batch_id=bid, line=it.row.line, tab=it.row.tab, case_id=it.row.case_id,
                         decision=it.row.decision, new_value=it.row.new_value, version=it.row.version,
                         status=it.status, detail=it.detail)
        for it in items
    ]
    for i in range(0, len(docs), CHUNK):
        await ApprovalFileItem.insert_many(docs[i:i + CHUNK])
    return {"batch_id": bid, "expires_at": (batch.created_at + PREVIEW_TTL).isoformat(), **summary}


# --- commit ------------------------------------------------------------------

async def _mark(batch_id: str, tab: str, case_ids: List[str], status: str, detail: str = "") -> None:
    if case_ids:
        await ApprovalFileItem.get_motor_collection().update_many(
            {"batch_id": batch_id, "tab": tab, "case_id": {"$in": case_ids}, "status": "apply"},
            {"$set": {"status": status, "detail": detail}},
        )


async def _split_current(tab: str, group: List[ApprovalFileItem]) -> tuple[list, dict]:
    """Re-check the fingerprints right before applying: a case that changed since the preview
    (a repost, another admin) is left alone. -> (items still fine, their states)."""
    states = await load_states(tab, [it.case_id for it in group])
    fine = [it for it in group
            if (st := states.get((tab, it.case_id))) and (not it.version or it.version == st.version)]
    return fine, states


def _status(order) -> str:
    return getattr(order.status, "value", order.status)


async def apply_price_decisions(oids: list, decision: str, value: str, admin: User, snap: Snapper,
                                touched: set) -> tuple[list, dict]:
    """Suspicious-price decisions on orders (same code for a file row, a bulk action and a click).
    Snapshots first, so a rejected order is archived and everything can be undone.
    -> (ids done, {id: reason})."""
    done: list = []
    released: list = []
    failed: dict = {}
    await snap.before("orders", oids)
    rates = await fx.load_rates()
    for oid in oids:
        order = await Order.get(oid)
        if not order:
            failed[str(oid)] = "Order disappeared"
            continue
        ws = order.ws_code
        was_held = _status(order) == OrderStatus.HELD.value
        try:
            if decision == "reject":
                await order.delete()
            else:
                await price_actions.apply_price_action(order, decision, value, rates)
        except HTTPException as exc:
            failed[str(oid)] = str(exc.detail)
            continue
        touched.add(ws)
        done.append(str(oid))
        if was_held:
            released.append(str(oid))
    # A held offer that is approved / fixed goes live now: alerts (Activity entry + push) as for any
    # new offer - before, these never reached an alert ("+1 more" where four offers matched).
    if decision != "reject" and released:
        from app.api.v1.endpoints.whatsapp import dispatch_new_listings_safe
        await dispatch_new_listings_safe(released)
    return done, failed


async def _commit_group(tab: str, decision: str, value: str, group: List[ApprovalFileItem],
                        admin: User, snap: Snapper, touched: set, batch_id: str) -> tuple[int, int]:
    """Apply one (tab, decision, new_value) chunk. -> (done, failed)."""
    fine, states = await _split_current(tab, group)
    gone = [it.case_id for it in group if it not in fine]
    await _mark(batch_id, tab, gone, "failed", "Case changed or was decided before commit")
    if not fine:
        return 0, len(group)
    done_ids: List[str] = []
    failed_ids: Dict[str, str] = {}

    if tab == "ai":
        oids = [states[(tab, it.case_id)].info["item_ids"][0] for it in fine]
        items = await PipelineItem.find({"_id": {"$in": oids}}).to_list()
        await snap.before("pipeline_items", oids)
        if decision != "confirm":
            await snap.before("orders", _oids(i.order_id for i in items if i.order_id))
        n, bad, created = await decide_ai_items(items, admin, decision, value, touched)
        await snap.created("pipeline_items", created)
        done_ids = [it.case_id for it in fine if it.case_id not in bad]
        failed_ids = bad
    elif tab == "unsure":
        oids = [o for it in fine for o in states[(tab, it.case_id)].info["item_ids"]]
        items = await PipelineItem.find({"_id": {"$in": oids}}).to_list()
        await snap.before("pipeline_items", oids)
        n, new_orders, bad = await decide_unsure_items(items, admin, decision, value)
        await snap.created("orders", new_orders)
        for it in fine:
            ids = [str(o) for o in states[(tab, it.case_id)].info["item_ids"]]
            if ids and all(i in bad for i in ids):
                failed_ids[it.case_id] = bad[ids[0]]
            else:
                done_ids.append(it.case_id)
    elif tab == "aliases":
        oids = [states[(tab, it.case_id)].info["item_ids"][0] for it in fine]
        items = await AliasSuggestion.find({"_id": {"$in": oids}}).to_list()
        await snap.before("alias_suggestions", [d["_id"] async for d in _coll("alias_suggestions").find(
            {"alias_key": {"$in": [i.alias_key for i in items]}}, {"_id": 1})])
        codes = {i.ws_code for i in items} | ({value} if value else set())
        await snap.before("watches", [w.id for w in await Watch.find({"ws_code": {"$in": list(codes)}}).to_list()])
        await ap.apply_alias_action(items, admin, decision, value or None)
        for a in items:
            if a.status != AliasStatus.PENDING:
                done_ids.append(str(a.id))
            else:
                failed_ids[str(a.id)] = "Watch not found"
    elif tab == "new_watches":
        for it in fine:
            oids = states[(tab, it.case_id)].info["item_ids"]
            items = await PipelineItem.find({"_id": {"$in": oids}}).to_list()
            await snap.before("pipeline_items", oids)
            new_orders, bad = await ap.apply_new_watch_action(items, admin, decision, value or None)
            await snap.created("orders", new_orders)
            if items and all(str(i.id) in bad for i in items):
                failed_ids[it.case_id] = next(iter(bad.values()))
            else:
                done_ids.append(it.case_id)
    elif tab == "prices":
        oids = [states[(tab, it.case_id)].info["order_ids"][0] for it in fine]
        done_ids, failed_ids = await apply_price_decisions(oids, decision, value, admin, snap, touched)
    await snap.finish()
    touched.update(snap.touched_codes)
    snap.touched_codes = set()
    await _mark(batch_id, tab, done_ids, "done")
    for case_id, why in failed_ids.items():
        await _mark(batch_id, tab, [case_id], "failed", str(why)[:300])
    return len(done_ids), len(group) - len(done_ids)


@router.post("/{batch_id}/commit")
async def commit_file(
    batch_id: str,
    body: CommitBody,
    background: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    batch = await _batch_or_404(batch_id)
    if batch.status != "previewed":
        raise HTTPException(status_code=409, detail=f"Batch is already {batch.status}")
    if datetime.utcnow() - batch.created_at > PREVIEW_TTL:
        raise HTTPException(status_code=410, detail="The preview has expired - upload the file again")
    if body.confirm_apply_total != batch.summary.get("apply_total"):
        raise HTTPException(status_code=400, detail="The number typed does not match the preview")
    await _claim(batch, "previewed", "committing")

    snap = Snapper(batch_id)
    touched: set = set()
    done: Dict[str, int] = {}
    failed = 0
    items = await ApprovalFileItem.find(
        ApprovalFileItem.batch_id == batch_id, ApprovalFileItem.status == "apply").to_list()
    groups: Dict[tuple, List[ApprovalFileItem]] = {}
    for it in items:
        groups.setdefault((it.tab, it.decision, it.new_value), []).append(it)
    try:
        for (tab, decision, value), members in groups.items():
            step = UNSURE_CHUNK if tab in ("unsure", "new_watches") else CHUNK
            for i in range(0, len(members), step):
                n, bad = await _commit_group(tab, decision, value, members[i:i + step],
                                             current_admin, snap, touched, batch_id)
                done[f"{tab}:{decision}"] = done.get(f"{tab}:{decision}", 0) + n
                failed += bad
    except Exception:
        # Leave the batch undoable: what ran is recorded in the snapshots.
        await snap.finish()
        batch.status = "committed"
        batch.committed_at = datetime.utcnow()
        batch.result = {"done": done, "failed": failed, "error": "Commit stopped early - see logs",
                        "committed_by": str(current_admin.id)}
        await batch.save()
        logger.exception("approval-file commit %s stopped early", batch_id)
        background.add_task(_refresh, touched)
        raise HTTPException(status_code=500, detail="Commit stopped early; the part that ran can be undone")

    batch.status = "committed"
    batch.committed_at = datetime.utcnow()
    batch.result = {"done": done, "failed": failed, "committed_by": str(current_admin.id)}
    await batch.save()
    background.add_task(_refresh, touched)
    await _log(current_admin, f"Approval file committed: {sum(done.values())} decisions", batch_id,
               done=done, failed=failed, file_name=batch.file_name)
    return {"batch_id": batch_id, **batch.result}


# --- undo --------------------------------------------------------------------

@router.post("/{batch_id}/undo")
async def undo_file(
    batch_id: str,
    background: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    batch = await _batch_or_404(batch_id)
    if batch.status != "committed":
        raise HTTPException(status_code=409, detail="Only a committed batch can be undone")
    await _claim(batch, "committed", "undoing")

    touched: set = set()
    removed = restored = skipped = 0
    snaps = ApprovalFileSnapshot.get_motor_collection()

    # 1. Remove what the commit created (new orders are archived first).
    async for s in snaps.find({"batch_id": batch_id, "coll": {"$regex": "^created:"}}):
        name = s["coll"].split(":", 1)[1]
        oid = _oid(s["doc_id"])
        cur = await _coll(name).find_one({"_id": oid}) if oid else None
        if not cur:
            continue
        if name == "orders":
            await OrderArchive(batch_id=batch_id, order_id=str(oid), doc=cur).insert()
            touched.add(cur.get("ws_code"))
        await _coll(name).delete_one({"_id": oid})
        removed += 1

    # 2. Put the before-states back, unless the document changed after the commit. Newest
    #    snapshot first, so two rows that touched the same document unwind in order.
    async for s in snaps.find({"batch_id": batch_id, "coll": {"$not": {"$regex": "^created:"}}}).sort("_id", -1):
        name = s["coll"]
        oid = _oid(s["doc_id"])
        col = _coll(name)
        cur = await col.find_one({"_id": oid})
        after = s.get("after") or {}
        if after.get("__deleted__"):
            ok = cur is None
        else:
            ok = cur is not None and all(cur.get(k) == after.get(k) for k in GUARD_FIELDS[name])
        if not ok:
            skipped += 1
            continue
        if name == "orders":
            await col.replace_one({"_id": oid}, s["doc"], upsert=True)
            touched.update({s["doc"].get("ws_code"), (cur or {}).get("ws_code")})
        else:
            await col.update_one({"_id": oid}, {"$set": s["doc"]})
        restored += 1

    await snaps.delete_many({"batch_id": batch_id})
    batch.status = "undone"
    batch.undone_at = datetime.utcnow()
    batch.result = {**batch.result, "restored": restored, "removed": removed, "left_alone": skipped,
                    "undone_by": str(current_admin.id)}
    await batch.save()
    background.add_task(_refresh, touched)
    await _log(current_admin, f"Approval file undone: {restored} restored, {removed} removed", batch_id,
               restored=restored, removed=removed, left_alone=skipped)
    return {"batch_id": batch_id, "restored": restored, "removed": removed, "left_alone": skipped}


@router.get("")
async def list_batches(current_admin: User = Depends(get_current_admin_user)) -> Any:
    batches = await ApprovalFileBatch.find_all().sort("-created_at").limit(50).to_list()
    return [_batch_row(b) for b in batches if b.status != "expired"]


@router.get("/{batch_id}/skipped.csv")
async def skipped_rows_csv(batch_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Rows of the file that were not executed, with the reason."""
    await _batch_or_404(batch_id)
    rows = [["line", "tab", "id", "decision", "new_value", "status", "detail"]]
    cursor = ApprovalFileItem.get_motor_collection().find(
        {"batch_id": batch_id, "status": {"$nin": ["apply", "done"]}}).sort("line", 1)
    async for it in cursor:
        rows.append([it.get("line"), it.get("tab"), it.get("case_id"), it.get("decision"),
                     it.get("new_value"), it.get("status"), it.get("detail")])
    return StreamingResponse(
        iter([chr(0xFEFF) + _csv_chunk(rows)]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="approval_{batch_id}_skipped.csv"'},
    )
