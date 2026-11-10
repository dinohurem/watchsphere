"""Automatic generator pipeline: Mac mini → server → app (generator spec §1).

Flow per upload (one group's ``_chat.txt`` + ``<group>_Medien.zip``):

1. ``store_upload`` writes both files to GridFS *before* the endpoint answers, so
   the Mac mini only deletes its copy once the server holds it durably.
2. ``process_upload`` keeps only messages newer than the group's watermark
   (every export contains the whole history), runs the generator for WTS and WTB,
   and routes the rows:
   - matched / matched_via_image → imported (``match_method`` exact / image)
   - needs_review → Claude review: sure → imported (``match_method="ai"``) and
     listed on the "AI decisions" tab; unsure → "Unsure" tab
   - not_in_database → archive (source of "New watches" suggestions)
   - discarded / aftermarket / no phone number → "Discarded" (TTL 30 days)
3. Reposts only refresh the existing order; ``dispatch_new_listings`` runs once
   per upload with the really-new order ids.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import re
import zipfile
from datetime import datetime, timedelta
from typing import Any, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

logger = logging.getLogger(__name__)

DISCARD_TTL_DAYS = 30
MODES = ("WTS", "WTB")
UPLOAD_BUCKET = "pipeline_uploads"
IMAGE_BUCKET = "pipeline_images"
MAX_ATTEMPTS = 3

_group_locks: dict[str, asyncio.Lock] = {}

# Same header formats the generator understands (iOS bracket, Android, German).
_HEADER_PATTERNS = [
    re.compile(r'^\[(\d{1,2}[./]\d{1,2}[./]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*[^:]+:'),
    re.compile(r'^(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*[^:]+:'),
    re.compile(r'^(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*[^:]+:'),
]
_INVISIBLE = re.compile('[‎‏‪-‮⁦-⁩﻿]')
_ATTACHED_RE = re.compile(r'<attached:\s*([^>]+?)\s*>|(\S+\.(?:jpe?g|png|webp|heic))\s*\((?:file attached|Datei angehängt)\)', re.I)


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #

def parse_header_timestamp(line: str) -> Optional[datetime]:
    clean = _INVISIBLE.sub('', line).replace('\xa0', ' ').replace(' ', ' ').strip()
    for pattern in _HEADER_PATTERNS:
        m = pattern.match(clean)
        if not m:
            continue
        date_str = m.group(1).replace('/', '.')
        time_str = m.group(2)
        for fmt in ("%d.%m.%y %H:%M:%S", "%d.%m.%Y %H:%M:%S", "%d.%m.%y %H:%M", "%d.%m.%Y %H:%M"):
            try:
                return datetime.strptime(f"{date_str} {time_str}", fmt)
            except ValueError:
                continue
    return None


def filter_new_messages(chat_txt: str, after: Optional[datetime]) -> dict:
    """Keep only messages strictly newer than ``after``.

    Continuation lines stay with their message. Returns
    {"text", "count", "first", "last", "attachments"}.
    """
    kept: list[str] = []
    count = 0
    first = last = None
    keep_current = False
    attachments: list[str] = []
    for line in chat_txt.splitlines():
        ts = parse_header_timestamp(line)
        if ts is not None:
            keep_current = after is None or ts > after
            if keep_current:
                count += 1
                first = first or ts
                last = ts if (last is None or ts > last) else last
        if keep_current:
            kept.append(line)
            for m in _ATTACHED_RE.finditer(line):
                name = (m.group(1) or m.group(2) or "").strip()
                if name:
                    attachments.append(name)
    return {
        "text": "\n".join(kept) + ("\n" if kept else ""),
        "count": count,
        "first": first,
        "last": last,
        "attachments": attachments,
    }


def text_key(text: Optional[str]) -> str:
    """Grouping key for identical texts on the Unsure tab."""
    t = _INVISIBLE.sub('', (text or "")).lower()
    t = re.sub(r'[\s ]+', ' ', t)
    return t.strip()


def row_meta(row: dict) -> dict:
    meta = row.get("_meta")
    return meta if isinstance(meta, dict) else {}


def row_phone(row: dict) -> str:
    return (row.get("Nummer") or row.get("nummer") or row_meta(row).get("sender_phone") or "").strip()


def row_source_text(row: dict) -> str:
    return (
        row_meta(row).get("source_text")
        or row.get("Original Text")
        or row.get("_original_content")
        or ""
    )


# --------------------------------------------------------------------------- #
# Storage
# --------------------------------------------------------------------------- #

def _bucket(name: str) -> AsyncIOMotorGridFSBucket:
    from app.models.order import Order

    return AsyncIOMotorGridFSBucket(Order.get_motor_collection().database, bucket_name=name)


async def _put(bucket: str, data: bytes, filename: str, metadata: Optional[dict] = None) -> str:
    file_id = await _bucket(bucket).upload_from_stream(filename, data, metadata=metadata or {})
    return str(file_id)


async def _get(bucket: str, file_id: str) -> bytes:
    stream = await _bucket(bucket).open_download_stream(ObjectId(file_id))
    return await stream.read()


async def _delete(bucket: str, file_id: Optional[str]) -> None:
    if not file_id:
        return
    try:
        await _bucket(bucket).delete(ObjectId(file_id))
    except Exception as exc:
        logger.debug("pipeline: gridfs delete %s/%s failed: %s", bucket, file_id, exc)


async def get_image(image_id: str) -> tuple[bytes, str]:
    stream = await _bucket(IMAGE_BUCKET).open_download_stream(ObjectId(image_id))
    data = await stream.read()
    name = (stream.filename or "").lower()
    ctype = "image/png" if name.endswith(".png") else "image/webp" if name.endswith(".webp") else "image/jpeg"
    return data, ctype


async def store_upload(group_name: str, chat_bytes: bytes, media_bytes: Optional[bytes]):
    """Durably store one export. Returns the PipelineUpload (existing one when the
    identical chat file for this group was already received and processed)."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    sha = hashlib.sha256(chat_bytes).hexdigest()
    existing = await PipelineUpload.find_one(
        {"group_name": group_name, "chat_sha256": sha,
         "status": {"$in": [UploadStatus.DONE.value, UploadStatus.RECEIVED.value, UploadStatus.PROCESSING.value]}}
    )
    if existing:
        return existing, True

    chat_id = await _put(UPLOAD_BUCKET, chat_bytes, f"{group_name}/_chat.txt", {"group": group_name})
    media_id = None
    if media_bytes:
        media_id = await _put(UPLOAD_BUCKET, media_bytes, f"{group_name}/{group_name}_Medien.zip", {"group": group_name})
    upload = PipelineUpload(
        group_name=group_name,
        chat_gridfs_id=chat_id,
        media_gridfs_id=media_id,
        chat_sha256=sha,
        chat_bytes=len(chat_bytes),
        media_bytes=len(media_bytes or b""),
    )
    await upload.insert()
    return upload, False


def _extract_media(zip_bytes: Optional[bytes], wanted: list[str]) -> dict[str, bytes]:
    if not zip_bytes or not wanted:
        return {}
    wanted_set = {w.lower() for w in wanted}
    out: dict[str, bytes] = {}
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                base = info.filename.rsplit("/", 1)[-1]
                if base.lower() in wanted_set and not info.is_dir():
                    out[base] = zf.read(info)
    except zipfile.BadZipFile:
        logger.warning("pipeline: media zip is not a valid zip")
    return out


# --------------------------------------------------------------------------- #
# Processing
# --------------------------------------------------------------------------- #

async def _admin_user():
    from app.models.user import User, UserRole

    return await User.find_one({"role": UserRole.ADMIN.value})


async def _save_image(media: dict[str, bytes], image_file: Optional[str], cache: dict) -> Optional[str]:
    if not image_file:
        return None
    if image_file in cache:
        return cache[image_file]
    data = media.get(image_file) or media.get(image_file.rsplit("/", 1)[-1])
    image_id = await _put(IMAGE_BUCKET, data, image_file) if data else None
    cache[image_file] = image_id
    return image_id


def image_url(image_id: Optional[str]) -> Optional[str]:
    return f"/api/v1/approval/images/{image_id}" if image_id else None


async def suggest_alias(alias: Optional[str], ws_code: Optional[str], example: Optional[str]) -> None:
    """Record a spelling the AI used; an admin approves it on the approval page."""
    from app.models.pipeline import AliasSuggestion, AliasStatus
    from app.models.watch import Watch

    alias = (alias or "").strip()
    if not alias or not ws_code or len(alias) > 80:
        return
    key = re.sub(r'\s+', ' ', alias.lower())
    watch = await Watch.find_one({"ws_code": ws_code})
    if watch and key in {a.strip().lower() for a in (watch.aliases or [])}:
        return
    existing = await AliasSuggestion.find_one({"alias_key": key, "ws_code": ws_code})
    if existing:
        if existing.status == AliasStatus.PENDING:
            existing.hits += 1
            if example and example not in existing.examples and len(existing.examples) < 5:
                existing.examples.append(example[:500])
            await existing.save()
        return
    await AliasSuggestion(
        alias=alias, alias_key=key, ws_code=ws_code,
        examples=[example[:500]] if example else [],
    ).insert()


def _parse_ts(value) -> Optional[datetime]:
    """Generator rows carry the message time as an ISO string after the JSON round-trip."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _item_base(row: dict, mode: str, ctx: dict) -> dict:
    meta = row_meta(row)
    text = row_source_text(row)
    return {
        "mode": mode,
        "group_name": ctx.get("group_name") or meta.get("group_name"),
        "upload_id": ctx.get("upload_id"),
        "run_id": ctx.get("run_id"),
        "source_text": text,
        "text_key": text_key(text),
        "sender_phone": row_phone(row) or None,
        "message_at": _parse_ts(meta.get("timestamp")),
        "row": {k: v for k, v in row.items() if not str(k).startswith("_")},
        "candidates": list(meta.get("candidates") or [])[:5],
    }


async def _create_items(kind, rows: list[dict], mode: str, ctx: dict, media: dict, img_cache: dict,
                        reason: Optional[str] = None, **extra) -> int:
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    docs = []
    for row in rows:
        meta = row_meta(row)
        data = _item_base(row, mode, ctx)
        data["image_id"] = await _save_image(media, meta.get("image_file"), img_cache) if kind != ReviewKind.DISCARDED else None
        data["reason"] = row.get("_reason") or reason or meta.get("discard_reason") or row.get("Review Reason")
        if kind == ReviewKind.DISCARDED:
            data["expires_at"] = datetime.utcnow() + timedelta(days=DISCARD_TTL_DAYS)
            data["status"] = ReviewStatus.RESOLVED
        if kind == ReviewKind.NOT_IN_DATABASE:
            cands = meta.get("candidates") or []
            data["guessed_reference"] = (
                row.get("Referenz") or row.get("Reference") or row.get("WS-Code")
                or (cands[0].get("reference") if cands else None)
            )
            data["guessed_brand"] = row.get("Marke") or (cands[0].get("brand") if cands else None)
        data.update(extra)
        docs.append(PipelineItem(kind=kind, **data))
    if docs:
        await PipelineItem.insert_many(docs)
    return len(docs)


async def _find_order_for_row(ws_code: str, phone: str, text: str) -> Optional[str]:
    from app.models.order import Order

    o = await Order.find_one(
        {"ws_code": ws_code, "whatsapp_phone": phone, "source_text": text}, sort=[("created_at", -1)]
    )
    if o is None:
        o = await Order.find_one(
            {"ws_code": ws_code, "whatsapp_phone": phone, "status": "active"}, sort=[("updated_at", -1)]
        )
    return str(o.id) if o else None


async def import_rows(rows: list[dict], admin, label: str, group_name: Optional[str]) -> dict:
    """Import generator rows through the shared order import (repost-aware)."""
    from app.api.v1.endpoints.whatsapp import import_order_rows
    from app.models.whatsapp_import import ImportStatus, WhatsAppImport

    if not rows:
        return {"new_order_ids": [], "refreshed_order_ids": [], "unmatched_row_list": [],
                "quarantined_row_list": [], "no_phone_row_list": []}
    fieldnames = [k for k in rows[0].keys() if not str(k).startswith("_")]
    record = WhatsAppImport(
        filename=label,
        group_name=group_name or "Pipeline",
        imported_by=str(admin.id),
        imported_by_name="Generator pipeline (automatic)",
        status=ImportStatus.PROCESSING,
    )
    await record.insert()
    try:
        return await import_order_rows(
            rows, fieldnames, record, admin, require_phone=True, dispatch_alerts=False,
        )
    except Exception as exc:
        record.status = ImportStatus.FAILED
        record.error_message = str(exc)[:300]
        record.completed_at = datetime.utcnow()
        await record.save()
        raise


async def route_rows(buckets: dict[str, list[dict]], mode: str, ctx: dict, media: dict, admin) -> dict:
    """Route one generator run's rows (spec §1.4–1.8). Returns stats + new order ids."""
    from app.models.pipeline import ReviewKind
    from app.services import ai_review

    img_cache: dict = {}
    stats: dict[str, Any] = {"mode": mode}
    group_name = ctx.get("group_name")
    run_id = ctx.get("run_id")

    def tag(row: dict, method: str, **more) -> dict:
        r = dict(row)
        r["_import"] = {
            "match_method": method,
            "source_text": row_source_text(row) or None,
            "source_group": group_name,
            "source_run_id": run_id,
            **more,
        }
        return r

    auto = [tag(r, "exact") for r in buckets.get("matched", [])]
    auto += [tag(r, "image") for r in buckets.get("matched_via_image", [])]

    # needs_review → AI
    unsure_rows: list[dict] = []
    review_input = []
    review_rows_by_id: dict[str, dict] = {}
    for i, row in enumerate(buckets.get("needs_review", [])):
        meta = row_meta(row)
        if meta.get("currency_unknown"):
            r = dict(row)
            r["_reason"] = "Unknown currency"
            unsure_rows.append(r)
            continue
        rid = str(i)
        review_rows_by_id[rid] = row
        review_input.append({"id": rid, "text": row_source_text(row), "candidates": meta.get("candidates") or []})
    decisions = await ai_review.review_rows(review_input) if review_input else {}

    ai_rows: list[tuple[dict, Any]] = []
    for rid, row in review_rows_by_id.items():
        d = decisions.get(rid)
        if d and d.sure and d.ws_code:
            r = dict(row)
            r["WS-Code"] = d.ws_code
            image_id = await _save_image(media, row_meta(row).get("image_file"), img_cache)
            ai_rows.append((tag(r, "ai", ai_reason=d.reason, source_image=image_url(image_id)), d))
        else:
            r = dict(row)
            r["_reason"] = (d.reason if d else None) or row.get("Review Reason") or "AI was not sure"
            unsure_rows.append(r)

    auto_result = await import_rows(auto, admin, f"pipeline-{mode.lower()}-{run_id}.csv", group_name)
    ai_result = await import_rows([r for r, _ in ai_rows], admin, f"pipeline-ai-{mode.lower()}-{run_id}.csv", group_name)

    # AI decisions tab: one entry per AI-imported row (with the order it became).
    ai_unimported_texts = {
        (row_source_text(r), row_phone(r))
        for r in ai_result.get("unmatched_row_list", []) + ai_result.get("quarantined_row_list", [])
        + ai_result.get("no_phone_row_list", [])
    }
    ai_items = 0
    for r, d in ai_rows:
        if (row_source_text(r), row_phone(r)) in ai_unimported_texts:
            continue
        order_id = await _find_order_for_row(d.ws_code, row_phone(r), row_source_text(r))
        ai_items += await _create_items(
            ReviewKind.AI_DECISION, [r], mode, ctx, media, img_cache,
            ai_ws_code=d.ws_code, ai_reason=d.reason, order_id=order_id,
        )
        await suggest_alias(d.alias, d.ws_code, row_source_text(r))

    # Rows the import could not publish go to a human.
    for result in (auto_result, ai_result):
        for r in result.get("unmatched_row_list", []):
            r = dict(r)
            r["_reason"] = r.get("_reason") or f"WS code {r.get('WS-Code') or '?'} not in the active catalog"
            unsure_rows.append(r)
        for r in result.get("quarantined_row_list", []):
            r = dict(r)
            r["_reason"] = r.get("Preis-Flag") or "Price check"
            unsure_rows.append(r)

    no_phone = auto_result.get("no_phone_row_list", []) + ai_result.get("no_phone_row_list", [])
    discarded = list(buckets.get("discarded", []))
    aftermarket = [dict(r, _reason="Aftermarket — never imported") for r in buckets.get("aftermarket", [])]

    stats["imported"] = len(auto_result.get("new_order_ids", []))
    stats["ai_imported"] = len(ai_result.get("new_order_ids", []))
    stats["refreshed"] = len(auto_result.get("refreshed_order_ids", [])) + len(ai_result.get("refreshed_order_ids", []))
    stats["ai_decisions"] = ai_items
    stats["unsure"] = await _create_items(ReviewKind.UNSURE, unsure_rows, mode, ctx, media, img_cache)
    stats["not_in_database"] = await _create_items(
        ReviewKind.NOT_IN_DATABASE, buckets.get("not_in_database", []), mode, ctx, media, img_cache)
    stats["discarded"] = await _create_items(ReviewKind.DISCARDED, discarded, mode, ctx, media, img_cache)
    stats["discarded"] += await _create_items(ReviewKind.DISCARDED, aftermarket, mode, ctx, media, img_cache)
    stats["discarded"] += await _create_items(
        ReviewKind.DISCARDED, no_phone, mode, ctx, media, img_cache, reason="No phone number")
    stats["new_order_ids"] = auto_result.get("new_order_ids", []) + ai_result.get("new_order_ids", [])
    return stats


async def _run_generator(chat_txt: str, media: dict, group_name: str, mode: str,
                         ref: datetime, admin_id: str) -> tuple[str, dict]:
    """Run the generator and return (run_id, rows by bucket).

    Uses the structured-output contract (``run_generator_on_export`` +
    ``load_run_rows``). When an older generator without it is deployed, falls back
    to ``process_generation`` and parses its CSVs (rows then carry no ``_meta``:
    no candidates, no photos — the AI review leaves such rows unsure).
    """
    from app.services import wtb_wts_service as gen

    if hasattr(gen, "run_generator_on_export") and hasattr(gen, "load_run_rows"):
        run_id = await gen.run_generator_on_export(
            chat_txt, media or None, group_name, mode, ref.month, ref.year, admin_id,
        )
        rows = await gen.load_run_rows(run_id)
        return str(run_id), rows or {}

    import csv as _csv

    result = await gen.process_generation(
        txt_content=chat_txt, mode=mode, ref_month=ref.month, ref_year=ref.year,
        group_name=group_name, media_archive=media or None,
    )

    def parse(key: str) -> list[dict]:
        text = (result.get(key) or "").lstrip("\ufeff")
        return list(_csv.DictReader(io.StringIO(text))) if text.strip() else []

    return f"legacy-{datetime.utcnow():%Y%m%d%H%M%S}-{mode}", {
        "matched": parse("matched_csv"),
        "matched_via_image": parse("matched_via_image_csv"),
        "needs_review": parse("needs_review_csv"),
        "not_in_database": parse("not_in_database_csv"),
        "discarded": [],
        "aftermarket": [],
    }


async def process_upload(upload_id: str) -> dict:
    """Process one stored upload. Safe to call more than once (status-guarded)."""
    from app.models.pipeline import PipelineGroupState, PipelineUpload, UploadStatus

    claimed = await PipelineUpload.get_motor_collection().find_one_and_update(
        {"_id": ObjectId(upload_id), "status": {"$in": [UploadStatus.RECEIVED.value, UploadStatus.FAILED.value]},
         "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$set": {"status": UploadStatus.PROCESSING.value}, "$inc": {"attempts": 1}},
    )
    if not claimed:
        return {"skipped": True}
    upload = await PipelineUpload.get(ObjectId(upload_id))
    lock = _group_locks.setdefault(upload.group_name, asyncio.Lock())
    async with lock:
        try:
            stats = await _process_claimed(upload)
            upload.status = UploadStatus.DONE
            upload.stats = {k: v for k, v in stats.items() if k != "new_order_ids"}
            upload.error = None
            upload.processed_at = datetime.utcnow()
            await upload.save()
            # Processed → the raw export is no longer needed.
            await _delete(UPLOAD_BUCKET, upload.chat_gridfs_id)
            await _delete(UPLOAD_BUCKET, upload.media_gridfs_id)
            return stats
        except Exception as exc:
            logger.exception("pipeline: upload %s (%s) failed: %s", upload_id, upload.group_name, exc)
            upload.status = UploadStatus.FAILED
            upload.error = str(exc)[:500]
            await upload.save()
            return {"error": upload.error}


async def _process_claimed(upload) -> dict:
    from app.api.v1.endpoints.whatsapp import dispatch_new_listings_safe
    from app.models.pipeline import PipelineGroupState

    admin = await _admin_user()
    if not admin:
        raise RuntimeError("No admin user exists to attribute the automatic import to")

    state = await PipelineGroupState.find_one({"group_name": upload.group_name})
    if state is None:
        state = PipelineGroupState(group_name=upload.group_name)
        await state.insert()

    chat_txt = (await _get(UPLOAD_BUCKET, upload.chat_gridfs_id)).decode("utf-8", errors="replace")
    filtered = filter_new_messages(chat_txt, state.last_message_at)
    upload.processed_from = state.last_message_at
    upload.processed_to = filtered["last"]
    upload.new_messages = filtered["count"]
    stats: dict[str, Any] = {"new_messages": filtered["count"], "modes": {}}
    if filtered["count"] == 0:
        stats["new_order_ids"] = []
        return stats

    media_zip = await _get(UPLOAD_BUCKET, upload.media_gridfs_id) if upload.media_gridfs_id else None
    media = _extract_media(media_zip, filtered["attachments"])
    ref = filtered["last"] or datetime.utcnow()

    new_ids: list[str] = []
    for mode in MODES:
        run_id, buckets = await _run_generator(
            filtered["text"], media, upload.group_name, mode, ref, str(admin.id))
        upload.run_ids[mode] = run_id
        ctx = {"group_name": upload.group_name, "upload_id": str(upload.id), "run_id": run_id}
        mode_stats = await route_rows(buckets, mode, ctx, media, admin)
        new_ids.extend(mode_stats.pop("new_order_ids", []))
        stats["modes"][mode] = mode_stats

    # Watermark only moves after both modes went through.
    state.last_message_at = filtered["last"] or state.last_message_at
    state.last_upload_at = datetime.utcnow()
    state.uploads += 1
    await state.save()

    # One alert dispatch per import run, only for really new listings (spec §1.11).
    await dispatch_new_listings_safe(new_ids)
    stats["new_orders"] = len(new_ids)
    stats["new_order_ids"] = new_ids
    return stats


async def process_pending(limit: int = 20) -> list[dict]:
    """Process uploads still waiting (e.g. when a serverless instance stopped the
    background task). Oldest first, so watermarks advance in order."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    pending = await PipelineUpload.find(
        {"status": {"$in": [UploadStatus.RECEIVED.value, UploadStatus.FAILED.value]},
         "attempts": {"$lt": MAX_ATTEMPTS}}
    ).sort("+received_at").limit(limit).to_list()
    results = []
    for upload in pending:
        results.append({"upload_id": str(upload.id), "group": upload.group_name,
                        **(await process_upload(str(upload.id)))})
    return results


# --------------------------------------------------------------------------- #
# Daily report (spec §1.10)
# --------------------------------------------------------------------------- #

async def build_daily_report(since: datetime) -> dict:
    from app.models.order import Order
    from app.models.pipeline import (
        AliasStatus, AliasSuggestion, PipelineItem, PipelineUpload, ReviewKind, ReviewStatus, UploadStatus,
    )

    uploads = await PipelineUpload.find({"received_at": {"$gte": since}}).to_list()
    imported = await Order.find({"first_seen_at": {"$gte": since}, "match_method": {"$in": ["exact", "image", "ai"]}}).count()
    return {
        "since": since.isoformat(),
        "uploads": len(uploads),
        "groups": len({u.group_name for u in uploads}),
        "failed_uploads": sum(1 for u in uploads if u.status == UploadStatus.FAILED),
        "new_listings": imported,
        "ai_decisions": await PipelineItem.find({"kind": ReviewKind.AI_DECISION.value, "created_at": {"$gte": since}}).count(),
        "unsure_pending": await PipelineItem.find({"kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value}).count(),
        "alias_pending": await AliasSuggestion.find({"status": AliasStatus.PENDING.value}).count(),
        "not_in_database": await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value, "created_at": {"$gte": since}}).count(),
        "discarded": await PipelineItem.find({"kind": ReviewKind.DISCARDED.value, "created_at": {"$gte": since}}).count(),
    }


async def send_daily_report() -> dict:
    from app.core.config import settings
    from app.models.pipeline import PipelineReportState
    from app.models.user import User, UserRole
    from app.services.email import email_service

    state = await PipelineReportState.find_one({"key": "daily"})
    now = datetime.utcnow()
    since = state.last_sent_at if state and state.last_sent_at else now - timedelta(days=1)
    report = await build_daily_report(since)
    link = f"{settings.WEB_APP_URL.rstrip('/')}/admin/approval"
    lines = [
        f"Exports received: {report['uploads']} from {report['groups']} group(s)"
        + (f" ({report['failed_uploads']} failed)" if report["failed_uploads"] else ""),
        f"New listings imported: {report['new_listings']}",
        f"Imported by AI (check tab AI decisions): {report['ai_decisions']}",
        f"Waiting for you (Unsure): {report['unsure_pending']}",
        f"Alias suggestions waiting: {report['alias_pending']}",
        f"Not in database: {report['not_in_database']}",
        f"Discarded automatically: {report['discarded']}",
    ]
    text = "WatchSphere daily pipeline report\n\n" + "\n".join(lines) + f"\n\nApproval page: {link}\n"
    html_body = (
        "<h2 style=\"margin:0 0 16px\">Daily pipeline report</h2><ul>"
        + "".join(f"<li>{line}</li>" for line in lines)
        + f"</ul><p><a href=\"{link}\">Open the approval page</a></p>"
    )
    html = email_service._get_email_template(html_body)
    admins = await User.find({"role": UserRole.ADMIN.value}).to_list()
    sent = 0
    for admin in admins:
        if admin.email and await email_service._send_email(
            admin.email, "WatchSphere – daily pipeline report", html, text
        ):
            sent += 1
    if state is None:
        state = PipelineReportState(key="daily")
    state.last_sent_at = now
    await state.save()
    return {**report, "sent_to": sent, "link": link}
