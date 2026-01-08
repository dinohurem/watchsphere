from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import re

from app.core.deps import get_current_user
from app.models.user import User
from app.models.order import Order, OrderType, OrderStatus
from app.models.whatsapp_import import ExtractedWatchListing

router = APIRouter()


# Watch brand patterns for detection
WATCH_BRANDS = [
    "rolex", "patek philippe", "patek", "audemars piguet", "ap",
    "richard mille", "rm", "omega", "cartier", "hublot",
    "jaeger-lecoultre", "jlc", "vacheron constantin", "vc",
    "iwc", "breitling", "tudor", "panerai", "tag heuer",
    "submariner", "daytona", "nautilus", "royal oak", "aquanaut",
    "speedmaster", "seamaster", "gmt-master", "datejust", "day-date"
]

# Reference patterns
REF_PATTERNS = [
    r'\b([A-Z]{0,3}\d{4,6}[A-Z0-9/-]*)\b',  # Standard refs like 126610LN, 5968G
    r'\bref\.?\s*([A-Z0-9/-]+)\b',  # "ref. 126610LN"
]


class WatchReference(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None


class SellerInfo(BaseModel):
    name: str
    contact: Optional[str] = None
    price: Optional[float] = None
    currency: str = "EUR"
    condition: Optional[str] = None
    source: str  # "order" or "whatsapp"
    message_date: Optional[datetime] = None


class MarketData(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: Optional[str] = None
    avg_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    active_orders_count: int = 0
    whatsapp_listings_count: int = 0


class AssistantQueryRequest(BaseModel):
    message: str
    intent: Optional[str] = None  # "buy", "sell", or None for detection


class AssistantQueryResponse(BaseModel):
    detected_intent: Optional[str] = None  # "buy", "sell", "info", or None
    detected_watches: List[WatchReference] = []
    market_data: Optional[MarketData] = None
    available_sellers: List[SellerInfo] = []
    suggested_response: str
    requires_clarification: bool = False
    clarification_options: List[str] = []


def detect_watch_reference(text: str) -> Optional[WatchReference]:
    """Detect watch brand/model/reference from text"""
    text_lower = text.lower()

    # Find brand
    brand = None
    model = None
    for b in WATCH_BRANDS:
        if b in text_lower:
            # Map model names to brands
            if b in ["submariner", "daytona", "gmt-master", "datejust", "day-date"]:
                brand = "Rolex"
                model = b.title().replace("-", " ")
            elif b in ["nautilus", "aquanaut"]:
                brand = "Patek Philippe"
                model = b.title()
            elif b in ["royal oak"]:
                brand = "Audemars Piguet"
                model = "Royal Oak"
            elif b in ["speedmaster", "seamaster"]:
                brand = "Omega"
                model = b.title()
            elif b == "patek philippe" or b == "patek":
                brand = "Patek Philippe"
            elif b == "audemars piguet" or b == "ap":
                brand = "Audemars Piguet"
            elif b == "richard mille" or b == "rm":
                brand = "Richard Mille"
            elif b == "jaeger-lecoultre" or b == "jlc":
                brand = "Jaeger-LeCoultre"
            elif b == "vacheron constantin" or b == "vc":
                brand = "Vacheron Constantin"
            elif b == "tag heuer":
                brand = "TAG Heuer"
            else:
                brand = b.title()
            break

    if not brand:
        return None

    # Find reference
    reference = None
    for pattern in REF_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            ref = match.group(1).upper()
            # Skip if too short or doesn't look like a reference
            if len(ref) >= 4 and any(c.isdigit() for c in ref):
                reference = ref
                break

    return WatchReference(brand=brand, model=model, reference=reference)


def detect_intent(text: str) -> Optional[str]:
    """Detect if user wants to buy or sell"""
    text_lower = text.lower()

    buy_keywords = ["buy", "buying", "purchase", "looking for", "want to get", "interested in buying", "where can i find", "looking to buy", "want a", "i need"]
    sell_keywords = ["sell", "selling", "list", "want to sell", "looking to sell", "get rid of"]
    info_keywords = ["price", "worth", "value", "market", "trend", "how much", "what's the"]

    for keyword in sell_keywords:
        if keyword in text_lower:
            return "sell"

    for keyword in buy_keywords:
        if keyword in text_lower:
            return "buy"

    for keyword in info_keywords:
        if keyword in text_lower:
            return "info"

    return None


@router.post("/assistant/query", response_model=AssistantQueryResponse)
async def query_assistant(
    request: AssistantQueryRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Query the AI assistant with watch-related data context"""

    message = request.message
    intent = request.intent or detect_intent(message)
    watch_ref = detect_watch_reference(message)

    # If no watch detected and no clear intent, ask for clarification
    if not watch_ref and not intent:
        return {
            "detected_intent": None,
            "detected_watches": [],
            "market_data": None,
            "available_sellers": [],
            "suggested_response": "I'd be happy to help you with watch information. Could you tell me which specific watch model or brand you're interested in? For example, you could ask about a Rolex Submariner, Patek Philippe Nautilus, or any other timepiece.",
            "requires_clarification": False,
            "clarification_options": [],
        }

    # If watch detected but no clear intent, ask if they want to buy or sell
    if watch_ref and not intent:
        watch_name = f"{watch_ref.brand}"
        if watch_ref.model:
            watch_name += f" {watch_ref.model}"
        if watch_ref.reference:
            watch_name += f" ({watch_ref.reference})"

        return {
            "detected_intent": None,
            "detected_watches": [watch_ref],
            "market_data": None,
            "available_sellers": [],
            "suggested_response": f"I see you're interested in the **{watch_name}**. Are you looking to buy or sell this watch?",
            "requires_clarification": True,
            "clarification_options": ["I want to buy", "I want to sell", "Just want information"],
        }

    # Gather market data
    market_data = MarketData()
    available_sellers: List[SellerInfo] = []

    if watch_ref:
        market_data.brand = watch_ref.brand
        market_data.model = watch_ref.model
        market_data.reference = watch_ref.reference

        # Search active orders in database
        try:
            # Build MongoDB query for orders
            order_query = {
                "order_type": OrderType.SELL.value,
                "status": OrderStatus.ACTIVE.value,
            }
            if watch_ref.brand:
                order_query["brand"] = {"$regex": watch_ref.brand, "$options": "i"}
            if watch_ref.reference:
                order_query["reference"] = {"$regex": watch_ref.reference, "$options": "i"}

            orders = await Order.find(order_query).limit(20).to_list()
            market_data.active_orders_count = len(orders)

            if orders:
                prices = [o.price for o in orders if o.price]
                if prices:
                    market_data.avg_price = sum(prices) / len(prices)
                    market_data.min_price = min(prices)
                    market_data.max_price = max(prices)

                # Add sellers from orders
                for order in orders[:5]:  # Top 5 sellers
                    user = None
                    if order.user_id:
                        try:
                            user = await User.get(PydanticObjectId(order.user_id))
                        except Exception:
                            pass
                    available_sellers.append(SellerInfo(
                        name=user.name if user else (order.user_name or "Anonymous"),
                        price=order.price,
                        currency=order.currency or "EUR",
                        condition=order.condition.value if order.condition else None,
                        source="order",
                    ))
        except Exception as e:
            print(f"Error searching orders: {e}")

        # Search WhatsApp imported listings
        wa_conditions = []
        if watch_ref.brand:
            wa_conditions.append({"brand": {"$regex": watch_ref.brand, "$options": "i"}})
        if watch_ref.reference:
            wa_conditions.append({"reference": {"$regex": watch_ref.reference, "$options": "i"}})

        try:
            if wa_conditions:
                wa_listings = await ExtractedWatchListing.find(*wa_conditions).sort([("message_timestamp", -1)]).limit(20).to_list()
            else:
                wa_listings = []

            market_data.whatsapp_listings_count = len(wa_listings)

            # Add sellers from WhatsApp
            for listing in wa_listings[:10]:  # Top 10 WhatsApp contacts
                if listing.seller_name:
                    available_sellers.append(SellerInfo(
                        name=listing.seller_name,
                        price=listing.price,
                        currency=listing.currency or "EUR",
                        condition=listing.condition,
                        source="whatsapp",
                        message_date=listing.message_timestamp,
                    ))
        except Exception as e:
            print(f"Error searching WhatsApp listings: {e}")

    # Generate response based on intent
    if intent == "buy":
        if available_sellers:
            watch_name = f"{watch_ref.brand if watch_ref else 'the watch'}"
            if watch_ref and watch_ref.model:
                watch_name += f" {watch_ref.model}"

            seller_list = []
            for seller in available_sellers[:5]:
                price_str = f"€{seller.price:,.0f}" if seller.price else "Price on request"
                source_label = "📱 WhatsApp" if seller.source == "whatsapp" else "🏪 Market"
                seller_list.append(f"• **{seller.name}** - {price_str} ({source_label})")

            response = f"Great! I found some sellers for the **{watch_name}**:\n\n" + "\n".join(seller_list)

            if market_data.avg_price:
                response += f"\n\n**Market Overview:**\n• Average price: €{market_data.avg_price:,.0f}\n• Range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}"

            response += "\n\nWould you like me to help you connect with any of these sellers?"
        else:
            response = f"I don't have any active listings for the **{watch_ref.brand if watch_ref else 'watch'}** at the moment, but I can keep you posted if anything comes up. Would you like to set up an alert?"

    elif intent == "sell":
        watch_name = f"{watch_ref.brand if watch_ref else 'your watch'}"
        if watch_ref and watch_ref.model:
            watch_name += f" {watch_ref.model}"

        if market_data.avg_price:
            response = f"Looking to sell your **{watch_name}**? Here's what I know about the current market:\n\n**Current Market:**\n• Average selling price: €{market_data.avg_price:,.0f}\n• Price range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}\n• Active listings: {market_data.active_orders_count}\n\nWould you like to create a sell order? I can help you list it at a competitive price."
        else:
            response = f"I can help you list your **{watch_name}** for sale. To create a listing, you'll need to provide:\n\n1. Watch condition\n2. Box & papers availability\n3. Your asking price\n4. Photos\n\nWould you like to start creating a listing?"

    else:  # info intent
        watch_name = f"{watch_ref.brand if watch_ref else 'the watch'}"
        if watch_ref and watch_ref.model:
            watch_name += f" {watch_ref.model}"

        if market_data.avg_price:
            response = f"Here's what I know about the **{watch_name}**:\n\n**Market Data:**\n• Average price: €{market_data.avg_price:,.0f}\n• Price range: €{market_data.min_price:,.0f} - €{market_data.max_price:,.0f}\n• Active listings: {market_data.active_orders_count}\n• WhatsApp market activity: {market_data.whatsapp_listings_count} recent mentions"
        else:
            response = f"I have the **{watch_name}** on record, but I don't have current market data available. Would you like me to search for more information or set up a price alert?"

    return {
        "detected_intent": intent,
        "detected_watches": [watch_ref] if watch_ref else [],
        "market_data": market_data if watch_ref else None,
        "available_sellers": available_sellers,
        "suggested_response": response,
        "requires_clarification": False,
        "clarification_options": [],
    }


@router.get("/assistant/search-sellers")
async def search_sellers(
    brand: Optional[str] = None,
    reference: Optional[str] = None,
    model: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Search for sellers of a specific watch"""

    sellers: List[dict] = []

    # Search orders using MongoDB query
    order_query = {
        "order_type": OrderType.SELL.value,
        "status": OrderStatus.ACTIVE.value,
    }
    if brand:
        order_query["brand"] = {"$regex": brand, "$options": "i"}
    if reference:
        order_query["reference"] = {"$regex": reference, "$options": "i"}
    if model:
        order_query["model"] = {"$regex": model, "$options": "i"}

    try:
        orders = await Order.find(order_query).limit(20).to_list()
        for order in orders:
            user = None
            if order.user_id:
                try:
                    user = await User.get(PydanticObjectId(order.user_id))
                except Exception:
                    pass
            sellers.append({
                "name": user.name if user else (order.user_name or "Anonymous"),
                "price": order.price,
                "currency": order.currency or "EUR",
                "condition": order.condition.value if order.condition else None,
                "source": "market",
                "listing_id": str(order.id),
            })
    except Exception:
        pass

    # Search WhatsApp
    wa_query = {}
    if brand:
        wa_query["brand"] = {"$regex": brand, "$options": "i"}
    if reference:
        wa_query["reference"] = {"$regex": reference, "$options": "i"}

    try:
        if wa_query:
            wa_listings = await ExtractedWatchListing.find(wa_query).sort([("message_timestamp", -1)]).limit(20).to_list()
            for listing in wa_listings:
                if listing.seller_name:
                    sellers.append({
                        "name": listing.seller_name,
                        "price": listing.price,
                        "currency": listing.currency or "USD",
                        "condition": listing.condition,
                        "source": "whatsapp",
                        "message_date": listing.message_timestamp.isoformat() if listing.message_timestamp else None,
                    })
    except Exception:
        pass

    return {
        "count": len(sellers),
        "sellers": sellers,
    }
