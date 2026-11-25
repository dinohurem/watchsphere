"""Processing queue: a few groups at a time (never one group twice at once),
live uploads oldest first then backfills, interrupted uploads requeued at
startup, process-pending answers without waiting. Every hourly export is
processed (none is superseded); re-sent lost exports come back as backfills."""
import asyncio
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import pipeline


@pytest_asyncio.fixture
async def upload_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.pipeline import PipelineUpload

    client = AsyncMongoMockClient()
    await init_beanie(database=client["queue_test"], document_models=[PipelineUpload])
    pipeline._drain_task = None
    pipeline._active_groups.clear()
    yield client
    if pipeline._drain_task and not pipeline._drain_task.done():
        pipeline._drain_task.cancel()
    pipeline._drain_task = None


async def _upload(group, minutes_ago, status="received", attempts=0, backfill=False):
    from app.models.pipeline import PipelineUpload

    up = PipelineUpload(group_name=group, chat_gridfs_id="0" * 24, chat_sha256=f"{group}-{minutes_ago}",
                        status=status, attempts=attempts, backfill=backfill,
                        received_at=datetime.utcnow() - timedelta(minutes=minutes_ago))
    await up.insert()
    return up


@pytest.fixture
def fake_processing(monkeypatch):
    """Replace the generator run: records order and the highest concurrency seen."""
    seen = {"order": [], "running": 0, "max_running": 0}

    seen["per_group"] = {}
    seen["max_per_group"] = 0

    async def fake(upload):
        g = upload.group_name
        seen["running"] += 1
        seen["per_group"][g] = seen["per_group"].get(g, 0) + 1
        seen["max_running"] = max(seen["max_running"], seen["running"])
        seen["max_per_group"] = max(seen["max_per_group"], seen["per_group"][g])
        await asyncio.sleep(0.01)
        seen["order"].append(g)
        seen["per_group"][g] -= 1
        seen["running"] -= 1
        return {"new_messages": 0}

    async def no_delete(bucket, file_id):
        return None

    monkeypatch.setattr(pipeline, "_process_claimed", fake)
    monkeypatch.setattr(pipeline, "_delete", no_delete)
    return seen


@pytest.mark.asyncio
async def test_uploads_run_in_parallel_up_to_the_worker_limit(upload_db, fake_processing, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PIPELINE_WORKERS", 3)
    ups = [await _upload(f"G{i}", 10 - i) for i in range(6)]
    await asyncio.gather(*(pipeline.process_upload(str(u.id)) for u in ups))
    assert fake_processing["max_running"] == 3
    assert len(fake_processing["order"]) == 6


@pytest.mark.asyncio
async def test_never_two_uploads_of_one_group_at_once(upload_db, fake_processing, monkeypatch):
    from app.core.config import settings
    from app.models.pipeline import PipelineUpload

    monkeypatch.setattr(settings, "PIPELINE_WORKERS", 4)
    for i in range(4):
        await _upload("A", 60 - i)  # four hourly exports of one group
    await _upload("B", 30)
    pipeline.kick_processing()
    await pipeline._drain_task
    assert fake_processing["max_per_group"] == 1
    assert fake_processing["order"].count("A") == 4  # every hourly export, none superseded
    assert {u.status.value for u in await PipelineUpload.find_all().to_list()} == {"done"}


@pytest.mark.asyncio
async def test_live_uploads_go_before_backfills(upload_db, fake_processing, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PIPELINE_WORKERS", 1)
    await _upload("old-backfill", 90, backfill=True)
    await _upload("live", 5)
    pipeline.kick_processing()
    await pipeline._drain_task
    assert fake_processing["order"] == ["live", "old-backfill"]


@pytest.mark.asyncio
async def test_worker_drains_received_oldest_first_and_skips_others(upload_db, fake_processing, monkeypatch):
    from app.core.config import settings
    from app.models.pipeline import PipelineUpload

    monkeypatch.setattr(settings, "PIPELINE_WORKERS", 1)

    await _upload("newer", 1)
    await _upload("older", 5)
    await _upload("done", 9, status="done", attempts=1)
    await _upload("used-up", 8, status="received", attempts=pipeline.MAX_ATTEMPTS)
    pipeline.kick_processing()
    pipeline.kick_processing()  # second kick reuses the running worker
    await pipeline._drain_task
    assert fake_processing["order"] == ["older", "newer"]
    statuses = {u.group_name: u.status.value for u in await PipelineUpload.find_all().to_list()}
    assert statuses == {"newer": "done", "older": "done", "done": "done", "used-up": "received"}


@pytest.mark.asyncio
async def test_startup_recovery_requeues_interrupted_and_gives_up_after_max(upload_db, fake_processing, monkeypatch):
    from app.models.pipeline import PipelineUpload

    monkeypatch.setattr(pipeline, "RECOVERY_RETRY_SECONDS", 0)

    await _upload("interrupted", 5, status="processing", attempts=1)
    await _upload("crashes-server", 6, status="processing", attempts=pipeline.MAX_ATTEMPTS)
    result = await pipeline.recover_interrupted_uploads(delay=0)
    assert result == {"requeued": 1, "failed": 1}
    await pipeline._drain_task
    by_group = {u.group_name: u for u in await PipelineUpload.find_all().to_list()}
    assert by_group["interrupted"].status.value == "done"
    assert by_group["crashes-server"].status.value == "failed"
    assert "restart" in by_group["crashes-server"].error
    assert fake_processing["order"] == ["interrupted"]


@pytest.mark.asyncio
async def test_queue_pending_retries_failed_and_returns_without_waiting(upload_db, fake_processing, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "PIPELINE_WORKERS", 1)
    await _upload("failed-once", 3, status="failed", attempts=1)
    await _upload("waiting", 2)
    queued = await pipeline.queue_pending(20)
    assert queued == 2
    assert fake_processing["order"] == []  # answered before processing ran
    await pipeline._drain_task
    assert fake_processing["order"] == ["failed-once", "waiting"]


# --- hourly exports, lost uploads and backfill ---------------------------------

@pytest.fixture
def stored(monkeypatch):
    files = {}

    async def put(bucket, data, filename, metadata=None):
        fid = f"f{len(files)}"
        files[fid] = data
        return fid

    async def get(bucket, file_id):
        return files[file_id]

    monkeypatch.setattr(pipeline, "_put", put)
    monkeypatch.setattr(pipeline, "_get", get)
    return files


@pytest.mark.asyncio
async def test_newer_hourly_export_does_not_replace_the_queued_one(upload_db, stored):
    from app.models.pipeline import PipelineUpload

    first, dup1 = await pipeline.store_upload("A", b"[25.11.26, 09:10:00] X: hour 9", None)
    second, dup2 = await pipeline.store_upload("A", b"[25.11.26, 10:10:00] X: hour 10", None)
    assert not dup1 and not dup2
    ups = await PipelineUpload.find_all().to_list()
    assert {u.status.value for u in ups} == {"received"} and len(ups) == 2
    assert not first.backfill and not second.backfill


@pytest.mark.asyncio
async def test_resent_superseded_file_is_accepted_as_backfill(upload_db, stored):
    from app.models.pipeline import PipelineUpload

    chat = b"[23.11.26, 03:10:00] X: lost hour"
    lost = PipelineUpload(group_name="A", chat_gridfs_id="gone", chat_sha256=pipeline.hashlib.sha256(chat).hexdigest(),
                          status="done", stats={"superseded_by": "x"})
    await lost.insert()
    up, duplicate = await pipeline.store_upload("A", chat, None)
    assert not duplicate and up.backfill and up.id != lost.id
    # Sent once more while queued (or after processing): now a real duplicate.
    again, duplicate = await pipeline.store_upload("A", chat, None)
    assert duplicate and again.id == up.id


@pytest.mark.asyncio
async def test_backfill_processes_messages_behind_the_watermark_and_keeps_it(upload_db, stored, monkeypatch):
    from beanie import init_beanie

    from app.models.pipeline import PipelineGroupState, PipelineUpload

    await init_beanie(database=upload_db["queue_test"], document_models=[PipelineUpload, PipelineGroupState])
    watermark = datetime(2026, 11, 25, 10, 55)
    await PipelineGroupState(group_name="A", last_message_at=watermark).insert()
    runs = []

    async def fake_generator(chat_txt, media, group_name, mode, ref, admin_id):
        runs.append(chat_txt)
        return f"run-{mode}", {}

    async def fake_route(buckets, mode, ctx, media, admin):
        return {"new_order_ids": []}

    async def admin():
        return type("Admin", (), {"id": "admin"})()

    async def nothing(*a, **k):
        return None

    monkeypatch.setattr(pipeline, "_run_generator", fake_generator)
    monkeypatch.setattr(pipeline, "route_rows", fake_route)
    monkeypatch.setattr(pipeline, "_admin_user", admin)
    monkeypatch.setattr(pipeline, "_delete", nothing)
    import app.api.v1.endpoints.whatsapp as wa
    monkeypatch.setattr(wa, "dispatch_new_listings_safe", nothing)

    chat = b"[23.11.26, 03:10:00] X: WTS 126610LN\n[23.11.26, 03:40:00] Y: WTB 5711\n"
    live, _ = await pipeline.store_upload("A", chat, None)
    stats = await pipeline.process_upload(str(live.id))
    assert stats["new_messages"] == 0 and runs == []  # behind the watermark: skipped

    up, _ = await pipeline.store_upload("A", chat + b"[23.11.26, 03:50:00] Z: more\n", None, backfill=True)
    stats = await pipeline.process_upload(str(up.id))
    assert stats["new_messages"] == 3 and len(runs) == 2
    assert (await PipelineGroupState.find_one({"group_name": "A"})).last_message_at == watermark


@pytest.mark.asyncio
async def test_recovery_retries_until_writes_work(upload_db, fake_processing, monkeypatch):
    calls = {"n": 0}
    real = pipeline._recover

    async def flaky(*args):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("over your space quota")
        return await real(*args)

    monkeypatch.setattr(pipeline, "_recover", flaky)
    monkeypatch.setattr(pipeline, "RECOVERY_RETRY_SECONDS", 0)
    await _upload("interrupted", 5, status="processing", attempts=1)
    assert await pipeline.recover_interrupted_uploads(delay=0) == {"requeued": 1, "failed": 0}
    assert calls["n"] == 3
    await pipeline._drain_task
    assert fake_processing["order"] == ["interrupted"]
