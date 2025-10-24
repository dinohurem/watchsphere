from fastapi import APIRouter

# Import endpoint routers here as they're created
# from app.api.v1.endpoints import auth, market, inventory, chat, ai_assistant

api_router = APIRouter()

# Include routers here
# api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
# api_router.include_router(market.router, prefix="/market", tags=["market"])
# api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
# api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
# api_router.include_router(ai_assistant.router, prefix="/ai", tags=["ai-assistant"])


@api_router.get("/status")
async def api_status():
    """API status check"""
    return {"status": "API v1 is running"}
