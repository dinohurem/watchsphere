from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId

from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.activity_log import ActivityLog, ActivityType, EntityType

router = APIRouter()


class ActivityResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    activity_type: ActivityType
    description: str
    entity_type: Optional[EntityType] = None
    entity_id: Optional[str] = None
    metadata: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    created_at: datetime


@router.get("/admin/activity", response_model=List[ActivityResponse])
async def admin_list_activity(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = None,
    activity_type: Optional[ActivityType] = None,
    entity_type: Optional[EntityType] = None,
    days: Optional[int] = None,
) -> Any:
    """List activity logs (Admin only)"""

    query_conditions = []

    if user_id:
        query_conditions.append(ActivityLog.user_id == user_id)
    if activity_type:
        query_conditions.append(ActivityLog.activity_type == activity_type)
    if entity_type:
        query_conditions.append(ActivityLog.entity_type == entity_type)
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query_conditions.append(ActivityLog.created_at >= cutoff)

    if query_conditions:
        logs = await ActivityLog.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        logs = await ActivityLog.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(log.id),
            "user_id": log.user_id,
            "user_name": log.user_name,
            "user_email": log.user_email,
            "activity_type": log.activity_type,
            "description": log.description,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "metadata": log.metadata,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.get("/admin/activity/user/{user_id}", response_model=List[ActivityResponse])
async def admin_get_user_activity(
    user_id: str,
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Get activity logs for a specific user (Admin only)"""

    logs = await ActivityLog.find(
        ActivityLog.user_id == user_id
    ).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(log.id),
            "user_id": log.user_id,
            "user_name": log.user_name,
            "user_email": log.user_email,
            "activity_type": log.activity_type,
            "description": log.description,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "metadata": log.metadata,
            "ip_address": log.ip_address,
            "created_at": log.created_at,
        }
        for log in logs
    ]


@router.get("/admin/activity/stats")
async def admin_activity_stats(
    current_admin: User = Depends(get_current_admin_user),
    days: int = 7,
) -> Any:
    """Get activity statistics (Admin only)"""

    cutoff = datetime.utcnow() - timedelta(days=days)
    recent_logs = await ActivityLog.find(ActivityLog.created_at >= cutoff).to_list()

    # Count by type
    by_type = {}
    for log in recent_logs:
        key = log.activity_type.value
        by_type[key] = by_type.get(key, 0) + 1

    # Count by day
    by_day = {}
    for log in recent_logs:
        day = log.created_at.strftime("%Y-%m-%d")
        by_day[day] = by_day.get(day, 0) + 1

    # Most active users
    user_counts = {}
    for log in recent_logs:
        if log.user_id:
            key = log.user_name or log.user_id
            user_counts[key] = user_counts.get(key, 0) + 1

    top_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "period_days": days,
        "total_events": len(recent_logs),
        "by_type": by_type,
        "by_day": dict(sorted(by_day.items())),
        "top_users": dict(top_users),
        "unique_users": len(set(log.user_id for log in recent_logs if log.user_id)),
    }


# Helper function to log activity (can be called from other endpoints)
async def log_activity(
    activity_type: ActivityType,
    description: str,
    user: Optional[User] = None,
    entity_type: Optional[EntityType] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ActivityLog:
    """Helper function to create activity log entries"""

    log = ActivityLog(
        user_id=str(user.id) if user else None,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        activity_type=activity_type,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    await log.insert()
    return log
