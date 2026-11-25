"""One huge export must not stall the queue (Nov 2026): AI review batches run in parallel and stop
at MAX_REVIEW_ROWS, and a group's first export starts FIRST_RUN_DAYS back, not at its whole history."""
import asyncio
from datetime import datetime, timedelta

import pytest

from app.services import ai_review, pipeline


@pytest.mark.asyncio
async def test_review_batches_run_in_parallel_and_stop_at_the_cap(monkeypatch):
    seen = {"running": 0, "max": 0, "rows": 0}

    async def fake_batch(client, batch):
        seen["running"] += 1
        seen["max"] = max(seen["max"], seen["running"])
        await asyncio.sleep(0.01)
        seen["running"] -= 1
        seen["rows"] += len(batch)
        return {i["id"]: ai_review.ReviewDecision(True, "5711/1A", "ok") for i in batch}

    monkeypatch.setattr(ai_review, "_review_batch", fake_batch)
    monkeypatch.setattr(ai_review, "is_enabled", lambda: True)
    items = [{"id": str(i), "text": f"5711 line {i}", "candidates": [{"ws_code": "5711/1A"}]} for i in range(1000)]
    out = await ai_review.review_rows(items)
    assert seen["rows"] == ai_review.MAX_REVIEW_ROWS
    assert 1 < seen["max"] <= ai_review.REVIEW_CONCURRENCY
    assert sum(1 for d in out.values() if d.sure) == ai_review.MAX_REVIEW_ROWS
    assert "too many rows" in out["999"].reason and not out["999"].sure


@pytest.mark.asyncio
async def test_first_export_of_a_group_starts_a_few_days_back(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.pipeline import PipelineGroupState, PipelineUpload

    client = AsyncMongoMockClient()
    await init_beanie(database=client["throughput_test"], document_models=[PipelineUpload, PipelineGroupState])
    old = (datetime.utcnow() - timedelta(days=40)).strftime("%d.%m.%y, %H:%M:%S")
    new = (datetime.utcnow() - timedelta(hours=2)).strftime("%d.%m.%y, %H:%M:%S")
    chat = f"[{old}] X: WTS 5711 old\n[{new}] Y: WTS 5711 new\n".encode()

    async def fake_get(bucket, fid):
        return chat

    async def admin():
        return type("Admin", (), {"id": "admin"})()

    runs = []

    async def fake_generator(chat_txt, media, group_name, mode, ref, admin_id):
        runs.append(chat_txt)
        return "run", {}

    async def fake_route(buckets, mode, ctx, media, admin):
        return {"new_order_ids": []}

    async def nothing(*a, **k):
        return None

    import app.api.v1.endpoints.whatsapp as wa
    monkeypatch.setattr(pipeline, "_get", fake_get)
    monkeypatch.setattr(pipeline, "_admin_user", admin)
    monkeypatch.setattr(pipeline, "_run_generator", fake_generator)
    monkeypatch.setattr(pipeline, "route_rows", fake_route)
    monkeypatch.setattr(wa, "dispatch_new_listings_safe", nothing)

    up = PipelineUpload(group_name="New group", chat_gridfs_id="x", chat_sha256="s", status="processing")
    await up.insert()
    stats = await pipeline._process_claimed(up)
    assert stats["new_messages"] == 1
    assert all("new" in r and "old" not in r for r in runs)

    # an explicit backfill still takes everything
    up2 = PipelineUpload(group_name="Other group", chat_gridfs_id="x", chat_sha256="t", status="processing", backfill=True)
    await up2.insert()
    assert (await pipeline._process_claimed(up2))["new_messages"] == 2
