from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from app.models.app_settings import AppSettings
from app.core.deps import get_current_admin_user
from app.models.user import User

router = APIRouter()


class AppSettingsResponse(BaseModel):
    v2_enabled: bool
    paywall_enabled: bool


class AppSettingsUpdate(BaseModel):
    v2_enabled: Optional[bool] = None
    paywall_enabled: Optional[bool] = None


def _response(settings: AppSettings) -> AppSettingsResponse:
    return AppSettingsResponse(
        v2_enabled=settings.v2_enabled,
        paywall_enabled=settings.paywall_enabled,
    )


@router.get("/app", response_model=AppSettingsResponse)
async def get_app_settings():
    """Get app settings. Public endpoint, no auth required."""
    return _response(await AppSettings.get_global())


@router.patch("/app", response_model=AppSettingsResponse)
async def update_app_settings(
    data: AppSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
):
    """Update app settings. Admin only."""
    settings = await AppSettings.get_global()
    if data.v2_enabled is not None:
        settings.v2_enabled = data.v2_enabled
    if data.paywall_enabled is not None:
        settings.paywall_enabled = data.paywall_enabled
    settings.updated_at = datetime.utcnow()
    await settings.save()
    return _response(settings)
