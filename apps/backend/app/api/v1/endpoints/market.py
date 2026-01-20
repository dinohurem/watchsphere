from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId
import random

from app.core.deps import get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.watch import Watch, WatchCondition, WatchStatus
from app.models.order import Order, OrderType, OrderStatus, OrderCondition


def generate_price_history_from_change(base_price: float, price_change: float, points: int = 20) -> List[float]:
    """
    Generate a synthetic price history that reflects the given price change.
    The graph will show an upward or downward trend based on the price_change percentage.
    """
    if not base_price or base_price <= 0:
        return []

    # Calculate start price based on price change
    # If price_change is +5%, start price was base_price / 1.05
    # If price_change is -5%, start price was base_price / 0.95
    if price_change != 0:
        start_price = base_price / (1 + price_change / 100)
    else:
        start_price = base_price

    # Generate points with some realistic variation
    history = []
    for i in range(points):
        # Linear interpolation from start to current price
        progress = i / (points - 1) if points > 1 else 1
        interpolated_price = start_price + (base_price - start_price) * progress

        # Add small random variation (±2% of price)
        variation = random.uniform(-0.02, 0.02) * interpolated_price
        price_point = interpolated_price + variation

        history.append(round(price_point, 2))

    # Ensure the last point is close to the current price
    if history:
        history[-1] = base_price

    return history


# Map WatchCondition to OrderCondition
def map_watch_to_order_condition(watch_condition: WatchCondition) -> OrderCondition:
    """Map watch condition to order condition (Unworn vs Used)"""
    if watch_condition in [WatchCondition.NEW, WatchCondition.NOS]:
        return OrderCondition.UNWORN
    return OrderCondition.USED

router = APIRouter()


# Response Models
class WatchResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    cover_image: Optional[str] = None
    status: WatchStatus
    featured: bool
    trending: bool = False
    order_count: int = 0
    price_change: float = 0.0
    price_history: List[float] = []
    dealer_id: str
    dealer_name: Optional[str] = None
    views: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MarketWatchResponse(BaseModel):
    """Response model for market/trending watches"""
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    cover_image: Optional[str] = None
    trending: bool = False
    order_count: int = 0
    price_change: float = 0.0
    price_history: List[float] = []


class WatchListResponse(BaseModel):
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str
    condition: WatchCondition
    cover_image: Optional[str] = None
    status: WatchStatus
    featured: bool
    dealer_name: Optional[str] = None
    created_at: datetime


# Request Models
class WatchCreate(BaseModel):
    brand: str
    model: str
    reference: Optional[str] = None
    price: float
    currency: str = "USD"
    condition: WatchCondition
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    cover_image: Optional[str] = None
    status: WatchStatus = WatchStatus.DRAFT
    featured: bool = False
    dealer_id: Optional[str] = None  # Admin can assign to any dealer


class WatchUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    condition: Optional[WatchCondition] = None
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    cover_image: Optional[str] = None
    status: Optional[WatchStatus] = None
    featured: Optional[bool] = None
    trending: Optional[bool] = None
    order_count: Optional[int] = None
    price_change: Optional[float] = None
    price_history: Optional[List[float]] = None


# ============== PUBLIC ENDPOINTS ==============

# NOTE: Route order matters in FastAPI! More specific routes must come before parameterized routes.
# The /watches endpoint must be defined before /{watch_id} to avoid "watches" being matched as a watch_id.

@router.get("/watches", response_model=List[MarketWatchResponse])
async def get_market_watches(
    category: str = Query(default="hot"),
    limit: int = Query(default=20, le=100),
) -> Any:
    """
    Get watches for market display with category filtering.

    Categories:
    - hot: Most active (by order_count)
    - gainers: Positive price change
    - losers: Negative price change
    - new: Recently added
    - trending: Admin-flagged or high order count
    """

    # Start with active watches
    base_query = Watch.status == WatchStatus.ACTIVE

    if category == "hot":
        # Sort by order count (most active)
        watches = await Watch.find(base_query).sort([("order_count", -1)]).limit(limit).to_list()

    elif category == "gainers":
        # Positive price change, sorted by change amount
        watches = await Watch.find(
            base_query,
            Watch.price_change > 0
        ).sort([("price_change", -1)]).limit(limit).to_list()

    elif category == "losers":
        # Negative price change, sorted by change amount (most negative first)
        watches = await Watch.find(
            base_query,
            Watch.price_change < 0
        ).sort([("price_change", 1)]).limit(limit).to_list()

    elif category == "new":
        # Recently published
        watches = await Watch.find(base_query).sort([("published_at", -1)]).limit(limit).to_list()

    elif category == "trending":
        # Trending flagged or high order count
        watches = await Watch.find(
            base_query,
            {"$or": [
                {"trending": True},
                {"order_count": {"$gt": 0}}
            ]}
        ).sort([("trending", -1), ("order_count", -1)]).limit(limit).to_list()

    else:
        # Default: all active, sorted by created_at
        watches = await Watch.find(base_query).sort([("created_at", -1)]).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "cover_image": watch.cover_image,
            "trending": watch.trending,
            "order_count": watch.order_count,
            "price_change": watch.price_change,
            "price_history": watch.price_history,
        }
        for watch in watches
    ]


@router.get("", response_model=List[WatchListResponse])
async def list_watches(
    skip: int = 0,
    limit: int = 50,
    brand: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[WatchCondition] = None,
    search: Optional[str] = None,
) -> Any:
    """List all active watches (public)"""

    # Build query - only show active watches publicly
    query_conditions = [Watch.status == WatchStatus.ACTIVE]

    if brand:
        query_conditions.append(Watch.brand == brand)
    if min_price is not None:
        query_conditions.append(Watch.price >= min_price)
    if max_price is not None:
        query_conditions.append(Watch.price <= max_price)
    if condition:
        query_conditions.append(Watch.condition == condition)

    # Execute query
    watches_query = Watch.find(*query_conditions)

    # Apply text search if provided (search in brand, model, description)
    if search:
        # For now, use regex-based search
        # In production, consider MongoDB text indexes
        watches_query = Watch.find(
            *query_conditions,
            {
                "$or": [
                    {"brand": {"$regex": search, "$options": "i"}},
                    {"model": {"$regex": search, "$options": "i"}},
                    {"reference": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}},
                ]
            }
        )

    # Sort by featured first, then by created_at
    watches = await watches_query.sort([("featured", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition,
            "cover_image": watch.cover_image,
            "status": watch.status,
            "featured": watch.featured,
            "dealer_name": watch.dealer_name,
            "created_at": watch.created_at,
        }
        for watch in watches
    ]


@router.get("/brands", response_model=List[str])
async def list_brands() -> Any:
    """Get list of all watch brands with active listings"""

    # Get distinct brands from active watches
    watches = await Watch.find(Watch.status == WatchStatus.ACTIVE).to_list()
    brands = list(set(watch.brand for watch in watches))
    brands.sort()

    return brands


# ============== FEATURED/TRENDING ENDPOINTS ==============
# NOTE: These must be defined BEFORE /{watch_id} to avoid route conflicts

@router.get("/trending", response_model=List[MarketWatchResponse])
async def get_trending_watches(
    limit: int = Query(default=5, le=10),
) -> Any:
    """
    Get trending watches for market display.

    Trending logic:
    1. Watches with trending=True (admin-flagged) are prioritized
    2. Then sorted by order_count (total sell/buy orders)
    3. Maximum of 5 trending watches
    """

    # First, get admin-flagged trending watches
    trending_watches = await Watch.find(
        Watch.status == WatchStatus.ACTIVE,
        Watch.trending == True
    ).sort([("order_count", -1)]).limit(limit).to_list()

    # If we don't have enough trending watches, fill with most active by order count
    if len(trending_watches) < limit:
        remaining = limit - len(trending_watches)
        trending_ids = [w.id for w in trending_watches]

        # Get watches with highest order counts that aren't already in trending
        additional_watches = await Watch.find(
            Watch.status == WatchStatus.ACTIVE,
            {"_id": {"$nin": trending_ids}}
        ).sort([("order_count", -1)]).limit(remaining).to_list()

        trending_watches.extend(additional_watches)

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "cover_image": watch.cover_image,
            "trending": watch.trending,
            "order_count": watch.order_count,
            "price_change": watch.price_change,
            "price_history": watch.price_history,
        }
        for watch in trending_watches
    ]


@router.get("/featured", response_model=List[MarketWatchResponse])
async def get_featured_watches(
    limit: int = Query(default=5, le=10),
) -> Any:
    """
    Get featured watches for market display.

    Priority logic:
    1. Admin-assigned featured watches (featured=True) are prioritized
    2. If not enough, fill with watches sorted by order_count (most orders first)
    3. If still not enough, fill with watches sorted by views (most views first)
    4. Maximum of 5 watches returned
    """
    featured_watches = []
    seen_ids = set()

    # Step 1: Get admin-assigned featured watches
    admin_featured = await Watch.find(
        Watch.status == WatchStatus.ACTIVE,
        Watch.featured == True
    ).sort([("order_count", -1)]).limit(limit).to_list()

    for watch in admin_featured:
        if watch.id not in seen_ids:
            featured_watches.append(watch)
            seen_ids.add(watch.id)

    # Step 2: If not enough, fill with watches by order_count
    if len(featured_watches) < limit:
        remaining = limit - len(featured_watches)
        by_orders = await Watch.find(
            Watch.status == WatchStatus.ACTIVE,
            {"_id": {"$nin": list(seen_ids)}}
        ).sort([("order_count", -1)]).limit(remaining).to_list()

        for watch in by_orders:
            if watch.id not in seen_ids:
                featured_watches.append(watch)
                seen_ids.add(watch.id)

    # Step 3: If still not enough, fill with watches by views
    if len(featured_watches) < limit:
        remaining = limit - len(featured_watches)
        by_views = await Watch.find(
            Watch.status == WatchStatus.ACTIVE,
            {"_id": {"$nin": list(seen_ids)}}
        ).sort([("views", -1)]).limit(remaining).to_list()

        for watch in by_views:
            if watch.id not in seen_ids:
                featured_watches.append(watch)
                seen_ids.add(watch.id)

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "cover_image": watch.cover_image,
            "trending": watch.trending,
            "order_count": watch.order_count,
            "price_change": watch.price_change,
            "price_history": watch.price_history,
        }
        for watch in featured_watches
    ]


# ============== AGGREGATED MARKET DATA ENDPOINTS ==============
# NOTE: These must be defined BEFORE /{watch_id} to avoid route conflicts

class AggregatedWatchResponse(BaseModel):
    """Aggregated market data for a watch reference (combines listings with orders)"""
    reference: str
    brand: str
    model: str
    cover_image: Optional[str] = None
    # Price is the lowest from active sell orders, or admin price if no orders
    display_price: float
    lowest_order_price: Optional[float] = None
    admin_price: Optional[float] = None
    currency: str = "EUR"
    # Price change from 1-month trend
    price_change: float = 0.0
    price_history: List[float] = []
    # Order counts for trending
    total_orders: int = 0
    trending: bool = False


@router.get("/aggregated", response_model=List[AggregatedWatchResponse])
async def get_aggregated_market_data(
    category: str = Query(default="hot"),
    limit: int = Query(default=20, le=100),
) -> Any:
    """
    Get aggregated market data with proper pricing logic.

    Price calculation:
    1. Always show the lowest price from active sell orders for the same reference
    2. If no sell orders exist, show admin's set price

    Categories:
    - hot: Most active (by order_count)
    - gainers: Positive price change
    - losers: Negative price change
    - new: Recently added
    - trending: Admin-flagged or high order count
    """

    try:
        # Get all active watches
        base_query = Watch.status == WatchStatus.ACTIVE

        if category == "hot":
            watches = await Watch.find(base_query).sort([("order_count", -1)]).limit(limit).to_list()
        elif category == "gainers":
            watches = await Watch.find(base_query, Watch.price_change > 0).sort([("price_change", -1)]).limit(limit).to_list()
        elif category == "losers":
            watches = await Watch.find(base_query, Watch.price_change < 0).sort([("price_change", 1)]).limit(limit).to_list()
        elif category == "new":
            watches = await Watch.find(base_query).sort([("published_at", -1)]).limit(limit).to_list()
        elif category == "trending":
            watches = await Watch.find(
                base_query,
                {"$or": [{"trending": True}, {"order_count": {"$gt": 0}}]}
            ).sort([("trending", -1), ("order_count", -1)]).limit(limit).to_list()
        else:
            watches = await Watch.find(base_query).sort([("created_at", -1)]).limit(limit).to_list()

        # Return empty list if no watches
        if not watches:
            return []

        # Get unique references (only non-empty ones)
        references = list(set(w.reference for w in watches if w.reference))

        # Get lowest sell order prices for each reference
        lowest_prices_by_ref = {}
        order_counts_by_ref = {}

        for ref in references:
            try:
                # Get lowest active sell order price
                sell_orders = await Order.find(
                    Order.reference == ref,
                    Order.order_type == OrderType.SELL,
                    Order.status == OrderStatus.ACTIVE,
                ).sort([("price", 1)]).limit(1).to_list()

                if sell_orders:
                    lowest_prices_by_ref[ref] = sell_orders[0].price

                # Get total order count
                order_count = await Order.find(
                    Order.reference == ref,
                    Order.status == OrderStatus.ACTIVE,
                ).count()
                order_counts_by_ref[ref] = order_count
            except Exception:
                # If order lookup fails, just continue without order data
                pass

        # Build response with proper pricing
        result = []
        seen_refs = set()

        for watch in watches:
            # Include watches without reference too (use id as fallback)
            ref_key = watch.reference or str(watch.id)

            # Skip duplicates (group by reference)
            if ref_key in seen_refs:
                continue
            seen_refs.add(ref_key)

            lowest_order_price = lowest_prices_by_ref.get(watch.reference) if watch.reference else None
            admin_price = watch.price
            display_price = lowest_order_price if lowest_order_price else admin_price

            # Calculate price_change based on SELL orders (lowest ask) vs admin base price
            price_change = 0.0
            if admin_price and admin_price > 0:
                if lowest_order_price:
                    # Price change = (current lowest ask - base price) / base price * 100
                    price_change = ((lowest_order_price - admin_price) / admin_price) * 100
                else:
                    # No sell orders - use stored price_change or 0
                    price_change = watch.price_change or 0.0
            else:
                # Fallback to stored price_change
                price_change = watch.price_change or 0.0

            # Generate price history that matches the calculated price_change
            # This ensures the graph trend matches the displayed percentage
            generated_history = generate_price_history_from_change(display_price, price_change)

            result.append(AggregatedWatchResponse(
                reference=watch.reference or str(watch.id),
                brand=watch.brand,
                model=watch.model,
                cover_image=watch.cover_image,
                display_price=display_price,
                lowest_order_price=lowest_order_price,
                admin_price=admin_price,
                currency=watch.currency,
                price_change=price_change,
                price_history=generated_history if generated_history else (watch.price_history or []),
                total_orders=order_counts_by_ref.get(watch.reference, 0) + (watch.order_count or 0),
                trending=watch.trending or False,
            ))

        return result
    except Exception as e:
        # Log the error for debugging
        import logging
        logging.error(f"Error in get_aggregated_market_data: {str(e)}")
        # Return empty list instead of 500 error
        return []


@router.get("/aggregated/{reference:path}")
async def get_aggregated_watch_by_reference(reference: str) -> Any:
    """
    Get aggregated market data for a specific watch reference.

    Returns combined data from watch model and active orders.
    """

    # Get the watch model
    watch = await Watch.find_one(
        Watch.reference == reference,
        Watch.status == WatchStatus.ACTIVE,
    )

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Get lowest active sell order price
    sell_orders = await Order.find(
        Order.reference == reference,
        Order.order_type == OrderType.SELL,
        Order.status == OrderStatus.ACTIVE,
    ).sort([("price", 1)]).limit(1).to_list()

    lowest_order_price = sell_orders[0].price if sell_orders else None
    display_price = lowest_order_price if lowest_order_price else watch.price

    # Get total order count
    order_count = await Order.find(
        Order.reference == reference,
        Order.status == OrderStatus.ACTIVE,
    ).count()

    # Calculate price_change based on SELL orders (lowest ask) vs admin base price
    price_change = 0.0
    admin_price = watch.price
    if admin_price and admin_price > 0:
        if lowest_order_price:
            # Price change = (current lowest ask - base price) / base price * 100
            price_change = ((lowest_order_price - admin_price) / admin_price) * 100
        else:
            # No sell orders - use stored price_change or 0
            price_change = watch.price_change or 0.0
    else:
        # Fallback to stored price_change
        price_change = watch.price_change or 0.0

    # Generate price history that matches the calculated price_change
    generated_history = generate_price_history_from_change(display_price, price_change)

    return AggregatedWatchResponse(
        reference=watch.reference,
        brand=watch.brand,
        model=watch.model,
        cover_image=watch.cover_image,
        display_price=display_price,
        lowest_order_price=lowest_order_price,
        admin_price=watch.price,
        currency=watch.currency,
        price_change=price_change,
        price_history=generated_history if generated_history else (watch.price_history or []),
        total_orders=order_count + watch.order_count,
        trending=watch.trending,
    )


@router.get("/{watch_id:path}", response_model=WatchResponse)
async def get_watch(watch_id: str) -> Any:
    """Get watch by ID or reference (public - only active watches)

    Note: Using :path parameter type to handle references containing slashes (e.g., 5711/1A-010)
    """

    watch = None

    # First try to find by reference (e.g., "5167R-001")
    watch = await Watch.find_one(Watch.reference == watch_id, Watch.status == WatchStatus.ACTIVE)

    # If not found by reference, try by MongoDB ID
    if not watch:
        try:
            watch = await Watch.get(PydanticObjectId(watch_id))
        except Exception:
            # Invalid ObjectId format, that's fine
            pass

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Only show active watches publicly
    if watch.status != WatchStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Increment view count
    watch.views += 1
    await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/all", response_model=List[WatchResponse])
async def admin_list_all_watches(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[WatchStatus] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
) -> Any:
    """List all watches including drafts (Admin only)"""

    query_conditions = []

    if status_filter:
        query_conditions.append(Watch.status == status_filter)
    if brand:
        query_conditions.append(Watch.brand == brand)
    if dealer_id:
        query_conditions.append(Watch.dealer_id == dealer_id)

    if query_conditions:
        watches = await Watch.find(*query_conditions).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    else:
        watches = await Watch.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition,
            "year": watch.year,
            "serial_number": watch.serial_number,
            "description": watch.description,
            "images": watch.images,
            "cover_image": watch.cover_image,
            "status": watch.status,
            "featured": watch.featured,
            "dealer_id": watch.dealer_id,
            "dealer_name": watch.dealer_name,
            "views": watch.views,
            "created_at": watch.created_at,
            "updated_at": watch.updated_at,
            "published_at": watch.published_at,
        }
        for watch in watches
    ]


@router.get("/admin/{watch_id}", response_model=WatchResponse)
async def admin_get_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get any watch by ID (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.post("/admin", response_model=WatchResponse)
async def admin_create_watch(
    watch_data: WatchCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new watch (Admin only)

    When a watch is created with status 'active' and has a reference,
    a sell order is automatically created in the order book.
    """

    # Get dealer info if dealer_id provided
    dealer_name = None
    dealer_id = watch_data.dealer_id or str(current_admin.id)

    if watch_data.dealer_id:
        dealer = await User.get(PydanticObjectId(watch_data.dealer_id))
        if dealer:
            dealer_name = dealer.name
    else:
        dealer_name = current_admin.name

    # Create watch
    watch = Watch(
        brand=watch_data.brand,
        model=watch_data.model,
        reference=watch_data.reference,
        price=watch_data.price,
        currency=watch_data.currency,
        condition=watch_data.condition,
        year=watch_data.year,
        serial_number=watch_data.serial_number,
        description=watch_data.description,
        images=watch_data.images,
        cover_image=watch_data.cover_image or (watch_data.images[0] if watch_data.images else None),
        status=watch_data.status,
        featured=watch_data.featured,
        dealer_id=dealer_id,
        dealer_name=dealer_name,
        published_at=datetime.utcnow() if watch_data.status == WatchStatus.ACTIVE else None,
    )

    await watch.insert()

    # Auto-create sell order if watch is active and has a reference
    if watch_data.status == WatchStatus.ACTIVE and watch_data.reference:
        sell_order = Order(
            order_type=OrderType.SELL,
            brand=watch_data.brand,
            model=watch_data.model,
            reference=watch_data.reference,
            watch_id=str(watch.id),
            price=watch_data.price,
            currency=watch_data.currency,
            condition=map_watch_to_order_condition(watch_data.condition),
            country_code="CH",  # Default to Switzerland for admin-created listings
            country_name="Switzerland",
            user_id=dealer_id,
            user_name=dealer_name,
            user_email=current_admin.email,
            status=OrderStatus.ACTIVE,
            has_box=True,  # Default to true for admin listings
            has_papers=True,
        )
        await sell_order.insert()

        # Increment order count on the watch
        watch.order_count = 1
        await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.patch("/admin/{watch_id}", response_model=WatchResponse)
async def admin_update_watch(
    watch_id: str,
    watch_update: WatchUpdate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Update a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Update fields if provided
    update_data = watch_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(watch, field, value)

    # Set published_at if status changed to active
    if watch_update.status == WatchStatus.ACTIVE and not watch.published_at:
        watch.published_at = datetime.utcnow()

    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "id": str(watch.id),
        "brand": watch.brand,
        "model": watch.model,
        "reference": watch.reference,
        "price": watch.price,
        "currency": watch.currency,
        "condition": watch.condition,
        "year": watch.year,
        "serial_number": watch.serial_number,
        "description": watch.description,
        "images": watch.images,
        "cover_image": watch.cover_image,
        "status": watch.status,
        "featured": watch.featured,
        "dealer_id": watch.dealer_id,
        "dealer_name": watch.dealer_name,
        "views": watch.views,
        "created_at": watch.created_at,
        "updated_at": watch.updated_at,
        "published_at": watch.published_at,
    }


@router.delete("/admin/{watch_id}")
async def admin_delete_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Delete a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    await watch.delete()

    return {"message": "Watch deleted successfully"}


@router.post("/admin/{watch_id}/publish")
async def admin_publish_watch(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Publish a draft watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    if watch.status == WatchStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watch is already published"
        )

    watch.status = WatchStatus.ACTIVE
    watch.published_at = datetime.utcnow()
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {"message": "Watch published successfully", "id": str(watch.id)}


@router.get("/admin/stats/summary")
async def admin_watch_stats(
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get watch statistics (Admin only)"""

    all_watches = await Watch.find_all().to_list()

    stats = {
        "total_watches": len(all_watches),
        "active_watches": len([w for w in all_watches if w.status == WatchStatus.ACTIVE]),
        "draft_watches": len([w for w in all_watches if w.status == WatchStatus.DRAFT]),
        "sold_watches": len([w for w in all_watches if w.status == WatchStatus.SOLD]),
        "reserved_watches": len([w for w in all_watches if w.status == WatchStatus.RESERVED]),
        "featured_watches": len([w for w in all_watches if w.featured]),
        "total_views": sum(w.views for w in all_watches),
        "brands_count": len(set(w.brand for w in all_watches)),
    }

    return stats


@router.post("/admin/{watch_id}/toggle-trending")
async def admin_toggle_trending(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle trending status for a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    # Toggle trending status
    watch.trending = not watch.trending
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "message": f"Watch trending status {'enabled' if watch.trending else 'disabled'}",
        "id": str(watch.id),
        "trending": watch.trending
    }


@router.post("/admin/{watch_id}/increment-order-count")
async def admin_increment_order_count(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Increment order count for a watch (Admin only - used when orders are placed)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    watch.order_count += 1
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "message": "Order count incremented",
        "id": str(watch.id),
        "order_count": watch.order_count
    }
