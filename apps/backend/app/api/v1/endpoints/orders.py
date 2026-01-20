from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import asyncio
import logging
import random

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.watch import Watch, WatchStatus
from app.api.v1.endpoints.activity import log_activity
from app.models.activity_log import ActivityType, EntityType
from app.models.notification import Notification, NotificationType as NotifType
from app.services.email import email_service
from app.services.notifications import notify_buy_offer, send_notification_to_multiple
from app.services.broadcast import broadcast_service

logger = logging.getLogger(__name__)


def generate_price_history_from_change(base_price: float, price_change: float, points: int = 20) -> List[float]:
    """
    Generate a synthetic price history that reflects the given price change.
    The graph will show an upward or downward trend based on the price_change percentage.
    """
    if not base_price or base_price <= 0:
        return []

    # Calculate start price based on price change
    if price_change != 0:
        start_price = base_price / (1 + price_change / 100)
    else:
        start_price = base_price

    # Generate points with some realistic variation
    history = []
    for i in range(points):
        progress = i / (points - 1) if points > 1 else 1
        interpolated_price = start_price + (base_price - start_price) * progress
        variation = random.uniform(-0.02, 0.02) * interpolated_price
        price_point = interpolated_price + variation
        history.append(round(price_point, 2))

    if history:
        history[-1] = base_price

    return history

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
    # For sell orders: highest buy order price for same reference
    best_bid: Optional[float] = None
    # Price change percentage from watch model
    price_change: Optional[float] = None


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
    # Basic information
    year: Optional[int] = None
    size: Optional[str] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    case_size: Optional[str] = None
    gender: Optional[str] = None
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
    clasp: Optional[str] = None  # Alias for clasp_type for backwards compatibility


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
    # Year is required for all orders (buy and sell)
    year: int  # Required field
    size: Optional[str] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    availability: Optional[str] = None
    gender: Optional[str] = None
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
    gender: Optional[str] = None
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
    1. Show lowest price from all active sell orders (lowest ask)
    2. If no orders, show admin's set price from the watch model

    Price change is calculated based on sell orders only (lowest ask price vs admin base price).
    """
    # Get all active SELL orders for this reference (not buy orders)
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

    # Display price: lowest sell order price, or admin price if no sell orders
    display_price = lowest_price if lowest_price else (admin_price if admin_price else 0)

    # Get price history from watch model (for chart display)
    price_history = watch.price_history if watch else []

    # Calculate price_change based on SELL orders only
    # Compare lowest sell order (lowest ask) to admin base price
    price_change = 0.0
    if admin_price and admin_price > 0:
        if lowest_price:
            # Price change = (current lowest ask - base price) / base price * 100
            price_change = ((lowest_price - admin_price) / admin_price) * 100
        else:
            # No sell orders - no change from base
            price_change = 0.0
    elif watch and watch.price_change:
        # Fallback to stored price_change if no admin price to compare
        price_change = watch.price_change

    # Generate price history that matches the calculated price_change
    generated_history = generate_price_history_from_change(display_price, price_change)

    return MarketPriceInfo(
        reference=reference,
        brand=watch.brand if watch else "",
        model=watch.model if watch else "",
        lowest_price=lowest_price,
        highest_price=highest_price,
        admin_price=admin_price,
        display_price=display_price,
        total_orders=len(sell_orders),
        price_history=generated_history if generated_history else price_history,
        price_change=price_change,
    )


# ============== USER ENDPOINTS ==============

async def notify_sellers_of_buy_order(
    order: Order,
    buyer: User,
):
    """
    Background task to notify sellers when a buy order is placed.
    Finds all active sell orders for the same reference and notifies those sellers.
    """
    try:
        logger.info(f"notify_sellers_of_buy_order called for order {order.id}, reference: {order.reference}, buyer: {buyer.id}")

        # Find all active sell orders for the same reference (excluding buyer's own)
        sell_orders = await Order.find(
            Order.reference == order.reference,
            Order.order_type == OrderType.SELL,
            Order.status == OrderStatus.ACTIVE,
            Order.user_id != str(buyer.id),
        ).to_list()

        logger.info(f"Query conditions: reference={order.reference}, type=SELL, status=ACTIVE, user_id!={buyer.id}")
        logger.info(f"Found {len(sell_orders)} matching sell orders")

        if not sell_orders:
            logger.info(f"No active sell orders found for reference {order.reference}")
            return

        # Get unique seller IDs
        seller_ids = list(set([o.user_id for o in sell_orders]))
        logger.info(f"Found {len(seller_ids)} sellers to notify for buy order on {order.reference}")

        # Fetch all sellers
        sellers = await User.find(
            {"_id": {"$in": [PydanticObjectId(sid) for sid in seller_ids]}}
        ).to_list()

        for seller in sellers:
            # Check if user has notifications enabled for buy offers
            if not seller.notifications_enabled or not seller.notify_buy_offers:
                logger.info(f"Skipping notification for seller {seller.id} - notifications disabled")
                continue

            # Create notification in database
            notification = Notification(
                user_id=str(seller.id),
                type=NotifType.NEW_OFFER,
                title="New offer",
                body=f"{buyer.name} placed a buy order for {order.reference} at {order.currency} {order.price:,.0f}",
                reference=order.reference,
                order_id=str(order.id),
                price=order.price,
                currency=order.currency,
                from_user_id=str(buyer.id),
                from_user_name=buyer.name,
                from_user_avatar=buyer.profile_image_url,
            )
            await notification.insert()

            # Broadcast real-time notification via WebSocket/Socket.IO
            try:
                await broadcast_service.broadcast_notification(
                    user_id=str(seller.id),
                    notification_data={
                        "id": str(notification.id),
                        "type": notification.type.value,
                        "title": notification.title,
                        "body": notification.body,
                        "reference": notification.reference,
                        "orderId": str(order.id),
                        "price": notification.price,
                        "currency": notification.currency,
                        "fromUserId": str(buyer.id),
                        "fromUserName": buyer.name,
                        "fromUserAvatar": buyer.profile_image_url,
                        "createdAt": notification.created_at.isoformat(),
                    }
                )
            except Exception as e:
                logger.error(f"Failed to broadcast notification to {seller.id}: {e}")

            # Send push notification if user has FCM tokens
            if seller.fcm_tokens:
                for token in seller.fcm_tokens:
                    try:
                        await notify_buy_offer(
                            token=token,
                            listing_title=f"{order.brand} {order.model}",
                            offer_amount=order.price,
                            buyer_name=buyer.name,
                            currency=order.currency,
                            listing_id=order.reference,
                            offer_id=str(order.id),
                        )
                    except Exception as e:
                        logger.error(f"Failed to send push notification to {seller.id}: {e}")

            # Send email notification if email notifications enabled
            if seller.email_notifications_enabled:
                try:
                    await email_service.send_buy_order_received_email(
                        to_email=seller.email,
                        seller_name=seller.name,
                        buyer_name=buyer.name,
                        watch_brand=order.brand,
                        watch_model=order.model,
                        watch_reference=order.reference,
                        offer_price=order.price,
                        currency=order.currency,
                        order_id=str(order.id),
                    )
                except Exception as e:
                    logger.error(f"Failed to send email notification to {seller.email}: {e}")

        logger.info(f"Successfully notified {len(sellers)} sellers about buy order {order.id}")

    except Exception as e:
        logger.error(f"Error in notify_sellers_of_buy_order: {e}", exc_info=True)


async def notify_buyers_of_sell_order(
    order: Order,
    seller: User,
):
    """
    Background task to notify buyers when a sell order is placed.
    Finds all active buy orders for the same reference where the buyer's bid is >= the sell price
    (i.e., the buyer could immediately buy at or above their desired price).
    """
    try:
        logger.info(f"notify_buyers_of_sell_order called for order {order.id}, reference: {order.reference}, price: {order.price}")

        # Find all active buy orders for the same reference where bid >= sell price (excluding seller's own)
        buy_orders = await Order.find(
            Order.reference == order.reference,
            Order.order_type == OrderType.BUY,
            Order.status == OrderStatus.ACTIVE,
            Order.user_id != str(seller.id),
            Order.price >= order.price,  # Buyer is willing to pay at least the sell price
        ).to_list()

        logger.info(f"Found {len(buy_orders)} buy orders at or above sell price {order.price}")

        if not buy_orders:
            return

        # Get unique buyer IDs
        buyer_ids = list(set(o.user_id for o in buy_orders))
        buyers = await User.find({"_id": {"$in": [PydanticObjectId(uid) for uid in buyer_ids]}}).to_list()
        logger.info(f"Found {len(buyers)} unique buyers to notify")

        for buyer in buyers:
            # Get the buyer's highest bid for this reference
            buyer_order = next((o for o in buy_orders if o.user_id == str(buyer.id)), None)
            if not buyer_order:
                continue

            # Check if user has notifications enabled for price changes (new listings affect their bids)
            if not buyer.notifications_enabled or not buyer.notify_price_changes:
                logger.info(f"Skipping notification for buyer {buyer.id} - notifications disabled")
                continue

            # Create in-app notification
            notification = Notification(
                user_id=str(buyer.id),
                type=NotifType.BUY_ORDER_OFFER,
                title="New listing available",
                body=f"{seller.name} listed {order.brand} {order.model} at {order.currency} {order.price:,.0f}",
                reference=order.reference,
                order_id=str(order.id),
                from_user_id=str(seller.id),
                from_user_name=seller.name,
                from_user_avatar=seller.profile_image_url,
                price=order.price,
                currency=order.currency,
            )
            await notification.insert()
            logger.info(f"Created notification for buyer {buyer.id}: {notification.id}")

            # Broadcast real-time WebSocket notification
            await broadcast_service.broadcast_notification(
                user_id=str(buyer.id),
                notification_data={
                    "id": str(notification.id),
                    "type": "new_listing",
                    "title": notification.title,
                    "body": notification.body,
                    "reference": notification.reference,
                    "orderId": str(order.id),
                    "fromUserId": str(seller.id),
                    "fromUserName": seller.name,
                    "fromUserAvatar": seller.profile_image_url,
                    "price": order.price,
                    "currency": order.currency,
                    "createdAt": notification.created_at.isoformat(),
                }
            )

            # Send email notification if email notifications enabled
            if buyer.email_notifications_enabled:
                try:
                    await email_service.send_new_listing_notification(
                        to_email=buyer.email,
                        buyer_name=buyer.name,
                        seller_name=seller.name,
                        watch_brand=order.brand,
                        watch_model=order.model,
                        watch_reference=order.reference,
                        listing_price=order.price,
                        buyer_bid_price=buyer_order.price,
                        currency=order.currency,
                        order_id=str(order.id),
                    )
                    logger.info(f"Sent email notification to buyer {buyer.email}")
                except Exception as e:
                    logger.error(f"Failed to send email notification to {buyer.email}: {e}")

        logger.info(f"Successfully notified {len(buyers)} buyers about sell order {order.id}")

    except Exception as e:
        logger.error(f"Error in notify_buyers_of_sell_order: {e}", exc_info=True)


async def notify_sellers_of_lower_price(
    order: Order,
    seller: User,
):
    """
    Background task to notify existing sellers when a new sell order is placed at a lower price.
    Finds all active sell orders for the same reference with higher prices and notifies those sellers.
    """
    try:
        logger.info(f"notify_sellers_of_lower_price called for order {order.id}, reference: {order.reference}, price: {order.price}")

        # Find all active sell orders for the same reference with price higher than this order (excluding this seller)
        higher_priced_orders = await Order.find(
            Order.reference == order.reference,
            Order.order_type == OrderType.SELL,
            Order.status == OrderStatus.ACTIVE,
            Order.user_id != str(seller.id),
            Order.price > order.price,  # Only notify sellers with higher prices
        ).to_list()

        logger.info(f"Found {len(higher_priced_orders)} sell orders priced higher than {order.price}")

        if not higher_priced_orders:
            return

        # Get unique seller IDs
        seller_ids = list(set(o.user_id for o in higher_priced_orders))
        sellers = await User.find({"_id": {"$in": [PydanticObjectId(uid) for uid in seller_ids]}}).to_list()
        logger.info(f"Found {len(sellers)} unique sellers to notify")

        for other_seller in sellers:
            # Get this seller's order to know their price
            seller_order = next((o for o in higher_priced_orders if o.user_id == str(other_seller.id)), None)
            if not seller_order:
                continue

            # Check if user has notifications enabled for price changes
            if not other_seller.notifications_enabled or not other_seller.notify_price_changes:
                logger.info(f"Skipping notification for seller {other_seller.id} - notifications disabled")
                continue

            price_diff = seller_order.price - order.price

            # Create in-app notification
            notification = Notification(
                user_id=str(other_seller.id),
                type=NotifType.PRICE_UNDERCUT,
                title="Lower price listing",
                body=f"A new listing for {order.brand} {order.model} was posted at {order.currency} {order.price:,.0f} (€{price_diff:,.0f} below your price)",
                reference=order.reference,
                order_id=str(order.id),
                from_user_id=str(seller.id),
                from_user_name=seller.name,
                from_user_avatar=seller.profile_image_url,
                price=order.price,
                currency=order.currency,
            )
            await notification.insert()
            logger.info(f"Created price undercut notification for seller {other_seller.id}: {notification.id}")

            # Broadcast real-time WebSocket notification
            await broadcast_service.broadcast_notification(
                user_id=str(other_seller.id),
                notification_data={
                    "id": str(notification.id),
                    "type": "price_undercut",
                    "title": notification.title,
                    "body": notification.body,
                    "reference": notification.reference,
                    "orderId": str(order.id),
                    "fromUserId": str(seller.id),
                    "fromUserName": seller.name,
                    "fromUserAvatar": seller.profile_image_url,
                    "price": order.price,
                    "currency": order.currency,
                    "createdAt": notification.created_at.isoformat(),
                }
            )

        logger.info(f"Successfully notified {len(sellers)} sellers about lower price listing {order.id}")

    except Exception as e:
        logger.error(f"Error in notify_sellers_of_lower_price: {e}", exc_info=True)


@router.post("", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    background_tasks: BackgroundTasks,
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

    # If this is a BUY order, notify sellers with active sell orders for same reference
    if order_data.order_type == OrderType.BUY:
        # Run notification in background to not block the response
        asyncio.create_task(notify_sellers_of_buy_order(order, current_user))

    # If this is a SELL order, notify buyers with active buy orders at or above this price
    # and notify other sellers if this price is lower than theirs
    if order_data.order_type == OrderType.SELL:
        # Run notifications in background to not block the response
        asyncio.create_task(notify_buyers_of_sell_order(order, current_user))
        asyncio.create_task(notify_sellers_of_lower_price(order, current_user))

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
    include_cancelled: bool = False,
) -> Any:
    """Get current user's orders with best bid for sell orders"""

    query_conditions = [Order.user_id == str(current_user.id)]

    if order_type:
        query_conditions.append(Order.order_type == order_type)
    if status_filter:
        query_conditions.append(Order.status == status_filter)
    elif not include_cancelled:
        # By default, exclude cancelled orders unless explicitly requested
        query_conditions.append(Order.status != OrderStatus.CANCELLED)

    orders = await Order.find(*query_conditions).sort([("created_at", -1)]).to_list()

    # Get unique references to fetch best bids and price changes
    all_references = set(
        order.reference for order in orders
        if order.reference
    )

    # Fetch price changes from Watch models
    price_changes: dict[str, float] = {}
    if all_references:
        watches = await Watch.find(
            {"reference": {"$in": list(all_references)}}
        ).to_list()
        for watch in watches:
            price_changes[watch.reference] = watch.price_change or 0.0

    # Get unique references for sell orders to fetch best bids
    sell_order_references = set(
        order.reference for order in orders
        if order.order_type == OrderType.SELL and order.reference
    )

    # Fetch highest buy order price for each reference
    best_bids: dict[str, float] = {}
    for reference in sell_order_references:
        # Find highest priced active buy order for this reference
        highest_buy = await Order.find(
            Order.reference == reference,
            Order.order_type == OrderType.BUY,
            Order.status == OrderStatus.ACTIVE
        ).sort([("price", -1)]).limit(1).to_list()

        if highest_buy:
            best_bids[reference] = highest_buy[0].price

    # Build response with best_bid and price_change
    result = []
    for order in orders:
        best_bid = None
        if order.order_type == OrderType.SELL and order.reference:
            best_bid = best_bids.get(order.reference)

        result.append(OrderResponse(
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
            best_bid=best_bid,
            price_change=price_changes.get(order.reference, 0.0),
        ))

    return result


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
    price_change: Optional[float] = None


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

    # Fetch price_change from Watch model
    price_change = 0.0
    if order.reference:
        watch = await Watch.find_one(Watch.reference == order.reference)
        if watch:
            price_change = watch.price_change or 0.0

    # Build watch_details from order fields - include ALL extended fields
    watch_details = WatchDetailsResponse(
        image_url=order.images[0] if order.images else None,
        images=order.images or [],
        # Basic information
        year=order.year,
        size=order.size,
        movement=order.movement or order.movement_type,
        case_material=order.case_material,
        bracelet_material=order.bracelet_material,
        case_size=order.size or order.case_diameter,
        gender=order.gender,
        availability=order.availability,
        # Caliber information
        movement_type=order.movement_type,
        caliber=order.caliber,
        base_caliber=order.base_caliber,
        power_reserve=order.power_reserve,
        number_of_jewels=order.number_of_jewels,
        # Case information
        case_diameter=order.case_diameter,
        water_resistance=order.water_resistance,
        bezel_material=order.bezel_material,
        crystal=order.crystal,
        dial=order.dial,
        dial_numerals=order.dial_numerals,
        # Bracelet/strap information
        bracelet_color=order.bracelet_color,
        clasp_type=order.clasp_type,
        clasp_material=order.clasp_material,
        clasp=order.clasp_type,  # Alias for backwards compatibility
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
        price_change=price_change,
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


@router.post("/{order_id}/mark-completed", response_model=OrderResponse)
async def mark_order_as_completed(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    x_platform: Optional[str] = Header(None),
) -> Any:
    """Mark own buy order as completed (removes from order book)"""

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

    if order.order_type != OrderType.BUY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only buy orders can be marked as completed"
        )

    order.status = OrderStatus.COMPLETED
    order.updated_at = datetime.utcnow()
    await order.save()

    # Log activity
    platform = x_platform or "web"
    await log_activity(
        activity_type=ActivityType.ORDER_COMPLETED,
        description=f"{current_user.name} marked buy order for {order.brand} {order.model} as completed",
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
