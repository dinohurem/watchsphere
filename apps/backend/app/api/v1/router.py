from fastapi import APIRouter
from app.api.v1.endpoints import auth

api_router = APIRouter()

# Include routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])


@api_router.get("/status")
async def api_status():
    """API status check"""
    return {"status": "API v1 is running"}
