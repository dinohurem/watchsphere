"""HTTP contract of the redesign endpoints used by the iOS app (pending approval, profile,
alerts, market browse, Activity)."""

import pytest
import pytest_asyncio

from app.core.security import create_tokens


@pytest_asyncio.fixture
async def env():
    from beanie import init_beanie
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from mongomock_motor import AsyncMongoMockClient

    from app.api.v1.endpoints import (
        auth, market_browse, notifications, profile, watch_alerts,
    )
    from app.models.notification import Notification
    from app.models.order import Order
    from app.models.user import User
    from app.models.watch import Watch, WatchStatus
    from app.models.watch_alert import WatchAlert
    from app.models.watchlist import WatchlistRecord

    client = AsyncMongoMockClient()
    await init_beanie(database=client["redesign_api_test"],
                      document_models=[User, Watch, Order, WatchAlert, Notification,
                                       WatchlistRecord])

    pending = User(email="p@x.io", name="P", approved=False, username="p")
    approved = User(email="a@x.io", name="A", approved=True, username="a")
    await pending.insert()
    await approved.insert()
    watch = Watch(brand="Rolex", model="Cosmograph Daytona", collection="Daytona",
                  reference="126518LN", ws_code="126518LN Pikachu", aliases=["Pikachu"],
                  dealer_id="x", status=WatchStatus.ACTIVE, cover_image="img.webp")
    await watch.insert()

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1/auth")
    app.include_router(profile.router, prefix="/api/v1/profile")
    app.include_router(market_browse.router, prefix="/api/v1/market")
    app.include_router(watch_alerts.router, prefix="/api/v1/watch-alerts")
    app.include_router(notifications.router, prefix="/api/v1/notifications")

    def headers(user):
        return {"Authorization": f"Bearer {create_tokens(str(user.id))[0]}"}

    with TestClient(app) as c:
        yield {"c": c, "pending": headers(pending), "approved": headers(approved),
               "approved_user": approved, "watch": watch}


def test_pending_user_sees_only_allowlisted_endpoints(env):
    c, h = env["c"], env["pending"]
    me = c.get("/api/v1/profile/me", headers=h)
    assert me.status_code == 200 and me.json()["approved"] is False
    assert c.get("/api/v1/auth/me", headers=h).json()["approved"] is False
    for path in ("/api/v1/market/cards", "/api/v1/watch-alerts", "/api/v1/notifications",
                 "/api/v1/profile/watchlist"):
        r = c.get(path, headers=h)
        assert r.status_code == 403 and r.json() == {"detail": "account_pending_approval"}, path


def test_profile_currency_and_toggles(env):
    c, h = env["c"], env["approved"]
    assert c.patch("/api/v1/profile/me", json={"preferred_currency": "XYZ"}, headers=h).status_code == 422
    r = c.patch("/api/v1/profile/me", json={"preferred_currency": "hkd"}, headers=h)
    assert r.status_code == 200 and r.json()["preferred_currency"] == "HKD"
    r = c.patch("/api/v1/profile/notification-preferences",
                json={"notify_alert_matches": False, "email_notifications_enabled": False}, headers=h)
    assert r.json()["notify_alert_matches"] is False
    me = c.get("/api/v1/profile/me", headers=h).json()
    for key in ("preferred_currency", "username", "approved", "whatsapp_phone",
                "notifications_enabled", "email_notifications_enabled", "notify_alert_matches"):
        assert key in me
    assert me["email_notifications_enabled"] is False


def test_recently_viewed(env):
    c, h = env["c"], env["approved"]
    assert c.get("/api/v1/profile/recently-viewed", headers=h).json() == []
    assert c.post("/api/v1/profile/recently-viewed", json={"ws_code": "nope"}, headers=h).status_code == 404
    r = c.post("/api/v1/profile/recently-viewed", json={"ws_code": "126518LN Pikachu"}, headers=h)
    assert r.json()["recently_viewed"] == ["126518LN Pikachu"]
    cards = c.get("/api/v1/profile/recently-viewed", headers=h).json()
    assert cards[0]["ws_code"] == "126518LN Pikachu" and cards[0]["image"] == "img.webp"
    assert set(cards[0]) == {"id", "ws_code", "brand", "model", "reference", "collection", "image",
                             "thumbnail", "change_1m_pct", "wts_count", "wtb_count", "retail_pct"}


def test_alert_crud_and_validation(env):
    c, h = env["c"], env["approved"]
    base = {"ws_code": "126518LN Pikachu", "alert_type": "wts", "year_mode": "newer", "year": 2022,
            "condition": "unworn", "locations": ["EU", "hk"], "price_mode": "max",
            "price_amount": 150000, "currency": "EUR"}
    assert c.post("/api/v1/watch-alerts", json={**base, "alert_type": "wtb"}, headers=h).status_code == 422
    assert c.post("/api/v1/watch-alerts", json={**base, "year": None}, headers=h).status_code == 422
    assert c.post("/api/v1/watch-alerts", json={**base, "currency": "BTC"}, headers=h).status_code == 422
    r = c.post("/api/v1/watch-alerts", json=base, headers=h)
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["locations"] == ["EU", "HK"] and a["brand"] == "Rolex" and a["reference"] == "126518LN"
    wtb = c.post("/api/v1/watch-alerts", json={"ws_code": "126518LN Pikachu", "alert_type": "wtb",
                                               "price_mode": "min", "price_amount": 100000},
                 headers=h).json()
    assert wtb["currency"] == "EUR" and wtb["year_mode"] == "any"

    mine = c.get("/api/v1/watch-alerts", headers=h).json()
    assert len(mine) == 2
    per_watch = c.get("/api/v1/watch-alerts/126518LN Pikachu", headers=h).json()
    assert [x["alert_type"] for x in per_watch] == ["wts", "wtb"]

    upd = c.put(f"/api/v1/watch-alerts/{a['id']}", json={**base, "price_mode": "any"}, headers=h).json()
    assert upd["price_mode"] == "any" and upd["price_amount"] is None
    assert c.delete(f"/api/v1/watch-alerts/{a['id']}", headers=h).json() == {"ok": True}
    assert len(c.get("/api/v1/watch-alerts", headers=h).json()) == 1


def test_market_browse(env):
    c, h = env["c"], env["approved"]
    r = c.get("/api/v1/market/search", params={"q": "pikachu"}, headers=h).json()
    assert [x["ws_code"] for x in r["items"]] == ["126518LN Pikachu"]
    assert c.get("/api/v1/market/search", params={"q": "submariner"}, headers=h).json() == {"items": []}
    cards = c.get("/api/v1/market/cards", params={"brand": "rolex", "collection": "daytona"},
                  headers=h).json()
    assert cards["total"] == 1 and cards["items"][0]["collection"] == "Daytona"
    assert c.get("/api/v1/market/brand-tabs", headers=h).json() == ["Rolex"]
    assert c.get("/api/v1/market/facets/collections", params={"brand": "Rolex"}, headers=h).json() == \
        [{"collection": "Daytona", "model_count": 1}]
    assert c.get("/api/v1/market/facets/models", params={"brand": "Rolex", "collection": "Daytona"},
                 headers=h).json() == ["Cosmograph Daytona"]
    assert c.get("/api/v1/market/facets/references",
                 params={"brand": "Rolex", "q": "12651"}, headers=h).json() == ["126518LN"]
    assert c.get("/api/v1/market/cards", params={"signal": "nope"}, headers=h).status_code == 422


@pytest.mark.asyncio
async def test_activity_filters(env):
    from app.models.notification import Notification, NotificationType

    c, h, user = env["c"], env["approved"], env["approved_user"]
    await Notification(user_id=str(user.id), type=NotificationType.ALERT_MATCH, title="t", body="b",
                       data={"kind": "wts", "ws_code": "126518LN Pikachu"}).insert()
    await Notification(user_id=str(user.id), type=NotificationType.NEW_MESSAGE, title="m",
                       body="b").insert()
    r = c.get("/api/v1/notifications", params={"type": "alert_match"}, headers=h).json()
    assert r["total"] == 1 and r["unread_count"] == 1
    item = r["notifications"][0]
    assert item["type"] == "alert_match" and item["read"] is False and item["data"]["kind"] == "wts"
    assert c.get("/api/v1/notifications/unread-count", params={"type": "alert_match"},
                 headers=h).json() == {"count": 1}
    assert c.post("/api/v1/notifications/read-all", params={"type": "alert_match"},
                  headers=h).json()["updated_count"] == 1
    assert c.get("/api/v1/notifications/unread-count", headers=h).json() == {"count": 1}
