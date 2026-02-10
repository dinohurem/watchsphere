"""
Vercel serverless function entry point for FastAPI.

Vercel serverless does not support WebSocket/Socket.IO and does not
reliably fire ASGI lifespan (on_startup) events, so we:
  1. Import fastapi_app directly (not the Starlette wrapper with Socket.IO).
  2. Add middleware that lazily initializes the MongoDB/Beanie connection
     on the first request (once per cold start).
"""
import asyncio
from app.main import fastapi_app
from app.db.session import connect_to_mongo

_db_initialized = False


@fastapi_app.middleware("http")
async def ensure_db(request, call_next):
    global _db_initialized
    if not _db_initialized:
        await connect_to_mongo()
        _db_initialized = True
    return await call_next(request)


# Vercel expects the variable named `app`
app = fastapi_app
