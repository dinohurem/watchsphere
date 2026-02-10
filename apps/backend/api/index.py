"""
Vercel serverless function entry point for FastAPI.

Vercel serverless does not support WebSocket/Socket.IO and does not
reliably fire ASGI lifespan (on_startup) events, so we:
  1. Build a standalone FastAPI app here (bypassing app.main which
     imports socketio_manager → python-socketio, unavailable on Vercel).
  2. Add middleware that lazily initializes the MongoDB/Beanie connection
     on the first request (once per cold start).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import connect_to_mongo

# Build a minimal FastAPI app (no Socket.IO / WebSocket)
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="WatchSphere - Premium Watch Trading Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

_db_initialized = False


@app.middleware("http")
async def ensure_db(request, call_next):
    global _db_initialized
    if not _db_initialized:
        await connect_to_mongo()
        _db_initialized = True
    return await call_next(request)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
