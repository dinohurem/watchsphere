"""Upload storage diet (only media for new messages), report recipients and
startup without index sync when MongoDB refuses writes."""
import io
import zipfile

import pytest
from pymongo.errors import OperationFailure

from app.db import session
from app.services.pipeline import report_recipients, slim_media_zip


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


def test_slim_zip_keeps_only_wanted_files():
    original = _zip({"old-PHOTO-1.jpg": b"a" * 5000, "Folder/NEW-photo-2.JPG": b"b" * 10, "x.opus": b"c"})
    slim = slim_media_zip(original, ["new-PHOTO-2.jpg"])
    with zipfile.ZipFile(io.BytesIO(slim)) as zf:
        assert zf.namelist() == ["NEW-photo-2.JPG"]
        assert zf.read("NEW-photo-2.JPG") == b"b" * 10
    assert len(slim) < len(original)


def test_slim_zip_nothing_wanted_or_found_stores_nothing():
    original = _zip({"old.jpg": b"a"})
    assert slim_media_zip(original, []) is None
    assert slim_media_zip(original, ["missing.jpg"]) is None
    assert slim_media_zip(None, ["a.jpg"]) is None


def test_slim_zip_keeps_unreadable_zip_unchanged():
    assert slim_media_zip(b"not a zip", ["a.jpg"]) == b"not a zip"


def test_report_recipients_merges_and_dedupes():
    out = report_recipients(["Admin@x.com", None, ""], "po@y.com; admin@x.com,ops@z.com  bad")
    assert out == ["Admin@x.com", "po@y.com", "ops@z.com"]
    assert report_recipients(["a@x.com"], "") == ["a@x.com"]


@pytest.mark.asyncio
async def test_startup_falls_back_to_no_index_sync(monkeypatch):
    calls = []

    async def fake_init_beanie(database, document_models):
        skipped = session.Initializer.init_indexes.__name__ == "_skip"
        calls.append(skipped)
        if not skipped:
            raise OperationFailure("you are over your space quota", code=8000)

    monkeypatch.setattr(session, "init_beanie", fake_init_beanie)
    monkeypatch.setattr(session, "AsyncIOMotorClient", lambda url: {session.settings.MONGODB_DB_NAME: object()})
    original = session.Initializer.init_indexes
    await session.connect_to_mongo()
    assert calls == [False, True]
    assert session.Initializer.init_indexes is original
