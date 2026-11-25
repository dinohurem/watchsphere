"""Admin: recalculate the condition of existing WTS offers (Unworn / Used / none).

    POST /admin/wts-condition/recalculate?dry_run=true&limit=

Dry run is the default: counts before and after plus a sample of the changes, nothing is written.
Only ``dry_run=false`` writes. Re-run the dry run afterwards: it then reports zero changes.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.services import condition_recalc

router = APIRouter()


@router.post("/recalculate")
async def recalculate_wts_condition(
    dry_run: bool = Query(True),
    limit: Optional[int] = Query(None, ge=1, description="Only look at the first N sell offers"),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Re-derive the condition of every sell order from its stored original line
    (``source_text``) with the three-state rules. Header rule is not applied (header not stored)."""
    return await condition_recalc.recalculate(dry_run=dry_run, limit=limit)
