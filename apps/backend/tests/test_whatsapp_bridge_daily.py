"""Scheduled daily ingest.

The point of these is the boundary the unattended path must not cross: only
matched rows get published, and anything the price check quarantines is held
back rather than written to the order book.
"""

from datetime import datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

TOKEN_HEADER = {"X-Bridge-Token": "test-bridge-token"}


@pytest.fixture
def app_client():
    from fastapi import FastAPI

    from app.api.v1.endpoints import whatsapp_bridge

    app = FastAPI()
    app.include_router(whatsapp_bridge.router, prefix="/whatsapp-bridge")
    return app


async def _client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _capture(group_jid: str, group_name: str, content: str, minutes_ago: int = 30):
    from app.models.whatsapp_bridge import BridgeMessage

    message = BridgeMessage(
        message_id=f"m-{minutes_ago}-{abs(hash(content)) % 10_000}",
        group_jid=group_jid,
        group_name=group_name,
        sender="4915112345678@s.whatsapp.net",
        sender_phone="+4915112345678",
        content=content,
        timestamp=datetime.utcnow() - timedelta(minutes=minutes_ago),
    )
    await message.insert()
    return message


@pytest.mark.asyncio
async def test_requires_the_bridge_token(db, app_client):
    async with await _client(app_client) as client:
        response = await client.post("/whatsapp-bridge/daily-ingest", json={"hours": 24})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_rejects_an_unknown_mode(db, app_client, monkeypatch):
    _stub_admin(monkeypatch)
    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest",
            json={"hours": 24, "mode": "sideways"},
            headers=TOKEN_HEADER,
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_refuses_to_run_without_an_admin_to_attribute_to(db, app_client, monkeypatch):
    """Orders need an owner; a cron run has no user behind it."""
    from app.api.v1.endpoints import whatsapp_bridge

    async def no_admin(*args, **kwargs):
        return None

    monkeypatch.setattr(whatsapp_bridge.User, "find_one", no_admin)

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )
    assert response.status_code == 503


def _stub_admin(monkeypatch):
    from app.api.v1.endpoints import whatsapp_bridge
    from app.models.user import User

    admin = User.model_construct(
        email="admin@watchsphere.io", name="Test Admin", role="admin"
    )
    object.__setattr__(admin, "id", "admin-id")

    async def find_one(*args, **kwargs):
        return admin

    monkeypatch.setattr(whatsapp_bridge.User, "find_one", find_one)
    return admin


@pytest.mark.asyncio
async def test_empty_window_is_a_clean_no_op(db, app_client, monkeypatch):
    _stub_admin(monkeypatch)
    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )
    assert response.status_code == 200
    body = response.json()
    assert body["groups"] == []
    assert body["orders_created"] == 0


@pytest.mark.asyncio
async def test_window_is_on_ingestion_so_a_missed_run_catches_up(db, app_client, monkeypatch):
    """A skipped run must not strand the messages it would have covered.

    Captures only reach us when the bridge connects. If the cron is missed for a
    day, the backlog arrives late carrying old send times — windowing on those
    would step straight over it and no run would ever pick it up.
    """
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge
    from app.models.whatsapp_bridge import BridgeMessage

    seen: dict = {}

    async def fake_generation(*, txt_content, **kw):
        seen["txt"] = txt_content
        return {"matched_count": 0, "needs_review_count": 0,
                "not_in_database_count": 0, "matched_csv": ""}

    monkeypatch.setattr(whatsapp_bridge, "process_generation", fake_generation)

    now = datetime.utcnow()
    # Sent three days ago, but only reached us minutes ago — a late backlog.
    await BridgeMessage(
        message_id="late-1",
        group_jid="111@g.us",
        group_name="HK Dealers",
        sender="4915112345678@s.whatsapp.net",
        content="LATE arrival from a missed run",
        timestamp=now - timedelta(days=3),
        ingested_at=now - timedelta(minutes=5),
    ).insert()

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    assert response.status_code == 200
    assert "LATE arrival from a missed run" in seen["txt"]


@pytest.mark.asyncio
async def test_captures_ingested_before_the_window_are_excluded(db, app_client, monkeypatch):
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge
    from app.models.whatsapp_bridge import BridgeMessage

    seen: dict = {}

    async def fake_generation(*, txt_content, **kw):
        seen["txt"] = txt_content
        return {"matched_count": 0, "needs_review_count": 0,
                "not_in_database_count": 0, "matched_csv": ""}

    monkeypatch.setattr(whatsapp_bridge, "process_generation", fake_generation)

    now = datetime.utcnow()
    await BridgeMessage(
        message_id="in-1", group_jid="111@g.us", group_name="HK Dealers",
        sender="4915112345678@s.whatsapp.net", content="INSIDE the window",
        timestamp=now - timedelta(hours=1), ingested_at=now - timedelta(hours=1),
    ).insert()
    await BridgeMessage(
        message_id="out-1", group_jid="111@g.us", group_name="HK Dealers",
        sender="4915112345678@s.whatsapp.net", content="ALREADY ingested last run",
        timestamp=now - timedelta(hours=40), ingested_at=now - timedelta(hours=40),
    ).insert()

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    assert "INSIDE the window" in seen["txt"]
    assert "ALREADY ingested last run" not in seen["txt"]
    assert response.json()["groups"][0]["messages"] == 1


@pytest.mark.asyncio
async def test_publishes_matched_rows_and_reports_quarantine(db, app_client, monkeypatch):
    """The core contract: matched rows land, quarantined ones are held."""
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge

    async def fake_generation(**kwargs):
        return {
            "matched_count": 5,
            "needs_review_count": 2,
            "not_in_database_count": 1,
            "matched_csv": "Marke;WS-Code\nRolex;WS-1\n",
        }

    async def fake_import(csv_content, import_record, admin):
        return {
            "matched_orders": 4,
            "price_quarantined_rows": 1,
            "price_quarantine_reasons": ["HKD 103,000 is 0.11x the median"],
        }

    monkeypatch.setattr(whatsapp_bridge, "process_generation", fake_generation)
    monkeypatch.setattr(whatsapp_bridge, "process_csv_import", fake_import)

    await _capture("111@g.us", "HK Dealers", "Rolex 126610LN HKD 942k")

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    body = response.json()
    group = body["groups"][0]

    assert group["orders_created"] == 4
    assert group["price_quarantined"] == 1
    assert "0.11x" in group["quarantine_reasons"][0]
    # 2 needs-review + 1 not-in-database + 1 quarantined never reach the book.
    assert body["held_for_review"] == 4
    assert body["orders_created"] == 4


@pytest.mark.asyncio
async def test_nothing_is_imported_when_nothing_matched(db, app_client, monkeypatch):
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge

    async def fake_generation(**kwargs):
        return {"matched_count": 0, "needs_review_count": 3,
                "not_in_database_count": 0, "matched_csv": ""}

    called = {"import": False}

    async def fake_import(*args, **kwargs):
        called["import"] = True
        return {}

    monkeypatch.setattr(whatsapp_bridge, "process_generation", fake_generation)
    monkeypatch.setattr(whatsapp_bridge, "process_csv_import", fake_import)

    await _capture("111@g.us", "HK Dealers", "unparseable chatter")

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    assert called["import"] is False
    assert response.json()["orders_created"] == 0
    assert response.json()["held_for_review"] == 3


@pytest.mark.asyncio
async def test_one_failing_group_does_not_abort_the_run(db, app_client, monkeypatch):
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge

    async def flaky_generation(*, group_name, **kwargs):
        if group_name == "Broken Group":
            raise RuntimeError("parser exploded")
        return {"matched_count": 0, "needs_review_count": 0,
                "not_in_database_count": 0, "matched_csv": ""}

    monkeypatch.setattr(whatsapp_bridge, "process_generation", flaky_generation)

    await _capture("111@g.us", "Broken Group", "boom")
    await _capture("222@g.us", "Healthy Group", "fine")

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    assert response.status_code == 200
    groups = {g["group_name"]: g for g in response.json()["groups"]}
    assert "parser exploded" in groups["Broken Group"]["error"]
    assert groups["Healthy Group"]["error"] is None


@pytest.mark.asyncio
async def test_reference_month_comes_from_the_messages_not_the_clock(
    db, app_client, monkeypatch
):
    """A run just after midnight on the 1st covers the previous month.

    Dating the generation "today" would resolve every relative date in the
    window against a month the messages were not sent in.
    """
    _stub_admin(monkeypatch)
    from app.api.v1.endpoints import whatsapp_bridge

    seen: dict = {}

    async def fake_generation(*, ref_month, ref_year, **kwargs):
        seen["ref_month"] = ref_month
        seen["ref_year"] = ref_year
        return {"matched_count": 0, "needs_review_count": 0,
                "not_in_database_count": 0, "matched_csv": ""}

    monkeypatch.setattr(whatsapp_bridge, "process_generation", fake_generation)

    from app.models.whatsapp_bridge import BridgeMessage

    captured_at = datetime.utcnow() - timedelta(hours=2)
    await BridgeMessage(
        message_id="ref-1",
        group_jid="111@g.us",
        group_name="HK Dealers",
        sender="4915112345678@s.whatsapp.net",
        content="Rolex 126610LN HKD 942k",
        timestamp=captured_at,
    ).insert()

    async with await _client(app_client) as client:
        response = await client.post(
            "/whatsapp-bridge/daily-ingest", json={"hours": 24}, headers=TOKEN_HEADER
        )

    assert response.status_code == 200
    assert seen["ref_month"] == captured_at.month
    assert seen["ref_year"] == captured_at.year
