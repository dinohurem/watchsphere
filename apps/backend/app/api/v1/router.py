from fastapi import APIRouter
from app.api.v1.endpoints import auth, market, inventory, chat, profile, admin

api_router = APIRouter()

# Include routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])


@api_router.get("/status")
async def api_status():
    """API status check"""
    return {"status": "API v1 is running"}
