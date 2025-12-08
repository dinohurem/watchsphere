from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, market, inventory, chat, profile, admin, news,
    chat_groups, billing, watchlist_admin, activity, whatsapp, ai_insights
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
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["whatsapp"])
api_router.include_router(ai_insights.router, prefix="/insights", tags=["ai-insights"])


@api_router.get("/status")
async def api_status():
    """API status check"""
    return {"status": "API v1 is running"}
