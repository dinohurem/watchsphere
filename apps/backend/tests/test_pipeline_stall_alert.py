"""Exports arrive but no order is created: the admins get one email, with the reason."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import ai_credit, pipeline, pipeline_alert

NOW = datetime(2026, 11, 24, 12, 0)


@pytest_asyncio.fixture
async def db(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.pipeline import PipelineReportState, PipelineUpload
    from app.models.user import User

    client = AsyncMongoMockClient()
    await init_beanie(database=client["stall_test"],
                      document_models=[PipelineUpload, PipelineReportState, Order, User])
    ai_credit.reset()

    sent: list[str] = []

    async def fake_send(lines):
        sent.append("\n".join(lines))
        return 1

    monkeypatch.setattr(pipeline_alert, "_send", fake_send)

    async def no_db_limit():
        return f"AI provider {ai_credit.provider()} is out of credit" if ai_credit.is_exhausted() else None

    monkeypatch.setattr(pipeline, "pause_reason", no_db_limit)
    yield client, sent
    ai_credit.reset()


async def _upload(received_at, status="received", error=None):
    await pipeline_alert_coll("pipeline_uploads").insert_one({
        "group_name": "HK", "status": status, "attempts": 0, "error": error,
        "received_at": received_at, "run_ids": {}, "stats": {},
    })


def pipeline_alert_coll(name):
    from app.models.pipeline import PipelineUpload

    return PipelineUpload.get_motor_collection().database[name]


async def _order(first_seen_at, phone="+85212345678"):
    await pipeline_alert_coll("orders").insert_one({"first_seen_at": first_seen_at, "whatsapp_phone": phone})


@pytest.mark.asyncio
async def test_uploads_without_orders_send_one_alert_with_the_reason(db):
    _, sent = db
    await _order(NOW - timedelta(hours=30))
    await _upload(NOW - timedelta(minutes=30), error="Waiting: AI provider openai is out of credit")
    ai_credit.mark_exhausted("openai")

    result = await pipeline_alert.check_and_alert(NOW)

    assert result == {"stalled": True, "sent_to": 1}
    assert "Processing is paused: AI provider openai is out of credit" in sent[0]
    assert "Uploads waiting to be processed: 1" in sent[0]

    # Still stuck an hour later: no second email inside the repeat interval.
    assert (await pipeline_alert.check_and_alert(NOW + timedelta(hours=1)))["sent_to"] == 0
    # After the repeat interval it reminds again (the Mac mini keeps uploading).
    await _upload(NOW + timedelta(hours=5, minutes=30))
    assert (await pipeline_alert.check_and_alert(NOW + timedelta(hours=6)))["sent_to"] == 1
    assert len(sent) == 2


@pytest.mark.asyncio
async def test_recent_order_means_no_alert(db):
    _, sent = db
    await _order(NOW - timedelta(minutes=50))
    await _upload(NOW - timedelta(minutes=10), status="done")

    assert (await pipeline_alert.check_and_alert(NOW))["stalled"] is False
    assert sent == []


@pytest.mark.asyncio
async def test_no_uploads_means_no_alert(db):
    """The Mac mini being off is not this alert's case: no exports, nothing expected."""
    _, sent = db
    await _order(NOW - timedelta(hours=30))
    await _upload(NOW - timedelta(hours=5), status="done")

    assert (await pipeline_alert.check_and_alert(NOW))["stalled"] is False
    assert sent == []


@pytest.mark.asyncio
async def test_manual_orders_do_not_count_as_pipeline_output(db):
    _, sent = db
    await _order(NOW - timedelta(hours=30))
    await _order(NOW - timedelta(minutes=5), phone=None)  # created in the app by a user
    await _upload(NOW - timedelta(minutes=30))

    assert (await pipeline_alert.check_and_alert(NOW))["stalled"] is True


@pytest.mark.asyncio
async def test_recovery_clears_the_state_so_the_next_stall_alerts_at_once(db):
    _, sent = db
    await _order(NOW - timedelta(hours=30))
    await _upload(NOW - timedelta(minutes=30))
    await pipeline_alert.check_and_alert(NOW)

    await _order(NOW + timedelta(minutes=20))
    assert (await pipeline_alert.check_and_alert(NOW + timedelta(minutes=30)))["stalled"] is False

    # Stuck again three hours later: alerts without waiting for the 6 h repeat.
    await _upload(NOW + timedelta(hours=3))
    assert (await pipeline_alert.check_and_alert(NOW + timedelta(hours=3, minutes=1)))["sent_to"] == 1
    assert len(sent) == 2


@pytest.mark.asyncio
async def test_disabled_with_zero_hours(db):
    await _order(NOW - timedelta(hours=30))
    await _upload(NOW - timedelta(minutes=30))
    status = await pipeline_alert.pipeline_status(NOW, hours=0)
    assert pipeline_alert.is_stalled(status) is False
