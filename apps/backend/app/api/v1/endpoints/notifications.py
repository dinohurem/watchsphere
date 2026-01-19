"""
Notification endpoints for user notifications
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
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
    created_at: datetime


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
) -> Any:
    """Get user's notifications"""

    query_conditions = [Notification.user_id == str(current_user.id)]

    if unread_only:
        query_conditions.append(Notification.is_read == False)

    # Get total count
    total = await Notification.find(*query_conditions).count()

    # Get unread count
    unread_count = await Notification.find(
        Notification.user_id == str(current_user.id),
        Notification.is_read == False
    ).count()

    # Get notifications
    notifications = await Notification.find(
        *query_conditions
    ).sort([("created_at", -1)]).skip(offset).limit(limit).to_list()

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
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
                created_at=n.created_at,
            )
            for n in notifications
        ],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get count of unread notifications"""
    count = await Notification.find(
        Notification.user_id == str(current_user.id),
        Notification.is_read == False
    ).count()

    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Mark a notification as read"""
    notification = await Notification.get(PydanticObjectId(notification_id))

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


@router.post("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Mark all notifications as read"""
    result = await Notification.find(
        Notification.user_id == str(current_user.id),
        Notification.is_read == False
    ).update_many({"$set": {"is_read": True, "read_at": datetime.utcnow()}})

    return {"success": True, "updated_count": result.modified_count if result else 0}


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
