"""Upload API for the Mac mini + scheduled pipeline jobs (generator spec §1).

Service endpoints authenticate with ``X-Pipeline-Key`` (``PIPELINE_API_KEY``;
unset → 503). Admin endpoints use the normal admin JWT.
"""
import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.core.deps import get_current_admin_user
from app.core.pipeline_auth import require_pipeline_key
from app.models.pipeline import PipelineGroupState, PipelineUpload
from app.models.user import User
from app.services import pipeline as pipeline_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_export(
    group_name: str = Form(..., description="Group name = export folder name"),
    chat: UploadFile = File(..., description="_chat.txt"),
    media: Optional[UploadFile] = File(None, description="<group>_Medien.zip"),
    _key: str = Depends(require_pipeline_key),
) -> Any:
    """Receive one group's export.

    Answers only after both files are stored in GridFS. ``stored: true`` is the
    Mac mini's signal that it may delete its local copy. Processing (generator,
    AI review, import) runs afterwards; a cron on ``/pipeline/process-pending``
    picks up anything a stopped instance left behind.
    """
    group = (group_name or "").strip()
    if not group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="group_name is required")
    chat_bytes = await chat.read()
    if not chat_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="_chat.txt is empty")
    media_bytes = await media.read() if media is not None else None

    try:
        upload, duplicate = await pipeline_service.store_upload(group, chat_bytes, media_bytes)
    except Exception as exc:
        logger.exception("pipeline upload store failed for %s: %s", group, exc)
        # Not stored → the Mac mini must keep its files and retry.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Upload could not be stored")

    if not duplicate:
        asyncio.create_task(pipeline_service.process_upload(str(upload.id)))
    return {
        "stored": True,
        "upload_id": str(upload.id),
        "duplicate": duplicate,
        "group_name": group,
        "chat_bytes": len(chat_bytes),
        "media_bytes": len(media_bytes or b""),
    }


@router.post("/process-pending")
async def process_pending(
    limit: int = Query(20, ge=1, le=200),
    _key: str = Depends(require_pipeline_key),
) -> Any:
    return {"results": await pipeline_service.process_pending(limit)}


@router.post("/daily-report")
async def daily_report(_key: str = Depends(require_pipeline_key)) -> Any:
    """Daily cron: short report email to all admins with a link to the approval page."""
    return await pipeline_service.send_daily_report()


# --- Admin ---

@router.get("/admin/uploads")
async def list_uploads(
    limit: int = Query(50, ge=1, le=500),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    uploads = await PipelineUpload.find_all().sort("-received_at").limit(limit).to_list()
    return [
        {
            "id": str(u.id),
            "group_name": u.group_name,
            "status": u.status.value,
            "attempts": u.attempts,
            "error": u.error,
            "new_messages": u.new_messages,
            "run_ids": u.run_ids,
            "stats": u.stats,
            "received_at": u.received_at,
            "processed_at": u.processed_at,
        }
        for u in uploads
    ]


@router.get("/admin/groups")
async def list_groups(current_admin: User = Depends(get_current_admin_user)) -> Any:
    states = await PipelineGroupState.find_all().sort("+group_name").to_list()
    return [
        {
            "group_name": s.group_name,
            "last_message_at": s.last_message_at,
            "last_upload_at": s.last_upload_at,
            "uploads": s.uploads,
        }
        for s in states
    ]


@router.post("/admin/process-pending")
async def admin_process_pending(current_admin: User = Depends(get_current_admin_user)) -> Any:
    return {"results": await pipeline_service.process_pending(20)}


@router.post("/admin/daily-report")
async def admin_daily_report(current_admin: User = Depends(get_current_admin_user)) -> Any:
    return await pipeline_service.send_daily_report()
