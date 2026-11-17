"""Reposted rows collapse into one review item, the startup cleanup removes the
copies that piled up, and processing pauses (without losing the upload) while an
AI provider is out of credit or the database is nearly full."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import ai_credit, pipeline


@pytest_asyncio.fixture
async def item_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.pipeline import PipelineItem, PipelineUpload

    client = AsyncMongoMockClient()
    await init_beanie(database=client["repost_test"], document_models=[PipelineItem, PipelineUpload, Order])
    ai_credit.reset()
    pipeline._drain_task = None
    pipeline._retry_task = None
    yield client
    for task in (pipeline._drain_task, pipeline._retry_task):
        if task and not task.done():
            task.cancel()
    pipeline._drain_task = None
    pipeline._retry_task = None
    ai_credit.reset()


def _row(text, phone="+85212345678", **meta):
    return {"Nummer": phone, "_meta": {"source_text": text, **meta}}


CTX = {"group_name": "HK", "upload_id": "u1", "run_id": "r1"}


async def _items(**f):
    from app.models.pipeline import PipelineItem

    return await PipelineItem.find(f).to_list()


# --- reposts ----------------------------------------------------------------

@pytest.mark.asyncio
async def test_repost_bumps_the_waiting_item_instead_of_adding_one(item_db):
    from app.models.pipeline import ReviewKind

    rows = [_row("WTS 126610LN 105k"), _row("WTS 126610LN 105k"), _row("WTS 5711 900k")]
    assert await pipeline._create_items(ReviewKind.NOT_IN_DATABASE, rows, "WTS", CTX, {}, {}) == 3
    ctx2 = dict(CTX, upload_id="u2", run_id="r2")
    assert await pipeline._create_items(
        ReviewKind.NOT_IN_DATABASE, [_row("wts  126610ln 105k")], "WTS", ctx2, {}, {}) == 1

    items = {i.text_key: i for i in await _items()}
    assert len(items) == 2
    rolex = items["wts 126610ln 105k"]
    assert rolex.occurrences == 3
    assert rolex.upload_id == "u2" and rolex.last_seen_at


@pytest.mark.asyncio
async def test_other_sender_mode_or_resolved_item_gets_its_own_item(item_db):
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    await pipeline._create_items(ReviewKind.UNSURE, [_row("126334 blue")], "WTS", CTX, {}, {})
    await pipeline._create_items(ReviewKind.UNSURE, [_row("126334 blue", phone="+49151")], "WTS", CTX, {}, {})
    await pipeline._create_items(ReviewKind.UNSURE, [_row("126334 blue")], "WTB", CTX, {}, {})
    assert len(await _items()) == 3

    first = await PipelineItem.find_one({"sender_phone": "+85212345678", "mode": "WTS"})
    first.status = ReviewStatus.RESOLVED
    await first.save()
    await pipeline._create_items(ReviewKind.UNSURE, [_row("126334 blue")], "WTS", CTX, {}, {})
    assert len(await _items()) == 4  # an admin already handled the old one


@pytest.mark.asyncio
async def test_discarded_reposts_refresh_expiry_and_ai_decisions_are_never_merged(item_db):
    from app.models.pipeline import PipelineItem, ReviewKind

    await pipeline._create_items(ReviewKind.DISCARDED, [_row("price?")], "WTS", CTX, {}, {})
    old = await PipelineItem.find_one({})
    old.expires_at = datetime.utcnow() + timedelta(days=1)
    await old.save()
    await pipeline._create_items(ReviewKind.DISCARDED, [_row("price?")], "WTS", CTX, {}, {})
    (item,) = await _items(kind="discarded")
    assert item.occurrences == 2
    assert item.expires_at > datetime.utcnow() + timedelta(days=pipeline.DISCARD_TTL_DAYS - 1)

    for _ in range(2):
        await pipeline._create_items(ReviewKind.AI_DECISION, [_row("126334 blue")], "WTS", CTX, {}, {})
    assert len(await _items(kind="ai_decision")) == 2


@pytest.mark.asyncio
async def test_repost_does_not_store_its_photo_again(item_db, monkeypatch):
    from app.models.pipeline import ReviewKind

    saved = []

    async def fake_put(bucket, data, filename, metadata=None):
        saved.append(filename)
        return "%024x" % len(saved)

    monkeypatch.setattr(pipeline, "_put", fake_put)
    media = {"a.jpg": b"x"}
    row = _row("126334 blue", image_file="a.jpg")
    await pipeline._create_items(ReviewKind.UNSURE, [row], "WTS", CTX, media, {})
    await pipeline._create_items(ReviewKind.UNSURE, [row], "WTS", CTX, media, {})
    assert saved == ["a.jpg"]


# --- startup cleanup ----------------------------------------------------------

@pytest.mark.asyncio
async def test_cleanup_keeps_newest_copy_sums_counts_and_frees_unused_photos(item_db, monkeypatch):
    from app.models.order import Order
    from app.models.pipeline import PipelineItem

    deleted_images = []

    async def fake_delete(bucket, file_id):
        deleted_images.append((bucket, file_id))

    monkeypatch.setattr(pipeline, "_delete", fake_delete)

    def item(text, image=None, kind="not_in_database", **more):
        return PipelineItem(kind=kind, mode="WTS", group_name="HK", text_key=text,
                            sender_phone="+852", image_id=image, **more)

    for img in ("i1", "i2", "i3"):
        await item("dup", image=img).insert()
    await item("single").insert()
    await item("ai", kind="ai_decision").insert()
    await item("ai", kind="ai_decision").insert()
    # i2 is still shown by an order
    await Order.get_motor_collection().insert_one({"source_image": pipeline.image_url("i2")})

    result = await pipeline.dedupe_review_items(batch=1)

    assert result == {"deleted": 2, "images_deleted": 1}
    dup = await _items(text_key="dup")
    assert len(dup) == 1 and dup[0].image_id == "i3" and dup[0].occurrences == 3
    assert len(await _items(text_key="single")) == 1
    assert len(await _items(kind="ai_decision")) == 2
    assert deleted_images == [(pipeline.IMAGE_BUCKET, "i1")]


@pytest.mark.asyncio
async def test_cleanup_with_nothing_to_do(item_db):
    assert await pipeline.dedupe_review_items() == {"deleted": 0, "images_deleted": 0}


# --- pausing ------------------------------------------------------------------

def test_credit_errors_are_recognised():
    assert ai_credit.check("openai", Exception(
        "Error code: 429 - {'error': {'code': 'credit_balance_exhausted', 'type': 'insufficient_quota'}}"))
    assert ai_credit.is_exhausted() and ai_credit.provider() == "openai"
    ai_credit.reset()
    assert ai_credit.check("anthropic", Exception("Your credit balance is too low to access the Anthropic API"))
    ai_credit.reset()
    assert not ai_credit.check("openai", Exception("Error code: 429 - rate limit reached, retry in 2s"))
    assert not ai_credit.is_exhausted()


async def _upload(group="HK", attempts=0):
    from app.models.pipeline import PipelineUpload

    up = PipelineUpload(group_name=group, chat_gridfs_id="0" * 24, chat_sha256=group, attempts=attempts)
    await up.insert()
    return up


@pytest.mark.asyncio
async def test_upload_waits_while_ai_is_out_of_credit(item_db, monkeypatch):
    from app.models.pipeline import PipelineUpload

    calls = []

    async def fake_process(upload):
        calls.append(upload.group_name)
        return {"new_messages": 0}

    from app.core.config import settings

    monkeypatch.setattr(pipeline, "_process_claimed", fake_process)
    monkeypatch.setattr(settings, "PIPELINE_PAUSE_DATA_MB", 0)
    ai_credit.mark_exhausted("openai")
    up = await _upload(attempts=1)

    result = await pipeline.process_upload(str(up.id))

    assert result == {"paused": "AI provider openai is out of credit"}
    assert calls == []
    again = await PipelineUpload.get(up.id)
    assert again.status.value == "received" and again.attempts == 1
    assert again.error.startswith("Waiting:")


@pytest.mark.asyncio
async def test_credit_running_out_mid_upload_keeps_it_queued(item_db, monkeypatch):
    from app.core.config import settings
    from app.models.pipeline import PipelineUpload

    monkeypatch.setattr(settings, "PIPELINE_PAUSE_DATA_MB", 0)

    async def generator_hits_credit_error(upload):
        ai_credit.check("anthropic", Exception("Your credit balance is too low"))
        pipeline._raise_if_ai_exhausted()
        return {}

    monkeypatch.setattr(pipeline, "_process_claimed", generator_hits_credit_error)
    up = await _upload()
    result = await pipeline.process_upload(str(up.id))
    assert "paused" in result
    again = await PipelineUpload.get(up.id)
    assert again.status.value == "received" and again.attempts == 0


@pytest.mark.asyncio
async def test_worker_pauses_when_database_is_nearly_full_and_retries_later(item_db, monkeypatch):
    from app.core.config import settings
    from app.models.pipeline import PipelineUpload

    monkeypatch.setattr(settings, "PIPELINE_PAUSE_DATA_MB", 4600)
    size = {"mib": 5000.0}

    async def fake_size():
        return size["mib"]

    processed = []

    async def fake_process(upload):
        processed.append(upload.group_name)
        return {"new_messages": 0}

    async def no_delete(bucket, file_id):
        return None

    monkeypatch.setattr(pipeline, "database_size_mib", fake_size)
    monkeypatch.setattr(pipeline, "_process_claimed", fake_process)
    monkeypatch.setattr(pipeline, "_delete", no_delete)
    monkeypatch.setattr(pipeline, "PAUSE_RETRY_SECONDS", 0.01)
    up = await _upload()

    pipeline.kick_processing()
    await pipeline._drain_task
    assert processed == []
    assert (await PipelineUpload.get(up.id)).status.value == "received"
    assert pipeline._retry_task is not None

    size["mib"] = 3000.0
    await pipeline._retry_task
    await pipeline._drain_task
    assert processed == ["HK"]
    assert (await PipelineUpload.get(up.id)).status.value == "done"


@pytest.mark.asyncio
async def test_openai_request_stops_retrying_on_credit_error(monkeypatch):
    from app.services import wtb_wts_service

    ai_credit.reset()
    attempts = []

    class Completions:
        async def create(self, **kw):
            attempts.append(1)
            raise Exception("Error code: 429 - {'error': {'code': 'credit_balance_exhausted'}}")

    class Client:
        chat = type("C", (), {"completions": Completions()})()

    items, truncated = await wtb_wts_service._request_json_array(Client(), "p", "AI matching")
    assert (items, truncated) == ([], False)
    assert len(attempts) == 1 and ai_credit.is_exhausted()
    # While exhausted, no call goes out at all.
    await wtb_wts_service._request_json_array(Client(), "p", "AI matching")
    assert len(attempts) == 1
    ai_credit.reset()
