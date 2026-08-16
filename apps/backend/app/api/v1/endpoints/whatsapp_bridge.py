"""Ingest endpoints for the live WhatsApp bridge client.

The bridge (apps/whatsapp-bridge) is a long-running Node process paired to a
dedicated WhatsApp number. It streams messages from allow-listed groups here;
this module stores them raw and, on demand, renders them back into WhatsApp
export format so the existing WTS/WTB generator can consume them unchanged.

Captured messages never reach the order book on their own — an admin still runs
a generation and reviews the matched / needs-review CSVs, exactly as with a
manual export.
"""

import asyncio
import hmac
import logging
from datetime import datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo import UpdateOne

from app.core.config import settings
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.whatsapp_bridge import BridgeMessage, BridgeState, BridgeStatus
from app.models.wtb_wts import GenerationMode, RunStatus, WtbWtsRun
from app.services.whatsapp_bridge_export import render_export_txt

# The generation plumbing (GridFS storage, progress updates, TTL cleanup) lives
# with the upload-based generator. Reused here so a bridge-sourced run is
# indistinguishable from an uploaded one downstream.
from app.api.v1.endpoints.wtb_wts import (
    _cleanup_all_expired,
    _run_processing,
    _run_to_response,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_BATCH_SIZE = 1000


# --- Auth ---

async def require_bridge_token(
    x_bridge_token: Optional[str] = Header(None, alias="X-Bridge-Token"),
) -> str:
    """Authenticate a bridge client via shared secret.

    The bridge is a service, not a user, so it carries a static token rather
    than a JWT. When no token is configured the endpoints stay closed — an
    unset secret must never degrade into "no auth required".
    """
    configured = (settings.WHATSAPP_BRIDGE_TOKEN or "").strip()
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WhatsApp bridge is not enabled (WHATSAPP_BRIDGE_TOKEN unset)",
        )

    if not x_bridge_token or not hmac.compare_digest(x_bridge_token, configured):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bridge token",
        )

    return x_bridge_token


# --- Request / response models ---

class BridgeMessageIn(BaseModel):
    message_id: str
    group_jid: str
    group_name: str
    sender: str
    sender_phone: Optional[str] = None
    push_name: Optional[str] = None
    content: str
    timestamp: datetime
    from_me: bool = False
    has_media: bool = False
    attachments: List[str] = Field(default_factory=list)


class IngestRequest(BaseModel):
    bridge_id: str
    messages: List[BridgeMessageIn]


class IngestResponse(BaseModel):
    received: int
    inserted: int
    duplicates: int


class HeartbeatRequest(BaseModel):
    bridge_id: str
    state: BridgeState
    phone_number: Optional[str] = None
    groups: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class BridgeStatusResponse(BaseModel):
    bridge_id: str
    state: BridgeState
    phone_number: Optional[str] = None
    groups: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    last_heartbeat_at: datetime
    last_message_at: Optional[datetime] = None
    messages_ingested: int = 0
    is_stale: bool = False


class BridgeGroupResponse(BaseModel):
    group_jid: str
    group_name: str
    message_count: int
    first_message_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None


class GenerateFromBridgeRequest(BaseModel):
    group_jid: str
    mode: str
    reference_month: int
    reference_year: int
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    tz_offset_minutes: int = 0


# --- Helpers ---

def _timestamp_filter(start: Optional[datetime], end: Optional[datetime]) -> dict:
    window: dict = {}
    if start:
        window["$gte"] = start
    if end:
        window["$lte"] = end
    return {"timestamp": window} if window else {}


async def _fetch_messages(
    group_jid: str,
    start: Optional[datetime],
    end: Optional[datetime],
) -> List[BridgeMessage]:
    query: dict = {"group_jid": group_jid}
    query.update(_timestamp_filter(start, end))
    return await BridgeMessage.find(query).sort("+timestamp").to_list()


# --- Bridge-facing endpoints ---

@router.post("/messages", response_model=IngestResponse)
async def ingest_messages(
    payload: IngestRequest,
    _token: str = Depends(require_bridge_token),
) -> Any:
    """Ingest a batch of captured messages.

    Idempotent on (group_jid, message_id): the bridge retries batches after
    network failures and replays its on-disk outbox after a restart, so the
    same message arrives more than once by design. Existing rows are left
    untouched rather than overwritten.
    """
    if len(payload.messages) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Batch too large: {len(payload.messages)} messages (max {MAX_BATCH_SIZE})",
        )

    if not payload.messages:
        return IngestResponse(received=0, inserted=0, duplicates=0)

    now = datetime.utcnow()
    operations = []
    for message in payload.messages:
        document = message.model_dump()
        document["ingested_at"] = now
        document["bridge_id"] = payload.bridge_id
        operations.append(
            UpdateOne(
                {"group_jid": message.group_jid, "message_id": message.message_id},
                {"$setOnInsert": document},
                upsert=True,
            )
        )

    result = await BridgeMessage.get_motor_collection().bulk_write(operations, ordered=False)
    inserted = len(result.upserted_ids or {})
    duplicates = len(payload.messages) - inserted

    latest = max(message.timestamp for message in payload.messages)
    await BridgeStatus.get_motor_collection().update_one(
        {"bridge_id": payload.bridge_id},
        {
            "$set": {"last_message_at": latest, "last_heartbeat_at": now},
            "$inc": {"messages_ingested": inserted},
            "$setOnInsert": {
                "bridge_id": payload.bridge_id,
                "state": BridgeState.CONNECTED.value,
                "groups": [],
                "created_at": now,
            },
        },
        upsert=True,
    )

    logger.info(
        f"bridge ingest: bridge={payload.bridge_id} received={len(payload.messages)} "
        f"inserted={inserted} duplicates={duplicates}"
    )
    return IngestResponse(
        received=len(payload.messages),
        inserted=inserted,
        duplicates=duplicates,
    )


@router.post("/heartbeat")
async def heartbeat(
    payload: HeartbeatRequest,
    _token: str = Depends(require_bridge_token),
) -> Any:
    """Report bridge connection state. Also how an admin learns a re-pair is due."""
    now = datetime.utcnow()
    await BridgeStatus.get_motor_collection().update_one(
        {"bridge_id": payload.bridge_id},
        {
            "$set": {
                "state": payload.state.value,
                "phone_number": payload.phone_number,
                "groups": payload.groups,
                "error": payload.error,
                "last_heartbeat_at": now,
            },
            "$setOnInsert": {
                "bridge_id": payload.bridge_id,
                "messages_ingested": 0,
                "created_at": now,
            },
        },
        upsert=True,
    )
    return {"ok": True}


# --- Admin-facing endpoints ---

@router.get("/status", response_model=List[BridgeStatusResponse])
async def bridge_status(
    current_admin: User = Depends(get_current_admin_user),
    stale_after_minutes: int = Query(5, ge=1, le=1440),
) -> Any:
    """Connection state of every bridge client that has ever reported in."""
    statuses = await BridgeStatus.find_all().sort("-last_heartbeat_at").to_list()
    cutoff = datetime.utcnow() - timedelta(minutes=stale_after_minutes)

    return [
        BridgeStatusResponse(
            bridge_id=item.bridge_id,
            state=item.state,
            phone_number=item.phone_number,
            groups=item.groups,
            error=item.error,
            last_heartbeat_at=item.last_heartbeat_at,
            last_message_at=item.last_message_at,
            messages_ingested=item.messages_ingested,
            is_stale=item.last_heartbeat_at < cutoff,
        )
        for item in statuses
    ]


@router.get("/groups", response_model=List[BridgeGroupResponse])
async def bridge_groups(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Groups the bridge has captured from, with coverage windows."""
    pipeline = [
        {
            "$group": {
                "_id": "$group_jid",
                "group_name": {"$last": "$group_name"},
                "message_count": {"$sum": 1},
                "first_message_at": {"$min": "$timestamp"},
                "last_message_at": {"$max": "$timestamp"},
            }
        },
        {"$sort": {"last_message_at": -1}},
    ]

    rows = await BridgeMessage.aggregate(pipeline).to_list()
    return [
        BridgeGroupResponse(
            group_jid=row["_id"],
            group_name=row.get("group_name") or row["_id"],
            message_count=row.get("message_count", 0),
            first_message_at=row.get("first_message_at"),
            last_message_at=row.get("last_message_at"),
        )
        for row in rows
    ]


@router.get("/export")
async def export_group_txt(
    group_jid: str = Query(...),
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    tz_offset_minutes: int = Query(0, ge=-840, le=840),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download captured messages as a WhatsApp export .txt.

    Gives an admin the same artifact a manual "Export chat" would have produced,
    for a group where that option is unavailable.
    """
    messages = await _fetch_messages(group_jid, start, end)
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No captured messages for that group and time range",
        )

    content = render_export_txt(messages, tz_offset_minutes=tz_offset_minutes)
    group_name = messages[-1].group_name or group_jid
    safe_name = "".join(c for c in group_name if c.isalnum() or c in " -_").strip() or "bridge"

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.txt"'},
    )


@router.post("/generate")
async def generate_from_bridge(
    payload: GenerateFromBridgeRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Run the WTS/WTB generator over captured messages.

    Produces a normal WtbWtsRun, so the admin downloads and reviews the same
    matched / needs-review / not-in-database CSVs as with an uploaded export.
    """
    try:
        gen_mode = GenerationMode(payload.mode.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be 'wts' or 'wtb'",
        )

    if not (1 <= payload.reference_month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reference_month must be between 1 and 12",
        )

    messages = await _fetch_messages(payload.group_jid, payload.start, payload.end)
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No captured messages for that group and time range",
        )

    txt_content = render_export_txt(messages, tz_offset_minutes=payload.tz_offset_minutes)
    group_name = messages[-1].group_name or payload.group_jid
    filename = f"bridge-{payload.group_jid.split('@')[0]}.txt"

    logger.info(
        f"generate_from_bridge: group={group_name} messages={len(messages)} "
        f"chars={len(txt_content)} mode={gen_mode.value}"
    )

    asyncio.create_task(_cleanup_all_expired())

    run = WtbWtsRun(
        filename=filename,
        group_name=group_name,
        mode=gen_mode,
        reference_month=payload.reference_month,
        reference_year=payload.reference_year,
        status=RunStatus.PROCESSING,
        imported_by=str(current_admin.id),
        imported_by_name=current_admin.name or str(current_admin.id),
    )
    await run.insert()

    asyncio.create_task(
        _run_processing(
            run,
            txt_content,
            gen_mode,
            payload.reference_month,
            payload.reference_year,
            group_name,
            None,
            filename,
            None,
        )
    )

    return _run_to_response(run)


@router.delete("/messages")
async def purge_messages(
    group_jid: Optional[str] = Query(None),
    older_than_days: Optional[int] = Query(None, ge=1),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete captured messages. Retention hygiene for a store that only grows.

    Requires at least one filter — an unfiltered delete of the whole capture
    history should be a deliberate act, not a missing query parameter.
    """
    if not group_jid and older_than_days is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide group_jid and/or older_than_days",
        )

    query: dict = {}
    if group_jid:
        query["group_jid"] = group_jid
    if older_than_days is not None:
        query["timestamp"] = {"$lt": datetime.utcnow() - timedelta(days=older_than_days)}

    result = await BridgeMessage.get_motor_collection().delete_many(query)
    logger.info(f"bridge purge: query={query} deleted={result.deleted_count}")
    return {"deleted": result.deleted_count}
