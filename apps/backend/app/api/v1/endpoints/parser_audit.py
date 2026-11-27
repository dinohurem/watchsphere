"""Admin access to the daily parser audit. Mounted at /api/v1/admin/parser-audit."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import get_current_admin_user
from app.models.parser_audit import ParserAuditReport
from app.models.user import User
from app.services import parser_audit

router = APIRouter()


def _out(report: ParserAuditReport) -> dict:
    data = report.model_dump(exclude={"id", "revision_id"})
    data["id"] = str(report.id)
    return data


@router.get("/latest")
async def latest(current_user: User = Depends(get_current_admin_user)):
    report = await ParserAuditReport.find_all().sort("-run_at").first_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="No parser audit has run yet")
    return _out(report)


@router.post("/run")
async def run(hours: float = Query(24, gt=0, le=24 * 30), current_user: User = Depends(get_current_admin_user)):
    """Audit the last ``hours`` now and store the report. Does not send the email."""
    result = await parser_audit.run_audit(hours)
    report = await parser_audit.store_report(result, "manual")
    return _out(report)
