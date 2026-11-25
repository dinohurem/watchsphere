"""Pipeline files live in Firebase Storage, not MongoDB (the media zips filled the 5 GB Atlas plan
and paused processing, Nov 2026): store / read / delete, moving waiting uploads, periodic cleanup."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import pipeline


class FakeBlob:
    def __init__(self, store, name):
        self.store, self.name = store, name

    def upload_from_string(self, data, content_type=None):
        self.store[self.name] = (data, datetime.utcnow())

    def download_as_bytes(self):
        return self.store[self.name][0]

    def delete(self):
        del self.store[self.name]

    @property
    def time_created(self):
        return self.store[self.name][1]


class FakeBucket:
    def __init__(self):
        self.store = {}

    def blob(self, name):
        return FakeBlob(self.store, name)

    def list_blobs(self, prefix=""):
        return [FakeBlob(self.store, n) for n in list(self.store) if n.startswith(prefix)]


class FakeStream:
    def __init__(self, data, filename):
        self.data, self.filename = data, filename

    async def read(self):
        return self.data


class FakeGridFS:
    """GridFS on the mongomock database: metadata in '<bucket>.files', bytes in memory."""
    data: dict = {}

    def __init__(self, db, name):
        self.files = db[f"{name}.files"]

    async def upload_from_stream(self, filename, data, metadata=None):
        from bson import ObjectId
        fid = ObjectId()
        await self.files.insert_one({"_id": fid, "filename": filename, "length": len(data),
                                     "uploadDate": datetime.utcnow(), "metadata": metadata or {}})
        FakeGridFS.data[fid] = data
        return fid

    async def open_download_stream(self, fid):
        doc = await self.files.find_one({"_id": fid})
        return FakeStream(FakeGridFS.data[fid], doc["filename"])

    async def delete(self, fid):
        await self.files.delete_one({"_id": fid})
        FakeGridFS.data.pop(fid, None)


@pytest_asyncio.fixture
async def fdb(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.pipeline import PipelineGroupState, PipelineItem, PipelineUpload

    client = AsyncMongoMockClient()
    await init_beanie(database=client["file_storage_test"],
                      document_models=[Order, PipelineItem, PipelineUpload, PipelineGroupState])
    fb = FakeBucket()
    monkeypatch.setattr(pipeline, "_firebase_bucket", lambda: fb)
    mdb = client["file_storage_test"]
    monkeypatch.setattr(pipeline, "_bucket", lambda name: FakeGridFS(mdb, name))
    return fb


@pytest.mark.asyncio
async def test_new_upload_files_go_to_firebase_and_are_read_and_deleted(fdb):
    up, dup = await pipeline.store_upload("WDG ONLY SALE 🇪🇺💰", b"[25.11.26, 16:01:00] X: WTS 5711", None)
    assert not dup and up.chat_gridfs_id.startswith("fb:")
    media = await pipeline._put(pipeline.UPLOAD_BUCKET, b"zipbytes", "WDG/WDG_Medien.zip")
    assert media.startswith("fb:pipeline/pipeline_uploads/")
    assert await pipeline._get(pipeline.UPLOAD_BUCKET, media) == b"zipbytes"
    await pipeline._delete(pipeline.UPLOAD_BUCKET, media)
    assert len(fdb.store) == 1                                    # only the chat file is left
    img = await pipeline._put(pipeline.IMAGE_BUCKET, b"jpg", "0001-PHOTO.jpg")
    assert await pipeline.get_image(img) == (b"jpg", "image/jpeg")


@pytest.mark.asyncio
async def test_waiting_uploads_are_moved_out_of_mongodb(fdb, monkeypatch):
    from app.models.pipeline import PipelineUpload

    gridfs_id = str(await pipeline._bucket(pipeline.UPLOAD_BUCKET).upload_from_stream("m.zip", b"old-media"))
    chat_id = str(await pipeline._bucket(pipeline.UPLOAD_BUCKET).upload_from_stream("c.txt", b"chat"))
    up = PipelineUpload(group_name="WDG", chat_gridfs_id=chat_id, media_gridfs_id=gridfs_id,
                        chat_sha256="x", status="received")
    await up.insert()
    busy = PipelineUpload(group_name="Busy", chat_gridfs_id=chat_id, chat_sha256="y", status="processing")
    await busy.insert()
    res = await pipeline.move_queued_files_to_storage()
    assert res["moved"] == 1 and res["failed"] == 0
    up = await PipelineUpload.get(up.id)
    assert up.media_gridfs_id.startswith("fb:") and up.chat_gridfs_id.startswith("fb:")
    assert await pipeline._get(pipeline.UPLOAD_BUCKET, up.media_gridfs_id) == b"old-media"
    db = PipelineUpload.get_motor_collection().database
    assert await db[f"{pipeline.UPLOAD_BUCKET}.files"].count_documents({}) == 0  # GridFS copies gone
    assert (await PipelineUpload.get(busy.id)).chat_gridfs_id == chat_id       # a running upload is left alone
    assert (await pipeline.move_queued_files_to_storage())["moved"] == 0      # idempotent


@pytest.mark.asyncio
async def test_storage_cleanup_deletes_only_old_unreferenced_files(fdb):
    from app.models.pipeline import PipelineItem, PipelineUpload

    db = PipelineUpload.get_motor_collection().database
    gen = pipeline._bucket("wtb_wts_files")
    old_csv = await gen.upload_from_stream("matched.csv", b"a")
    await db["wtb_wts_files.files"].update_one({"_id": old_csv}, {"$set": {"uploadDate": datetime.utcnow() - timedelta(days=3)}})
    await gen.upload_from_stream("fresh.csv", b"b")

    imgs = pipeline._bucket(pipeline.IMAGE_BUCKET)
    used = await imgs.upload_from_stream("used.jpg", b"u")
    unused = await imgs.upload_from_stream("unused.jpg", b"x")
    await db[f"{pipeline.IMAGE_BUCKET}.files"].update_many({}, {"$set": {"uploadDate": datetime.utcnow() - timedelta(days=1)}})
    await PipelineItem(kind="unsure", mode="WTS", image_id=str(used), status="pending").insert()

    waiting = await pipeline._put(pipeline.UPLOAD_BUCKET, b"queued", "q.zip")
    await PipelineUpload(group_name="G", chat_gridfs_id=waiting, chat_sha256="z", status="received").insert()
    orphan = await pipeline._put(pipeline.UPLOAD_BUCKET, b"left", "o.zip")
    for name in list(fdb.store):
        fdb.store[name] = (fdb.store[name][0], datetime.utcnow() - timedelta(days=3))

    out = await pipeline.storage_cleanup()
    assert out["generator_files"] == 1 and out["images"] == 1 and out["upload_files"] == 1
    assert await db["wtb_wts_files.files"].count_documents({}) == 1
    names = {d["filename"] async for d in db[f"{pipeline.IMAGE_BUCKET}.files"].find()}
    assert names == {"used.jpg"}
    assert "fb:" + next(iter(fdb.store)) == waiting and orphan[3:] not in fdb.store
