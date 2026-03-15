import asyncio
import io
import logging
import traceback
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.wtb_wts import WtbWtsRun, GenerationMode, RunStatus
from app.services.wtb_wts_service import process_generation

logger = logging.getLogger(__name__)

router = APIRouter()

FILES_TTL_MINUTES = 30


# --- GridFS helpers ---

def _get_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    """Get a GridFS bucket from the WtbWtsRun collection's database."""
    db = WtbWtsRun.get_motor_collection().database
    return AsyncIOMotorGridFSBucket(db, bucket_name="wtb_wts_files")


async def _gridfs_put(content: str, filename: str) -> str:
    """Store text content in GridFS, return the file ID as a string."""
    bucket = _get_gridfs_bucket()
    file_id = await bucket.upload_from_stream(
        filename,
        content.encode("utf-8"),
    )
    return str(file_id)


async def _gridfs_get(file_id: str) -> str:
    """Retrieve text content from GridFS by file ID."""
    bucket = _get_gridfs_bucket()
    stream = await bucket.open_download_stream(ObjectId(file_id))
    data = await stream.read()
    return data.decode("utf-8")


async def _gridfs_delete(file_id: str) -> None:
    """Delete a file from GridFS."""
    bucket = _get_gridfs_bucket()
    try:
        await bucket.delete(ObjectId(file_id))
    except Exception:
        pass


async def _cleanup_expired_files(run: WtbWtsRun) -> None:
    """Delete GridFS files for a run and clear references."""
    for field in ("matched_csv_gridfs_id", "needs_review_csv_gridfs_id", "suggested_csv_gridfs_id"):
        file_id = getattr(run, field, None)
        if file_id:
            await _gridfs_delete(file_id)

    await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
        "matched_csv_gridfs_id": None,
        "needs_review_csv_gridfs_id": None,
        "suggested_csv_gridfs_id": None,
        "files_expire_at": None,
    }})


async def _cleanup_all_expired() -> None:
    """Find and clean up all runs with expired files."""
    now = datetime.utcnow()
    expired_runs = await WtbWtsRun.find(
        WtbWtsRun.files_expire_at != None,  # noqa: E711
        WtbWtsRun.files_expire_at <= now,
    ).to_list()

    for run in expired_runs:
        try:
            await _cleanup_expired_files(run)
            logger.info(f"Cleaned up expired files for run {run.id}")
        except Exception as e:
            logger.error(f"Failed to clean up run {run.id}: {e}")


async def _schedule_cleanup(run_id: PydanticObjectId, delay_minutes: int = FILES_TTL_MINUTES) -> None:
    """Schedule file cleanup after delay."""
    await asyncio.sleep(delay_minutes * 60)
    try:
        run = await WtbWtsRun.get(run_id)
        if run and run.files_expire_at:
            await _cleanup_expired_files(run)
            logger.info(f"Scheduled cleanup completed for run {run_id}")
    except Exception as e:
        logger.error(f"Scheduled cleanup failed for run {run_id}: {e}")


# --- Response Models ---

class RunResponse(BaseModel):
    id: str
    filename: str
    group_name: str
    mode: str
    reference_month: int
    reference_year: int
    status: RunStatus
    error_message: Optional[str] = None
    total_messages: int = 0
    detected_posts: int = 0
    matched_count: int = 0
    needs_review_count: int = 0
    fuzzy_matched_count: int = 0
    ai_matched_count: int = 0
    has_matched_csv: bool = False
    has_needs_review_csv: bool = False
    has_suggested_csv: bool = False
    suggested_additions_count: int = 0
    files_expire_at: Optional[datetime] = None
    imported_by: str
    imported_by_name: str
    created_at: datetime
    completed_at: Optional[datetime] = None


def _run_to_response(run: WtbWtsRun) -> RunResponse:
    """Convert a WtbWtsRun document to a RunResponse."""
    return RunResponse(
        id=str(run.id),
        filename=run.filename,
        group_name=run.group_name,
        mode=run.mode.value,
        reference_month=run.reference_month,
        reference_year=run.reference_year,
        status=run.status,
        error_message=run.error_message,
        total_messages=run.total_messages,
        detected_posts=run.detected_posts,
        matched_count=run.matched_count,
        needs_review_count=run.needs_review_count,
        fuzzy_matched_count=run.fuzzy_matched_count,
        ai_matched_count=run.ai_matched_count,
        has_matched_csv=bool(run.matched_csv_gridfs_id),
        has_needs_review_csv=bool(run.needs_review_csv_gridfs_id),
        has_suggested_csv=bool(getattr(run, "suggested_csv_gridfs_id", None)),
        suggested_additions_count=getattr(run, "suggested_additions_count", 0),
        files_expire_at=getattr(run, "files_expire_at", None),
        imported_by=run.imported_by,
        imported_by_name=run.imported_by_name,
        created_at=run.created_at,
        completed_at=run.completed_at,
    )


# --- Background processing ---

async def _run_processing(
    run: WtbWtsRun,
    txt_content: str,
    gen_mode: GenerationMode,
    ref_month: int,
    ref_year: int,
    group_name: str,
    jsonl_content: Optional[str],
    filename: str,
):
    """Run WTB/WTS processing in background with progress updates."""
    async def update_progress(stage: str, percent: int, detail: str = ""):
        try:
            await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
                "progress_percent": percent,
                "progress_stage": stage,
                "progress_detail": detail,
            }})
        except Exception:
            pass

    try:
        result = await process_generation(
            txt_content=txt_content,
            mode=gen_mode.value.upper(),
            ref_month=ref_month,
            ref_year=ref_year,
            group_name=group_name,
            jsonl_content=jsonl_content,
            progress_callback=update_progress,
        )
        logger.info(f"generate_wtb_wts: processing done — matched={result['matched_count']}, "
                     f"needs_review={result['needs_review_count']}, fuzzy={result.get('fuzzy_matched_count', 0)}, "
                     f"ai={result.get('ai_matched_count', 0)}")

        matched_gridfs_id = None
        if result["matched_csv"]:
            matched_gridfs_id = await _gridfs_put(
                result["matched_csv"],
                f"matched-{filename.replace('.txt', '.csv')}",
            )

        needs_review_gridfs_id = None
        if result["needs_review_csv"]:
            needs_review_gridfs_id = await _gridfs_put(
                result["needs_review_csv"],
                f"needs-review-{filename.replace('.txt', '.csv')}",
            )

        # Store suggested-additions CSV
        suggested_csv = result.get("suggested_additions_csv", "")
        suggested_gridfs_id = None
        if suggested_csv:
            suggested_gridfs_id = await _gridfs_put(
                suggested_csv,
                f"suggested-{filename.replace('.txt', '.csv')}",
            )

        completed_at = datetime.utcnow()
        files_expire_at = completed_at + timedelta(minutes=FILES_TTL_MINUTES)

        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
            "matched_csv_gridfs_id": matched_gridfs_id,
            "needs_review_csv_gridfs_id": needs_review_gridfs_id,
            "suggested_csv_gridfs_id": suggested_gridfs_id,
            "total_messages": result["total_messages"],
            "detected_posts": result["detected_posts"],
            "matched_count": result["matched_count"],
            "needs_review_count": result["needs_review_count"],
            "fuzzy_matched_count": result.get("fuzzy_matched_count", 0),
            "ai_matched_count": result.get("ai_matched_count", 0),
            "suggested_additions_count": result.get("suggested_additions_count", 0),
            "status": RunStatus.COMPLETED,
            "completed_at": completed_at,
            "files_expire_at": files_expire_at,
            "progress_percent": 100,
            "progress_stage": "completed",
            "progress_detail": "Done",
        }})

        # Schedule cleanup after TTL
        asyncio.create_task(_schedule_cleanup(run.id))

    except Exception as e:
        logger.error(f"generate_wtb_wts FAILED: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
            "status": RunStatus.FAILED,
            "error_message": str(e),
            "progress_percent": 0,
            "progress_stage": "failed",
            "progress_detail": str(e),
        }})


# --- Endpoints ---

@router.post("/admin/wtb-wts/generate", response_model=RunResponse)
async def generate_wtb_wts(
    file: UploadFile = File(...),
    mode: str = Form(...),
    group_name: str = Form(...),
    reference_month: int = Form(...),
    reference_year: int = Form(...),
    jsonl_file: Optional[UploadFile] = File(None),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Generate WTB/WTS CSV from a WhatsApp .txt export (Admin only)"""
    if not file.filename.endswith('.txt'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .txt file"
        )

    try:
        gen_mode = GenerationMode(mode.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be 'wts' or 'wtb'"
        )

    if not (1 <= reference_month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reference_month must be between 1 and 12"
        )

    # Read file contents — not stored, only used for processing
    txt_content = (await file.read()).decode('utf-8', errors='ignore')
    logger.info(f"generate_wtb_wts: file={file.filename}, size={len(txt_content)} chars, "
                f"mode={mode}, group={group_name}, month={reference_month}/{reference_year}")

    jsonl_content = None
    if jsonl_file and jsonl_file.filename:
        jsonl_content = (await jsonl_file.read()).decode('utf-8', errors='ignore')
        logger.info(f"generate_wtb_wts: jsonl file={jsonl_file.filename}, size={len(jsonl_content)} chars")

    admin_name = current_admin.name or str(current_admin.id)

    # Clean up any previously expired files before creating new run
    asyncio.create_task(_cleanup_all_expired())

    # Create run record (no original files stored)
    run = WtbWtsRun(
        filename=file.filename,
        group_name=group_name,
        mode=gen_mode,
        reference_month=reference_month,
        reference_year=reference_year,
        status=RunStatus.PROCESSING,
        imported_by=str(current_admin.id),
        imported_by_name=admin_name,
    )
    await run.insert()

    # Launch processing in background — return run immediately
    asyncio.create_task(_run_processing(run, txt_content, gen_mode, reference_month,
                                        reference_year, group_name, jsonl_content, file.filename))

    return _run_to_response(run)


@router.get("/admin/wtb-wts/runs", response_model=List[RunResponse])
async def list_runs(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all WTB/WTS generation runs (Admin only)"""

    # Clean up expired files on list fetch
    asyncio.create_task(_cleanup_all_expired())

    runs = await WtbWtsRun.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [_run_to_response(run) for run in runs]


@router.get("/admin/wtb-wts/runs/{run_id}/progress")
async def get_run_progress(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get progress of a processing run (Admin only)"""
    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return {
        "status": run.status.value,
        "progress_percent": getattr(run, "progress_percent", 0),
        "progress_stage": getattr(run, "progress_stage", ""),
        "progress_detail": getattr(run, "progress_detail", ""),
    }


@router.get("/admin/wtb-wts/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get a single WTB/WTS run details (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    return _run_to_response(run)


@router.get("/admin/wtb-wts/runs/{run_id}/matched-csv")
async def download_matched_csv(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download matched CSV from a run (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    if not run.matched_csv_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after generation."
        )

    try:
        content = await _gridfs_get(run.matched_csv_gridfs_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after generation."
        )

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="matched-{run.filename.replace(".txt", ".csv")}"'
        },
    )


@router.get("/admin/wtb-wts/runs/{run_id}/needs-review-csv")
async def download_needs_review_csv(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download needs-review CSV from a run (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    if not run.needs_review_csv_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after generation."
        )

    try:
        content = await _gridfs_get(run.needs_review_csv_gridfs_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after generation."
        )

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="needs-review-{run.filename.replace(".txt", ".csv")}"'
        },
    )


@router.get("/admin/wtb-wts/runs/{run_id}/suggested-csv")
async def download_suggested_csv(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download suggested additions CSV for a run (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    if not getattr(run, "suggested_csv_gridfs_id", None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No suggested additions CSV available"
        )

    try:
        content = await _gridfs_get(run.suggested_csv_gridfs_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after generation."
        )

    filename = f"suggested-{run.filename.replace('.txt', '.csv')}"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8") if isinstance(content, str) else content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/admin/wtb-wts/runs/{run_id}")
async def delete_run(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a WTB/WTS run and its files (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    # Clean up GridFS files
    await _cleanup_expired_files(run)
    await run.delete()

    return {"message": "Run deleted"}
