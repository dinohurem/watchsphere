"""Checks admin: lists, CRUD, bulk edit/delete, import (CSV/XLSX + photos ZIP) and export.

Mounted at ``/api/v1/admin/checks``. The three collections (``serial-reports``,
``dealer-numbers``, ``bracelets``) share one set of generic endpoints. Draft rows with a
reporter are user reports; publishing or rejecting one notifies the reporter (spec 2.4).
"""
import io
import logging
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

import httpx
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.v1.endpoints.activity import log_activity
from app.core.deps import get_current_admin_user
from app.models.activity_log import ActivityType, EntityType
from app.models.checks import CheckImportPreview, DealerNumber, SerialReport
from app.models.user import User
from app.services import checks_import
from app.services.checks_service import (
    COLLECTIONS,
    Collection,
    CheckError,
    FIELD_ALIASES,
    admin_dict,
    apply_changes,
    build_list_query,
    export_csv,
    export_xlsx,
    merge_and_clean,
    parse_table,
    photo_names,
    reporters_for,
)

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_PAGE_SIZE = 200


def _coll(collection: str) -> Collection:
    coll = COLLECTIONS.get(collection)
    if coll is None:
        raise HTTPException(status_code=404, detail="Unknown collection")
    return coll


def _oid(value: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")


async def _log(admin: User, coll: Collection, description: str, entity_id: Optional[str] = None,
               **metadata: Any) -> None:
    try:
        await log_activity(
            ActivityType.ADMIN_ACTION, description, user=admin, entity_type=EntityType.CHECK,
            entity_id=entity_id, metadata={"collection": coll.key, **metadata}, platform="admin",
        )
    except Exception as exc:  # audit trail must not break the operation
        logger.warning("checks activity log failed: %s", exc)


# --------------------------------------------------------------------------------------------
# Draft counts (sidebar badges) - declared before the /{collection} routes
# --------------------------------------------------------------------------------------------

@router.get("/draft-counts")
async def draft_counts(current_admin: User = Depends(get_current_admin_user)) -> Any:
    return {
        "serial_reports": await SerialReport.find({"status": "draft"}).count(),
        "dealer_numbers": await DealerNumber.find({"status": "draft"}).count(),
    }


# --------------------------------------------------------------------------------------------
# List / export (before /{collection}/{id})
# --------------------------------------------------------------------------------------------

@router.get("/{collection}")
async def list_items(
    collection: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    coll = _coll(collection)
    query = build_list_query(coll, search, status or None, type or None)
    total = await coll.model.find(query).count()
    docs = await coll.model.find(query).sort([("created_at", -1)]) \
        .skip((page - 1) * page_size).limit(page_size).to_list()
    reporters = await reporters_for(docs)
    return {"items": [admin_dict(coll, d, reporters) for d in docs],
            "total": total, "page": page, "page_size": page_size}


async def _filtered_docs(coll: Collection, search, status, type) -> List[Any]:
    return await coll.model.find(build_list_query(coll, search, status or None, type or None)) \
        .sort([("created_at", -1)]).to_list()


@router.get("/{collection}/export")
async def export_items(
    collection: str,
    format: Literal["csv", "xlsx"] = "csv",
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """The current list (filters applied) in exactly the import columns."""
    coll = _coll(collection)
    docs = await _filtered_docs(coll, search, status, type)
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M")
    if format == "xlsx":
        return Response(
            export_xlsx(coll, docs),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{coll.key}_{stamp}.xlsx"'})
    return Response(
        export_csv(coll, docs), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{coll.key}_{stamp}.csv"'})


async def fetch_photo(url: str) -> Optional[bytes]:
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            r = await client.get(url)
            return r.content if r.status_code == 200 else None
    except Exception:
        return None


@router.get("/{collection}/export-photos")
async def export_photos(
    collection: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """ZIP of the photos of the current list, named as in the export's photo_filename column."""
    coll = _coll(collection)
    docs = await _filtered_docs(coll, search, status, type)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        for doc in docs:
            urls = list(getattr(doc, "photos", None) or []) if coll.kind != "bracelet" else \
                ([doc.photo_url] if doc.photo_url else [])
            for name, url in zip(photo_names(str(doc.id), urls), urls):
                data = await fetch_photo(url)
                if data:
                    zf.writestr(name, data)
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M")
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{coll.key}_photos_{stamp}.zip"'})


# --------------------------------------------------------------------------------------------
# CRUD
# --------------------------------------------------------------------------------------------

@router.get("/{collection}/{item_id}")
async def get_item(collection: str, item_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    doc = await coll.model.get(_oid(item_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")
    return admin_dict(coll, doc, await reporters_for([doc]))


@router.post("/{collection}", status_code=201)
async def create_item(collection: str, body: Dict[str, Any], current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    try:
        cleaned = merge_and_clean(coll, body)
    except CheckError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    doc = coll.model(**cleaned)
    await doc.insert()
    await _log(current_admin, coll, f"Created {coll.key} entry", str(doc.id))
    return admin_dict(coll, doc)


@router.patch("/{collection}/{item_id}")
async def update_item(collection: str, item_id: str, body: Dict[str, Any],
                      current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    doc = await coll.model.get(_oid(item_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        cleaned = merge_and_clean(coll, body, doc)
    except CheckError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    result = await apply_changes(coll, doc, cleaned)
    await _log(current_admin, coll, f"Updated {coll.key} entry", str(doc.id),
               status_from=result["old_status"], status_to=result["new_status"])
    return admin_dict(coll, doc, await reporters_for([doc]))


@router.delete("/{collection}/{item_id}")
async def delete_item(collection: str, item_id: str, current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    doc = await coll.model.get(_oid(item_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")
    await doc.delete()
    await _log(current_admin, coll, f"Deleted {coll.key} entry", item_id)
    return {"deleted": 1}


# --------------------------------------------------------------------------------------------
# Bulk edit / delete
# --------------------------------------------------------------------------------------------

class BulkEditBody(BaseModel):
    ids: List[str]
    set: Dict[str, Any]


class BulkDeleteBody(BaseModel):
    ids: List[str]


@router.post("/{collection}/bulk-edit")
async def bulk_edit(collection: str, body: BulkEditBody, current_admin: User = Depends(get_current_admin_user)) -> Any:
    """Set the given fields on every selected row. All-or-nothing validation: if the change is
    invalid for any row nothing is saved and the error names the row."""
    coll = _coll(collection)
    changes = {FIELD_ALIASES.get(k, k): v for k, v in body.set.items()}
    bad = [k for k in changes if k not in coll.fields or k in ("photos", "photo_thumbnails")]
    if not changes or bad:
        raise HTTPException(status_code=422, detail=f"Cannot set: {', '.join(bad) or 'nothing to set'}")
    docs = await coll.model.find({"_id": {"$in": [_oid(i) for i in body.ids]}}).to_list()
    prepared = []
    for doc in docs:
        try:
            prepared.append((doc, merge_and_clean(coll, changes, doc)))
        except CheckError as exc:
            raise HTTPException(status_code=422, detail=f"{doc.id}: {exc}")
    for doc, cleaned in prepared:
        await apply_changes(coll, doc, cleaned)
    await _log(current_admin, coll, f"Bulk edit of {len(docs)} {coll.key} entries",
               fields=sorted(changes), count=len(docs))
    return {"updated": len(docs)}


@router.post("/{collection}/bulk-delete")
async def bulk_delete(collection: str, body: BulkDeleteBody, current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    result = await coll.model.find({"_id": {"$in": [_oid(i) for i in body.ids]}}).delete()
    count = getattr(result, "deleted_count", 0) or 0
    await _log(current_admin, coll, f"Bulk delete of {count} {coll.key} entries", count=count)
    return {"deleted": count}


# --------------------------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------------------------

async def _read_upload(f: UploadFile) -> bytes:
    return await f.read()


@router.post("/{collection}/import/preview")
async def import_preview(
    collection: str,
    file: UploadFile = File(...),
    photos: Optional[UploadFile] = File(None),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    coll = _coll(collection)
    try:
        raw_rows = parse_table(file.filename or "", await file.read())
    except CheckError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if not raw_rows:
        raise HTTPException(status_code=422, detail="No rows found in the file")
    planned = await checks_import.plan_rows(coll, raw_rows)
    zip_bytes = await photos.read() if photos is not None and photos.filename else None
    zip_error = await checks_import.attach_photos(coll, planned, zip_bytes, UPLOADER)
    if zip_error:
        raise HTTPException(status_code=422, detail=zip_error)
    preview = await checks_import.save_preview(coll, planned, str(current_admin.id) if current_admin.id else None)
    counts: Dict[str, int] = {}
    for r in preview.rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return {"rows": checks_import.public_rows(preview.rows), "token": str(preview.id), "counts": counts}


# Module-level hook so tests can replace the Firebase upload.
UPLOADER = checks_import.default_uploader


class CommitBody(BaseModel):
    token: str
    duplicates: Literal["skip", "update"] = "skip"
    conflicts: Literal["skip", "import"] = "skip"  # verified/scammer conflicts: the team decides
    skip_rows: List[int] = []


@router.post("/{collection}/import/commit")
async def import_commit(collection: str, body: CommitBody, current_admin: User = Depends(get_current_admin_user)) -> Any:
    coll = _coll(collection)
    preview = await CheckImportPreview.get(_oid(body.token))
    if preview is None or preview.collection != coll.key:
        raise HTTPException(status_code=404, detail="Import preview not found or expired")
    result = await checks_import.commit_import(coll, preview, body.duplicates, body.conflicts, body.skip_rows)
    await _log(current_admin, coll, f"Imported {coll.key}: {result['created']} created, "
               f"{result['updated']} updated, {result['skipped']} skipped", **result)
    return result
