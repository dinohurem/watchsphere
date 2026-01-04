from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from openai import AsyncOpenAI

from app.core.config import settings
from app.models.watch import Watch, WatchStatus
from app.models.news import News, NewsStatus


# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


async def get_market_context() -> str:
    """Get current market data for AI context"""
    # Get active watches for market context
    active_watches = await Watch.find(
        Watch.status == WatchStatus.ACTIVE
    ).sort([("created_at", -1)]).limit(50).to_list()

    # Get recent news
    recent_news = await News.find(
        News.status == NewsStatus.PUBLISHED
    ).sort([("published_at", -1)]).limit(10).to_list()

    # Format watch data
    watch_summary = []
    for watch in active_watches:
        watch_summary.append({
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": f"{watch.price} {watch.currency}",
            "condition": watch.condition.value if watch.condition else "unknown",
            "year": watch.year,
        })

    # Format news data
    news_summary = []
    for article in recent_news:
        news_summary.append({
            "title": article.title,
            "excerpt": article.excerpt,
            "published": article.published_at.strftime("%Y-%m-%d") if article.published_at else None,
            "tags": article.tags,
        })

    # Get price statistics per brand
    brand_stats = {}
    for watch in active_watches:
        brand = watch.brand
        if brand not in brand_stats:
            brand_stats[brand] = {"count": 0, "min_price": float('inf'), "max_price": 0, "prices": []}
        brand_stats[brand]["count"] += 1
        brand_stats[brand]["prices"].append(watch.price)
        brand_stats[brand]["min_price"] = min(brand_stats[brand]["min_price"], watch.price)
        brand_stats[brand]["max_price"] = max(brand_stats[brand]["max_price"], watch.price)

    # Calculate averages
    for brand in brand_stats:
        prices = brand_stats[brand]["prices"]
        brand_stats[brand]["avg_price"] = round(sum(prices) / len(prices), 2)
        del brand_stats[brand]["prices"]  # Remove the list
        if brand_stats[brand]["min_price"] == float('inf'):
            brand_stats[brand]["min_price"] = 0

    context = f"""
Current WatchSphere Market Data (as of {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}):

ACTIVE LISTINGS ({len(active_watches)} watches):
{json.dumps(watch_summary[:20], indent=2)}

BRAND STATISTICS:
{json.dumps(brand_stats, indent=2)}

RECENT NEWS & UPDATES ({len(recent_news)} articles):
{json.dumps(news_summary, indent=2)}
"""
    return context


SYSTEM_PROMPT = """You are WatchSphere AI, an expert luxury watch market assistant. You help users with:

1. **Market Insights**: Provide information about watch prices, trends, and market conditions
2. **Watch Recommendations**: Suggest watches based on budget, preferences, and investment potential
3. **Price Analysis**: Help evaluate if a watch is fairly priced compared to market data
4. **Authentication Tips**: General advice about verifying watch authenticity
5. **Investment Advice**: Discuss which watches might hold value or appreciate

IMPORTANT GUIDELINES:
- Always base your answers on the provided market data when available
- Be honest when you don't have specific information
- Never guarantee investment returns
- Recommend consulting authorized dealers for authentication
- Keep responses concise but informative
- Use EUR as the default currency unless specified otherwise
- Be professional yet friendly

You have access to real-time market data from WatchSphere's platform."""


async def generate_ai_response(
    user_message: str,
    conversation_history: List[Dict[str, str]],
    include_market_context: bool = True,
) -> str:
    """
    Generate an AI response using OpenAI with market context.

    Args:
        user_message: The user's message
        conversation_history: Previous messages in the conversation
        include_market_context: Whether to include current market data

    Returns:
        The AI's response text
    """
    if not openai_client:
        return "AI service is not configured. Please add your OpenAI API key to enable AI chat."

    try:
        # Build the messages array
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        # Add market context if requested
        if include_market_context:
            market_context = await get_market_context()
            messages.append({
                "role": "system",
                "content": f"Current market data context:\n{market_context}"
            })

        # Add conversation history
        for msg in conversation_history[-10:]:  # Keep last 10 messages for context
            role = "assistant" if msg.get("is_ai") else "user"
            messages.append({"role": role, "content": msg["content"]})

        # Add the current user message
        messages.append({"role": "user", "content": user_message})

        # Call OpenAI API
        response = await openai_client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for best quality
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"I apologize, but I encountered an error processing your request. Please try again later. Error: {str(e)}"


async def get_watch_recommendation(
    budget_min: float,
    budget_max: float,
    brands: Optional[List[str]] = None,
    purpose: str = "collection",  # collection, investment, daily_wear
) -> Dict[str, Any]:
    """
    Get watch recommendations based on criteria.
    """
    query_conditions = [
        Watch.status == WatchStatus.ACTIVE,
        Watch.price >= budget_min,
        Watch.price <= budget_max,
    ]

    if brands:
        query_conditions.append({"brand": {"$in": brands}})

    watches = await Watch.find(*query_conditions).sort([("views", -1)]).limit(10).to_list()

    recommendations = []
    for watch in watches:
        recommendations.append({
            "id": str(watch.id),
            "brand": watch.brand,
            "model": watch.model,
            "reference": watch.reference,
            "price": watch.price,
            "currency": watch.currency,
            "condition": watch.condition.value if watch.condition else None,
            "year": watch.year,
            "cover_image": watch.cover_image,
        })

    return {
        "recommendations": recommendations,
        "total_found": len(recommendations),
        "criteria": {
            "budget_range": f"{budget_min} - {budget_max}",
            "brands": brands,
            "purpose": purpose,
        }
    }
