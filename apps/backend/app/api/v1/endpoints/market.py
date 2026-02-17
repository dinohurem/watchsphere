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
    price: float = 0
    currency: str = "EUR"
    condition: Optional[WatchCondition] = None
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
    collection: Optional[str] = None
    oem_references: List[str] = []
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: List[str] = []

    class Config:
        from_attributes = True


class MarketWatchResponse(BaseModel):
    """Response model for market/trending watches"""
    id: str
    brand: str
    model: str
    reference: Optional[str] = None
    ws_code: Optional[str] = None
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
    price: float = 0
    currency: str = "EUR"
    condition: Optional[WatchCondition] = None
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
    price: Optional[float] = 0
    currency: str = "EUR"
    condition: Optional[WatchCondition] = None
    year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    cover_image: Optional[str] = None
    status: WatchStatus = WatchStatus.DRAFT
    featured: bool = False
    dealer_id: Optional[str] = None
    collection: Optional[str] = None
    oem_references: List[str] = []
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: List[str] = []


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
    collection: Optional[str] = None
    oem_references: Optional[List[str]] = None
    dial: Optional[str] = None
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: Optional[List[str]] = None


# ============== PUBLIC ENDPOINTS ==============

# NOTE: Route order matters in FastAPI! More specific routes must come before parameterized routes.
# The /watches endpoint must be defined before /{watch_id} to avoid "watches" being matched as a watch_id.


@router.get("/brands", response_model=List[str])
async def get_market_brands() -> Any:
    """Get unique brand names from active watches, sorted with Rolex first."""
    try:
        pipeline = [
            {"$match": {"status": WatchStatus.ACTIVE.value}},
            {"$group": {
                "_id": {"$toLower": {"$trim": {"input": "$brand"}}},
                "display_name": {"$first": "$brand"},
            }},
            {"$sort": {"_id": 1}},
        ]
        raw = await Watch.aggregate(pipeline).to_list()
        # Deduplicate by lowercased name (safety net)
        seen = set()
        brands = []
        for item in raw:
            name = (item.get("display_name") or "").strip()
            key = name.lower()
            if name and key not in seen:
                seen.add(key)
                brands.append(name)
        # Move Rolex to front if present (case-insensitive)
        rolex_entry = next((b for b in brands if b.lower() == "rolex"), None)
        if rolex_entry:
            brands.remove(rolex_entry)
            brands.insert(0, rolex_entry)
        return brands
    except Exception:
        return []


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
        # Fallback: if no watches have positive price_change, show by price desc
        if not watches:
            watches = await Watch.find(base_query).sort([("price", -1)]).limit(limit).to_list()

    elif category == "losers":
        # Negative price change, sorted by change amount (most negative first)
        watches = await Watch.find(
            base_query,
            Watch.price_change < 0
        ).sort([("price_change", 1)]).limit(limit).to_list()
        # Fallback: if no watches have negative price_change, show by price asc
        if not watches:
            watches = await Watch.find(base_query).sort([("price", 1)]).limit(limit).to_list()

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
            "ws_code": watch.ws_code,
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

    # Get distinct brands from active watches using aggregation
    pipeline = [
        {"$match": {"status": WatchStatus.ACTIVE.value}},
        {"$group": {"_id": "$brand"}},
        {"$sort": {"_id": 1}},
    ]
    brand_docs = await Watch.aggregate(pipeline).to_list()
    brands = [doc["_id"] for doc in brand_docs if doc["_id"]]

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
            "ws_code": watch.ws_code,
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
            "ws_code": watch.ws_code,
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
    """Aggregated market data for a watch (combines listings with orders)"""
    id: str
    reference: str
    brand: str
    model: str
    ws_code: Optional[str] = None
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
    brand: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
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
        # Fetch enough records to cover skip + limit
        fetch_limit = skip + limit

        # If brand filter is provided, filter by brand (case-insensitive)
        if brand:
            import re
            brand_regex = re.compile(f"^{re.escape(brand)}$", re.IGNORECASE)
            watches = await Watch.find(base_query, {"brand": {"$regex": brand_regex}}).sort([("order_count", -1)]).limit(fetch_limit).to_list()
        # For gainers/losers, we need to compute price_change dynamically from
        # sell orders vs admin price, so fetch all watches first then filter.
        elif category == "hot":
            watches = await Watch.find(base_query).sort([("order_count", -1)]).limit(fetch_limit).to_list()
        elif category in ("gainers", "losers"):
            # Fetch more watches than needed — we'll filter after computing price_change
            watches = await Watch.find(base_query).sort([("created_at", -1)]).to_list()
        elif category == "new":
            watches = await Watch.find(base_query).sort([("published_at", -1)]).limit(fetch_limit).to_list()
        elif category == "trending":
            watches = await Watch.find(
                base_query,
                {"$or": [{"trending": True}, {"order_count": {"$gt": 0}}]}
            ).sort([("trending", -1), ("order_count", -1)]).limit(fetch_limit).to_list()
        else:
            watches = await Watch.find(base_query).sort([("created_at", -1)]).limit(fetch_limit).to_list()

        # Return empty list if no watches
        if not watches:
            return []

        # Get unique references (only non-empty ones)
        references = list(set(w.reference for w in watches if w.reference))

        # Batch-fetch lowest sell order prices and order counts using aggregation
        lowest_prices_by_ref = {}
        order_counts_by_ref = {}

        if references:
            # Get lowest sell price per reference in one query
            sell_price_pipeline = [
                {"$match": {"reference": {"$in": references}, "order_type": OrderType.SELL.value, "status": OrderStatus.ACTIVE.value}},
                {"$group": {"_id": "$reference", "min_price": {"$min": "$price"}}},
            ]
            try:
                sell_price_raw = await Order.aggregate(sell_price_pipeline).to_list()
                for item in sell_price_raw:
                    lowest_prices_by_ref[item["_id"]] = item["min_price"]
            except Exception:
                pass

            # Get total active order count per reference in one query
            count_pipeline = [
                {"$match": {"reference": {"$in": references}, "status": OrderStatus.ACTIVE.value}},
                {"$group": {"_id": "$reference", "count": {"$sum": 1}}},
            ]
            try:
                count_raw = await Order.aggregate(count_pipeline).to_list()
                for item in count_raw:
                    order_counts_by_ref[item["_id"]] = item["count"]
            except Exception:
                pass

        # Build response — unique per ws_code
        result = []
        seen_keys = set()

        for watch in watches:
            watch_id = str(watch.id)
            # Deduplicate by ws_code (most unique identifier); fall back to watch id
            dedup_key = (watch.ws_code or "").strip().lower() or watch_id

            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

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
                id=watch_id,
                reference=watch.reference or watch_id,
                brand=watch.brand,
                model=watch.model,
                ws_code=watch.ws_code,
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

        # For gainers/losers, filter and sort by dynamically computed price_change
        if category == "gainers":
            filtered = sorted(
                [r for r in result if r.price_change > 0],
                key=lambda r: r.price_change,
                reverse=True,
            )
            # Fallback: if no watches have positive price_change, show all sorted by
            # price descending so the category isn't empty
            if not filtered:
                filtered = sorted(result, key=lambda r: r.display_price, reverse=True)
            result = filtered
        elif category == "losers":
            filtered = sorted(
                [r for r in result if r.price_change < 0],
                key=lambda r: r.price_change,
            )
            # Fallback: if no watches have negative price_change, show all sorted by
            # price ascending so the category isn't empty
            if not filtered:
                filtered = sorted(result, key=lambda r: r.display_price)
            result = filtered

        # Apply pagination (skip/limit)
        return result[skip:skip + limit]
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

    # Get the watch model — try ws_code first (primary identifier), then reference
    import re as re_mod
    ws_regex = re_mod.compile(f"^{re_mod.escape(reference)}$", re_mod.IGNORECASE)
    watch = await Watch.find_one(
        {"ws_code": {"$regex": ws_regex}},
        Watch.status == WatchStatus.ACTIVE,
    )
    if not watch:
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
        id=str(watch.id),
        reference=watch.reference,
        brand=watch.brand,
        model=watch.model,
        ws_code=watch.ws_code,
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


# ============== ADMIN ENDPOINTS ==============
# NOTE: Admin routes MUST be defined before the catch-all /{watch_id:path} route below,
# otherwise FastAPI's path matching will treat "admin/all" as a watch_id.

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
            "collection": watch.collection,
            "oem_references": watch.oem_references,
            "dial": watch.dial,
            "bracelet": watch.bracelet,
            "ws_code": watch.ws_code,
            "aliases": watch.aliases,
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
        "collection": watch.collection,
        "oem_references": watch.oem_references,
        "dial": watch.dial,
        "bracelet": watch.bracelet,
        "ws_code": watch.ws_code,
        "aliases": watch.aliases,
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
        price=watch_data.price or 0,
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
        collection=watch_data.collection,
        oem_references=watch_data.oem_references,
        dial=watch_data.dial,
        bracelet=watch_data.bracelet,
        ws_code=watch_data.ws_code,
        aliases=watch_data.aliases,
    )

    await watch.insert()

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
        "collection": watch.collection,
        "oem_references": watch.oem_references,
        "dial": watch.dial,
        "bracelet": watch.bracelet,
        "ws_code": watch.ws_code,
        "aliases": watch.aliases,
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
        "collection": watch.collection,
        "oem_references": watch.oem_references,
        "dial": watch.dial,
        "bracelet": watch.bracelet,
        "ws_code": watch.ws_code,
        "aliases": watch.aliases,
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

    # Use aggregation instead of loading all watches into memory
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = await Watch.aggregate(status_pipeline).to_list()
    status_map = {item["_id"]: item["count"] for item in status_counts}

    # Aggregation for total views and brand count
    summary_pipeline = [
        {"$group": {
            "_id": None,
            "total_views": {"$sum": "$views"},
            "brands": {"$addToSet": "$brand"},
            "featured_count": {"$sum": {"$cond": ["$featured", 1, 0]}},
        }},
    ]
    summary_raw = await Watch.aggregate(summary_pipeline).to_list()
    summary = summary_raw[0] if summary_raw else {"total_views": 0, "brands": [], "featured_count": 0}

    total = sum(status_map.values())

    stats = {
        "total_watches": total,
        "active_watches": status_map.get(WatchStatus.ACTIVE.value, status_map.get(WatchStatus.ACTIVE, 0)),
        "draft_watches": status_map.get(WatchStatus.DRAFT.value, status_map.get(WatchStatus.DRAFT, 0)),
        "completed_watches": status_map.get("completed", 0),
        "featured_watches": summary["featured_count"],
        "total_views": summary["total_views"],
        "brands_count": len(summary["brands"]),
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


# ============== CATCH-ALL (must be LAST) ==============

@router.get("/{watch_id:path}", response_model=WatchResponse)
async def get_watch(watch_id: str) -> Any:
    """Get watch by ID or reference (public - only active watches)

    Note: Using :path parameter type to handle references containing slashes (e.g., 5711/1A-010)
    This route MUST be last in the file, as it matches everything.
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

    # Increment view count atomically
    await watch.update({"$inc": {"views": 1}})

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
        "collection": watch.collection,
        "oem_references": watch.oem_references,
        "dial": watch.dial,
        "bracelet": watch.bracelet,
        "ws_code": watch.ws_code,
        "aliases": watch.aliases,
    }
