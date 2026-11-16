"""Generator rows JSON is deleted after the pipeline reads it; leftovers older
than an hour are swept at startup."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import wtb_wts_service as svc


class FakeBucket:
    def __init__(self, store):
        self.store = store

    async def delete(self, file_id):
        if str(file_id) not in self.store:
            raise KeyError(file_id)
        del self.store[str(file_id)]


@pytest_asyncio.fixture
async def runs_db(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.wtb_wts import WtbWtsRun

    await init_beanie(database=AsyncMongoMockClient()["rows_test"], document_models=[WtbWtsRun])
    store: dict[str, str] = {}
    counter = iter(range(10**6))

    async def put(content, filename):
        fid = f"{next(counter):024x}"
        store[fid] = content
        return fid

    async def get(fid):
        return store[fid]

    monkeypatch.setattr(svc, "_gridfs_put_text", put)
    monkeypatch.setattr(svc, "_gridfs_get_text", get)
    monkeypatch.setattr(svc, "_rows_gridfs_bucket", lambda: FakeBucket(store))
    return store


async def _run(minutes_ago=0):
    from app.models.wtb_wts import WtbWtsRun

    run = WtbWtsRun(filename="_chat.txt", group_name="G", mode="wts", reference_month=11, imported_by="pipeline", imported_by_name="Pipeline",
                    reference_year=2026, created_at=datetime.utcnow() - timedelta(minutes=minutes_ago))
    await run.insert()
    await svc.store_run_rows(run.id, {"matched": [{"WS-Code": "126610LN"}]})
    return run


@pytest.mark.asyncio
async def test_discard_after_read_removes_file_and_link(runs_db):
    from app.models.wtb_wts import WtbWtsRun

    run = await _run()
    rows = await svc.load_run_rows(run.id)
    assert rows["matched"] == [{"WS-Code": "126610LN"}]
    await svc.discard_run_rows(run.id)
    assert runs_db == {}
    assert (await WtbWtsRun.get(run.id)).rows_json_gridfs_id is None
    await svc.discard_run_rows(run.id)  # second call is a no-op


@pytest.mark.asyncio
async def test_pipeline_generator_step_discards_rows(runs_db, monkeypatch):
    from app.services import pipeline

    async def fake_generate(chat_txt, media, group_name, mode, month, year, admin_id):
        return (await _run()).id

    monkeypatch.setattr(svc, "run_generator_on_export", fake_generate)
    _, rows = await pipeline._run_generator("chat", {}, "G", "WTS", datetime.utcnow(), "admin")
    assert rows["matched"] == [{"WS-Code": "126610LN"}]
    assert runs_db == {}


@pytest.mark.asyncio
async def test_startup_sweep_deletes_only_old_files_and_never_writes(runs_db, monkeypatch):
    from bson import ObjectId

    from app.models.wtb_wts import WtbWtsRun

    files = WtbWtsRun.get_motor_collection().database["wtb_wts_files.files"]
    old_id, fresh_id, csv_id = ObjectId(), ObjectId(), ObjectId()
    now = datetime.utcnow()
    await files.insert_many([
        {"_id": old_id, "filename": "rows-a.json", "uploadDate": now - timedelta(hours=2)},
        {"_id": fresh_id, "filename": "rows-b.json", "uploadDate": now - timedelta(minutes=5)},
        {"_id": csv_id, "filename": "matched-a.csv", "uploadDate": now - timedelta(hours=2)},
    ])
    runs_db.update({str(old_id): "x", str(fresh_id): "y", str(csv_id): "z"})

    async def no_writes(*a, **k):
        raise AssertionError("sweep must not update runs")

    monkeypatch.setattr(WtbWtsRun, "update", no_writes, raising=False)
    assert await svc.cleanup_stale_run_rows() == 1
    assert set(runs_db) == {str(fresh_id), str(csv_id)}
