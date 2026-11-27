"""Automatic generator pipeline: Mac mini → server → app (generator spec §1).

Flow per upload (one group's ``_chat.txt`` + ``<group>_Medien.zip``):

1. ``store_upload`` writes both files to GridFS *before* the endpoint answers, so
   the Mac mini only deletes its copy once the server holds it durably.
2. ``process_upload`` keeps only messages newer than the group's watermark (the
   Mac mini sends hourly exports of the newest messages; a full export works the
   same way), runs the generator for WTS and WTB, and routes the rows:
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
from pymongo import UpdateOne

logger = logging.getLogger(__name__)

DISCARD_TTL_DAYS = 30
# A not-in-database row nobody has reposted for this long is no longer a useful
# new-watch suggestion.
NOT_IN_DATABASE_TTL_DAYS = 30
# 16/17 Nov 2026: both AI accounts were out of credit and every needs-review row
# went to the Unsure tab with this reason, never reviewed. Removed at startup.
OUTAGE_REASON = "AI review unavailable"
OUTAGE_START = datetime(2026, 11, 16, 18, 0)
OUTAGE_END = datetime(2026, 11, 18, 12, 0)
MODES = ("WTS", "WTB")
UPLOAD_BUCKET = "pipeline_uploads"
IMAGE_BUCKET = "pipeline_images"
MAX_ATTEMPTS = 3
FIRST_RUN_DAYS = 4  # a group without a watermark starts this far back, not at its whole history

# Uploads are processed a few at a time (``PIPELINE_WORKERS``), never two of the
# same group at once: a group's watermark and its reposts must be handled in order.
# Each run holds the chat, the media and the generator state in memory and calls
# the AI models; running a whole Mac mini batch at once (~60 groups) made the
# server too slow to answer new uploads, the Mac mini re-sent them, and the
# instance ran out of memory.
_slots: dict = {}  # event loop → Semaphore(PIPELINE_WORKERS)
_group_locks: dict = {}  # (event loop, group) → Lock
_active_groups: set[str] = set()
_drain_task: Optional[asyncio.Task] = None
# A restarted instance waits this long before taking over interrupted uploads, so
# an old instance still finishing during a deploy is not processed twice.
RECOVERY_DELAY_SECONDS = 30
RECOVERY_RETRIES = 10
RECOVERY_RETRY_SECONDS = 60
# While processing is paused (AI out of credit, database nearly full) the worker
# looks again this often.
PAUSE_RETRY_SECONDS = 10 * 60
_retry_task: Optional[asyncio.Task] = None


class ProcessingPaused(Exception):
    """Processing this upload now would store degraded or too much data; it stays
    queued (its attempt is not counted) and the worker tries again later."""

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


SEEN_DAYS = 10            # an offer lives 10 days (WTS) after its last post
SEEN_MIN_CHARS = 15       # "ok", "pm", "?" are never worth remembering
_SENDER_RE = re.compile(r'^\[[^\]]+\]\s*([^:]+):\s?(.*)$|^\d{1,2}[./]\d{1,2}[./]\d{2,4},\s*[\d:]+\s*-\s*([^:]+):\s?(.*)$')


def split_messages(text: str) -> list[dict]:
    """[{"ts", "sender", "body", "lines"}] of an export text (continuation lines stay with
    their message)."""
    out: list[dict] = []
    for line in text.splitlines():
        ts = parse_header_timestamp(line)
        if ts is not None:
            clean = _INVISIBLE.sub('', line).replace('\xa0', ' ').strip()
            m = _SENDER_RE.match(clean)
            sender = ((m.group(1) or m.group(3)) if m else "").strip()
            body = ((m.group(2) or m.group(4)) if m else "") or ""
            out.append({"ts": ts, "sender": sender, "body": [body], "lines": [line]})
        elif out:
            out[-1]["body"].append(line)
            out[-1]["lines"].append(line)
    for msg in out:
        msg["body"] = "\n".join(msg["body"]).strip()
    return out


def message_key(sender: str, body: str) -> Optional[str]:
    """Same dealer + same text (spacing, case and invisible characters ignored); None for
    messages too short to be a listing."""
    tk = text_key(body)
    if len(tk) < SEEN_MIN_CHARS or not sender:
        return None
    who = re.sub(r"[^\d+]", "", sender) or sender.strip().lower()
    return hashlib.sha1(f"{who}|{tk}".encode("utf-8")).hexdigest()


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


# Files live in Firebase Storage (private objects, id "fb:<path>"), not in MongoDB: the hourly
# exports' media zips (~5 MB each, ~65 an hour) filled the 5 GB Atlas plan, which paused
# processing and left whole groups (all of WDG) unprocessed (Nov 2026). Ids without the prefix
# are GridFS files from before; they are still read and deleted. Without Firebase (tests, local
# development) files go to GridFS as before.
FIREBASE_PREFIX = "fb:"


def _firebase_bucket():
    from app.core.config import settings

    if not settings.PIPELINE_FILES_IN_FIREBASE:
        return None
    try:
        from app.core.firebase import get_storage_bucket
        return get_storage_bucket()
    except Exception as exc:
        logger.warning("pipeline: Firebase Storage unavailable, files stay in MongoDB: %s", exc)
        return None


async def _fb_put(fb, path: str, data: bytes, content_type: str) -> str:
    def up():
        fb.blob(path).upload_from_string(data, content_type=content_type)
    await asyncio.to_thread(up)
    return FIREBASE_PREFIX + path


async def _put(bucket: str, data: bytes, filename: str, metadata: Optional[dict] = None) -> str:
    fb = _firebase_bucket()
    if fb is not None:
        safe = re.sub(r"[^\w.\-]+", "_", filename)[-120:]
        path = f"pipeline/{bucket}/{datetime.utcnow():%Y-%m-%d}/{ObjectId()}-{safe}"
        try:
            return await _fb_put(fb, path, data, _content_type(filename))
        except Exception as exc:
            logger.error("pipeline: Firebase upload of %s failed, stored in MongoDB: %s", filename, exc)
    file_id = await _bucket(bucket).upload_from_stream(filename, data, metadata=metadata or {})
    return str(file_id)


async def _get(bucket: str, file_id: str) -> bytes:
    if str(file_id).startswith(FIREBASE_PREFIX):
        fb = _firebase_bucket()
        if fb is None:
            raise RuntimeError("Firebase Storage is not configured")
        path = file_id[len(FIREBASE_PREFIX):]
        return await asyncio.to_thread(lambda: fb.blob(path).download_as_bytes())
    stream = await _bucket(bucket).open_download_stream(ObjectId(file_id))
    return await stream.read()


async def _delete(bucket: str, file_id: Optional[str]) -> None:
    if not file_id:
        return
    try:
        if str(file_id).startswith(FIREBASE_PREFIX):
            fb = _firebase_bucket()
            if fb is not None:
                path = file_id[len(FIREBASE_PREFIX):]
                await asyncio.to_thread(lambda: fb.blob(path).delete())
            return
        await _bucket(bucket).delete(ObjectId(file_id))
    except Exception as exc:
        logger.debug("pipeline: delete %s/%s failed: %s", bucket, file_id, exc)


def _content_type(name: str) -> str:
    n = (name or "").lower()
    if n.endswith(".png"):
        return "image/png"
    if n.endswith(".webp"):
        return "image/webp"
    if n.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if n.endswith(".zip"):
        return "application/zip"
    if n.endswith(".txt"):
        return "text/plain; charset=utf-8"
    return "application/octet-stream"


async def get_image(image_id: str) -> tuple[bytes, str]:
    if str(image_id).startswith(FIREBASE_PREFIX):
        return await _get(IMAGE_BUCKET, image_id), _content_type(image_id)
    stream = await _bucket(IMAGE_BUCKET).open_download_stream(ObjectId(image_id))
    data = await stream.read()
    return data, _content_type(stream.filename or "")


async def move_queued_files_to_storage() -> dict:
    """Move the files of uploads still waiting (received / failed) from MongoDB to
    Firebase Storage. A GridFS file is deleted only after its copy is stored. Safe to run again."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    moved = failed = freed = 0
    fb = _firebase_bucket()
    if fb is None:
        return {"moved": 0, "failed": 0, "freed_mb": 0, "skipped": "Firebase Storage not configured"}
    waiting = [UploadStatus.RECEIVED.value, UploadStatus.FAILED.value]  # never one a worker is reading
    async for up in PipelineUpload.find({"status": {"$in": waiting}}):
        changed = {}
        for field, name in (("chat_gridfs_id", "_chat.txt"), ("media_gridfs_id", "_Medien.zip")):
            fid = getattr(up, field)
            if not fid or str(fid).startswith(FIREBASE_PREFIX):
                continue
            try:
                data = await _get(UPLOAD_BUCKET, fid)
                safe = re.sub(r"[^\w.\-]+", "_", f"{up.group_name}{name}")[-120:]
                path = f"pipeline/{UPLOAD_BUCKET}/moved/{ObjectId()}-{safe}"
                changed[field] = await _fb_put(fb, path, data, _content_type(name))
                freed += len(data)
            except Exception as exc:
                failed += 1
                logger.error("pipeline: moving %s of upload %s failed: %s", field, up.id, exc)
        if changed:
            old = {f: getattr(up, f) for f in changed}
            # only switch an upload nobody has picked up meanwhile; the GridFS copy goes after the switch
            res = await PipelineUpload.get_motor_collection().update_one(
                {"_id": up.id, **{f: old[f] for f in changed}}, {"$set": changed})
            if res.modified_count:
                for f in changed:
                    await _delete(UPLOAD_BUCKET, old[f])
                moved += 1
            else:
                for f, new_id in changed.items():
                    await _delete(UPLOAD_BUCKET, new_id)
    logger.info("pipeline: moved files of %d waiting uploads to Firebase Storage (%.0f MiB)", moved, freed / 2**20)
    return {"moved": moved, "failed": failed, "freed_mb": round(freed / 2**20)}


async def store_upload(group_name: str, chat_bytes: bytes, media_bytes: Optional[bytes],
                       backfill: bool = False):
    """Durably store one export. Returns (PipelineUpload, duplicate): the existing
    upload when the identical chat file for this group is queued or was processed.

    ``backfill``: the export holds messages the group's watermark already passed
    (re-sent after it was lost); all of them are processed. An identical file of
    an upload that was superseded (dropped unprocessed, until Nov 2026 the server
    assumed every export held the whole history) is a backfill on its own."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    sha = hashlib.sha256(chat_bytes).hexdigest()
    same = {"group_name": group_name, "chat_sha256": sha}
    existing = await PipelineUpload.find_one({
        **same,
        "status": {"$in": [UploadStatus.DONE.value, UploadStatus.RECEIVED.value, UploadStatus.PROCESSING.value]},
        "stats.superseded_by": {"$exists": False},
    })
    if existing:
        return existing, True
    if not backfill and await PipelineUpload.find_one({**same, "stats.superseded_by": {"$exists": True}}):
        backfill = True

    if media_bytes:
        # The export's ZIP holds the media of the group's whole history. Keep only the
        # files attached to messages newer than the watermark: processing never reads
        # the rest, and storing it filled the database. An older watermark (an earlier
        # upload not processed yet) only keeps more files, never fewer.
        from app.models.pipeline import PipelineGroupState

        state = await PipelineGroupState.find_one({"group_name": group_name})
        watermark = None if backfill or not state else state.last_message_at
        # Parsing the chat and rebuilding the ZIP is CPU work on tens of MB. Off the
        # event loop, so the server keeps answering other uploads meanwhile.
        wanted, slim = await asyncio.to_thread(
            _slim_for_watermark, chat_bytes, media_bytes, watermark)
        logger.info("pipeline: %s media zip %d → %d bytes (%d attachment(s) kept)",
                    group_name, len(media_bytes), len(slim or b""), len(wanted))
        media_bytes = slim

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
        backfill=backfill,
    )
    await upload.insert()
    return upload, False


def _slim_for_watermark(chat_bytes: bytes, media_bytes: bytes, watermark: Optional[datetime]):
    wanted = filter_new_messages(chat_bytes.decode("utf-8", errors="replace"), watermark)["attachments"]
    return wanted, slim_media_zip(media_bytes, wanted)


def slim_media_zip(zip_bytes: Optional[bytes], wanted: list[str]) -> Optional[bytes]:
    """Rebuild the media ZIP with only the ``wanted`` files (matched by base name,
    case-insensitive). None when nothing is wanted or found. An unreadable ZIP is
    kept as-is so nothing is lost."""
    if not zip_bytes or not wanted:
        return None
    files = _extract_media(zip_bytes, wanted)
    if not files:
        try:
            zipfile.ZipFile(io.BytesIO(zip_bytes)).close()
        except zipfile.BadZipFile:
            return zip_bytes
        return None
    out = io.BytesIO()
    # Photos are already compressed; storing avoids recompressing them for nothing.
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return out.getvalue()


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


def not_in_database_expiry(now: Optional[datetime] = None) -> datetime:
    return (now or datetime.utcnow()) + timedelta(days=NOT_IN_DATABASE_TTL_DAYS)


def _repost_filter(kind, data: dict) -> dict:
    """Matches the waiting item a repost of this row belongs to."""
    from app.models.pipeline import ReviewKind, ReviewStatus

    f = {
        "kind": kind.value, "text_key": data.get("text_key"), "mode": data.get("mode"),
        "sender_phone": data.get("sender_phone"), "group_name": data.get("group_name"),
    }
    if kind != ReviewKind.DISCARDED:  # discarded items are resolved from the start
        f["status"] = ReviewStatus.PENDING.value
    return f


async def _create_items(kind, rows: list[dict], mode: str, ctx: dict, media: dict, img_cache: dict,
                        reason: Optional[str] = None, **extra) -> int:
    """Store review items. Returns how many rows went in (new items + reposts).

    A row whose text is already waiting from the same sender in the same group
    only refreshes that item (``occurrences``, ``last_seen_at``, upload/run);
    without this, hourly reposts added ~10 copies of every row per day and filled
    the database. AI decisions are always stored: each one is its own order."""
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    now = datetime.utcnow()
    coll = PipelineItem.get_motor_collection()
    docs: list = []
    pending: dict[tuple, Any] = {}  # repost key → new doc in this batch
    count = 0
    for row in rows:
        meta = row_meta(row)
        data = _item_base(row, mode, ctx)
        count += 1
        dedupe = kind != ReviewKind.AI_DECISION and bool(data.get("text_key"))
        if dedupe:
            f = _repost_filter(kind, data)
            key = tuple(sorted((k, str(v)) for k, v in f.items()))
            if key in pending:
                pending[key].occurrences += 1
                continue
            refresh: dict[str, Any] = {
                "last_seen_at": now, "upload_id": data.get("upload_id"),
                "run_id": data.get("run_id"), "message_at": data.get("message_at"),
            }
            if kind == ReviewKind.DISCARDED:
                refresh["expires_at"] = now + timedelta(days=DISCARD_TTL_DAYS)
            elif kind == ReviewKind.NOT_IN_DATABASE:
                refresh["expires_at"] = not_in_database_expiry(now)
            hit = await coll.find_one_and_update(
                f, {"$inc": {"occurrences": 1}, "$set": refresh},
                sort=[("created_at", -1)], projection={"_id": 1},
            )
            if hit:
                continue
        data["image_id"] = await _save_image(media, meta.get("image_file"), img_cache) if kind != ReviewKind.DISCARDED else None
        data["reason"] = row.get("_reason") or reason or meta.get("discard_reason") or row.get("Review Reason")
        if kind == ReviewKind.DISCARDED:
            data["expires_at"] = now + timedelta(days=DISCARD_TTL_DAYS)
            data["status"] = ReviewStatus.RESOLVED
        if kind == ReviewKind.NOT_IN_DATABASE:
            cands = meta.get("candidates") or []
            data["guessed_reference"] = (
                row.get("Referenz") or row.get("Reference") or row.get("WS-Code")
                or (cands[0].get("reference") if cands else None)
            )
            data["guessed_brand"] = row.get("Marke") or (cands[0].get("brand") if cands else None)
            data["expires_at"] = not_in_database_expiry(now)
        data.update(extra)
        doc = PipelineItem(kind=kind, last_seen_at=now, **data)
        docs.append(doc)
        if dedupe:
            pending[key] = doc
    if docs:
        await PipelineItem.insert_many(docs)
    return count


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


async def import_rows(rows: list[dict], admin, label: str, group_name: Optional[str],
                      *, guard: bool = False) -> dict:
    """Import generator rows through the shared order import (repost-aware).

    ``guard``: check each row against the dealer's text before publishing (the
    automatic pipeline). Rows an admin confirmed on the approval page skip it."""
    from app.api.v1.endpoints.whatsapp import import_order_rows
    from app.models.whatsapp_import import ImportStatus, WhatsAppImport

    if not rows:
        return {"new_order_ids": [], "refreshed_order_ids": [], "unmatched_row_list": [],
                "quarantined_row_list": [], "no_phone_row_list": [],
                "guard_held_row_list": [], "guard_rejected_row_list": []}
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
            rows, fieldnames, record, admin, require_phone=True, dispatch_alerts=False, guard=guard,
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
    _raise_if_ai_exhausted()

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

    auto_result = await import_rows(auto, admin, f"pipeline-{mode.lower()}-{run_id}.csv", group_name, guard=True)
    ai_result = await import_rows([r for r, _ in ai_rows], admin, f"pipeline-ai-{mode.lower()}-{run_id}.csv",
                                  group_name, guard=True)

    # AI decisions tab: one entry per AI-imported row (with the order it became).
    ai_unimported_texts = {
        (row_source_text(r), row_phone(r))
        for r in ai_result.get("unmatched_row_list", []) + ai_result.get("quarantined_row_list", [])
        + ai_result.get("no_phone_row_list", []) + ai_result.get("guard_held_row_list", [])
        + ai_result.get("guard_rejected_row_list", [])
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
        # The guard found no evidence in the dealer's text: a human decides.
        for r in result.get("guard_held_row_list", []):
            r = dict(r)
            r["_reason"] = f"Guard: {r.get('Guard') or 'no evidence in the text'}"
            unsure_rows.append(r)
    guard_rejected = [
        dict(r, _reason=f"Guard: {r.get('Guard') or 'rejected'}")
        for result in (auto_result, ai_result) for r in result.get("guard_rejected_row_list", [])
    ]

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
    stats["discarded"] += await _create_items(ReviewKind.DISCARDED, guard_rejected, mode, ctx, media, img_cache)
    stats["guard_held"] = sum(len(r.get("guard_held_row_list", [])) for r in (auto_result, ai_result))
    stats["guard_rejected"] = len(guard_rejected)
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
        # Read once, here; the rows live on in PipelineItems and orders.
        await gen.discard_run_rows(run_id)
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


def _slot() -> asyncio.Semaphore:
    from app.core.config import settings

    loop = asyncio.get_running_loop()
    if loop not in _slots:
        _slots.clear()
        _group_locks.clear()
        _slots[loop] = asyncio.Semaphore(max(1, settings.PIPELINE_WORKERS))
    return _slots[loop]


def _group_lock(group_name: str) -> asyncio.Lock:
    _slot()  # resets the locks when the event loop changed
    key = (asyncio.get_running_loop(), group_name)
    if key not in _group_locks:
        _group_locks[key] = asyncio.Lock()
    return _group_locks[key]


async def process_upload(upload_id: str) -> dict:
    """Process one stored upload. Safe to call more than once (status-guarded).

    Waits for a free slot and for the group's other upload *before* claiming, so
    queued uploads stay ``received`` (not ``processing``) until their turn."""
    from app.models.pipeline import PipelineUpload

    doc = await PipelineUpload.get_motor_collection().find_one({"_id": ObjectId(upload_id)}, {"group_name": 1})
    if not doc:
        return {"skipped": True}
    async with _group_lock(doc["group_name"]), _slot():
        return await _process_one(upload_id)


async def _process_one(upload_id: str) -> dict:
    from app.models.pipeline import PipelineUpload, UploadStatus

    claimed = await PipelineUpload.get_motor_collection().find_one_and_update(
        {"_id": ObjectId(upload_id), "status": {"$in": [UploadStatus.RECEIVED.value, UploadStatus.FAILED.value]},
         "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$set": {"status": UploadStatus.PROCESSING.value}, "$inc": {"attempts": 1}},
    )
    if not claimed:
        return {"skipped": True}
    upload = await PipelineUpload.get(ObjectId(upload_id))
    try:
        reason = await pause_reason()
        if reason:
            raise ProcessingPaused(reason)
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
    except ProcessingPaused as exc:
        upload.status = UploadStatus.RECEIVED
        upload.attempts = max(0, upload.attempts - 1)
        upload.error = f"Waiting: {exc}"[:500]
        await upload.save()
        return {"paused": str(exc)}
    except Exception as exc:
        logger.exception("pipeline: upload %s (%s) failed: %s", upload_id, upload.group_name, exc)
        upload.status = UploadStatus.FAILED
        upload.error = str(exc)[:500]
        await upload.save()
        return {"error": upload.error}


def kick_processing() -> None:
    """Start the background worker unless it is already running. It works through
    every ``received`` upload: live exports oldest first, then backfills, up to
    ``PIPELINE_WORKERS`` groups at a time."""
    global _drain_task
    if _drain_task is None or _drain_task.done():
        _drain_task = asyncio.create_task(_drain_received())


async def _next_upload(seen: set[str]):
    """The next waiting upload whose group no other worker is processing."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    query: dict[str, Any] = {"status": UploadStatus.RECEIVED.value, "attempts": {"$lt": MAX_ATTEMPTS},
                             "_id": {"$nin": [ObjectId(i) for i in seen]}}
    if _active_groups:
        query["group_name"] = {"$nin": list(_active_groups)}
    # Missing/false sorts before true: live uploads before backfills.
    nxt = await PipelineUpload.find(query).sort([("backfill", 1), ("received_at", 1)]).limit(1).to_list()
    return nxt[0] if nxt else None


async def _drain_received() -> None:
    from app.core.config import settings

    seen: set[str] = set()  # each upload is tried once per drain; never spin on one
    state = {"paused": None}

    async def worker() -> None:
        while state["paused"] is None:
            upload = await _next_upload(seen)
            if upload is None:
                return
            upload_id = str(upload.id)
            seen.add(upload_id)
            _active_groups.add(upload.group_name)
            try:
                result = await process_upload(upload_id)
            except Exception as exc:  # process_upload records failures itself; this is the DB going away
                logger.exception("pipeline: worker stopped: %s", exc)
                return
            finally:
                _active_groups.discard(upload.group_name)
            if isinstance(result, dict) and result.get("paused"):
                state["paused"] = result["paused"]

    await asyncio.gather(*(worker() for _ in range(max(1, settings.PIPELINE_WORKERS))))
    if state["paused"]:
        logger.warning("pipeline: processing paused (%s); trying again in %d min",
                       state["paused"], PAUSE_RETRY_SECONDS // 60)
        _schedule_retry()
    elif await _waiting_count(seen):
        # Uploads that arrived while the last workers finished: go again.
        kick_later()


async def _waiting_count(seen: set[str]) -> int:
    from app.models.pipeline import PipelineUpload, UploadStatus

    return await PipelineUpload.get_motor_collection().count_documents({
        "status": UploadStatus.RECEIVED.value, "attempts": {"$lt": MAX_ATTEMPTS},
        "_id": {"$nin": [ObjectId(i) for i in seen]},
    })


def kick_later() -> None:
    asyncio.get_running_loop().call_soon(kick_processing)


def _schedule_retry(delay: float = None) -> None:
    global _retry_task
    if _retry_task is not None and not _retry_task.done():
        return

    async def _later():
        await asyncio.sleep(PAUSE_RETRY_SECONDS if delay is None else delay)
        kick_processing()

    _retry_task = asyncio.create_task(_later())


async def database_size_mib() -> float:
    """Data plus indexes in MiB — what the Atlas space quota counts."""
    from app.models.pipeline import PipelineUpload

    stats = await PipelineUpload.get_motor_collection().database.command("dbstats")
    return (stats.get("dataSize", 0) + stats.get("indexSize", 0)) / (1024 * 1024)


async def pause_reason() -> Optional[str]:
    """Why uploads must not be processed right now, or None."""
    from app.core.config import settings

    blocked = ai_blocked_provider()
    if blocked:
        return f"AI provider {blocked} is out of credit"
    limit = settings.PIPELINE_PAUSE_DATA_MB
    if limit:
        try:
            size = await database_size_mib()
        except Exception as exc:  # stats unavailable: do not block processing on it
            logger.warning("pipeline: could not read database size: %s", exc)
            return None
        if size > limit:
            logger.error("pipeline: database holds %.0f MiB (pause limit %d MiB); processing paused",
                         size, limit)
            return f"Database holds {size:.0f} MiB, above the {limit} MiB pause limit"
    return None


def ai_blocked_provider() -> Optional[str]:
    """The provider that blocks processing, or None. OpenAI-only steps (matching, verification)
    need OpenAI; the review runs on any configured provider, so one exhausted provider only
    blocks when no other can review."""
    from app.services import ai_credit, ai_review

    if ai_credit.is_exhausted("openai"):
        return "openai"
    return ai_review.blocked_provider()


def _raise_if_ai_exhausted() -> None:
    blocked = ai_blocked_provider()
    if blocked:
        raise ProcessingPaused(f"AI provider {blocked} is out of credit")


async def queue_pending(limit: int = 20) -> int:
    """Queue failed uploads (attempts left) for another try and start the worker.
    Returns how many uploads are waiting now."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    coll = PipelineUpload.get_motor_collection()
    failed = await coll.find(
        {"status": UploadStatus.FAILED.value, "attempts": {"$lt": MAX_ATTEMPTS}}, {"_id": 1}
    ).sort("received_at", 1).limit(limit).to_list(limit)
    if failed:
        await coll.update_many(
            {"_id": {"$in": [d["_id"] for d in failed]}, "status": UploadStatus.FAILED.value},
            {"$set": {"status": UploadStatus.RECEIVED.value}},
        )
    kick_processing()
    return await coll.count_documents({"status": UploadStatus.RECEIVED.value, "attempts": {"$lt": MAX_ATTEMPTS}})


async def _delete_unused_images(candidates: set[str], batch: int = 5000) -> int:
    """Delete the photos in ``candidates`` that no review item and no order
    (``source_image`` URL) uses any more."""
    from app.models.order import Order
    from app.models.pipeline import PipelineItem

    coll = PipelineItem.get_motor_collection()
    images = [c for c in candidates if c]
    in_use: set[str] = set()
    for i in range(0, len(images), batch):
        chunk = images[i:i + batch]
        in_use.update(await coll.distinct("image_id", {"image_id": {"$in": chunk}}))
        urls = [image_url(x) for x in chunk]
        async for o in Order.get_motor_collection().find({"source_image": {"$in": urls}}, {"source_image": 1}):
            in_use.add(o["source_image"].rsplit("/", 1)[-1])
    deleted = 0
    for image_id in set(images) - in_use:
        try:
            await _delete(IMAGE_BUCKET, image_id)
            deleted += 1
        except Exception as exc:
            logger.warning("pipeline: could not delete image %s: %s", image_id, exc)
    return deleted


async def _delete_items(query: dict, batch: int = 5000) -> tuple[int, set[str]]:
    """Delete the review items matching ``query`` in batches.
    Returns (deleted, their image ids)."""
    from app.models.pipeline import PipelineItem

    coll = PipelineItem.get_motor_collection()
    deleted = 0
    images: set[str] = set()
    while True:
        docs = await coll.find(query, {"_id": 1, "image_id": 1}).limit(batch).to_list(batch)
        if not docs:
            return deleted, images
        images.update(d["image_id"] for d in docs if d.get("image_id"))
        deleted += (await coll.delete_many({"_id": {"$in": [d["_id"] for d in docs]}})).deleted_count


async def apply_review_retention(now: Optional[datetime] = None) -> dict:
    """Delete-only first (works while Atlas blocks writes):

    - Unsure rows from the AI credit outage (``OUTAGE_*``): never reviewed.
    - Waiting not-in-database rows nobody reposted for ``NOT_IN_DATABASE_TTL_DAYS``.
    - Photos only those rows used.

    ``set_missing_expiry`` then covers rows stored before the expiry existed."""
    from app.models.pipeline import ReviewKind, ReviewStatus

    now = now or datetime.utcnow()
    outage, img1 = await _delete_items({
        "kind": ReviewKind.UNSURE.value, "status": ReviewStatus.PENDING.value,
        "reason": OUTAGE_REASON, "created_at": {"$gte": OUTAGE_START, "$lt": OUTAGE_END},
    })
    cutoff = now - timedelta(days=NOT_IN_DATABASE_TTL_DAYS)
    stale, img2 = await _delete_items({
        "kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value,
        "$or": [{"last_seen_at": {"$lt": cutoff}},
                {"last_seen_at": None, "created_at": {"$lt": cutoff}}],
    })
    images = await _delete_unused_images(img1 | img2)
    if outage or stale:
        logger.warning("pipeline: retention removed %d outage item(s), %d stale not-in-database "
                       "item(s), %d photo(s)", outage, stale, images)

    return {"outage_deleted": outage, "stale_deleted": stale, "images_deleted": images}


async def set_missing_expiry(now: Optional[datetime] = None) -> int:
    """Give waiting not-in-database rows stored before the expiry existed one
    (last seen + ``NOT_IN_DATABASE_TTL_DAYS``), so the TTL index removes them."""
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    now = now or datetime.utcnow()
    coll = PipelineItem.get_motor_collection()
    missing = {"kind": ReviewKind.NOT_IN_DATABASE.value, "status": ReviewStatus.PENDING.value,
               "expires_at": None}
    done = 0
    while True:
        docs = await coll.find(missing, {"_id": 1, "created_at": 1, "last_seen_at": 1}).limit(5000).to_list(5000)
        if not docs:
            return done
        ops = [UpdateOne({"_id": d["_id"]}, {"$set": {"expires_at": not_in_database_expiry(
                   d.get("last_seen_at") or d.get("created_at") or now)}}) for d in docs]
        done += (await coll.bulk_write(ops, ordered=False)).modified_count


async def dedupe_review_items(batch: int = 5000) -> dict:
    """Collapse reposted review items into one per (kind, mode, text, sender, group),
    keeping the newest, and delete photos no remaining item or order uses.

    Deletes first, so it works while the cluster is over its space quota and
    blocks writes; the occurrence counts on the kept items are written afterwards
    and are skipped (logged) if that write is still refused. AI decisions are
    left alone."""
    from app.models.pipeline import PipelineItem, ReviewKind

    coll = PipelineItem.get_motor_collection()

    def pipeline_for(group_name):
        # One WhatsApp group at a time: the Flex tier caps $group at 100 MB and
        # ignores allowDiskUse, and all items of the whole collection exceed that.
        return [
        {"$match": {"group_name": group_name, "kind": {"$ne": ReviewKind.AI_DECISION.value},
                    "text_key": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": {"k": "$kind", "s": "$status", "m": "$mode", "t": "$text_key",
                    "p": "$sender_phone", "g": "$group_name"},
            "keep": {"$max": "$_id"},  # ObjectIds grow with insertion time: newest
            "ids": {"$push": "$_id"},
            "n": {"$sum": {"$ifNull": ["$occurrences", 1]}},
            "c": {"$sum": 1},
        }},
        {"$match": {"c": {"$gt": 1}}},
        {"$project": {"keep": 1, "ids": 1, "n": 1}},
        ]
    counts: list[tuple] = []
    candidate_images: set[str] = set()
    deleted = 0
    chunk: list = []

    async def flush():
        nonlocal deleted, chunk
        if not chunk:
            return
        async for d in coll.find({"_id": {"$in": chunk}, "image_id": {"$ne": None}}, {"image_id": 1}):
            candidate_images.add(d["image_id"])
        deleted += (await coll.delete_many({"_id": {"$in": chunk}})).deleted_count
        chunk = []

    for group_name in await coll.distinct("group_name") + [None]:
        # $group is a blocking stage: all results exist before the first delete.
        async for g in coll.aggregate(pipeline_for(group_name), allowDiskUse=True):
            chunk.extend(i for i in g["ids"] if i != g["keep"])
            counts.append((g["keep"], g["n"]))
            if len(chunk) >= batch:
                await flush()
    await flush()
    if not deleted:
        return {"deleted": 0, "images_deleted": 0}
    logger.warning("pipeline: removed %d duplicate review item(s) in %d group(s)", deleted, len(counts))

    images_deleted = await _delete_unused_images(candidate_images, batch)
    logger.warning("pipeline: removed %d photo(s) only duplicates used", images_deleted)

    for attempt in range(RECOVERY_RETRIES):
        try:
            for i in range(0, len(counts), 500):
                ops = [UpdateOne({"_id": k}, {"$set": {"occurrences": n}}) for k, n in counts[i:i + 500]]
                await coll.bulk_write(ops, ordered=False)
            break
        except Exception as exc:
            logger.warning("pipeline: writing repost counts failed (attempt %d): %s", attempt + 1, str(exc)[:200])
            await asyncio.sleep(RECOVERY_RETRY_SECONDS)
    return {"deleted": deleted, "images_deleted": images_deleted}


async def recover_interrupted_uploads(delay: float = RECOVERY_DELAY_SECONDS) -> dict:
    """At startup: uploads left ``processing`` by a stopped instance never finish on
    their own. Put them back in the queue (or mark them failed once they used up
    their attempts, so one upload that crashes the server cannot loop forever) and
    start the worker. Assumes a single backend instance."""
    from app.models.pipeline import PipelineUpload, UploadStatus

    if delay:
        await asyncio.sleep(delay)
    # Before the worker starts adding items: collapse reposted review items
    # (delete-only first, so it also frees space while writes are blocked).
    try:
        await apply_review_retention()
    except Exception as exc:
        logger.warning("pipeline: review item retention failed: %s", str(exc)[:200])
    try:
        await dedupe_review_items()
    except Exception as exc:
        logger.warning("pipeline: review item cleanup failed: %s", str(exc)[:200])
    for attempt in range(RECOVERY_RETRIES):  # a write: waits for Atlas to see the freed space
        try:
            await set_missing_expiry()
            break
        except Exception as exc:
            logger.warning("pipeline: setting not-in-database expiry failed (attempt %d): %s",
                           attempt + 1, str(exc)[:200])
            await asyncio.sleep(RECOVERY_RETRY_SECONDS)
    # Atlas takes a while to notice space freed at startup; until then writes fail.
    for attempt in range(RECOVERY_RETRIES):
        try:
            return await _recover(PipelineUpload, UploadStatus)
        except Exception as exc:
            logger.warning("pipeline: startup recovery attempt %d failed: %s", attempt + 1, str(exc)[:200])
            await asyncio.sleep(RECOVERY_RETRY_SECONDS)
    return {"requeued": 0, "failed": 0}


async def _recover(PipelineUpload, UploadStatus) -> dict:
    coll = PipelineUpload.get_motor_collection()
    gave_up = await coll.update_many(
        {"status": UploadStatus.PROCESSING.value, "attempts": {"$gte": MAX_ATTEMPTS}},
        {"$set": {"status": UploadStatus.FAILED.value,
                  "error": "Interrupted by server restarts too often; not retried automatically"}},
    )
    requeued = await coll.update_many(
        {"status": UploadStatus.PROCESSING.value},
        {"$set": {"status": UploadStatus.RECEIVED.value}},
    )
    if gave_up.modified_count or requeued.modified_count:
        logger.warning("pipeline: startup recovery: %d upload(s) requeued, %d marked failed",
                       requeued.modified_count, gave_up.modified_count)
    kick_processing()
    return {"requeued": requeued.modified_count, "failed": gave_up.modified_count}


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
    # A backfill holds messages behind the watermark that were never processed.
    after = None if upload.backfill else state.last_message_at
    if after is None and not upload.backfill:
        # A group's first export holds its whole chat history (months, tens of thousands of
        # lines): one such run held a worker for hours and stalled every other group. Start
        # with the last FIRST_RUN_DAYS; older messages come in only as an explicit backfill.
        after = datetime.utcnow() - timedelta(days=FIRST_RUN_DAYS)
    filtered = await asyncio.to_thread(filter_new_messages, chat_txt, after)
    upload.processed_from = after
    upload.processed_to = filtered["last"]
    upload.new_messages = filtered["count"]
    stats: dict[str, Any] = {"new_messages": filtered["count"], "modes": {}}
    if filtered["count"] == 0:
        stats["new_order_ids"] = []
        return stats

    # Reposts: a message this dealer already posted (any group, last SEEN_DAYS) is not parsed
    # again; its offers are only refreshed, like the import does for a repost.
    messages = split_messages(filtered["text"])
    seen = await _seen_keys([k for k in (message_key(m["sender"], m["body"]) for m in messages) if k])
    fresh = [m for m in messages if message_key(m["sender"], m["body"]) not in seen]
    reposts = [m for m in messages if message_key(m["sender"], m["body"]) in seen]
    stats["reposts_refreshed_offers"], reparse = await _refresh_reposts(reposts)
    if reparse:
        # An old offer these lines no longer support: read the message again instead of keeping it alive.
        again = {id(m) for m in reparse}
        reposts = [m for m in reposts if id(m) not in again]
        fresh = sorted(fresh + reparse, key=lambda m: m["ts"])
    stats["reposts_skipped"] = len(reposts)
    stats["reposts_reparsed"] = len(reparse)
    if not fresh:
        await _remember(reposts)
        await _advance_watermark(state, filtered["last"])
        stats["new_order_ids"] = []
        return stats
    filtered["text"] = "".join(l + "\n" for m in fresh for l in m["lines"])
    filtered["attachments"] = [a for m in fresh for l in m["lines"] for a in
                               ((x.group(1) or x.group(2) or "").strip() for x in _ATTACHED_RE.finditer(l)) if a]

    media_zip = await _get(UPLOAD_BUCKET, upload.media_gridfs_id) if upload.media_gridfs_id else None
    media = await asyncio.to_thread(_extract_media, media_zip, filtered["attachments"])
    ref = filtered["last"] or datetime.utcnow()

    new_ids: list[str] = []
    for mode in MODES:
        run_id, buckets = await _run_generator(
            filtered["text"], media, upload.group_name, mode, ref, str(admin.id))
        # Rows matched without the AI would land in review and the watermark would
        # move past them; wait for credit instead.
        _raise_if_ai_exhausted()
        upload.run_ids[mode] = run_id
        ctx = {"group_name": upload.group_name, "upload_id": str(upload.id), "run_id": run_id}
        mode_stats = await route_rows(buckets, mode, ctx, media, admin)
        new_ids.extend(mode_stats.pop("new_order_ids", []))
        stats["modes"][mode] = mode_stats

    # Watermark only moves after both modes went through, and never back.
    await _advance_watermark(state, filtered["last"])
    await _remember(fresh + reposts)

    # One alert dispatch per import run, only for really new listings (spec §1.11).
    await dispatch_new_listings_safe(new_ids)
    stats["new_orders"] = len(new_ids)
    stats["new_order_ids"] = new_ids
    return stats


async def _advance_watermark(state, last: Optional[datetime]) -> None:
    if last and (state.last_message_at is None or last > state.last_message_at):
        state.last_message_at = last
    state.last_upload_at = datetime.utcnow()
    state.uploads += 1
    await state.save()


async def _seen_keys(keys: list[str]) -> set[str]:
    from app.models.pipeline import PipelineSeenMessage

    if not keys:
        return set()
    now = datetime.utcnow()
    docs = await PipelineSeenMessage.get_motor_collection().find(
        {"key": {"$in": list(set(keys))}, "expires_at": {"$gt": now}}, {"key": 1}).to_list(None)
    return {d["key"] for d in docs}


async def _remember(messages: list[dict]) -> None:
    """Mark messages as parsed (after the run went through, so a failed run is retried)."""
    from app.models.pipeline import PipelineSeenMessage

    now = datetime.utcnow()
    ops = []
    for m in messages:
        k = message_key(m["sender"], m["body"])
        if k:
            ops.append(UpdateOne({"key": k}, {"$set": {"key": k, "sender": m["sender"], "last_at": m["ts"],
                                                       "expires_at": now + timedelta(days=SEEN_DAYS)}}, upsert=True))
    if ops:
        await PipelineSeenMessage.get_motor_collection().bulk_write(ops, ordered=False)


def _line_keys(text: Optional[str]) -> set[str]:
    """Comparable forms of a line: as written and as the generator normalises it."""
    from app.services.wtb_wts_service import _clean_message

    raw = text_key(text)
    if not raw:
        return set()
    return {raw, text_key(_clean_message(text or ""))} - {""}


async def _refresh_reposts(reposts: list[dict]) -> tuple[int, list[dict]]:
    """A reposted message refreshes the dealer's offers that came from its lines: post time,
    expiry, an expired offer comes back (same as the import does for a repost).

    Only an offer the line really supports is refreshed: its price (and a year the line writes)
    must still follow from the line. Otherwise the offer holds an old or wrong reading, the repost
    must not keep it alive, and the message goes back to the generator to be read again (the import
    then overwrites the offer with the new reading). Returns (refreshed offers, messages to re-parse)."""
    from app.models.order import Order, OrderStatus
    from app.services import offer_lifecycle as lifecycle
    from app.services.wtb_wts_service import extract_phone_number

    by_phone: dict[str, list[dict]] = {}
    for m in reposts:
        phone = extract_phone_number(m["sender"]) or ""
        if phone:
            by_phone.setdefault(phone, []).append(m)
    now = datetime.utcnow()
    ops = []
    reparse: dict[int, dict] = {}
    for phone, msgs in by_phone.items():
        wanted: dict[str, tuple[datetime, dict]] = {}
        for m in msgs:
            for part in [m["body"], *m["body"].split("\n")]:
                for k in _line_keys(part):
                    if k not in wanted or m["ts"] >= wanted[k][0]:
                        wanted[k] = (m["ts"], m)
        cur = Order.get_motor_collection().find(
            {"whatsapp_phone": phone, "status": {"$in": [OrderStatus.ACTIVE.value, OrderStatus.EXPIRED.value]},
             "superseded_by": None},
            {"source_text": 1, "order_type": 1, "created_at": 1, "status": 1, "price": 1, "year": 1})
        async for o in cur:
            hits = [wanted[k] for k in _line_keys(o.get("source_text")) if k in wanted]
            if not hits:
                continue
            ts, msg = max(hits, key=lambda h: h[0])
            if not lifecycle.reading_matches_line(o.get("price"), o.get("year"), o.get("source_text")):
                reparse[id(msg)] = msg
                continue
            if o.get("created_at") and ts <= o["created_at"]:
                continue
            ops.append(UpdateOne({"_id": o["_id"]}, {"$set": {
                "created_at": ts, "updated_at": now, "last_seen_at": now,
                "expires_at": lifecycle.expires_at(o.get("order_type") or "sell", ts),
                "status": OrderStatus.ACTIVE.value}}))
    if ops:
        await Order.get_motor_collection().bulk_write(ops, ordered=False)
    return len(ops), sorted(reparse.values(), key=lambda m: m["ts"])


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


def report_recipients(admin_emails: list[Optional[str]], extra: Optional[str]) -> list[str]:
    """All admin emails plus the comma/semicolon-separated extra addresses,
    deduplicated case-insensitively, in that order."""
    out: list[str] = []
    seen: set[str] = set()
    for email in [*admin_emails, *re.split(r"[,;\s]+", extra or "")]:
        email = (email or "").strip()
        if email and "@" in email and email.lower() not in seen:
            seen.add(email.lower())
            out.append(email)
    return out


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
    recipients = report_recipients([a.email for a in admins], settings.PIPELINE_REPORT_EXTRA_RECIPIENTS)
    sent = 0
    for email in recipients:
        if await email_service._send_email(
            email, "WatchSphere – daily pipeline report", html, text
        ):
            sent += 1
    if state is None:
        state = PipelineReportState(key="daily")
    state.last_sent_at = now
    await state.save()
    return {**report, "sent_to": sent, "link": link}


# --------------------------------------------------------------------------- #
# Storage cleanup (every few hours): the database must never fill up again
# --------------------------------------------------------------------------- #

STORAGE_CLEANUP_HOURS = 6
GENERATOR_FILE_DAYS = 1      # generator CSV / rows files: read within minutes of a run
UNUSED_IMAGE_HOURS = 6       # an approval image no item / order points to


async def storage_cleanup() -> dict:
    """Deletes only: old generator output files, approval images nothing references, upload files
    in Firebase that no waiting upload points to (left by a crash). Never orders, items or the
    files of uploads still waiting."""
    from app.models.order import Order
    from app.models.pipeline import PipelineItem, PipelineUpload, UploadStatus

    db = Order.get_motor_collection().database
    now = datetime.utcnow()
    out = {"generator_files": 0, "images": 0, "upload_files": 0}

    gen = _bucket("wtb_wts_files")
    async for f in db["wtb_wts_files.files"].find(
            {"uploadDate": {"$lt": now - timedelta(days=GENERATOR_FILE_DAYS)}}, {"_id": 1}):
        try:
            await gen.delete(f["_id"])
            out["generator_files"] += 1
        except Exception:
            pass

    ref: set[str] = set()
    async for d in PipelineItem.get_motor_collection().find({"image_id": {"$nin": [None, ""]}}, {"image_id": 1}):
        ref.add(str(d["image_id"]))
    async for d in Order.get_motor_collection().find({"source_image": {"$nin": [None, ""]}}, {"source_image": 1}):
        ref.update(re.findall(r"[0-9a-f]{24}", str(d["source_image"])))
        if FIREBASE_PREFIX in str(d["source_image"]):
            ref.add(str(d["source_image"]).split("/images/", 1)[-1])
    async for f in db[f"{IMAGE_BUCKET}.files"].find(
            {"uploadDate": {"$lt": now - timedelta(hours=UNUSED_IMAGE_HOURS)}}, {"_id": 1}):
        if str(f["_id"]) not in ref:
            await _delete(IMAGE_BUCKET, str(f["_id"]))
            out["images"] += 1

    fb = _firebase_bucket()
    if fb is not None:
        waiting = set()
        async for u in PipelineUpload.find({"status": {"$in": [UploadStatus.RECEIVED.value,
                                                               UploadStatus.PROCESSING.value,
                                                               UploadStatus.FAILED.value]}}):
            waiting.update(x for x in (u.chat_gridfs_id, u.media_gridfs_id) if x)
        cutoff = now - timedelta(days=2)

        def sweep(prefix: str, keep: set) -> int:
            n = 0
            for blob in fb.list_blobs(prefix=prefix):
                if FIREBASE_PREFIX + blob.name in keep:
                    continue
                if blob.time_created and blob.time_created.replace(tzinfo=None) < cutoff:
                    blob.delete()
                    n += 1
            return n

        try:
            out["upload_files"] = await asyncio.to_thread(sweep, f"pipeline/{UPLOAD_BUCKET}/", waiting)
            out["images"] += await asyncio.to_thread(sweep, f"pipeline/{IMAGE_BUCKET}/", ref)
        except Exception as exc:
            logger.warning("pipeline: Firebase cleanup failed: %s", exc)
    logger.info("pipeline: storage cleanup %s", out)
    return out


async def storage_loop() -> None:
    """At startup: move waiting uploads' files out of MongoDB, then clean up every few hours."""
    try:
        await move_queued_files_to_storage()
    except Exception as exc:
        logger.error("pipeline: moving queued files failed: %s", exc)
    while True:
        try:
            await storage_cleanup()
        except Exception as exc:
            logger.error("pipeline: storage cleanup failed: %s", exc)
        await asyncio.sleep(STORAGE_CLEANUP_HOURS * 3600)
