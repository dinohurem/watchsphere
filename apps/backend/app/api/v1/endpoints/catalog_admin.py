"""Catalog admin: export, edit import, bulk images, bulk actions and undo (bulk/edit spec).

Mounted at ``/api/v1/catalog-admin``. Admin only. The import semantics live in
``app/services/catalog_admin.py`` (pure, unit-tested); undo lives in ``app/services/undo.py``.
"""
import io
import logging
import uuid
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.deps import get_current_admin_user
from app.core.market_constants import LIST_PRICE_COUNTRIES
from app.models.change_batch import ChangeBatch, ChangeBatchEntry
from app.models.user import User
from app.models.watch import Watch, WatchStatus
from app.services.catalog_admin import (
    IMAGE_FIELDS,
    ParsedRows,
    build_image_index,
    build_watch_query,
    export_csv,
    export_jsonl,
    load_catalog,
    match_image_names,
    parse_import_text,
    plan_edit_import,
    watch_to_dict,
    write_update_plans,
)
from app.services.undo import ChangeBatchRecorder, batch_to_dict, undo_batch

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_ZIP_TOTAL_BYTES = 500 * 1024 * 1024


# --------------------------------------------------------------------------------------------
# Selection (ids / everything matching the list filters / every watch)
# --------------------------------------------------------------------------------------------

class WatchFilters(BaseModel):
    status: Optional[str] = None
    brand: Optional[str] = None
    dealer_id: Optional[str] = None
    search: Optional[str] = None
    no_image: bool = False
    no_ws_code: bool = False
    no_aliases: bool = False
    no_list_price: bool = False


class Selection(BaseModel):
    # ids → only ``ids``; filtered → every watch matching ``filters``; all → every watch
    mode: Literal["ids", "filtered", "all"] = "ids"
    ids: List[str] = []
    filters: WatchFilters = WatchFilters()


def selection_query(selection: Selection) -> Dict[str, Any]:
    if selection.mode == "all":
        return {}
    if selection.mode == "filtered":
        return build_watch_query(**selection.filters.model_dump())
    if not selection.ids:
        raise HTTPException(status_code=400, detail="No watches selected")
    return build_watch_query(ids=selection.ids)


async def selected_watches(selection: Selection) -> List[Watch]:
    return await Watch.find(selection_query(selection)).sort([("created_at", -1)]).to_list()


# --------------------------------------------------------------------------------------------
# Reference data
# --------------------------------------------------------------------------------------------

@router.get("/list-price-countries")
async def list_price_countries(current_admin: User = Depends(get_current_admin_user)) -> Any:
    """The 13 list-price countries in display order (currency and tax label are fixed)."""
    return LIST_PRICE_COUNTRIES


@router.get("/brands")
async def catalog_brands(current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Every brand in the catalog, active and draft."""
    brands = await Watch.distinct("brand")
    return sorted({b for b in brands if b}, key=str.lower)


# --------------------------------------------------------------------------------------------
# Export (§1)
# --------------------------------------------------------------------------------------------

class ExportRequest(BaseModel):
    format: Literal["jsonl", "csv"] = "jsonl"
    selection: Selection = Selection(mode="all")


def export_response(watches: List[Watch], fmt: str) -> StreamingResponse:
    rows = [watch_to_dict(w) for w in watches]
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M")
    if fmt == "csv":
        return StreamingResponse(
            export_csv(rows), media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="watches_export_{stamp}.csv"'},
        )
    return StreamingResponse(
        export_jsonl(rows), media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="watches_export_{stamp}.jsonl"'},
    )


@router.post("/watches/export")
async def export_watches(payload: ExportRequest, current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Export selected / filtered / all watches (draft included) as JSONL or CSV."""
    return export_response(await selected_watches(payload.selection), payload.format)


# --------------------------------------------------------------------------------------------
# Edit import (§2, §3)
# --------------------------------------------------------------------------------------------

class EditImportRequest(BaseModel):
    text: Optional[str] = None  # raw JSONL / CSV file content
    format: str = "auto"  # auto | jsonl | csv
    rows: Optional[List[Any]] = None  # already-parsed rows (alternative to ``text``)
    dry_run: bool = True


@router.post("/watches/edit-import")
async def edit_import(payload: EditImportRequest, current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Update existing watches matched by ``id``.

    Run with ``dry_run=true`` first to get the summary ("312 watches · 280 WS codes changed ·
    3 errors") and per-row errors; run again with ``dry_run=false`` to save. Rows with errors are
    always skipped.
    """
    if payload.rows is not None:
        parsed = ParsedRows(rows=list(enumerate(payload.rows, start=1)))
    elif payload.text is not None:
        parsed = parse_import_text(payload.text, payload.format)
    else:
        raise HTTPException(status_code=400, detail="Provide text or rows")
    if not parsed.rows and not parsed.errors:
        raise HTTPException(status_code=400, detail="Nothing to import")

    catalog = await load_catalog()
    plan = plan_edit_import(parsed, catalog)
    plans = plan.pop("plans")
    plan["dry_run"] = payload.dry_run
    plan["batch_id"] = None
    if not payload.dry_run and plans:
        recorder = ChangeBatchRecorder(
            "edit_import", f"Edit import · {plan['summary']}", current_admin,
        )
        await write_update_plans(plans, catalog, recorder)
        plan["batch_id"] = str(recorder.batch.id) if recorder.batch else None
    return plan


# --------------------------------------------------------------------------------------------
# Bulk images (§4)
# --------------------------------------------------------------------------------------------

def _expand_uploads(files: List[tuple]) -> tuple:
    """(name, bytes) uploads → (image entries, ignored, unmatched). ZIPs are unpacked."""
    entries: List[tuple] = []
    ignored: List[Dict[str, str]] = []
    unmatched: List[Dict[str, str]] = []
    for name, data in files:
        if name.lower().endswith(".zip"):
            try:
                archive = zipfile.ZipFile(io.BytesIO(data))
            except zipfile.BadZipFile:
                unmatched.append({"file": name, "reason": "not a valid ZIP file"})
                continue
            total = 0
            for info in archive.infolist():
                if info.is_dir():
                    continue
                path = info.filename
                if "__MACOSX" in path.split("/") or path.rsplit("/", 1)[-1].startswith("._"):
                    ignored.append({"file": f"{name}/{path}", "reason": "macOS metadata"})
                    continue
                if info.file_size > MAX_IMAGE_BYTES:
                    unmatched.append({"file": f"{name}/{path}", "reason": "file too large (max 25 MB)"})
                    continue
                total += info.file_size
                if total > MAX_ZIP_TOTAL_BYTES:
                    unmatched.append({"file": f"{name}/{path}", "reason": "ZIP too large (max 500 MB unpacked)"})
                    continue
                entries.append((path, archive.read(info)))
        else:
            if len(data) > MAX_IMAGE_BYTES:
                unmatched.append({"file": name, "reason": "file too large (max 25 MB)"})
                continue
            entries.append((name, data))
    return entries, ignored, unmatched


@router.post("/watches/images")
async def bulk_images(
    files: List[UploadFile] = File(...),
    dry_run: bool = Form(False),
    batch_id: Optional[str] = Form(None),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Upload many images and/or ZIPs; each file name (without extension) is matched to a watch
    id, WS code or OEM reference (case-insensitive, ``/`` = ``-`` = ``_``). One image per watch,
    replacing the existing one. Large uploads can be split over several requests by passing the
    ``batch_id`` returned by the first one, so a single undo covers all of them."""
    from app.services.storage import upload_image

    raw = [(f.filename or "unnamed", await f.read()) for f in files]
    entries, ignored, unmatched = _expand_uploads(raw)

    batch: Optional[ChangeBatch] = None
    already: Dict[str, str] = {}
    if batch_id:
        if not PydanticObjectId.is_valid(batch_id):
            raise HTTPException(status_code=400, detail="Invalid batch_id")
        batch = await ChangeBatch.get(PydanticObjectId(batch_id))
        if batch is None or batch.kind != "bulk_images" or batch.undone_at:
            raise HTTPException(status_code=400, detail="Invalid batch_id")
        for e in await ChangeBatchEntry.find(ChangeBatchEntry.batch_id == batch_id).to_list():
            already[e.watch_id] = "an earlier upload"

    catalog = await load_catalog()
    labels = {wid: (w.get("ws_code") or f"{w.get('brand')} {w.get('model')}") for wid, w in catalog.items()}
    data_by_name = {name: data for name, data in entries}
    result = match_image_names([n for n, _ in entries], build_image_index(catalog.values()), labels, already)
    result["ignored"] = ignored + result["ignored"]
    result["unmatched"] = unmatched + result["unmatched"]
    for m in result["matched"]:
        w = catalog[m["watch_id"]]
        m.update({"ws_code": w.get("ws_code"), "brand": w.get("brand"), "model": w.get("model"),
                  "had_image": bool(w.get("cover_image"))})

    if dry_run:
        return {"dry_run": True, **result, "batch_id": batch_id}

    uploaded: List[Dict[str, Any]] = []
    for m in result["matched"]:
        try:
            stored = await upload_image(
                data_by_name[m["file"]], folder="watches",
                # Unique name: the previous image file is kept so undo can restore its URL.
                filename=f"watch_{m['watch_id']}_{uuid.uuid4().hex[:8]}",
            )
        except Exception as exc:  # bad image data, storage not configured, ...
            logger.warning("bulk image upload failed for %s: %s", m["file"], exc)
            result["unmatched"].append({"file": m["file"], "reason": f"could not process image: {str(exc)[:120]}"})
            continue
        uploaded.append({**m, "stored": stored})
    result["matched"] = [{k: v for k, v in u.items() if k != "stored"} for u in uploaded]

    plans = [
        {"id": u["watch_id"], "changes": {
            "cover_image": u["stored"]["url"],
            "cover_image_thumbnail": u["stored"].get("thumbnail_url"),
            "images": [u["stored"]["url"]],
            "image_thumbnails": [u["stored"]["thumbnail_url"]] if u["stored"].get("thumbnail_url") else [],
            "image_paths": [u["stored"]["path"]],
        }}
        for u in uploaded
    ]
    recorder = ChangeBatchRecorder("bulk_images", "", current_admin, batch=batch)
    for p in plans:
        recorder.record_update(p["id"], catalog[p["id"]], list(IMAGE_FIELDS) + ["updated_at"])
    total_images = (batch.updated_count if batch else 0) + len(plans)
    recorder.summary = f"Bulk images · {total_images} watch{'es' if total_images != 1 else ''}"
    if plans:
        await write_update_plans(plans, catalog, recorder)
    return {"dry_run": False, **result,
            "batch_id": str(recorder.batch.id) if recorder.batch else batch_id}


# --------------------------------------------------------------------------------------------
# Bulk actions (§5)
# --------------------------------------------------------------------------------------------

class BulkActionRequest(BaseModel):
    action: Literal["set_status", "set_discontinued", "delete"]
    value: Optional[Any] = None  # "active" | "draft" for set_status; bool for set_discontinued
    selection: Selection


@router.post("/watches/bulk-action")
async def bulk_action(payload: BulkActionRequest, current_admin: User = Depends(get_current_admin_user)) -> Any:
    watches = await selected_watches(payload.selection)
    now = datetime.utcnow()
    catalog = {str(w.id): watch_to_dict(w) for w in watches}

    if payload.action == "delete":
        recorder = ChangeBatchRecorder("bulk_action", f"Deleted {len(watches)} watch{'es' if len(watches) != 1 else ''}", current_admin)
        for w in watches:
            recorder.record_delete(w)
        await recorder.save()
        if watches:
            await Watch.find({"_id": {"$in": [w.id for w in watches]}}).delete()
        return {"action": "delete", "matched": len(watches), "affected": len(watches),
                "batch_id": str(recorder.batch.id) if recorder.batch else None}

    plans: List[Dict[str, Any]] = []
    if payload.action == "set_status":
        value = str(payload.value or "").lower()
        if value not in (WatchStatus.ACTIVE.value, WatchStatus.DRAFT.value):
            raise HTTPException(status_code=400, detail="value must be 'active' or 'draft'")
        for wid, w in catalog.items():
            if w.get("status") == value:
                continue
            changes: Dict[str, Any] = {"status": value}
            if value == "active" and not w.get("published_at"):
                changes["published_at"] = now
            plans.append({"id": wid, "changes": changes})
        summary = f"Set {len(plans)} watch{'es' if len(plans) != 1 else ''} to {value}"
    else:
        value = True if payload.value is None else bool(payload.value)
        for wid, w in catalog.items():
            if bool(w.get("discontinued")) != value:
                plans.append({"id": wid, "changes": {"discontinued": value}})
        summary = f"{'Marked' if value else 'Unmarked'} {len(plans)} watch{'es' if len(plans) != 1 else ''} discontinued"

    recorder = ChangeBatchRecorder("bulk_action", summary, current_admin)
    if plans:
        await write_update_plans(plans, catalog, recorder)
    return {"action": payload.action, "matched": len(watches), "affected": len(plans),
            "batch_id": str(recorder.batch.id) if recorder.batch else None, "summary": summary}


# --------------------------------------------------------------------------------------------
# Undo (§8.1)
# --------------------------------------------------------------------------------------------

@router.get("/batches")
async def recent_batches(limit: int = 20, current_admin: User = Depends(get_current_admin_user)) -> Any:
    batches = await ChangeBatch.find_all().sort([("created_at", -1)]).limit(max(1, min(limit, 100))).to_list()
    return [batch_to_dict(b) for b in batches]


@router.post("/batches/{batch_id}/undo")
async def undo(batch_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    if not PydanticObjectId.is_valid(batch_id):
        raise HTTPException(status_code=404, detail="Change not found")
    try:
        result = await undo_batch(batch_id, current_admin)
    except LookupError:
        raise HTTPException(status_code=404, detail="Change not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return {"batch_id": batch_id, **result}
