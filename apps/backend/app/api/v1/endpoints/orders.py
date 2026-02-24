from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId
import asyncio
import csv
import io
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
    reference: Optional[str] = None
    watch_id: Optional[str] = None
    price: float
    currency: str
    condition: Optional[OrderCondition] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    user_id: str
    user_name: Optional[str] = None
    status: OrderStatus
    has_box: bool = False
    has_papers: bool = False
    notes: Optional[str] = None
    remarks: Optional[str] = None
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
    whatsapp_phone: Optional[str] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None


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
    order_type: Optional[OrderType] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    condition: Optional[OrderCondition] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    has_box: Optional[bool] = None
    has_papers: Optional[bool] = None
    notes: Optional[str] = None
    user_name: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    status: Optional[OrderStatus] = None
    created_at: Optional[datetime] = None
    # Catalog fields
    collection: Optional[str] = None
    oem_references: Optional[List[str]] = None
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: Optional[List[str]] = None
    description: Optional[str] = None
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

class PriceHistoryPoint(BaseModel):
    """A single data point for price chart"""
    date: str  # ISO format date string
    price: float


class PriceHistoryResponse(BaseModel):
    """Price history from real sell orders"""
    reference: str
    points: List[PriceHistoryPoint]
    current_price: float
    price_change: float


@router.get("/price-history/{reference:path}", response_model=PriceHistoryResponse)
async def get_price_history(
    reference: str,
    days: int = Query(default=365, le=730),
) -> Any:
    """
    Get real price history from sell orders for chart display.

    Returns the lowest sell order price per day for the given reference or ws_code,
    covering up to the requested number of days. Includes both active
    and completed orders to show historical pricing.
    """
    import re as re_mod

    # Try ws_code-first lookup for the watch to resolve reference
    ws_regex = re_mod.compile(f"^{re_mod.escape(reference)}$", re_mod.IGNORECASE)
    watch_match = await Watch.find_one({"ws_code": {"$regex": ws_regex}})
    lookup_ref = watch_match.reference if watch_match else reference

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get all sell orders (active + completed) created within the time range
    sell_orders = await Order.find(
        Order.reference == lookup_ref,
        Order.order_type == OrderType.SELL,
        Order.created_at >= cutoff_date,
    ).sort([("created_at", 1)]).to_list()

    # Group by date (day), take the lowest price per day
    daily_prices: dict[str, float] = {}
    for order in sell_orders:
        day_key = order.created_at.strftime("%Y-%m-%d")
        if day_key not in daily_prices or order.price < daily_prices[day_key]:
            daily_prices[day_key] = order.price

    points = [
        PriceHistoryPoint(date=day, price=price)
        for day, price in sorted(daily_prices.items())
    ]

    # Calculate current price (lowest active sell, or last recorded price)
    current_price = 0.0
    lowest_active = await Order.find(
        Order.reference == lookup_ref,
        Order.order_type == OrderType.SELL,
        Order.status == OrderStatus.ACTIVE,
    ).sort([("price", 1)]).limit(1).to_list()

    if lowest_active:
        current_price = lowest_active[0].price
    elif points:
        current_price = points[-1].price

    # Get admin price for price_change calculation
    watch = watch_match or await Watch.find_one(Watch.reference == lookup_ref, Watch.status == WatchStatus.ACTIVE)
    admin_price = watch.price if watch else 0

    price_change = 0.0
    if admin_price and admin_price > 0 and current_price > 0:
        price_change = ((current_price - admin_price) / admin_price) * 100

    return PriceHistoryResponse(
        reference=reference,
        points=points,
        current_price=current_price,
        price_change=price_change,
    )


@router.get("/book/{reference:path}", response_model=OrderBookResponse)
async def get_order_book(
    reference: str,
    limit: int = Query(default=50, le=100),
) -> Any:
    """
    Get order book for a specific watch reference or ws_code.
    Returns both buy and sell orders sorted by price.
    """
    import re as re_mod

    # Try ws_code-first lookup for the watch
    ws_regex = re_mod.compile(f"^{re_mod.escape(reference)}$", re_mod.IGNORECASE)
    watch = await Watch.find_one({"ws_code": {"$regex": ws_regex}})
    if not watch:
        watch = await Watch.find_one(Watch.reference == reference)

    # If watch has a ws_code, filter orders by ws_code for exact variant matching
    # Otherwise fall back to reference-based matching
    if watch and watch.ws_code:
        buy_orders = await Order.find(
            Order.ws_code == watch.ws_code,
            Order.order_type == OrderType.BUY,
            Order.status == OrderStatus.ACTIVE,
        ).sort([("price", -1)]).limit(limit).to_list()

        sell_orders = await Order.find(
            Order.ws_code == watch.ws_code,
            Order.order_type == OrderType.SELL,
            Order.status == OrderStatus.ACTIVE,
        ).sort([("price", 1)]).limit(limit).to_list()
    else:
        lookup_ref = watch.reference if watch else reference
        buy_orders = await Order.find(
            Order.reference == lookup_ref,
            Order.order_type == OrderType.BUY,
            Order.status == OrderStatus.ACTIVE,
        ).sort([("price", -1)]).limit(limit).to_list()

        sell_orders = await Order.find(
            Order.reference == lookup_ref,
            Order.order_type == OrderType.SELL,
            Order.status == OrderStatus.ACTIVE,
        ).sort([("price", 1)]).limit(limit).to_list()
    brand = watch.brand if watch else ""
    model = watch.model if watch else ""

    # Collect all user IDs that need name lookup
    all_orders = buy_orders + sell_orders
    user_ids_needing_names = [o.user_id for o in all_orders if not o.user_name]

    # Fetch user names and whatsapp phones in batch
    user_names_map = {}
    user_whatsapp_map = {}
    if user_ids_needing_names:
        users = await User.find(
            {"_id": {"$in": [PydanticObjectId(uid) for uid in user_ids_needing_names]}}
        ).to_list()
        user_names_map = {str(u.id): u.name for u in users}
        user_whatsapp_map = {str(u.id): u.whatsapp_phone for u in users if u.whatsapp_phone}

    # Format orders for response
    def format_order(order: Order) -> OrderBookEntry:
        # Use order.user_name if available, otherwise lookup from user_names_map
        user_name = order.user_name or user_names_map.get(order.user_id)
        # Prefer order-level whatsapp_phone (set by admin), fall back to user profile
        whatsapp_phone = order.whatsapp_phone or user_whatsapp_map.get(order.user_id)

        # If year_raw is set (e.g., "2022+"), use it directly as date string
        year_raw = getattr(order, 'year_raw', None)
        if year_raw:
            date_str = year_raw
        elif order.year:
            short_year = order.year % 100
            if order.watch_month:
                date_str = f"{order.watch_month:02d}.01.{short_year:02d}"
            else:
                date_str = f"01.01.{short_year:02d}"
        else:
            date_str = order.created_at.strftime("%m.%d.%y")

        # Use condition_raw if available (e.g., "Unworn only"), otherwise use enum value
        condition_raw = getattr(order, 'condition_raw', None)
        condition_str = condition_raw if condition_raw else order.condition.value

        remarks = getattr(order, 'remarks', None)

        return OrderBookEntry(
            id=str(order.id),
            date=date_str,
            condition=condition_str,
            price=order.price,
            currency=order.currency,
            country_code=order.country_code,
            country_name=order.country_name,
            has_box=order.has_box,
            has_papers=order.has_papers,
            user_id=order.user_id,
            user_name=user_name,
            whatsapp_phone=whatsapp_phone,
            remarks=remarks,
            created_at=order.created_at,
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


async def trigger_watch_alerts(order: Order, creator: User):
    """Check WatchAlerts matching this order's ws_code and send notifications"""
    try:
        from app.models.watch_alert import WatchAlert
        from app.services.notifications import send_push_to_user

        ws_code = getattr(order, 'ws_code', None)
        if not ws_code and order.reference:
            watch = await Watch.find_one(Watch.reference == order.reference)
            if watch:
                ws_code = watch.ws_code

        if not ws_code:
            return

        alerts = await WatchAlert.find(
            WatchAlert.ws_code == ws_code,
            WatchAlert.is_active == True,
        ).to_list()

        order_type_str = "WTS" if order.order_type == OrderType.SELL else "WTB"

        for alert in alerts:
            if alert.user_id == str(creator.id):
                continue

            if order.order_type == OrderType.SELL and not alert.notify_wts:
                continue
            if order.order_type == OrderType.BUY and not alert.notify_wtb:
                continue

            if alert.target_year:
                order_year = getattr(order, 'year', None)
                if order_year is None:
                    continue
                year_dir = getattr(alert, 'year_direction', 'exactly')
                if year_dir == "exactly" and order_year != alert.target_year:
                    continue
                if year_dir == "newer" and order_year < alert.target_year:
                    continue
                if year_dir == "older" and order_year > alert.target_year:
                    continue

            if alert.price_threshold and order.price:
                if alert.price_direction == "below" and order.price > alert.price_threshold:
                    continue
                if alert.price_direction == "above" and order.price < alert.price_threshold:
                    continue

            user = await User.get(PydanticObjectId(alert.user_id))
            if not user:
                continue

            title = f"New {order_type_str} for {ws_code}"
            body = f"{order.price} {order.currency}" if order.price else f"New {order_type_str} order"

            notification = Notification(
                user_id=alert.user_id,
                type=NotifType.WATCHLIST_ALERT,
                title=title,
                body=body,
                reference=order.reference,
                order_id=str(order.id),
                price=order.price,
                currency=order.currency or "EUR",
            )
            await notification.insert()

            await send_push_to_user(
                user,
                title=title,
                body=body,
                data={
                    "type": "watch_alert",
                    "ws_code": ws_code,
                    "reference": order.reference or "",
                    "order_id": str(order.id),
                },
            )

    except Exception as e:
        logger.error(f"Error triggering watch alerts: {e}", exc_info=True)


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

    # Update order count on related watch models atomically
    await Watch.find(Watch.reference == order_data.reference).update_many(
        {"$inc": {"order_count": 1}}
    )

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

    asyncio.create_task(trigger_watch_alerts(order, current_user))

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
        remarks=getattr(order, 'remarks', None),
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
    """Get current user's orders with best bid for sell orders"""

    query_conditions = [Order.user_id == str(current_user.id)]

    if order_type:
        query_conditions.append(Order.order_type == order_type)
    if status_filter:
        query_conditions.append(Order.status == status_filter)

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

    # Batch-fetch highest buy order price for each reference using aggregation
    best_bids: dict[str, float] = {}
    if sell_order_references:
        best_bid_pipeline = [
            {"$match": {
                "reference": {"$in": list(sell_order_references)},
                "order_type": OrderType.BUY.value,
                "status": OrderStatus.ACTIVE.value,
            }},
            {"$group": {"_id": "$reference", "max_price": {"$max": "$price"}}},
        ]
        best_bid_raw = await Order.aggregate(best_bid_pipeline).to_list()
        for item in best_bid_raw:
            best_bids[item["_id"]] = item["max_price"]

    # Build response with best_bid and price_change
    result = []
    for order in orders:
        best_bid = None
        if order.order_type == OrderType.SELL and order.reference:
            best_bid = best_bids.get(order.reference)

        result.append(OrderResponse(
            id=str(order.id),
            order_type=order.order_type,
            brand=order.brand or "",
            model=order.model or "",
            reference=order.reference,
            watch_id=order.watch_id,
            price=order.price,
            currency=order.currency or "EUR",
            condition=order.condition,
            country_code=getattr(order, 'country_code', None),
            country_name=getattr(order, 'country_name', None),
            user_id=order.user_id,
            user_name=order.user_name,
            status=order.status,
            has_box=getattr(order, 'has_box', False),
            has_papers=getattr(order, 'has_papers', False),
            notes=order.notes,
            remarks=getattr(order, 'remarks', None),
            cover_image=order.images[0] if order.images else None,
            images=order.images or [],
            created_at=order.created_at,
            updated_at=order.updated_at,
            best_bid=best_bid,
            price_change=price_changes.get(order.reference, 0.0) if order.reference else 0.0,
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
    whatsapp_phone: Optional[str] = None
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
    whatsapp_phone = None

    try:
        user = await User.get(PydanticObjectId(order.user_id))
        if user:
            user_profile_image = user.profile_image_url
            user_rating = user.average_rating
            user_review_count = user.review_count
            whatsapp_phone = user.whatsapp_phone if hasattr(user, 'whatsapp_phone') else None
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

    # Build watch_details from order fields — no fallback values, only actual stored data
    watch_details = WatchDetailsResponse(
        image_url=order.images[0] if order.images else None,
        images=order.images or [],
        # Basic information
        year=order.year,
        size=order.size,
        movement=order.movement,
        case_material=order.case_material,
        bracelet_material=order.bracelet_material,
        case_size=order.case_size if hasattr(order, 'case_size') else None,
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
        whatsapp_phone=whatsapp_phone,
        created_at=order.created_at,
        updated_at=order.updated_at,
        watch_details=watch_details,
        price_change=price_change,
    )


@router.patch("/{order_id}", response_model=OrderDetailResponse)
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

    # Build watch_details from order fields — no fallback values
    watch_details = WatchDetailsResponse(
        image_url=order.images[0] if order.images else None,
        images=order.images or [],
        year=order.year,
        size=order.size,
        movement=order.movement,
        case_material=order.case_material,
        bracelet_material=order.bracelet_material,
        case_size=order.case_size if hasattr(order, 'case_size') else None,
        gender=order.gender,
        availability=order.availability,
        movement_type=order.movement_type,
        caliber=order.caliber,
        base_caliber=order.base_caliber,
        power_reserve=order.power_reserve,
        number_of_jewels=order.number_of_jewels,
        case_diameter=order.case_diameter,
        water_resistance=order.water_resistance,
        bezel_material=order.bezel_material,
        crystal=order.crystal,
        dial=order.dial,
        dial_numerals=order.dial_numerals,
        bracelet_color=order.bracelet_color,
        clasp_type=order.clasp_type,
        clasp_material=order.clasp_material,
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
        user_name=current_user.name,
        user_profile_image=current_user.profile_image_url,
        user_rating=0.0,
        user_review_count=0,
        status=order.status,
        has_box=order.has_box,
        has_papers=order.has_papers,
        notes=order.notes,
        created_at=order.created_at,
        updated_at=order.updated_at,
        watch_details=watch_details,
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

    order.status = OrderStatus.COMPLETED
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

    order.status = OrderStatus.COMPLETED
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
        remarks=getattr(order, 'remarks', None),
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
        remarks=getattr(order, 'remarks', None),
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
            remarks=getattr(order, 'remarks', None),
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

    # Use aggregation instead of loading all orders into memory
    stats_pipeline = [
        {"$facet": {
            "by_status": [{"$group": {"_id": "$status", "count": {"$sum": 1}}}],
            "by_type": [{"$group": {"_id": "$order_type", "count": {"$sum": 1}}}],
            "unique_refs": [{"$group": {"_id": "$reference"}}, {"$count": "count"}],
            "total": [{"$count": "count"}],
        }}
    ]
    result = await Order.aggregate(stats_pipeline).to_list()
    facets = result[0] if result else {"by_status": [], "by_type": [], "unique_refs": [], "total": []}

    status_map = {item["_id"]: item["count"] for item in facets["by_status"]}
    type_map = {item["_id"]: item["count"] for item in facets["by_type"]}
    total = facets["total"][0]["count"] if facets["total"] else 0
    unique_refs = facets["unique_refs"][0]["count"] if facets["unique_refs"] else 0

    stats = {
        "total_orders": total,
        "active_orders": status_map.get(OrderStatus.ACTIVE.value, status_map.get(OrderStatus.ACTIVE, 0)),
        "completed_orders": status_map.get(OrderStatus.COMPLETED.value, status_map.get(OrderStatus.COMPLETED, 0)),
        "buy_orders": type_map.get(OrderType.BUY.value, type_map.get(OrderType.BUY, 0)),
        "sell_orders": type_map.get(OrderType.SELL.value, type_map.get(OrderType.SELL, 0)),
        "unique_references": unique_refs,
    }

    return stats


@router.get("/admin/export-csv")
async def admin_export_orders_csv(
    current_admin: User = Depends(get_current_admin_user),
    reference: Optional[str] = None,
) -> Any:
    """Export orders as CSV (Admin only). Optionally filter by reference."""

    query_conditions = []
    if reference:
        query_conditions.append(Order.reference == reference)

    if query_conditions:
        orders = await Order.find(*query_conditions).sort([("created_at", -1)]).to_list()
    else:
        orders = await Order.find_all().sort([("created_at", -1)]).to_list()

    # Build a map of reference -> Watch for parent watch data
    refs = list(set(o.reference for o in orders if o.reference))
    watch_map = {}
    if refs:
        watches = await Watch.find({"reference": {"$in": refs}, "status": {"$ne": "completed"}}).to_list()
        for w in watches:
            if w.reference and w.reference not in watch_map:
                watch_map[w.reference] = w

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Reference", "Brand", "Model", "Collection", "OEM-References", "Dial",
        "Bracelet", "WS-Code", "Aliases", "Description", "Order Type",
        "Price", "Currency", "Condition", "Country", "User Name",
        "Has Box", "Has Papers", "Notes", "Created At",
    ])

    for order in orders:
        watch = watch_map.get(order.reference)
        writer.writerow([
            order.reference,
            order.brand,
            order.model,
            getattr(watch, "collection", "") or "",
            ", ".join(getattr(watch, "oem_references", []) or []),
            getattr(watch, "dial", "") or "",
            getattr(watch, "bracelet", "") or "",
            getattr(watch, "ws_code", "") or "",
            ", ".join(getattr(watch, "aliases", []) or []),
            getattr(watch, "description", "") or "",
            order.order_type.value.upper(),
            order.price,
            order.currency,
            order.condition.value if order.condition else "",
            order.country_name or order.country_code,
            order.user_name or "",
            "Yes" if order.has_box else "No",
            "Yes" if order.has_papers else "No",
            order.notes or "",
            order.created_at.isoformat() if order.created_at else "",
        ])

    output.seek(0)
    filename = f"orders-{reference}.csv" if reference else "orders-all.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/admin/by-reference/{reference:path}", response_model=List[OrderResponse])
async def admin_get_orders_by_reference(
    reference: str,
    current_admin: User = Depends(get_current_admin_user),
    order_type: Optional[OrderType] = None,
    status_filter: Optional[OrderStatus] = None,
    ws_code: Optional[str] = Query(default=None),
) -> Any:
    """Get all orders for a specific watch reference or ws_code (Admin only)"""

    # If ws_code is provided, filter by ws_code for exact watch variant matching
    if ws_code:
        query_conditions = [Order.ws_code == ws_code]
    else:
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
            remarks=getattr(order, 'remarks', None),
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
    country_code: str = "CH"
    country_name: Optional[str] = None
    has_box: bool = False
    has_papers: bool = False
    notes: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    # Catalog fields
    collection: Optional[str] = None
    oem_references: List[str] = []
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: List[str] = []
    description: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    created_at: Optional[datetime] = None


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

    order_kwargs = dict(
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
        collection=order_data.collection,
        oem_references=order_data.oem_references,
        dial=order_data.dial,
        bracelet=order_data.bracelet,
        ws_code=order_data.ws_code,
        aliases=order_data.aliases,
        description=order_data.description,
        whatsapp_phone=order_data.whatsapp_phone,
    )
    if order_data.created_at:
        order_kwargs["created_at"] = order_data.created_at
    order = Order(**order_kwargs)

    await order.insert()

    # Update order count on related watch models atomically
    await Watch.find(Watch.reference == order_data.reference).update_many(
        {"$inc": {"order_count": 1}}
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
        remarks=getattr(order, 'remarks', None),
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
        remarks=getattr(order, 'remarks', None),
        cover_image=order.images[0] if order.images else None,
        images=order.images or [],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
