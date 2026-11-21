"""Checks bulk import: preview (classify rows, attach photos from a ZIP) and commit.

Spec 2.1-2.3. A preview classifies every row as ``new``, ``duplicate``, ``conflict`` or
``invalid`` and is stored under a token; ``commit`` applies it.

Duplicates: serial reports = same normalised serial + reference + type; dealer numbers = same
E.164 + type; bracelets = same normalised reference + bracelet. Conflicts (dealer numbers only):
the number already exists (or appears earlier in the file) with the other type. Rows with a
phone number that is not valid for the country code are ``invalid`` and skipped.
"""
import io
import logging
import uuid
import zipfile
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from app.models.checks import CheckImportPreview
from app.services.checks_service import (
    Collection,
    CheckError,
    _slug,
    _text,
    apply_changes,
    doc_fields,
    merge_and_clean,
)

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 25 * 1024 * 1024
MAX_ZIP_TOTAL_BYTES = 500 * 1024 * 1024
PREVIEW_TTL = timedelta(hours=24)

Uploader = Callable[[bytes, str], Awaitable[Dict[str, Any]]]


async def default_uploader(data: bytes, folder: str) -> Dict[str, Any]:
    """WebP + 400 px thumbnail in Firebase Storage (same path the Watches bulk images use)."""
    from app.services.storage import upload_image

    return await upload_image(data, folder=folder, filename=uuid.uuid4().hex)


def _key(coll: Collection, c: Dict[str, Any]) -> Tuple:
    if coll.kind == "serial":
        return (c["serial_normalized"], c["reference_normalized"], c["type"])
    if coll.kind == "dealer_number":
        return (c["e164"], c["type"])
    return (c["reference_normalized"], _slug(c["bracelet"]))


def _doc_key(coll: Collection, doc: Any) -> Tuple:
    if coll.kind == "serial":
        t = doc.type.value if hasattr(doc.type, "value") else doc.type
        return (doc.serial_normalized, doc.reference_normalized, t)
    if coll.kind == "dealer_number":
        t = doc.type.value if hasattr(doc.type, "value") else doc.type
        return (doc.e164, t)
    return (doc.reference_normalized, _slug(doc.bracelet))


def _filenames(v: Any) -> List[str]:
    s = _text(v) or ""
    return [p.strip() for p in s.replace("|", ";").split(";") if p.strip()]


async def _existing_docs(coll: Collection, cleaned_rows: List[Dict[str, Any]]) -> List[Any]:
    field = {"serial": "serial_normalized", "dealer_number": "e164", "bracelet": "reference_normalized"}[coll.kind]
    values = sorted({c[field] for c in cleaned_rows})
    if not values:
        return []
    return await coll.model.find({field: {"$in": values}}).to_list()


async def plan_rows(coll: Collection, raw_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Classify the parsed rows (no writes)."""
    planned: List[Dict[str, Any]] = []
    for raw in raw_rows:
        changes = {k: v for k, v in raw.items()
                   if k in coll.fields and k not in ("photos", "photo_thumbnails")}
        item: Dict[str, Any] = {
            "row": raw.get("_row"), "status": "new", "message": "", "existing_id": None,
            "filenames": _filenames(raw.get("photo_filename")),
            "status_given": bool(_text(raw.get("status"))), "photos": [], "photo_thumbnails": [],
        }
        try:
            item["data"] = coll.clean(changes)
        except CheckError as exc:
            item.update(status="invalid", message=str(exc),
                        data={k: v for k, v in changes.items()})
        planned.append(item)

    valid = [p["data"] for p in planned if p["status"] != "invalid"]
    existing = await _existing_docs(coll, valid) if valid else []
    by_key: Dict[Tuple, Any] = {}
    for d in existing:
        by_key.setdefault(_doc_key(coll, d), d)
    by_number: Dict[str, List[Any]] = {}
    if coll.kind == "dealer_number":
        for d in existing:
            by_number.setdefault(d.e164, []).append(d)

    seen: Dict[Tuple, int] = {}
    seen_number: Dict[str, List[Tuple[str, int]]] = {}
    for p in planned:
        if p["status"] == "invalid":
            continue
        c = p["data"]
        k = _key(coll, c)
        if k in seen:
            p.update(status="duplicate", message=f"Same as row {seen[k]} in this file (skipped)")
        elif k in by_key:
            p.update(status="duplicate", existing_id=str(by_key[k].id), message="Already exists")
        elif coll.kind == "dealer_number":
            other = [d for d in by_number.get(c["e164"], [])
                     if (d.type.value if hasattr(d.type, "value") else d.type) != c["type"]
                     and (d.status.value if hasattr(d.status, "value") else d.status) != "rejected"]
            in_file = [(t, r) for t, r in seen_number.get(c["e164"], []) if t != c["type"]]
            if other:
                o = other[0]
                p.update(status="conflict", existing_id=str(o.id),
                         message=f"Already in the database as {o.type.value if hasattr(o.type, 'value') else o.type}")
            elif in_file:
                p.update(status="conflict", message=f"Row {in_file[0][1]} has the same number as {in_file[0][0]}")
        if k not in seen:
            seen[k] = p["row"]
        if coll.kind == "dealer_number":
            seen_number.setdefault(c["e164"], []).append((c["type"], p["row"]))
    return planned


def _zip_index(zip_bytes: bytes) -> Tuple[Dict[str, Tuple[zipfile.ZipFile, zipfile.ZipInfo]], Optional[str]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        return {}, "The photos file is not a valid ZIP"
    index = {}
    total = 0
    for info in archive.infolist():
        if info.is_dir():
            continue
        parts = info.filename.split("/")
        if "__MACOSX" in parts or parts[-1].startswith("._"):
            continue
        total += info.file_size
        if total > MAX_ZIP_TOTAL_BYTES:
            return index, "The photos ZIP is too large (max 500 MB unpacked)"
        index.setdefault(parts[-1].lower(), (archive, info))
    return index, None


async def attach_photos(coll: Collection, planned: List[Dict[str, Any]], zip_bytes: Optional[bytes],
                        uploader: Uploader = default_uploader) -> Optional[str]:
    """Upload the photos named in ``photo_filename`` from the ZIP. Returns a ZIP-level error."""
    if zip_bytes is None:
        for p in planned:
            if p["filenames"] and p["status"] != "invalid":
                p["message"] = (p["message"] + "; " if p["message"] else "") + \
                    "photo_filename given but no photos ZIP uploaded"
        return None
    index, err = _zip_index(zip_bytes)
    if err and not index:
        return err
    for p in planned:
        if p["status"] == "invalid" or not p["filenames"]:
            continue
        notes = []
        names = p["filenames"][:1] if coll.kind == "bracelet" else p["filenames"]
        for name in names:
            entry = index.get(name.rsplit("/", 1)[-1].lower())
            if entry is None:
                notes.append(f"Photo not found in ZIP: {name}")
                continue
            archive, info = entry
            if info.file_size > MAX_IMAGE_BYTES:
                notes.append(f"Photo too large (max 25 MB): {name}")
                continue
            try:
                stored = await uploader(archive.read(info), "checks")
            except Exception as exc:  # bad image, storage not configured, ...
                logger.warning("checks photo upload failed for %s: %s", name, exc)
                notes.append(f"Could not process photo {name}: {str(exc)[:80]}")
                continue
            p["photos"].append(stored["url"])
            p["photo_thumbnails"].append(stored.get("thumbnail_url") or stored["url"])
        if notes:
            p["message"] = (p["message"] + "; " if p["message"] else "") + "; ".join(notes)
    return err


def _apply_photos(coll: Collection, data: Dict[str, Any], p: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(data)
    if p["photos"]:
        if coll.kind == "bracelet":
            out["photo_url"] = p["photos"][0]
            out["photo_thumb_url"] = p["photo_thumbnails"][0]
        else:
            out["photos"] = list(p["photos"])
            out["photo_thumbnails"] = list(p["photo_thumbnails"])
    return out


async def save_preview(coll: Collection, planned: List[Dict[str, Any]], admin_id: Optional[str]) -> CheckImportPreview:
    await CheckImportPreview.find({"created_at": {"$lt": datetime.utcnow() - PREVIEW_TTL}}).delete()
    rows = []
    for p in planned:
        rows.append({**p, "data": _apply_photos(coll, p["data"], p) if p["status"] != "invalid" else p["data"]})
    preview = CheckImportPreview(collection=coll.key, rows=rows, created_by=admin_id)
    await preview.insert()
    return preview


def public_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{"row": r["row"], "data": r["data"], "status": r["status"], "message": r["message"],
             "existing_id": r["existing_id"]} for r in rows]


async def commit_import(coll: Collection, preview: CheckImportPreview, duplicates: str = "skip",
                        conflicts: str = "skip", skip_rows: Optional[List[int]] = None) -> Dict[str, int]:
    created = updated = skipped = 0
    skip = set(skip_rows or [])
    for r in preview.rows:
        st = r["status"]
        if r["row"] in skip or st == "invalid":
            skipped += 1
            continue
        if st == "duplicate":
            if duplicates != "update" or not r.get("existing_id"):
                skipped += 1
                continue
            doc = None
            try:
                doc = await coll.model.get(r["existing_id"])
            except Exception:
                pass
            if doc is None:
                skipped += 1
                continue
            changes = {k: v for k, v in r["data"].items() if v not in (None, [], "")}
            if not r.get("status_given"):
                changes.pop("status", None)
            cleaned = merge_and_clean(coll, changes, doc)
            await apply_changes(coll, doc, cleaned)
            updated += 1
            continue
        if st == "conflict" and conflicts != "import":
            skipped += 1
            continue
        doc = coll.model(**r["data"])
        await doc.insert()
        created += 1
    await preview.delete()
    return {"created": created, "updated": updated, "skipped": skipped}
