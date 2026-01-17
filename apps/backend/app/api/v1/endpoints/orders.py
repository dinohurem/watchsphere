from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.watch import Watch, WatchStatus
from app.api.v1.endpoints.activity import log_activity
from app.models.activity_log import ActivityType, EntityType

router = APIRouter()


# Response Models
class OrderResponse(BaseModel):
    id: str
    order_type: OrderType
    brand: str
    model: str
    reference: str
    watch_id: Optional[str] = None
    price: float
    currency: str
    condition: OrderCondition
    country_code: str
    country_name: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    status: OrderStatus
    has_box: bool
    has_papers: bool
    notes: Optional[str] = None
    cover_image: Optional[str] = None
    images: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None


class OrderBookEntry(BaseModel):
    """Entry for order book display"""
    id: str
    date: str  # Formatted date MM.DD.YY
    condition: str  # "Used" or "Unworn"
    price: float
    currency: str
    country_code: str
    country_name: Optional[str] = None
    has_box: bool
    has_papers: bool
    user_id: str
    user_name: Optional[str] = None


class OrderBookResponse(BaseModel):
    """Complete order book for a watch reference"""
    reference: str
    brand: str
    model: str
    buy_orders: List[OrderBookEntry]
    sell_orders: List[OrderBookEntry]
    lowest_ask: Optional[float] = None
    highest_bid: Optional[float] = None
    spread: Optional[float] = None


class MarketPriceInfo(BaseModel):
    """Market price information for a watch reference"""
    reference: str
    brand: str
    model: str
    lowest_price: Optional[float] = None
    highest_price: Optional[float] = None
    admin_price: Optional[float] = None
    display_price: float  # The price to show (lowest or admin)
    total_orders: int
    price_history: List[float]
    price_change: float


# Watch details sub-model for order detail response
class WatchDetailsResponse(BaseModel):
    image_url: Optional[str] = None
    images: list[str] = []
    year: Optional[int] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    case_size: Optional[str] = None
    water_resistance: Optional[str] = None
    caliber: Optional[str] = None
    power_reserve: Optional[str] = None
    number_of_jewels: Optional[int] = None
    crystal: Optional[str] = None
    dial: Optional[str] = None
    bezel_material: Optional[str] = None
    clasp: Optional[str] = None


# Request Models
class OrderCreate(BaseModel):
    order_type: OrderType
    brand: str
    model: str
    reference: str
    watch_id: Optional[str] = None
    price: float
    currency: str = "EUR"
    condition: OrderCondition = OrderCondition.UNWORN
    country_code: str = "US"
    country_name: Optional[str] = None
    has_box: bool = False
    has_papers: bool = False
    notes: Optional[str] = None
    # Images (for sell orders)
    images: list[str] = []
    # Extended watch details (for sell listings)
    year: Optional[int] = None
    size: Optional[str] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    availability: Optional[str] = None
    # Caliber information
    movement_type: Optional[str] = None
    caliber: Optional[str] = None
    base_caliber: Optional[str] = None
    power_reserve: Optional[str] = None
    number_of_jewels: Optional[int] = None
    # Case information
    case_diameter: Optional[str] = None
    water_resistance: Optional[str] = None
    bezel_material: Optional[str] = None
    crystal: Optional[str] = None
    dial: Optional[str] = None
    dial_numerals: Optional[str] = None
    # Bracelet/strap information
    bracelet_color: Optional[str] = None
    clasp_type: Optional[str] = None
    clasp_material: Optional[str] = None


class OrderUpdate(BaseModel):
    price: Optional[float] = None
    condition: Optional[OrderCondition] = None
    has_box: Optional[bool] = None
    has_papers: Optional[bool] = None
    notes: Optional[str] = None
    status: Optional[OrderStatus] = None
    # Extended watch details (for sell listings)
    images: Optional[list[str]] = None
    year: Optional[int] = None
    size: Optional[str] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    availability: Optional[str] = None
    # Caliber information
    movement_type: Optional[str] = None
    caliber: Optional[str] = None
    base_caliber: Optional[str] = None
    power_reserve: Optional[str] = None
    number_of_jewels: Optional[int] = None
    # Case information
    case_diameter: Optional[str] = None
    water_resistance: Optional[str] = None
    bezel_material: Optional[str] = None
    crystal: Optional[str] = None
    dial: Optional[str] = None
    dial_numerals: Optional[str] = None
    # Bracelet/strap information
    bracelet_color: Optional[str] = None
    clasp_type: Optional[str] = None
    clasp_material: Optional[str] = None


# ============== PUBLIC ENDPOINTS ==============

@router.get("/book/{reference:path}", response_model=OrderBookResponse)
async def get_order_book(
    reference: str,
    limit: int = Query(default=50, le=100),
) -> Any:
    """
    Get order book for a specific watch reference.
    Returns both buy and sell orders sorted by price.
    """
    # Get all active orders for this reference
    buy_orders = await Order.find(
        Order.reference == reference,
        Order.order_type == OrderType.BUY,
        Order.status == OrderStatus.ACTIVE,
    ).sort([("price", -1)]).limit(limit).to_list()  # Highest bids first

    sell_orders = await Order.find(
        Order.reference == reference,
        Order.order_type == OrderType.SELL,
        Order.status == OrderStatus.ACTIVE,
    ).sort([("price", 1)]).limit(limit).to_list()  # Lowest asks first

    # Get watch info for brand/model
    watch = await Watch.find_one(Watch.reference == reference)
    brand = watch.brand if watch else ""
    model = watch.model if watch else ""

    # Collect all user IDs that need name lookup
    all_orders = buy_orders + sell_orders
    user_ids_needing_names = [o.user_id for o in all_orders if not o.user_name]

    # Fetch user names in batch
    user_names_map = {}
    if user_ids_needing_names:
        users = await User.find(
            {"_id": {"$in": [PydanticObjectId(uid) for uid in user_ids_needing_names]}}
        ).to_list()
        user_names_map = {str(u.id): u.name for u in users}

    # Format orders for response
    def format_order(order: Order) -> OrderBookEntry:
        # Use order.user_name if available, otherwise lookup from user_names_map
        user_name = order.user_name or user_names_map.get(order.user_id)
        return OrderBookEntry(
            id=str(order.id),
            date=order.created_at.strftime("%m.%d.%y"),
            condition=order.condition.value,
            price=order.price,
            currency=order.currency,
            country_code=order.country_code,
            country_name=order.country_name,
            has_box=order.has_box,
            has_papers=order.has_papers,
            user_id=order.user_id,
            user_name=user_name,
        )

    formatted_buy = [format_order(o) for o in buy_orders]
    formatted_sell = [format_order(o) for o in sell_orders]

    # Calculate spread
    lowest_ask = sell_orders[0].price if sell_orders else None
    highest_bid = buy_orders[0].price if buy_orders else None
    spread = None
    if lowest_ask and highest_bid:
        spread = lowest_ask - highest_bid

    return OrderBookResponse(
        reference=reference,
        brand=brand,
        model=model,
        buy_orders=formatted_buy,
        sell_orders=formatted_sell,
        lowest_ask=lowest_ask,
        highest_bid=highest_bid,
        spread=spread,
    )


@router.get("/market-price/{reference:path}", response_model=MarketPriceInfo)
async def get_market_price(reference: str) -> Any:
    """
    Get market price for a specific watch reference.

    Price logic:
    1. Show lowest price from all active sell orders
    2. If no orders, show admin's set price from the watch model
    """
    # Get all active sell orders for this reference
    sell_orders = await Order.find(
        Order.reference == reference,
        Order.order_type == OrderType.SELL,
        Order.status == OrderStatus.ACTIVE,
    ).sort([("price", 1)]).to_list()

    # Get admin's watch data for this reference
    watch = await Watch.find_one(
        Watch.reference == reference,
        Watch.status == WatchStatus.ACTIVE,
    )

    lowest_price = sell_orders[0].price if sell_orders else None
    highest_price = sell_orders[-1].price if sell_orders else None
    admin_price = watch.price if watch else None

    # Display price: lowest order price, or admin price if no orders
    display_price = lowest_price if lowest_price else (admin_price if admin_price else 0)

    # Get price history and change from watch model
    price_history = watch.price_history if watch else []
    price_change = watch.price_change if watch else 0.0

    return MarketPriceInfo(
        reference=reference,
        brand=watch.brand if watch else "",
        model=watch.model if watch else "",
        lowest_price=lowest_price,
        highest_price=highest_price,
        admin_price=admin_price,
        display_price=display_price,
        total_orders=len(sell_orders),
        price_history=price_history,
        price_change=price_change,
    )


# ============== USER ENDPOINTS ==============

@router.post("", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None, alias="X-Platform"),
) -> Any:
    """Create a new buy/sell order"""

    order = Order(
        order_type=order_data.order_type,
        brand=order_data.brand,
        model=order_data.model,
        reference=order_data.reference,
        watch_id=order_data.watch_id,
        price=order_data.price,
        currency=order_data.currency,
        condition=order_data.condition,
        country_code=order_data.country_code,
        country_name=order_data.country_name,
        user_id=str(current_user.id),
        user_name=current_user.name,
        user_email=current_user.email,
        has_box=order_data.has_box,
        has_papers=order_data.has_papers,
        notes=order_data.notes,
        # Images
        images=order_data.images,
        # Extended watch details
        year=order_data.year,
        size=order_data.size,
        movement=order_data.movement,
        case_material=order_data.case_material,
        bracelet_material=order_data.bracelet_material,
        availability=order_data.availability,
        # Caliber information
        movement_type=order_data.movement_type,
        caliber=order_data.caliber,
        base_caliber=order_data.base_caliber,
        power_reserve=order_data.power_reserve,
        number_of_jewels=order_data.number_of_jewels,
        # Case information
        case_diameter=order_data.case_diameter,
        water_resistance=order_data.water_resistance,
        bezel_material=order_data.bezel_material,
        crystal=order_data.crystal,
        dial=order_data.dial,
        dial_numerals=order_data.dial_numerals,
        # Bracelet/strap information
        bracelet_color=order_data.bracelet_color,
        clasp_type=order_data.clasp_type,
        clasp_material=order_data.clasp_material,
    )

    await order.insert()

    # Update order count on related watch models
    watches = await Watch.find(Watch.reference == order_data.reference).to_list()
    for watch in watches:
        watch.order_count += 1
        await watch.save()

    # Log activity
    platform = x_platform or "web"
    activity_type = ActivityType.BUY_ORDER_PLACED if order_data.order_type == OrderType.BUY else ActivityType.SELL_ORDER_PLACED
    await log_activity(
        activity_type=activity_type,
        description=f"{current_user.name} placed a {order_data.order_type.value} order for {order_data.brand} {order_data.model} at {order_data.price} {order_data.currency}",
        user=current_user,
        entity_type=EntityType.ORDER,
        entity_id=str(order.id),
        metadata={
            "order_type": order_data.order_type.value,
            "brand": order_data.brand,
            "model": order_data.model,
            "reference": order_data.reference,
            "price": order_data.price,
            "currency": order_data.currency,
            "platform": platform,
        },
        platform=platform,
    )

    return OrderResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=order.user_name,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("/my-orders", response_model=List[OrderResponse])
async def get_my_orders(
    current_user: User = Depends(get_current_active_user),
    order_type: Optional[OrderType] = None,
    status_filter: Optional[OrderStatus] = None,
) -> Any:
    """Get current user's orders"""

    query_conditions = [Order.user_id == str(current_user.id)]

    if order_type:
        query_conditions.append(Order.order_type == order_type)
    if status_filter:
        query_conditions.append(Order.status == status_filter)

    orders = await Order.find(*query_conditions).sort([("created_at", -1)]).to_list()

    return [
        OrderResponse(
            id=str(order.id),
            order_type=order.order_type,
            brand=order.brand,
            model=order.model,
            reference=order.reference,
            watch_id=order.watch_id,
            price=order.price,
            currency=order.currency,
            condition=order.condition,
            country_code=order.country_code,
            country_name=order.country_name,
            user_id=order.user_id,
            user_name=order.user_name,
            status=order.status,
            has_box=order.has_box,
            has_papers=order.has_papers,
            notes=order.notes,
            cover_image=order.images[0] if order.images else None,
            images=order.images or [],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order in orders
    ]


class OrderDetailResponse(BaseModel):
    """Detailed order response with user rating info"""
    id: str
    order_type: OrderType
    brand: str
    model: str
    reference: str
    watch_id: Optional[str] = None
    price: float
    currency: str
    condition: OrderCondition
    country_code: str
    country_name: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    user_profile_image: Optional[str] = None
    user_rating: float = 0.0
    user_review_count: int = 0
    status: OrderStatus
    has_box: bool
    has_papers: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    watch_details: Optional[WatchDetailsResponse] = None


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_order(
    order_id: str,
) -> Any:
    """Get a single order by ID (public)"""
    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get user info for rating and name
    user_profile_image = None
    user_rating = 0.0
    user_review_count = 0
    user_name = order.user_name  # Try from order first

    try:
        user = await User.get(PydanticObjectId(order.user_id))
        if user:
            user_profile_image = user.profile_image_url
            user_rating = user.average_rating
            user_review_count = user.review_count
            # If user_name not stored in order, get from user profile
            if not user_name:
                user_name = user.name
    except Exception:
        pass

    # Build watch_details from order fields
    watch_details = WatchDetailsResponse(
        image_url=order.images[0] if order.images else None,
        images=order.images or [],
        year=order.year,
        movement=order.movement or order.movement_type,
        case_material=order.case_material,
        bracelet_material=order.bracelet_material,
        case_size=order.size or order.case_diameter,
        water_resistance=order.water_resistance,
        caliber=order.caliber,
        power_reserve=order.power_reserve,
        number_of_jewels=order.number_of_jewels,
        crystal=order.crystal,
        dial=order.dial,
        bezel_material=order.bezel_material,
        clasp=order.clasp_type,
    )

    return OrderDetailResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=user_name,
        user_profile_image=user_profile_image,
        user_rating=user_rating,
        user_review_count=user_review_count,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        created_at=order.created_at,
        updated_at=order.updated_at,
        watch_details=watch_details,
    )


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_update: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None),
) -> Any:
    """Update own order"""

    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this order"
        )

    # Update fields if provided
    update_data = order_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    order.updated_at = datetime.utcnow()
    await order.save()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.WATCH_UPDATED,
        description=f"{current_user.name} updated their {order.order_type.value} order for {order.brand} {order.model}",
        user=current_user,
        entity_type=EntityType.ORDER,
        entity_id=str(order.id),
        platform=platform,
        metadata={
            "order_type": order.order_type.value,
            "brand": order.brand,
            "model": order.model,
            "reference": order.reference,
            "price": order.price,
            "updated_fields": list(update_data.keys()),
        }
    )

    return OrderResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=order.user_name,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None),
) -> Any:
    """Cancel own order"""

    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this order"
        )

    # Store order details for logging before changing status
    order_type = order.order_type.value
    brand = order.brand
    model = order.model
    reference = order.reference
    price = order.price

    order.status = OrderStatus.CANCELLED
    order.updated_at = datetime.utcnow()
    await order.save()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.ORDER_CANCELLED,
        description=f"{current_user.name} cancelled their {order_type} order for {brand} {model}",
        user=current_user,
        entity_type=EntityType.ORDER,
        entity_id=str(order.id),
        platform=platform,
        metadata={
            "order_type": order_type,
            "brand": brand,
            "model": model,
            "reference": reference,
            "price": price,
        }
    )

    return {"message": "Order cancelled successfully"}


@router.post("/{order_id}/mark-sold", response_model=OrderResponse)
async def mark_order_as_sold(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None),
) -> Any:
    """Mark own sell order as sold (removes from inventory)"""

    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this order"
        )

    if order.order_type != OrderType.SELL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only sell orders can be marked as sold"
        )

    order.status = OrderStatus.SOLD
    order.updated_at = datetime.utcnow()
    await order.save()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.WATCH_SOLD,
        description=f"{current_user.name} marked {order.brand} {order.model} as sold for {order.price} {order.currency}",
        user=current_user,
        entity_type=EntityType.ORDER,
        entity_id=str(order.id),
        platform=platform,
        metadata={
            "order_type": order.order_type.value,
            "brand": order.brand,
            "model": order.model,
            "reference": order.reference,
            "price": order.price,
            "currency": order.currency,
        }
    )

    return OrderResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=order.user_name,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/all", response_model=List[OrderResponse])
async def admin_list_all_orders(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    order_type: Optional[OrderType] = None,
    status_filter: Optional[OrderStatus] = None,
    reference: Optional[str] = None,
) -> Any:
    """List all orders (Admin only)"""

    query_conditions = []

    if order_type:
        query_conditions.append(Order.order_type == order_type)
    if status_filter:
        query_conditions.append(Order.status == status_filter)
    if reference:
        query_conditions.append(Order.reference == reference)

    if query_conditions:
        orders = await Order.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        orders = await Order.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        OrderResponse(
            id=str(order.id),
            order_type=order.order_type,
            brand=order.brand,
            model=order.model,
            reference=order.reference,
            watch_id=order.watch_id,
            price=order.price,
            currency=order.currency,
            condition=order.condition,
            country_code=order.country_code,
            country_name=order.country_name,
            user_id=order.user_id,
            user_name=order.user_name,
            status=order.status,
            has_box=order.has_box,
            has_papers=order.has_papers,
            notes=order.notes,
            cover_image=order.images[0] if order.images else None,
            images=order.images or [],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order in orders
    ]


@router.delete("/admin/{order_id}")
async def admin_delete_order(
    order_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete an order (Admin only)"""

    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    await order.delete()

    return {"message": "Order deleted successfully"}


@router.get("/admin/stats")
async def admin_order_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get order statistics (Admin only)"""

    all_orders = await Order.find_all().to_list()

    stats = {
        "total_orders": len(all_orders),
        "active_orders": len([o for o in all_orders if o.status == OrderStatus.ACTIVE]),
        "completed_orders": len([o for o in all_orders if o.status == OrderStatus.COMPLETED]),
        "cancelled_orders": len([o for o in all_orders if o.status == OrderStatus.CANCELLED]),
        "buy_orders": len([o for o in all_orders if o.order_type == OrderType.BUY]),
        "sell_orders": len([o for o in all_orders if o.order_type == OrderType.SELL]),
        "unique_references": len(set(o.reference for o in all_orders)),
    }

    return stats


@router.get("/admin/by-reference/{reference:path}", response_model=List[OrderResponse])
async def admin_get_orders_by_reference(
    reference: str,
    current_admin: User = Depends(get_current_admin_user),
    order_type: Optional[OrderType] = None,
    status_filter: Optional[OrderStatus] = None,
) -> Any:
    """Get all orders for a specific watch reference (Admin only)"""

    query_conditions = [Order.reference == reference]

    if order_type:
        query_conditions.append(Order.order_type == order_type)
    if status_filter:
        query_conditions.append(Order.status == status_filter)

    orders = await Order.find(*query_conditions).sort([("created_at", -1)]).to_list()

    return [
        OrderResponse(
            id=str(order.id),
            order_type=order.order_type,
            brand=order.brand,
            model=order.model,
            reference=order.reference,
            watch_id=order.watch_id,
            price=order.price,
            currency=order.currency,
            condition=order.condition,
            country_code=order.country_code,
            country_name=order.country_name,
            user_id=order.user_id,
            user_name=order.user_name,
            status=order.status,
            has_box=order.has_box,
            has_papers=order.has_papers,
            notes=order.notes,
            cover_image=order.images[0] if order.images else None,
            images=order.images or [],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order in orders
    ]


class AdminOrderCreate(BaseModel):
    order_type: OrderType
    brand: str
    model: str
    reference: str
    watch_id: Optional[str] = None
    price: float
    currency: str = "EUR"
    condition: OrderCondition = OrderCondition.UNWORN
    country_code: str
    country_name: Optional[str] = None
    has_box: bool = False
    has_papers: bool = False
    notes: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None


@router.post("/admin/create", response_model=OrderResponse)
async def admin_create_order(
    order_data: AdminOrderCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create an order as admin (Admin only)"""

    # If no user specified, use admin as the user
    user_id = order_data.user_id or str(current_admin.id)
    user_name = order_data.user_name or current_admin.name
    user_email = current_admin.email if not order_data.user_id else None

    # If user_id provided, try to get user's email
    if order_data.user_id:
        try:
            user = await User.get(PydanticObjectId(order_data.user_id))
            if user:
                user_email = user.email
                if not order_data.user_name:
                    user_name = user.name
        except Exception:
            pass

    order = Order(
        order_type=order_data.order_type,
        brand=order_data.brand,
        model=order_data.model,
        reference=order_data.reference,
        watch_id=order_data.watch_id,
        price=order_data.price,
        currency=order_data.currency,
        condition=order_data.condition,
        country_code=order_data.country_code,
        country_name=order_data.country_name,
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        has_box=order_data.has_box,
        has_papers=order_data.has_papers,
        notes=order_data.notes,
    )

    await order.insert()

    # Update order count on related watch models
    watches = await Watch.find(Watch.reference == order_data.reference).to_list()
    for watch in watches:
        watch.order_count += 1
        await watch.save()

    return OrderResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=order.user_name,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.patch("/admin/{order_id}", response_model=OrderResponse)
async def admin_update_order(
    order_id: str,
    order_update: OrderUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update any order (Admin only)"""

    order = await Order.get(PydanticObjectId(order_id))

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Update fields if provided
    update_data = order_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    order.updated_at = datetime.utcnow()
    await order.save()

    return OrderResponse(
        id=str(order.id),
        order_type=order.order_type,
        brand=order.brand,
        model=order.model,
        reference=order.reference,
        watch_id=order.watch_id,
        price=order.price,
        currency=order.currency,
        condition=order.condition,
        country_code=order.country_code,
        country_name=order.country_name,
        user_id=order.user_id,
        user_name=order.user_name,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
