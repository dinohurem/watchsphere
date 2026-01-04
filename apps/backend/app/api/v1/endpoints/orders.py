from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.watch import Watch, WatchStatus

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
    country_code: str
    country_name: Optional[str] = None
    has_box: bool = False
    has_papers: bool = False
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    price: Optional[float] = None
    condition: Optional[OrderCondition] = None
    has_box: Optional[bool] = None
    has_papers: Optional[bool] = None
    notes: Optional[str] = None
    status: Optional[OrderStatus] = None


# ============== PUBLIC ENDPOINTS ==============

@router.get("/book/{reference}", response_model=OrderBookResponse)
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

    # Format orders for response
    def format_order(order: Order) -> OrderBookEntry:
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
            user_name=order.user_name,
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


@router.get("/market-price/{reference}", response_model=MarketPriceInfo)
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
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order in orders
    ]


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_update: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
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
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
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

    order.status = OrderStatus.CANCELLED
    order.updated_at = datetime.utcnow()
    await order.save()

    return {"message": "Order cancelled successfully"}


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


@router.get("/admin/by-reference/{reference}", response_model=List[OrderResponse])
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
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
        for order in orders
    ]


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
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
