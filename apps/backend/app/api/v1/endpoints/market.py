from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, ValidationError
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
    cover_image_thumbnail: Optional[str] = None
    status: WatchStatus
    featured: bool
    is_popular_search: bool = False
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
    list_prices: dict = {}
    discontinued: bool = False

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
    cover_image_thumbnail: Optional[str] = None
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
    cover_image_thumbnail: Optional[str] = None
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
    list_prices: dict = {}
    discontinued: bool = False


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
    list_prices: Optional[dict] = None
    discontinued: Optional[bool] = None


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

    # Apply text search if provided (search in brand, model, description).
    # Normalize the user's query so that spaces and hyphens match interchangeably:
    # 'GMT Master', 'GMT-Master', 'GMT  Master' all match catalog 'GMT-Master 2'.
    if search:
        import re as _re
        # Escape regex specials, then turn any whitespace/hyphen run into a flexible
        # separator pattern that matches one or more spaces, hyphens, or underscores.
        escaped = _re.escape(search.strip())
        # _re.escape turns '-' into '\-' and ' ' stays ' '. Replace these sequences
        # with a flexible class so they cross-match in either direction.
        flexible = _re.sub(r'(?:\\\s|\\-|\s|_)+', lambda _m: r'[\s\-_]+', escaped)
        watches_query = Watch.find(
            *query_conditions,
            {
                "$or": [
                    {"brand": {"$regex": flexible, "$options": "i"}},
                    {"model": {"$regex": flexible, "$options": "i"}},
                    {"reference": {"$regex": flexible, "$options": "i"}},
                    {"description": {"$regex": flexible, "$options": "i"}},
                    {"collection": {"$regex": flexible, "$options": "i"}},
                    {"ws_code": {"$regex": flexible, "$options": "i"}},
                    {"oem_references": {"$regex": flexible, "$options": "i"}},
                    {"aliases": {"$regex": flexible, "$options": "i"}},
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
    Single query: trending=True first, then by order_count.
    """
    # Single query with sort priority: trending first, then order_count
    trending_watches = await Watch.find(
        Watch.status == WatchStatus.ACTIVE,
        {"$or": [{"trending": True}, {"order_count": {"$gt": 0}}]}
    ).sort([("trending", -1), ("order_count", -1)]).limit(limit).to_list()

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
    Single query: featured first, then order_count, then views.
    """
    # Single aggregation instead of 3 sequential queries
    pipeline = [
        {"$match": {"status": WatchStatus.ACTIVE.value}},
        {"$addFields": {
            "_priority": {"$cond": [{"$eq": ["$featured", True]}, 0, 1]}
        }},
        {"$sort": {"_priority": 1, "order_count": -1, "views": -1}},
        {"$limit": limit},
    ]
    featured_raw = await Watch.aggregate(pipeline).to_list()

    return [
        {
            "id": str(w["_id"]),
            "brand": w.get("brand"),
            "model": w.get("model"),
            "reference": w.get("reference"),
            "ws_code": w.get("ws_code"),
            "price": w.get("price"),
            "currency": w.get("currency"),
            "cover_image": w.get("cover_image"),
            "trending": w.get("trending"),
            "order_count": w.get("order_count"),
            "price_change": w.get("price_change"),
            "price_history": w.get("price_history"),
        }
        for w in featured_raw
    ]


@router.get("/popular-searches")
async def get_popular_searches(
    limit: int = Query(default=10, le=20),
) -> Any:
    """Get watches flagged as popular searches"""
    watches = await Watch.find(
        Watch.status == WatchStatus.ACTIVE,
        Watch.is_popular_search == True,
    ).sort([("brand", 1), ("model", 1)]).limit(limit).to_list()

    return [
        {
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "ws_code": watch.ws_code,
            "cover_image": watch.cover_image,
        }
        for watch in watches
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
    cover_image_thumbnail: Optional[str] = None
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
    wts_count: int = 0
    wtb_count: int = 0
    trending: bool = False
    collection: Optional[str] = None
    oem_references: List[str] = []
    aliases: List[str] = []


@router.get("/aggregated", response_model=List[AggregatedWatchResponse])
async def get_aggregated_market_data(
    category: str = Query(default="hot"),
    brand: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50),
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
        import asyncio as _asyncio

        # Get active watches — paginate at DB level when possible
        base_query = Watch.status == WatchStatus.ACTIVE

        # Categories that need post-processing (can't paginate at DB level)
        needs_post_filter = category in ("gainers", "losers")

        if search:
            import re as _re
            escaped = _re.escape(search.strip())
            flexible = _re.sub(r'(?:\\\s|\\-|\s|_)+', lambda _m: r'[\s\-_]+', escaped)
            search_filter = {
                "$or": [
                    {"brand": {"$regex": flexible, "$options": "i"}},
                    {"model": {"$regex": flexible, "$options": "i"}},
                    {"reference": {"$regex": flexible, "$options": "i"}},
                    {"collection": {"$regex": flexible, "$options": "i"}},
                    {"ws_code": {"$regex": flexible, "$options": "i"}},
                    {"oem_references": {"$regex": flexible, "$options": "i"}},
                    {"aliases": {"$regex": flexible, "$options": "i"}},
                ]
            }
            q = Watch.find(base_query, search_filter).sort([("order_count", -1), ("created_at", -1)])
        elif brand:
            import re
            brand_regex = re.compile(f"^{re.escape(brand)}$", re.IGNORECASE)
            q = Watch.find(base_query, {"brand": {"$regex": brand_regex}}).sort([("order_count", -1), ("created_at", -1)])
        elif category == "hot":
            q = Watch.find(base_query).sort([("order_count", -1), ("created_at", -1)])
        elif needs_post_filter:
            q = Watch.find(base_query).sort([("created_at", -1)])
        elif category == "new":
            q = Watch.find(base_query).sort([("published_at", -1), ("created_at", -1)])
        elif category == "trending":
            q = Watch.find(
                base_query,
                {"$or": [{"trending": True}, {"order_count": {"$gt": 0}}]}
            ).sort([("trending", -1), ("order_count", -1)])
        else:
            q = Watch.find(base_query).sort([("created_at", -1)])

        # Apply DB-level pagination for categories that don't need post-filtering
        if not needs_post_filter:
            q = q.skip(skip).limit(limit)

        watches = await q.to_list()

        if not watches:
            return []

        # Get unique references and ws_codes for this page only
        references = list(set(w.reference for w in watches if w.reference))
        ws_codes = list(set(w.ws_code for w in watches if w.ws_code))

        # Run all order aggregation pipelines IN PARALLEL
        lowest_prices_by_ref = {}
        lowest_currency_by_ref = {}
        order_counts_by_ref = {}
        wts_counts_by_ws = {}
        wtb_counts_by_ws = {}

        async def _fetch_sell_prices():
            if not references:
                return
            pipeline = [
                {"$match": {"reference": {"$in": references}, "order_type": OrderType.SELL.value, "status": OrderStatus.ACTIVE.value}},
                {"$sort": {"price": 1}},
                {"$group": {"_id": "$reference", "min_price": {"$first": "$price"}, "currency": {"$first": "$currency"}}},
            ]
            try:
                for item in await Order.aggregate(pipeline).to_list():
                    lowest_prices_by_ref[item["_id"]] = item["min_price"]
                    lowest_currency_by_ref[item["_id"]] = item.get("currency", "EUR")
            except Exception:
                pass

        async def _fetch_order_counts():
            if not references:
                return
            pipeline = [
                {"$match": {"reference": {"$in": references}, "status": OrderStatus.ACTIVE.value}},
                {"$group": {"_id": "$reference", "count": {"$sum": 1}}},
            ]
            try:
                for item in await Order.aggregate(pipeline).to_list():
                    order_counts_by_ref[item["_id"]] = item["count"]
            except Exception:
                pass

        async def _fetch_wts_wtb_counts():
            if not ws_codes:
                return
            pipeline = [
                {"$match": {"ws_code": {"$in": ws_codes}, "status": OrderStatus.ACTIVE.value}},
                {"$group": {"_id": {"ws_code": "$ws_code", "order_type": "$order_type"}, "count": {"$sum": 1}}},
            ]
            try:
                for item in await Order.aggregate(pipeline).to_list():
                    ws = item["_id"]["ws_code"]
                    ot = item["_id"]["order_type"]
                    if ot == OrderType.SELL.value:
                        wts_counts_by_ws[ws] = item["count"]
                    elif ot == OrderType.BUY.value:
                        wtb_counts_by_ws[ws] = item["count"]
            except Exception:
                pass

        # Fire all 3 aggregations at once
        await _asyncio.gather(
            _fetch_sell_prices(),
            _fetch_order_counts(),
            _fetch_wts_wtb_counts(),
        )

        # Build response
        result = []

        for watch in watches:
            watch_id = str(watch.id)

            lowest_order_price = lowest_prices_by_ref.get(watch.reference) if watch.reference else None
            admin_price = watch.price
            display_price = lowest_order_price if lowest_order_price else admin_price
            # Use the currency from the lowest WTS order when available
            display_currency = lowest_currency_by_ref.get(watch.reference, watch.currency) if lowest_order_price and watch.reference else watch.currency

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
                cover_image_thumbnail=watch.cover_image_thumbnail,
                display_price=display_price,
                lowest_order_price=lowest_order_price,
                admin_price=admin_price,
                currency=display_currency,
                price_change=price_change,
                price_history=generated_history if generated_history else (watch.price_history or []),
                total_orders=order_counts_by_ref.get(watch.reference, 0) + (watch.order_count or 0),
                wts_count=wts_counts_by_ws.get(watch.ws_code, 0) if watch.ws_code else 0,
                wtb_count=wtb_counts_by_ws.get(watch.ws_code, 0) if watch.ws_code else 0,
                trending=watch.trending or False,
                collection=watch.collection,
                oem_references=watch.oem_references or [],
                aliases=watch.aliases or [],
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

        # For categories that were paginated at DB level, result is already sliced.
        # For post-filter categories (gainers/losers), apply pagination here.
        if needs_post_filter:
            return result[skip:skip + limit]
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

    # Use the watch's own reference for order lookups (not the URL param, which may be ws_code)
    watch_ref = watch.reference

    # Get lowest active sell order price
    sell_orders = []
    if watch_ref:
        sell_orders = await Order.find(
            Order.reference == watch_ref,
            Order.order_type == OrderType.SELL,
            Order.status == OrderStatus.ACTIVE,
        ).sort([("price", 1)]).limit(1).to_list()

    lowest_order_price = sell_orders[0].price if sell_orders else None
    lowest_order_currency = sell_orders[0].currency if sell_orders else None
    display_price = lowest_order_price if lowest_order_price else watch.price
    # Use the currency from the lowest WTS order when available
    display_currency = lowest_order_currency if lowest_order_price and lowest_order_currency else watch.currency

    # Get total order count and WTS/WTB counts by ws_code (variant-level)
    order_count = 0
    wts_count = 0
    wtb_count = 0
    count_field = watch.ws_code if watch.ws_code else watch_ref
    count_key = "ws_code" if watch.ws_code else "reference"
    if count_field:
        order_count = await Order.find(
            {count_key: count_field, "status": OrderStatus.ACTIVE.value},
        ).count()
        wts_count = await Order.find(
            {count_key: count_field, "order_type": OrderType.SELL.value, "status": OrderStatus.ACTIVE.value},
        ).count()
        wtb_count = await Order.find(
            {count_key: count_field, "order_type": OrderType.BUY.value, "status": OrderStatus.ACTIVE.value},
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
        cover_image_thumbnail=watch.cover_image_thumbnail,
        display_price=display_price,
        lowest_order_price=lowest_order_price,
        admin_price=watch.price,
        currency=display_currency,
        price_change=price_change,
        price_history=generated_history if generated_history else (watch.price_history or []),
        total_orders=order_count + watch.order_count,
        wts_count=wts_count,
        wtb_count=wtb_count,
        trending=watch.trending,
    )


# ============== ADMIN ENDPOINTS ==============
# NOTE: Admin routes MUST be defined before the catch-all /{watch_id:path} route below,
# otherwise FastAPI's path matching will treat "admin/all" as a watch_id.

def _admin_watch_dict(watch: Watch) -> dict:
    """Admin response shape (WatchResponse) for one watch."""
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
        "cover_image_thumbnail": watch.cover_image_thumbnail,
        "status": watch.status,
        "featured": watch.featured,
        "trending": watch.trending,
        "is_popular_search": watch.is_popular_search,
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
        "list_prices": watch.list_prices or {},
        "discontinued": watch.discontinued,
    }


def _admin_list_query(
    status_filter: Optional[WatchStatus],
    brand: Optional[str],
    dealer_id: Optional[str],
    search: Optional[str],
    no_image: bool,
    no_ws_code: bool,
    no_aliases: bool,
    no_list_price: bool,
) -> dict:
    from app.services.catalog_admin import build_watch_query

    return build_watch_query(
        status=status_filter.value if status_filter else None, brand=brand, dealer_id=dealer_id,
        search=search, no_image=no_image, no_ws_code=no_ws_code, no_aliases=no_aliases,
        no_list_price=no_list_price,
    )


def _clean_list_prices(raw: Optional[dict]) -> dict:
    """Form input → {country: price}; unknown countries are rejected, empty prices dropped."""
    from app.services.catalog_admin import normalize_list_prices
    from app.core.market_constants import LIST_PRICE_COUNTRY_CODES

    mapping, errors = normalize_list_prices(raw or {})
    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(errors))
    mapping = mapping or {}
    return {c: mapping[c] for c in LIST_PRICE_COUNTRY_CODES if mapping.get(c) is not None}


@router.get("/admin/all", response_model=List[WatchResponse])
async def admin_list_all_watches(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[WatchStatus] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
    search: Optional[str] = None,
    no_image: bool = False,
    no_ws_code: bool = False,
    no_aliases: bool = False,
    no_list_price: bool = False,
) -> Any:
    """List all watches including drafts (Admin only)"""
    query = _admin_list_query(status_filter, brand, dealer_id, search, no_image, no_ws_code, no_aliases, no_list_price)
    watches = await Watch.find(query).sort([("created_at", -1)]).skip(skip).limit(limit).to_list()
    return [_admin_watch_dict(watch) for watch in watches]


@router.get("/admin/count")
async def admin_count_watches(
    current_admin: User = Depends(get_current_admin_user),
    status_filter: Optional[WatchStatus] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
    search: Optional[str] = None,
    no_image: bool = False,
    no_ws_code: bool = False,
    no_aliases: bool = False,
    no_list_price: bool = False,
) -> Any:
    """Count all watches with filters (Admin only)"""
    query = _admin_list_query(status_filter, brand, dealer_id, search, no_image, no_ws_code, no_aliases, no_list_price)
    total = await Watch.find(query).count()
    return {"total": total}


@router.get("/admin/export")
async def admin_export_watches(
    current_admin: User = Depends(get_current_admin_user),
    format: str = "jsonl",
    ids: Optional[str] = None,
    status_filter: Optional[WatchStatus] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
    search: Optional[str] = None,
    no_image: bool = False,
    no_ws_code: bool = False,
    no_aliases: bool = False,
    no_list_price: bool = False,
) -> Any:
    """Export watches as JSONL (default) or CSV (Admin only).

    Draft watches are included. ``ids`` (comma-separated) limits the export to a selection;
    otherwise the list filters apply. The output is re-importable by the edit import. For
    large selections use ``POST /catalog-admin/watches/export``.
    """
    from app.api.v1.endpoints.catalog_admin import export_response
    from app.services.catalog_admin import build_watch_query

    if ids:
        query = build_watch_query(ids=[i.strip() for i in ids.split(",") if i.strip()])
    else:
        query = _admin_list_query(status_filter, brand, dealer_id, search, no_image, no_ws_code, no_aliases, no_list_price)
    watches = await Watch.find(query).sort([("created_at", -1)]).to_list()
    return export_response(watches, "csv" if format.lower() == "csv" else "jsonl")


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

    return _admin_watch_dict(watch)


class BulkImportRequest(BaseModel):
    """A batch of new watches plus how to treat ones that already exist.

    Rows stay untyped here on purpose: each row is validated individually and reported on its
    own line, so one typo never blocks a 200-row file. Send either parsed ``watches`` or the raw
    file ``text`` (JSONL or CSV, ``format`` auto-detected).
    """
    watches: List[Any] = []
    text: Optional[str] = None
    format: str = "auto"
    # "skip" leaves an existing watch untouched, "update" applies the row to it (edit-import rules).
    on_duplicate: str = "skip"
    # When true nothing is written; the caller gets the same per-row report.
    dry_run: bool = False


class BulkImportRowResult(BaseModel):
    row: int  # 1-based, matching the line number the admin sees
    action: str  # created | updated | unchanged | skipped | error
    id: Optional[str] = None
    ws_code: Optional[str] = None
    reference: Optional[str] = None
    message: Optional[str] = None
    warnings: List[str] = []


class BulkImportResponse(BaseModel):
    dry_run: bool
    total: int
    created: int
    updated: int
    skipped: int
    errors: int
    unchanged: int = 0
    warnings: int = 0
    batch_id: Optional[str] = None
    results: List[BulkImportRowResult]


@router.post("/admin/import", response_model=BulkImportResponse)
async def admin_bulk_import_watches(
    payload: BulkImportRequest,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Bulk-create watches from JSONL / JSON / CSV (Admin only).

    Duplicates are detected only by WS code or OEM reference — never by ``reference``, because
    one reference can have many editions (RM67-02 has 11). Every string is trimmed; a WS code
    already used by another watch (or earlier in the file) rejects the row; an alias already
    used by another watch is reported as a warning. ``list_prices`` (object or ``list_price_XX``
    columns) and ``discontinued`` are accepted. The write is recorded for undo.
    """
    from app.services.catalog_admin import (
        ParsedRows, load_catalog, parse_import_text, plan_bulk_import, write_update_plans,
    )
    from app.services.undo import ChangeBatchRecorder

    if payload.text is not None and payload.text.strip():
        parsed = parse_import_text(payload.text, payload.format)
    else:
        parsed = ParsedRows(rows=list(enumerate(payload.watches, start=1)))

    catalog = await load_catalog()
    plan = plan_bulk_import(parsed, catalog, payload.on_duplicate)
    results = plan["results"]
    batch_id: Optional[str] = None

    if not payload.dry_run and (plan["creates"] or plan["updates"]):
        recorder = ChangeBatchRecorder(
            "bulk_import",
            f"Bulk import · {plan['created']} created · {plan['updated']} updated",
            current_admin,
        )
        by_line = {r["line"]: r for r in results}
        now = datetime.utcnow()
        new_watches = []
        for create in plan["creates"]:
            # None = "not given" for a new watch; let the model defaults apply.
            f = {k: v for k, v in create["fields"].items() if v is not None}
            images = f.pop("images", None) or []
            cover = f.pop("cover_image", None)
            f.pop("dealer_id", None)
            status_value = f.pop("status", None) or WatchStatus.DRAFT.value
            try:
                watch = Watch(
                    **f,
                    images=[cover] if cover and not images else images,
                    cover_image=cover or (images[0] if images else None),
                    status=status_value,
                    dealer_id=str(current_admin.id),
                    dealer_name=current_admin.name,
                    published_at=now if status_value == WatchStatus.ACTIVE.value else None,
                )
            except (ValidationError, TypeError, ValueError) as exc:
                res = by_line[create["line"]]
                res["action"] = "error"
                if isinstance(exc, ValidationError):
                    first = exc.errors()[0]
                    loc = ".".join(str(p) for p in first.get("loc", ()))
                    res["message"] = f"{loc}: {first.get('msg')}" if loc else first.get("msg")
                else:
                    res["message"] = str(exc)[:200]
                continue
            watch.id = PydanticObjectId()
            new_watches.append((create["line"], watch))
            recorder.record_create(str(watch.id))

        if plan["updates"]:
            await write_update_plans(plan["updates"], catalog, recorder)
        else:
            await recorder.save()
        for line, watch in new_watches:
            try:
                await watch.insert()
                by_line[line]["id"] = str(watch.id)
            except Exception as exc:
                by_line[line]["action"] = "error"
                by_line[line]["message"] = str(exc)[:200]
        batch_id = str(recorder.batch.id) if recorder.batch else None

    out_rows = [
        BulkImportRowResult(
            row=r["line"], action=r["action"], id=r.get("id"), ws_code=r.get("ws_code"),
            reference=r.get("reference"), message=r.get("message"), warnings=r.get("warnings", []),
        )
        for r in results
    ]
    return BulkImportResponse(
        dry_run=payload.dry_run,
        total=len(out_rows),
        created=sum(1 for r in out_rows if r.action == "created"),
        updated=sum(1 for r in out_rows if r.action == "updated"),
        skipped=sum(1 for r in out_rows if r.action == "skipped"),
        errors=sum(1 for r in out_rows if r.action == "error"),
        unchanged=sum(1 for r in out_rows if r.action == "unchanged"),
        warnings=sum(len(r.warnings) for r in out_rows),
        batch_id=batch_id,
        results=out_rows,
    )


@router.post("/admin", response_model=WatchResponse)
async def admin_create_watch(
    watch_data: WatchCreate,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new watch (Admin only).

    Creates the catalog entry only. No order is created here - WTS/WTB rows
    come from the WhatsApp import and the order endpoints, so a newly created
    watch shows 0/0 counts until orders exist for its ws_code.
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
        list_prices=_clean_list_prices(watch_data.list_prices),
        discontinued=watch_data.discontinued,
    )

    await watch.insert()

    return _admin_watch_dict(watch)


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
    if "list_prices" in update_data:
        # The form sends all 13 fields; the whole map is replaced.
        update_data["list_prices"] = _clean_list_prices(update_data["list_prices"])
    if "discontinued" in update_data and update_data["discontinued"] is None:
        update_data["discontinued"] = False

    for field, value in update_data.items():
        setattr(watch, field, value)

    # Set published_at if status changed to active
    if watch_update.status == WatchStatus.ACTIVE and not watch.published_at:
        watch.published_at = datetime.utcnow()

    watch.updated_at = datetime.utcnow()
    await watch.save()

    return _admin_watch_dict(watch)


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


@router.post("/admin/{watch_id}/toggle-popular-search")
async def admin_toggle_popular_search(
    watch_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Toggle popular search status for a watch (Admin only)"""

    watch = await Watch.get(PydanticObjectId(watch_id))

    if not watch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch not found"
        )

    watch.is_popular_search = not watch.is_popular_search
    watch.updated_at = datetime.utcnow()
    await watch.save()

    return {
        "message": f"Watch popular search status {'enabled' if watch.is_popular_search else 'disabled'}",
        "id": str(watch.id),
        "is_popular_search": watch.is_popular_search
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
