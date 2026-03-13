from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.wtb_wts import WtbWtsRun, GenerationMode, RunStatus
from app.services.wtb_wts_service import process_generation

router = APIRouter()


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
    reprocessed_from: Optional[str] = None
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
        reprocessed_from=run.reprocessed_from,
        imported_by=run.imported_by,
        imported_by_name=run.imported_by_name,
        created_at=run.created_at,
        completed_at=run.completed_at,
    )


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
    import logging
    logger = logging.getLogger(__name__)

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

    # Read file contents
    txt_content = (await file.read()).decode('utf-8', errors='ignore')
    logger.info(f"generate_wtb_wts: file={file.filename}, size={len(txt_content)} chars, "
                f"mode={mode}, group={group_name}, month={reference_month}/{reference_year}")

    jsonl_content = None
    if jsonl_file and jsonl_file.filename:
        jsonl_content = (await jsonl_file.read()).decode('utf-8', errors='ignore')
        logger.info(f"generate_wtb_wts: jsonl file={jsonl_file.filename}, size={len(jsonl_content)} chars")

    admin_name = current_admin.name or str(current_admin.id)

    # Store input files in GridFS
    original_gridfs_id = await _gridfs_put(txt_content, file.filename)
    jsonl_gridfs_id = None
    if jsonl_content:
        jsonl_gridfs_id = await _gridfs_put(jsonl_content, f"jsonl-{file.filename}")

    # Create run record (lightweight — no large text blobs)
    run = WtbWtsRun(
        filename=file.filename,
        group_name=group_name,
        mode=gen_mode,
        reference_month=reference_month,
        reference_year=reference_year,
        status=RunStatus.PROCESSING,
        original_file_gridfs_id=original_gridfs_id,
        jsonl_file_gridfs_id=jsonl_gridfs_id,
        imported_by=str(current_admin.id),
        imported_by_name=admin_name,
    )
    await run.insert()

    try:
        result = await process_generation(
            txt_content=txt_content,
            mode=gen_mode.value.upper(),
            ref_month=reference_month,
            ref_year=reference_year,
            group_name=group_name,
            jsonl_content=jsonl_content,
        )
        logger.info(f"generate_wtb_wts: processing done — matched={result['matched_count']}, "
                     f"needs_review={result['needs_review_count']}, fuzzy={result.get('fuzzy_matched_count', 0)}, "
                     f"ai={result.get('ai_matched_count', 0)}")

        # Store output CSVs in GridFS
        matched_gridfs_id = None
        if result["matched_csv"]:
            matched_gridfs_id = await _gridfs_put(
                result["matched_csv"],
                f"matched-{file.filename.replace('.txt', '.csv')}",
            )

        needs_review_gridfs_id = None
        if result["needs_review_csv"]:
            needs_review_gridfs_id = await _gridfs_put(
                result["needs_review_csv"],
                f"needs-review-{file.filename.replace('.txt', '.csv')}",
            )

        completed_at = datetime.utcnow()
        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
            "matched_csv_gridfs_id": matched_gridfs_id,
            "needs_review_csv_gridfs_id": needs_review_gridfs_id,
            "total_messages": result["total_messages"],
            "detected_posts": result["detected_posts"],
            "matched_count": result["matched_count"],
            "needs_review_count": result["needs_review_count"],
            "fuzzy_matched_count": result.get("fuzzy_matched_count", 0),
            "ai_matched_count": result.get("ai_matched_count", 0),
            "status": RunStatus.COMPLETED,
            "completed_at": completed_at,
        }})
        # Update local object for response
        run.matched_csv_gridfs_id = matched_gridfs_id
        run.needs_review_csv_gridfs_id = needs_review_gridfs_id
        run.total_messages = result["total_messages"]
        run.detected_posts = result["detected_posts"]
        run.matched_count = result["matched_count"]
        run.needs_review_count = result["needs_review_count"]
        run.fuzzy_matched_count = result.get("fuzzy_matched_count", 0)
        run.ai_matched_count = result.get("ai_matched_count", 0)
        run.status = RunStatus.COMPLETED
        run.completed_at = completed_at

    except Exception as e:
        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
            "status": RunStatus.FAILED,
            "error_message": str(e),
        }})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )

    return _run_to_response(run)


@router.get("/admin/wtb-wts/runs", response_model=List[RunResponse])
async def list_runs(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all WTB/WTS generation runs (Admin only)"""

    runs = await WtbWtsRun.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [_run_to_response(run) for run in runs]


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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matched CSV available for this run"
        )

    content = await _gridfs_get(run.matched_csv_gridfs_id)
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No needs-review CSV available for this run"
        )

    content = await _gridfs_get(run.needs_review_csv_gridfs_id)
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="needs-review-{run.filename.replace(".txt", ".csv")}"'
        },
    )


@router.get("/admin/wtb-wts/runs/{run_id}/original-file")
async def download_original_file(
    run_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download the original .txt file from a run (Admin only)"""

    run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found"
        )

    if not run.original_file_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original file not available"
        )

    content = await _gridfs_get(run.original_file_gridfs_id)
    return Response(
        content=content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{run.filename}"'
        },
    )


@router.post("/admin/wtb-wts/runs/{run_id}/reprocess", response_model=RunResponse)
async def reprocess_run(
    run_id: str,
    mode: str = Form(...),
    group_name: str = Form(...),
    reference_month: int = Form(...),
    reference_year: int = Form(...),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Re-process a previous run with different settings (Admin only).
    Creates a new WtbWtsRun linked to the original via reprocessed_from."""

    original_run = await WtbWtsRun.get(PydanticObjectId(run_id))
    if not original_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original run not found"
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

    admin_name = current_admin.name or str(current_admin.id)

    # Load original file content from GridFS for processing
    if not original_run.original_file_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Original file content not available for reprocessing"
        )
    txt_content = await _gridfs_get(original_run.original_file_gridfs_id)

    jsonl_content = None
    if original_run.jsonl_file_gridfs_id:
        jsonl_content = await _gridfs_get(original_run.jsonl_file_gridfs_id)

    # Store copies in GridFS for the new run
    new_original_gridfs_id = await _gridfs_put(txt_content, original_run.filename)
    new_jsonl_gridfs_id = None
    if jsonl_content:
        new_jsonl_gridfs_id = await _gridfs_put(jsonl_content, f"jsonl-{original_run.filename}")

    new_run = WtbWtsRun(
        filename=original_run.filename,
        group_name=group_name,
        mode=gen_mode,
        reference_month=reference_month,
        reference_year=reference_year,
        status=RunStatus.PROCESSING,
        original_file_gridfs_id=new_original_gridfs_id,
        jsonl_file_gridfs_id=new_jsonl_gridfs_id,
        imported_by=str(current_admin.id),
        imported_by_name=admin_name,
        reprocessed_from=str(original_run.id),
    )
    await new_run.insert()

    try:
        result = await process_generation(
            txt_content=txt_content,
            mode=gen_mode.value.upper(),
            ref_month=reference_month,
            ref_year=reference_year,
            group_name=group_name,
            jsonl_content=jsonl_content,
        )

        matched_gridfs_id = None
        if result["matched_csv"]:
            matched_gridfs_id = await _gridfs_put(
                result["matched_csv"],
                f"matched-{original_run.filename.replace('.txt', '.csv')}",
            )

        needs_review_gridfs_id = None
        if result["needs_review_csv"]:
            needs_review_gridfs_id = await _gridfs_put(
                result["needs_review_csv"],
                f"needs-review-{original_run.filename.replace('.txt', '.csv')}",
            )

        completed_at = datetime.utcnow()
        await WtbWtsRun.find_one(WtbWtsRun.id == new_run.id).update({"$set": {
            "matched_csv_gridfs_id": matched_gridfs_id,
            "needs_review_csv_gridfs_id": needs_review_gridfs_id,
            "total_messages": result["total_messages"],
            "detected_posts": result["detected_posts"],
            "matched_count": result["matched_count"],
            "needs_review_count": result["needs_review_count"],
            "fuzzy_matched_count": result.get("fuzzy_matched_count", 0),
            "ai_matched_count": result.get("ai_matched_count", 0),
            "status": RunStatus.COMPLETED,
            "completed_at": completed_at,
        }})
        new_run.matched_csv_gridfs_id = matched_gridfs_id
        new_run.needs_review_csv_gridfs_id = needs_review_gridfs_id
        new_run.total_messages = result["total_messages"]
        new_run.detected_posts = result["detected_posts"]
        new_run.matched_count = result["matched_count"]
        new_run.needs_review_count = result["needs_review_count"]
        new_run.fuzzy_matched_count = result.get("fuzzy_matched_count", 0)
        new_run.ai_matched_count = result.get("ai_matched_count", 0)
        new_run.status = RunStatus.COMPLETED
        new_run.completed_at = completed_at

    except Exception as e:
        await WtbWtsRun.find_one(WtbWtsRun.id == new_run.id).update({"$set": {
            "status": RunStatus.FAILED,
            "error_message": str(e),
        }})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reprocessing failed: {str(e)}"
        )

    return _run_to_response(new_run)
