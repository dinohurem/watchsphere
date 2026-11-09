"""Shared-secret auth for the generator pipeline and its scheduled jobs.

The Mac mini (chat export uploads) and the cron (FX refresh, daily report) are
services, not users, so they present ``PIPELINE_API_KEY`` in ``X-Pipeline-Key``.
An unset key keeps the endpoints closed (503), never open — same rule as the
WhatsApp bridge token.
"""
import hmac
from typing import Optional

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def require_pipeline_key(
    x_pipeline_key: Optional[str] = Header(None, alias="X-Pipeline-Key"),
) -> str:
    configured = (settings.PIPELINE_API_KEY or "").strip()
    if not configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pipeline is not enabled (PIPELINE_API_KEY unset)",
        )
    if not x_pipeline_key or not hmac.compare_digest(x_pipeline_key, configured):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid pipeline key",
        )
    return x_pipeline_key
