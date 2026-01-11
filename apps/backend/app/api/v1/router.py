from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, market, inventory, chat, profile, admin, news,
    chat_groups, billing, watchlist_admin, default_watchlist_admin,
    activity, whatsapp, ai_insights, upload, orders, assistant, ai_chat,
    listing_fields, filters, support, reviews
)

api_router = APIRouter()

# Include routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(news.router, prefix="/news", tags=["news"])
api_router.include_router(chat_groups.router, prefix="/chat-groups", tags=["chat-groups"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(watchlist_admin.router, prefix="/watchlist", tags=["watchlist-admin"])
api_router.include_router(default_watchlist_admin.router, prefix="/default-watchlist", tags=["default-watchlist-admin"])
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["whatsapp"])
api_router.include_router(ai_insights.router, prefix="/insights", tags=["ai-insights"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(assistant.router, tags=["assistant"])
api_router.include_router(ai_chat.router, tags=["ai-chat"])
api_router.include_router(listing_fields.router, prefix="/listing-fields", tags=["listing-fields"])
api_router.include_router(filters.router, prefix="/filters", tags=["filters"])
api_router.include_router(support.router, prefix="/support", tags=["support"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])


@api_router.get("/status")
async def api_status():
    """API status check"""
    return {"status": "API v1 is running"}
