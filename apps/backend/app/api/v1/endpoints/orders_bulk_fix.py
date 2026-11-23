"""Admin: fix or delete many orders from one uploaded file.

    POST /orders/admin/bulk-fix/preview              upload -> what would happen; changes nothing
    POST /orders/admin/bulk-fix/{batch_id}/commit    run the previewed batch (admin types the count)
    POST /orders/admin/bulk-fix/{batch_id}/undo      put deleted orders back, revert the edits
    GET  /orders/admin/bulk-fix                      last 50 batches
    GET  /orders/admin/bulk-fix/{batch_id}/skipped.csv

The file is built by the audit (compares every live order with the dealer's
original message). Nothing is hard-deleted: a deleted order is copied into
``orders_archive`` first. An order that changed since the file was built is
never touched; the check runs in the preview and again in the commit filter,
so a repost that arrives in between wins.
"""
import csv
import io
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.deps import get_current_admin_user
from app.models.order import Order, OrderStatus
from app.models.order_fix import OrderArchive, OrderFixBatch, OrderFixItem
from app.models.user import User
from app.models.watch import Watch
from app.services import bulk_fix_plan as plan
from app.services import fx

logger = logging.getLogger(__name__)
router = APIRouter()

PREVIEW_TTL = timedelta(minutes=60)
CHUNK = 2000
MAX_UPLOAD_BYTES = 60 * 1024 * 1024
# The fields a move copies from the catalogue (same set as the approval page).
MOVE_FIELDS = ("ws_code", "brand", "model", "reference", "watch_id", "aliases", "collection")


class CommitBody(BaseModel):
    confirm_apply_total: int


def _oid(s: str) -> Optional[PydanticObjectId]:
    try:
        return PydanticObjectId(s)
    except Exception:
        return None


async def _batch_or_404(batch_id: str) -> OrderFixBatch:
    oid = _oid(batch_id)
    batch = await OrderFixBatch.get(oid) if oid else None
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


async def _claim(batch: OrderFixBatch, from_status: str, to_status: str) -> None:
    """Flip the batch status atomically so two clicks cannot run it twice."""
    res = await OrderFixBatch.get_motor_collection().update_one(
        {"_id": batch.id, "status": from_status}, {"$set": {"status": to_status}}
    )
    if not res.modified_count:
        raise HTTPException(status_code=409, detail=f"Batch is already {batch.status}")
    batch.status = to_status


async def _orders_by_id(ids: List[str]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    oids = [o for o in map(_oid, ids) if o]
    col = Order.get_motor_collection()
    projection = {k: 1 for k in plan.SNAPSHOT_FIELDS + ("order_type",)}
    for i in range(0, len(oids), CHUNK):
        cur = col.find({"_id": {"$in": oids[i:i + CHUNK]}, "status": OrderStatus.ACTIVE.value}, projection)
        async for d in cur:
            out[str(d["_id"])] = d
    return out


async def _watches_by_ws_code(codes) -> Dict[str, Watch]:
    """One catalogue row per WS code; an active row wins when a code sits on several."""
    out: Dict[str, Watch] = {}
    codes = [c for c in codes if c]
    if not codes:
        return out
    for w in await Watch.find({"ws_code": {"$in": codes}}).to_list():
        active = (getattr(w.status, "value", w.status) or "") == "active"
        if w.ws_code not in out or active:
            out[w.ws_code] = w
    return out


def _watch_fields(w: Watch) -> dict:
    return {
        "ws_code": w.ws_code,
        "brand": w.brand,
        "model": w.model,
        "reference": w.reference or w.ws_code,
        "watch_id": str(w.id),
        "aliases": list(w.aliases or []),
        "collection": getattr(w, "collection", None),
    }


async def _expire_old_previews() -> None:
    """Previews nobody committed hold one item per file row; drop them once expired."""
    cutoff = datetime.utcnow() - PREVIEW_TTL
    stale = await OrderFixBatch.find({"status": "previewed", "created_at": {"$lt": cutoff}}).to_list()
    for b in stale:
        await OrderFixItem.get_motor_collection().delete_many({"batch_id": str(b.id)})
        b.status = "expired"
        await b.save()


async def _log(admin: User, description: str, batch_id: str, **metadata: Any) -> None:
    try:
        from app.api.v1.endpoints.activity import log_activity
        from app.models.activity_log import ActivityType, EntityType

        await log_activity(
            ActivityType.ADMIN_ACTION, description, user=admin, entity_type=EntityType.ORDER,
            entity_id=batch_id, metadata={"bulk_fix": True, **metadata}, platform="admin",
        )
    except Exception as exc:  # the audit trail must not break the operation
        logger.warning("bulk-fix activity log failed: %s", exc)


async def _refresh(ws_codes: set) -> None:
    from app.services.market_stats import recompute_for_safe

    await recompute_for_safe(sorted(c for c in ws_codes if c))


def _batch_row(b: OrderFixBatch) -> dict:
    return {
        "batch_id": str(b.id),
        "file_name": b.file_name,
        "status": b.status,
        "created_at": b.created_at,
        "created_by_name": b.created_by_name,
        "committed_at": b.committed_at,
        "undone_at": b.undone_at,
        "apply": b.summary.get("apply"),
        "apply_total": b.summary.get("apply_total"),
        "skipped": b.summary.get("skipped"),
        "result": b.result,
    }


@router.post("/preview")
async def preview_bulk_fix(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Read the file, compare every row with the current order, store the plan. Changes no order."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 60 MB")
    rows, errors = plan.parse_file(data)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors[:50]})
    await _expire_old_previews()

    orders = await _orders_by_id([r.order_id for r in rows])
    targets = {r.new_value for r in rows if r.action == "move" and r.new_value}
    known = set((await _watches_by_ws_code(targets)).keys())
    currencies = set((await fx.load_rates()).keys())
    items = plan.build_plan(rows, orders, known, currencies)
    total = await Order.find(Order.status == OrderStatus.ACTIVE).count()
    summary = plan.summarize(items, total)

    batch = OrderFixBatch(
        file_name=file.filename or "orders_bulk_fix.csv",
        created_by=str(current_admin.id),
        created_by_name=getattr(current_admin, "name", None),
        summary=summary,
    )
    await batch.insert()
    bid = str(batch.id)
    docs = [
        OrderFixItem(
            batch_id=bid, line=it.row.line, order_id=it.row.order_id, action=it.row.action,
            new_value=it.row.new_value, reason=it.row.reason[:300], source_line=it.row.source_line[:500],
            status=it.status, detail=it.detail, before=it.before,
        )
        for it in items
    ]
    for i in range(0, len(docs), CHUNK):
        await OrderFixItem.insert_many(docs[i:i + CHUNK])
    return {"batch_id": bid, "expires_at": (batch.created_at + PREVIEW_TTL).isoformat(), **summary}


@router.post("/{batch_id}/commit")
async def commit_bulk_fix(
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

    col = Order.get_motor_collection()
    items_col = OrderFixItem.get_motor_collection()
    done = {a: 0 for a in plan.ACTIONS}
    failed = 0
    touched: set = set()
    rates = await fx.load_rates()
    items = await OrderFixItem.find(OrderFixItem.batch_id == batch_id, OrderFixItem.status == "apply").to_list()

    try:
        # 1. Deletes: copy the full document into the archive, then remove it.
        dels = [it for it in items if it.action == "delete"]
        for i in range(0, len(dels), CHUNK):
            part = dels[i:i + CHUNK]
            expect = {it.order_id: it.before for it in part}
            oids = [PydanticObjectId(it.order_id) for it in part]
            found = [d async for d in col.find({"_id": {"$in": oids}, "status": OrderStatus.ACTIVE.value})]
            # An order that changed between preview and commit is left alone.
            found = [
                d for d in found
                if all(d.get(k) == expect[str(d["_id"])].get(k) for k in ("ws_code", "price", "currency"))
            ]
            ok_ids = [str(d["_id"]) for d in found]
            if found:
                await OrderArchive.insert_many(
                    [OrderArchive(batch_id=batch_id, order_id=str(d["_id"]), doc=d) for d in found]
                )
                await col.delete_many({"_id": {"$in": [d["_id"] for d in found]}})
                touched.update(d.get("ws_code") for d in found)
            await items_col.update_many(
                {"batch_id": batch_id, "order_id": {"$in": ok_ids}, "action": "delete"},
                {"$set": {"status": "done"}},
            )
            gone = [oid for oid in expect if oid not in set(ok_ids)]
            if gone:
                await items_col.update_many(
                    {"batch_id": batch_id, "order_id": {"$in": gone}, "action": "delete"},
                    {"$set": {"status": "failed", "detail": "Order changed or disappeared before commit"}},
                )
            done["delete"] += len(found)
            failed += len(part) - len(found)

        # 2. Edits, one by one (a few hundred). The filter repeats the expected
        #    state, so an order that changed in the meantime is left alone.
        edits = [it for it in items if it.action != "delete"]
        watches = await _watches_by_ws_code({it.new_value for it in edits if it.action == "move"})
        now = datetime.utcnow()
        for it in edits:
            b = it.before
            flt = {"_id": PydanticObjectId(it.order_id), "status": OrderStatus.ACTIVE.value,
                   "ws_code": b.get("ws_code"), "price": b.get("price"), "currency": b.get("currency")}
            upd: Dict[str, Any]
            if it.action == "move":
                w = watches.get(it.new_value)
                if not w:
                    failed += 1
                    await items_col.update_one({"_id": it.id}, {"$set": {"status": "failed", "detail": "Target WS code gone"}})
                    continue
                upd = _watch_fields(w)
            elif it.action == "set_currency":
                cur = it.new_value.upper()
                usd = fx.convert(b.get("price"), cur, "USD", rates) if b.get("price") else None
                upd = {"currency": cur, "usd_price": round(usd, 2) if usd is not None else None}
            else:  # clear_price
                upd = {"price": None, "usd_price": None}
            res = await col.update_one(flt, {"$set": {**upd, "updated_at": now}})
            if res.modified_count:
                done[it.action] += 1
                touched.update({b.get("ws_code"), upd.get("ws_code")})
                await items_col.update_one({"_id": it.id}, {"$set": {"status": "done", "after": upd}})
            else:
                failed += 1
                await items_col.update_one(
                    {"_id": it.id}, {"$set": {"status": "failed", "detail": "Order changed before commit"}}
                )
    except Exception:
        # Leave the batch undoable: what ran is recorded on the items and in the archive.
        batch.status = "committed"
        batch.committed_at = datetime.utcnow()
        batch.result = {"done": done, "failed": failed, "error": "Commit stopped early - see logs",
                        "committed_by": str(current_admin.id)}
        await batch.save()
        logger.exception("bulk-fix commit %s stopped early", batch_id)
        background.add_task(_refresh, touched)
        raise HTTPException(status_code=500, detail="Commit stopped early; the part that ran can be undone")

    batch.status = "committed"
    batch.committed_at = datetime.utcnow()
    batch.result = {"done": done, "failed": failed, "committed_by": str(current_admin.id)}
    await batch.save()
    background.add_task(_refresh, touched)
    await _log(current_admin, f"Bulk fix committed: {sum(done.values())} orders changed", batch_id,
               done=done, failed=failed, file_name=batch.file_name)
    return {"batch_id": batch_id, **batch.result}


@router.post("/{batch_id}/undo")
async def undo_bulk_fix(
    batch_id: str,
    background: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    batch = await _batch_or_404(batch_id)
    if batch.status != "committed":
        raise HTTPException(status_code=409, detail="Only a committed batch can be undone")
    await _claim(batch, "committed", "undoing")

    col = Order.get_motor_collection()
    restored = reverted = 0
    touched: set = set()
    async for a in OrderArchive.find(OrderArchive.batch_id == batch_id):
        if not await col.find_one({"_id": a.doc["_id"]}, {"_id": 1}):
            await col.insert_one(a.doc)
            restored += 1
            touched.add(a.doc.get("ws_code"))
    await OrderArchive.get_motor_collection().delete_many({"batch_id": batch_id})

    fields = {"move": MOVE_FIELDS, "set_currency": ("currency", "usd_price"), "clear_price": ("price", "usd_price")}
    raw_items = OrderFixItem.get_motor_collection().find(
        {"batch_id": batch_id, "status": "done", "action": {"$ne": "delete"}}
    )
    async for it in raw_items:
        b = it.get("before") or {}
        after = it.get("after") or {}
        # Only revert while the order still looks the way the commit left it.
        flt: Dict[str, Any] = {"_id": PydanticObjectId(it["order_id"])}
        for k in ("ws_code", "price", "currency"):
            flt[k] = after[k] if k in after else b.get(k)
        upd = {k: b.get(k) for k in fields[it["action"]]}
        res = await col.update_one(flt, {"$set": {**upd, "updated_at": datetime.utcnow()}})
        reverted += res.modified_count
        touched.update({b.get("ws_code"), it.get("new_value") if it["action"] == "move" else None})

    batch.status = "undone"
    batch.undone_at = datetime.utcnow()
    batch.result = {**batch.result, "restored": restored, "reverted": reverted, "undone_by": str(current_admin.id)}
    await batch.save()
    background.add_task(_refresh, touched)
    await _log(current_admin, f"Bulk fix undone: {restored} restored, {reverted} reverted", batch_id,
               restored=restored, reverted=reverted)
    return {"batch_id": batch_id, "restored": restored, "reverted": reverted}


@router.get("")
async def list_bulk_fix_batches(current_admin: User = Depends(get_current_admin_user)) -> Any:
    batches = await OrderFixBatch.find_all().sort("-created_at").limit(50).to_list()
    return [_batch_row(b) for b in batches]


@router.get("/{batch_id}/skipped.csv")
async def skipped_rows_csv(batch_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Rows of the file that were not executed, with the reason."""
    await _batch_or_404(batch_id)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["line", "order_id", "action", "status", "detail", "reason", "source_line"])
    cursor = OrderFixItem.get_motor_collection().find(
        {"batch_id": batch_id, "status": {"$nin": ["apply", "done"]}}
    ).sort("line", 1)
    async for it in cursor:
        w.writerow([it.get("line"), it.get("order_id"), it.get("action"), it.get("status"),
                    it.get("detail"), it.get("reason"), it.get("source_line")])
    return StreamingResponse(
        iter([chr(0xFEFF) + buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bulk_fix_{batch_id}_skipped.csv"'},
    )
