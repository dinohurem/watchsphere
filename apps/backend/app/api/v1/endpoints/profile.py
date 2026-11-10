from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
from beanie.operators import In

from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.watchlist import WatchlistRecord, WatchlistItemType
from app.models.watch import Watch, WatchStatus
from app.models.order import Order, OrderType, OrderStatus
from app.core.market_constants import APP_CURRENCIES
from app.services.market_cards import cards_for_ws_codes, stats_for, watches_by_ws_codes, watch_image

router = APIRouter()


# ============== Response Models ==============

class WatchlistItemResponse(BaseModel):
    id: str
    item_type: WatchlistItemType
    brand: str
    model: str
    reference: Optional[str] = None
    ws_code: Optional[str] = None
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
    wts_count: int = 0
    wtb_count: int = 0
    # Card fields (redesign v3 §5; `id` stays the watchlist item id, the watch is `watch_id`)
    watch_id: Optional[str] = None
    collection: Optional[str] = None
    thumbnail: Optional[str] = None
    change_1m_pct: Optional[float] = None
    retail_pct: Optional[float] = None


class WatchlistCreateRequest(BaseModel):
    item_type: WatchlistItemType = WatchlistItemType.WATCHING
    brand: str
    model: str
    reference: Optional[str] = None
    ws_code: Optional[str] = None
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
    notifications_enabled: Optional[bool] = None  # Push notifications
    email_notifications_enabled: Optional[bool] = None  # Email notifications
    notify_alert_matches: Optional[bool] = None  # "WTS & WTB alerts" (redesign v3 P4)
    notify_price_changes: Optional[bool] = None  # Price alerts (legacy builds)
    notify_buy_offers: Optional[bool] = None  # Buy order offers
    notify_messages: Optional[bool] = None  # Chat messages


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    telegram_username: Optional[str] = None
    # One of the 9 app currencies (redesign v3 §0.2)
    preferred_currency: Optional[str] = None


class RecentlyViewedRequest(BaseModel):
    ws_code: str


RECENTLY_VIEWED_MAX = 5


def _profile_payload(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "phone": user.phone,
        "whatsapp_phone": user.whatsapp_phone,
        "telegram_username": user.telegram_username,
        "role": user.role,
        "is_active": user.is_active,
        "verified": user.verified,
        "approved": user.approved,
        "auth_provider": user.auth_provider,
        "preferred_currency": user.preferred_currency,
        "profile_image_url": user.profile_image_url,
        "profile_image_thumbnail_url": user.profile_image_thumbnail_url,
        "notifications_enabled": user.notifications_enabled,
        "email_notifications_enabled": user.email_notifications_enabled,
        "notify_alert_matches": user.notify_alert_matches,
        "notify_price_changes": user.notify_price_changes,
        "notify_buy_offers": user.notify_buy_offers,
        "notify_messages": user.notify_messages,
        "average_rating": user.average_rating,
        "review_count": user.review_count,
        "created_at": user.created_at,
    }


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
async def get_profile(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get current user's profile (also reachable while the account is pending approval)."""
    return _profile_payload(current_user)


@router.get("/user/{user_id}")
async def get_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get another user's public profile"""
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid user ID format"
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,  # May want to hide this for privacy
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "profile_image_url": user.profile_image_url,
        "profile_image_thumbnail_url": user.profile_image_thumbnail_url,
        "average_rating": user.average_rating,
        "review_count": user.review_count,
        "created_at": user.created_at,
    }


@router.patch("/me")
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update current user's profile"""
    update_data = data.model_dump(exclude_unset=True)

    if "preferred_currency" in update_data:
        cur = (update_data["preferred_currency"] or "").strip().upper()
        if cur not in APP_CURRENCIES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"preferred_currency must be one of {', '.join(APP_CURRENCIES)}",
            )
        update_data["preferred_currency"] = cur

    if "whatsapp_phone" in update_data and update_data["whatsapp_phone"]:
        from app.services.phone import normalize_phone

        phone = normalize_phone(update_data["whatsapp_phone"])
        if not phone:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Enter a valid WhatsApp number including the country code",
            )
        clash = await User.find_one(User.whatsapp_phone == phone)
        if clash and str(clash.id) != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this WhatsApp number already exists",
            )
        update_data["whatsapp_phone"] = phone

    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await current_user.set(update_data)

    return _profile_payload(current_user)


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
        "email_notifications_enabled": current_user.email_notifications_enabled,
        "notify_alert_matches": current_user.notify_alert_matches,
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

    # Market data by ws_code only – distinct variants (e.g. 5205R Green vs 5205R Black)
    # must stay separate. No reference fallback.
    ws_codes = [item.ws_code for item in items if item.ws_code]
    watches = await watches_by_ws_codes(ws_codes)
    stats = await stats_for(watches.keys())

    # Lowest active WTS price per ws_code (legacy `price` field for older app builds)
    lowest: Dict[str, float] = {}
    if watches:
        rows = await Order.get_motor_collection().aggregate([
            {"$match": {
                "ws_code": {"$in": list(watches.keys())},
                "order_type": OrderType.SELL.value,
                "status": OrderStatus.ACTIVE.value,
                "price": {"$gt": 0},
            }},
            {"$group": {"_id": "$ws_code", "min_price": {"$min": "$price"}}},
        ]).to_list(length=None)
        lowest = {r["_id"]: r["min_price"] for r in rows}

    def to_payload(item: WatchlistRecord) -> dict:
        watch = watches.get(item.ws_code or "")
        st = stats.get(item.ws_code or "", {})
        image, thumb = watch_image(watch) if watch else (None, None)
        display_price = lowest.get(item.ws_code or "") or (watch.price if watch else None)
        return {
            "id": str(item.id),
            "item_type": item.item_type,
            "brand": item.brand,
            "model": item.model,
            "reference": item.reference,
            "ws_code": item.ws_code,
            "target_price": item.target_price,
            "currency": item.currency,
            "price_alert_enabled": item.price_alert_enabled,
            "notes": item.notes,
            "is_active": item.is_active,
            "created_at": item.created_at,
            "price": display_price or item.target_price or 0,
            "priceChange": (watch.price_change or 0.0) if watch else 0.0,
            "image": image,
            "wts_count": int(st.get("wts_count") or 0),
            "wtb_count": int(st.get("wtb_count") or 0),
            "watch_id": str(watch.id) if watch else None,
            "collection": watch.collection if watch else None,
            "thumbnail": thumb,
            "change_1m_pct": st.get("change_1m_pct"),
            "retail_pct": st.get("retail_pct"),
        }

    return [to_payload(item) for item in items]


# ============== Recently viewed (redesign v3 H1) ==============

@router.post("/recently-viewed")
async def add_recently_viewed(
    data: RecentlyViewedRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Record that the user opened a watch. Keeps the last 5 WS codes, newest first."""
    ws_code = (data.ws_code or "").strip()
    if not ws_code:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="ws_code is required")
    watch = await Watch.find_one(Watch.ws_code == ws_code)
    if not watch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watch not found")

    current = [c for c in (current_user.recently_viewed or []) if c != ws_code]
    updated = ([ws_code] + current)[:RECENTLY_VIEWED_MAX]
    await current_user.set({"recently_viewed": updated, "updated_at": datetime.utcnow()})
    return {"recently_viewed": updated}


@router.get("/recently-viewed")
async def get_recently_viewed(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Cards for the last opened references (max 5, newest first). Empty list for new users."""
    return await cards_for_ws_codes((current_user.recently_viewed or [])[:RECENTLY_VIEWED_MAX])


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
        ws_code=data.ws_code,
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
        "ws_code": item.ws_code,
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
        "ws_code": item.ws_code,
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
        "ws_code": item.ws_code,
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


@router.delete("/watchlist/{item_id:path}")
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

    # If not found by ObjectId, try to find by ws_code first, then reference
    if not item:
        item = await WatchlistRecord.find_one(
            WatchlistRecord.user_id == str(current_user.id),
            WatchlistRecord.ws_code == item_id,
            WatchlistRecord.is_active == True
        )

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
