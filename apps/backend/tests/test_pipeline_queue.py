"""Processing queue: one upload at a time, oldest first, interrupted uploads
requeued at startup, process-pending answers without waiting."""
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
    yield client
    if pipeline._drain_task and not pipeline._drain_task.done():
        pipeline._drain_task.cancel()
    pipeline._drain_task = None


async def _upload(group, minutes_ago, status="received", attempts=0):
    from app.models.pipeline import PipelineUpload

    up = PipelineUpload(group_name=group, chat_gridfs_id="0" * 24, chat_sha256=group,
                        status=status, attempts=attempts,
                        received_at=datetime.utcnow() - timedelta(minutes=minutes_ago))
    await up.insert()
    return up


@pytest.fixture
def fake_processing(monkeypatch):
    """Replace the generator run: records order and the highest concurrency seen."""
    seen = {"order": [], "running": 0, "max_running": 0}

    async def fake(upload):
        seen["running"] += 1
        seen["max_running"] = max(seen["max_running"], seen["running"])
        await asyncio.sleep(0.01)
        seen["order"].append(upload.group_name)
        seen["running"] -= 1
        return {"new_messages": 0}

    async def no_delete(bucket, file_id):
        return None

    monkeypatch.setattr(pipeline, "_process_claimed", fake)
    monkeypatch.setattr(pipeline, "_delete", no_delete)
    return seen


@pytest.mark.asyncio
async def test_concurrent_uploads_are_processed_one_at_a_time(upload_db, fake_processing):
    ups = [await _upload(f"G{i}", 10 - i) for i in range(5)]
    await asyncio.gather(*(pipeline.process_upload(str(u.id)) for u in ups))
    assert fake_processing["max_running"] == 1
    assert len(fake_processing["order"]) == 5


@pytest.mark.asyncio
async def test_worker_drains_received_oldest_first_and_skips_others(upload_db, fake_processing):
    from app.models.pipeline import PipelineUpload

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
async def test_startup_recovery_requeues_interrupted_and_gives_up_after_max(upload_db, fake_processing):
    from app.models.pipeline import PipelineUpload

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
async def test_queue_pending_retries_failed_and_returns_without_waiting(upload_db, fake_processing):
    await _upload("failed-once", 3, status="failed", attempts=1)
    await _upload("waiting", 2)
    queued = await pipeline.queue_pending(20)
    assert queued == 2
    assert fake_processing["order"] == []  # answered before processing ran
    await pipeline._drain_task
    assert fake_processing["order"] == ["failed-once", "waiting"]


# --- superseding older queued exports ------------------------------------------

@pytest.fixture
def deleted(monkeypatch):
    calls = []

    async def record(bucket, file_id):
        if file_id:
            calls.append(file_id)

    monkeypatch.setattr(pipeline, "_delete", record)
    return calls


async def _upload_files(group, minutes_ago, status="received"):
    up = await _upload(group, minutes_ago, status=status)
    up.chat_gridfs_id = f"chat-{group}-{minutes_ago}"
    up.media_gridfs_id = f"media-{group}-{minutes_ago}"
    await up.save()
    return up


@pytest.mark.asyncio
async def test_newer_export_supersedes_older_queued_ones(upload_db, deleted):
    from app.models.pipeline import PipelineUpload

    old1 = await _upload_files("A", 30)
    old2 = await _upload_files("A", 20)
    running = await _upload_files("A", 40, status="processing")
    newest = await _upload_files("A", 10)
    other = await _upload_files("B", 25)
    assert await pipeline.supersede_queued() == 2
    got = {u.id: u for u in await PipelineUpload.find_all().to_list()}
    for old in (old1, old2):
        assert got[old.id].status.value == "done"
        assert got[old.id].stats == {"superseded_by": str(newest.id)}
    assert got[newest.id].status.value == "received"
    assert got[running.id].status.value == "processing"  # never touched mid-run
    assert got[other.id].status.value == "received"
    assert sorted(deleted) == sorted([old1.chat_gridfs_id, old1.media_gridfs_id,
                                      old2.chat_gridfs_id, old2.media_gridfs_id])


@pytest.mark.asyncio
async def test_delete_only_frees_files_without_writing_status(upload_db, deleted):
    from app.models.pipeline import PipelineUpload

    stuck = await _upload_files("A", 30, status="processing")
    await _upload_files("A", 10)
    n = await pipeline.supersede_queued(delete_only=True, statuses=("received", "processing"))
    assert n == 1 and deleted == [stuck.chat_gridfs_id, stuck.media_gridfs_id]
    assert (await PipelineUpload.get(stuck.id)).status.value == "processing"


@pytest.mark.asyncio
async def test_process_upload_skips_superseded_without_reading_files(upload_db, fake_processing, deleted):
    from app.models.pipeline import PipelineUpload

    old = await _upload_files("A", 30)
    await _upload_files("A", 10)
    assert await pipeline.process_upload(str(old.id)) == {"superseded": True}
    assert fake_processing["order"] == []
    assert (await PipelineUpload.get(old.id)).status.value == "done"


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
