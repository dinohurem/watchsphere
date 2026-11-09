"""
Notification endpoints for user notifications
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, field_serializer
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.notification import Notification, NotificationType

router = APIRouter()


# Response Models
class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    body: str
    reference: Optional[str] = None
    order_id: Optional[str] = None
    conversation_id: Optional[str] = None
    price: Optional[float] = None
    currency: str = "EUR"
    from_user_id: Optional[str] = None
    from_user_name: Optional[str] = None
    from_user_avatar: Optional[str] = None
    is_read: bool = False
    # Redesign v3 §7 (Activity): same flag as is_read, plus the structured payload
    read: bool = False
    ws_code: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    created_at: datetime

    @field_serializer("created_at")
    def _iso_utc(self, v: datetime) -> str:
        # Stored as naive UTC; the explicit "Z" keeps clients from reading it as local time.
        return v.isoformat() + ("Z" if v.tzinfo is None else "")


def _to_response(n: Notification) -> "NotificationResponse":
    return NotificationResponse(
        id=str(n.id),
        type=n.type,
        title=n.title,
        body=n.body,
        reference=n.reference,
        order_id=n.order_id,
        conversation_id=n.conversation_id,
        price=n.price,
        currency=n.currency,
        from_user_id=n.from_user_id,
        from_user_name=n.from_user_name,
        from_user_avatar=n.from_user_avatar,
        is_read=n.is_read,
        read=n.is_read,
        ws_code=n.ws_code,
        data=n.data,
        created_at=n.created_at,
    )


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    count: int


# Endpoints
@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    type: Optional[NotificationType] = Query(default=None),
) -> Any:
    """Get user's notifications, newest first. ``?type=alert_match`` for the Activity tab."""

    base = [Notification.user_id == str(current_user.id)]
    if type is not None:
        base.append(Notification.type == type)

    query_conditions = list(base)
    if unread_only:
        query_conditions.append(Notification.is_read == False)

    total = await Notification.find(*query_conditions).count()
    unread_count = await Notification.find(*base, Notification.is_read == False).count()

    notifications = await Notification.find(
        *query_conditions
    ).sort([("created_at", -1)]).skip(offset).limit(limit).to_list()

    return NotificationListResponse(
        notifications=[_to_response(n) for n in notifications],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    type: Optional[NotificationType] = Query(default=None),
) -> Any:
    """Count of unread notifications (``?type=alert_match`` for the Activity badge)."""
    conds = [Notification.user_id == str(current_user.id), Notification.is_read == False]
    if type is not None:
        conds.append(Notification.type == type)
    count = await Notification.find(*conds).count()

    return UnreadCountResponse(count=count)


@router.post("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    type: Optional[NotificationType] = Query(default=None),
) -> Any:
    """Mark all (optionally only ``?type=``) notifications as read."""
    conds = [Notification.user_id == str(current_user.id), Notification.is_read == False]
    if type is not None:
        conds.append(Notification.type == type)
    result = await Notification.find(*conds).update_many(
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )

    return {"success": True, "updated_count": result.modified_count if result else 0}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Mark a notification as read"""
    try:
        notification = await Notification.get(PydanticObjectId(notification_id))
    except Exception:
        notification = None

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    if notification.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this notification"
        )

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await notification.save()

    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Delete a notification"""
    notification = await Notification.get(PydanticObjectId(notification_id))

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    if notification.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this notification"
        )

    await notification.delete()

    return {"success": True}
