"""Shared test fixtures.

MongoDB is stubbed with mongomock-motor so the suite runs without a server.
Beanie is initialised against that stub, which covers the document CRUD,
bulk_write upserts and aggregation pipelines the bridge endpoints rely on.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio

# Make `app` importable when pytest is run from anywhere.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Keep tests off any real service before app modules read settings.
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("WHATSAPP_BRIDGE_TOKEN", "test-bridge-token")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db():
    """Initialise Beanie against an in-memory Mongo stub, fresh per test."""
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.whatsapp_bridge import BridgeMessage, BridgeStatus

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["watchsphere_test"],
        document_models=[BridgeMessage, BridgeStatus],
    )
    yield client


@pytest.fixture
def admin_user():
    """A stand-in admin for dependency overrides."""
    from app.models.user import User

    user = User.model_construct(
        email="admin@watchsphere.io",
        name="Test Admin",
        role="admin",
    )
    # Documents built with model_construct have no id; the endpoints only ever
    # stringify it for run bookkeeping.
    user.id = None
    return user


@pytest.fixture
def api(db, admin_user):
    """A minimal app exposing only the bridge router.

    main.py mounts Socket.IO and opens a real Mongo connection on startup;
    neither is under test here, so the router is mounted standalone.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import whatsapp_bridge
    from app.core.deps import get_current_admin_user

    application = FastAPI()
    application.include_router(whatsapp_bridge.router, prefix="/whatsapp-bridge")
    application.dependency_overrides[get_current_admin_user] = lambda: admin_user

    with TestClient(application) as client:
        yield client
