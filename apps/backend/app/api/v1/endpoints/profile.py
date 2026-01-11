from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.watchlist import WatchlistRecord, WatchlistItemType

router = APIRouter()


# ============== Response Models ==============

class WatchlistItemResponse(BaseModel):
    id: str
    item_type: WatchlistItemType
    brand: str
    model: str
    reference: Optional[str] = None
    target_price: Optional[float] = None
    currency: str = "USD"
    price_alert_enabled: bool = False
    notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    # Frontend display fields
    price: Optional[float] = None  # Alias for target_price
    priceChange: float = 0.0  # Placeholder - will be calculated from market data
    image: Optional[str] = None  # Watch image URL


class WatchlistCreateRequest(BaseModel):
    item_type: WatchlistItemType = WatchlistItemType.WATCHING
    brand: str
    model: str
    reference: Optional[str] = None
    target_price: Optional[float] = None
    currency: str = "USD"
    price_alert_enabled: bool = False
    notes: Optional[str] = None


class WatchlistUpdateRequest(BaseModel):
    item_type: Optional[WatchlistItemType] = None
    target_price: Optional[float] = None
    currency: Optional[str] = None
    price_alert_enabled: Optional[bool] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ============== User Profile Endpoints ==============

class FCMTokenRequest(BaseModel):
    token: str


class NotificationPreferencesRequest(BaseModel):
    notifications_enabled: Optional[bool] = None
    notify_price_changes: Optional[bool] = None
    notify_buy_offers: Optional[bool] = None
    notify_messages: Optional[bool] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    telegram_username: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
async def get_profile(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user's profile"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "phone": current_user.phone,
        "whatsapp_phone": current_user.whatsapp_phone,
        "telegram_username": current_user.telegram_username,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "verified": current_user.verified,
        "profile_image_url": current_user.profile_image_url,
        "profile_image_thumbnail_url": current_user.profile_image_thumbnail_url,
        "notifications_enabled": current_user.notifications_enabled,
        "notify_price_changes": current_user.notify_price_changes,
        "notify_buy_offers": current_user.notify_buy_offers,
        "notify_messages": current_user.notify_messages,
        "created_at": current_user.created_at,
    }


@router.patch("/me")
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update current user's profile"""
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await current_user.set(update_data)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "verified": current_user.verified,
        "profile_image_url": current_user.profile_image_url,
        "profile_image_thumbnail_url": current_user.profile_image_thumbnail_url,
    }


@router.post("/change-password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Change user's password"""
    from app.core.security import verify_password, get_password_hash

    # Verify current password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Update password
    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.updated_at = datetime.utcnow()
    await current_user.save()

    return {"message": "Password changed successfully"}


@router.post("/fcm-token")
async def register_fcm_token(
    data: FCMTokenRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Register FCM token for push notifications"""
    if data.token not in current_user.fcm_tokens:
        current_user.fcm_tokens.append(data.token)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()

    return {"message": "FCM token registered successfully"}


@router.delete("/fcm-token")
async def unregister_fcm_token(
    data: FCMTokenRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Unregister FCM token (e.g., on logout)"""
    if data.token in current_user.fcm_tokens:
        current_user.fcm_tokens.remove(data.token)
        current_user.updated_at = datetime.utcnow()
        await current_user.save()

    return {"message": "FCM token unregistered successfully"}


@router.patch("/notification-preferences")
async def update_notification_preferences(
    data: NotificationPreferencesRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update notification preferences"""
    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await current_user.set(update_data)

    return {
        "notifications_enabled": current_user.notifications_enabled,
        "notify_price_changes": current_user.notify_price_changes,
        "notify_buy_offers": current_user.notify_buy_offers,
        "notify_messages": current_user.notify_messages,
    }


# ============== User Watchlist Endpoints ==============

@router.get("/watchlist", response_model=List[WatchlistItemResponse])
async def get_my_watchlist(
    current_user: User = Depends(get_current_active_user),
    item_type: Optional[WatchlistItemType] = None,
    active_only: bool = True,
) -> Any:
    """Get current user's watchlist"""

    query_conditions = [WatchlistRecord.user_id == str(current_user.id)]

    if item_type:
        query_conditions.append(WatchlistRecord.item_type == item_type)

    if active_only:
        query_conditions.append(WatchlistRecord.is_active == True)

    items = await WatchlistRecord.find(*query_conditions).sort([("created_at", -1)]).to_list()

    return [
        {
            "id": str(item.id),
            "item_type": item.item_type,
            "brand": item.brand,
            "model": item.model,
            "reference": item.reference,
            "target_price": item.target_price,
            "currency": item.currency,
            "price_alert_enabled": item.price_alert_enabled,
            "notes": item.notes,
            "is_active": item.is_active,
            "created_at": item.created_at,
            # Frontend display fields
            "price": item.target_price or 0,
            "priceChange": 0.0,  # TODO: Calculate from market data
            "image": None,  # TODO: Get from market data
        }
        for item in items
    ]


@router.post("/watchlist", response_model=WatchlistItemResponse)
async def add_to_watchlist(
    data: WatchlistCreateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Add a watch to current user's watchlist"""

    item = WatchlistRecord(
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        item_type=data.item_type,
        brand=data.brand,
        model=data.model,
        reference=data.reference,
        target_price=data.target_price,
        currency=data.currency,
        price_alert_enabled=data.price_alert_enabled,
        notes=data.notes,
        is_active=True,
        created_at=datetime.utcnow(),
    )

    await item.insert()

    return {
        "id": str(item.id),
        "item_type": item.item_type,
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "target_price": item.target_price,
        "currency": item.currency,
        "price_alert_enabled": item.price_alert_enabled,
        "notes": item.notes,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "price": item.target_price or 0,
        "priceChange": 0.0,
        "image": None,
    }


@router.get("/watchlist/{item_id}", response_model=WatchlistItemResponse)
async def get_watchlist_item(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get a specific watchlist item"""

    item = await WatchlistRecord.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found"
        )

    if item.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this item"
        )

    return {
        "id": str(item.id),
        "item_type": item.item_type,
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "target_price": item.target_price,
        "currency": item.currency,
        "price_alert_enabled": item.price_alert_enabled,
        "notes": item.notes,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "price": item.target_price or 0,
        "priceChange": 0.0,
        "image": None,
    }


@router.patch("/watchlist/{item_id}", response_model=WatchlistItemResponse)
async def update_watchlist_item(
    item_id: str,
    data: WatchlistUpdateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update a watchlist item"""

    item = await WatchlistRecord.get(PydanticObjectId(item_id))

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found"
        )

    if item.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this item"
        )

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await item.set(update_data)

    return {
        "id": str(item.id),
        "item_type": item.item_type,
        "brand": item.brand,
        "model": item.model,
        "reference": item.reference,
        "target_price": item.target_price,
        "currency": item.currency,
        "price_alert_enabled": item.price_alert_enabled,
        "notes": item.notes,
        "is_active": item.is_active,
        "created_at": item.created_at,
        "price": item.target_price or 0,
        "priceChange": 0.0,
        "image": None,
    }


@router.delete("/watchlist/{item_id}")
async def remove_from_watchlist(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Remove a watch from watchlist by item_id or reference"""

    item = None

    # First try to find by ObjectId
    try:
        item = await WatchlistRecord.get(PydanticObjectId(item_id))
    except Exception:
        # If not a valid ObjectId, try finding by reference
        pass

    # If not found by ObjectId, try to find by reference
    if not item:
        item = await WatchlistRecord.find_one(
            WatchlistRecord.user_id == str(current_user.id),
            WatchlistRecord.reference == item_id,
            WatchlistRecord.is_active == True
        )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found"
        )

    if item.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this item"
        )

    await item.delete()

    return {"message": "Item removed from watchlist"}


@router.post("/deactivate")
async def deactivate_account(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Deactivate current user's account"""
    current_user.is_active = False
    current_user.updated_at = datetime.utcnow()
    await current_user.save()

    return {"message": "Account deactivated successfully"}
