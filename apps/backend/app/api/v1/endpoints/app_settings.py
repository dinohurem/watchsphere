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


class AppSettingsUpdate(BaseModel):
    v2_enabled: Optional[bool] = None


async def get_or_create_settings() -> AppSettings:
    """Get the global settings singleton, creating it if it doesn't exist."""
    settings = await AppSettings.find_one(AppSettings.key == "global")
    if not settings:
        settings = AppSettings(key="global", v2_enabled=False)
        await settings.insert()
    return settings


@router.get("/app", response_model=AppSettingsResponse)
async def get_app_settings():
    """Get app settings. Public endpoint, no auth required."""
    settings = await get_or_create_settings()
    return AppSettingsResponse(v2_enabled=settings.v2_enabled)


@router.patch("/app", response_model=AppSettingsResponse)
async def update_app_settings(
    data: AppSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
):
    """Update app settings. Admin only."""
    settings = await get_or_create_settings()
    if data.v2_enabled is not None:
        settings.v2_enabled = data.v2_enabled
    settings.updated_at = datetime.utcnow()
    await settings.save()
    return AppSettingsResponse(v2_enabled=settings.v2_enabled)
