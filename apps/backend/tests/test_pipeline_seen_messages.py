"""Reposts are not parsed again (Nov 2026): the same dealer list arrives hourly and in 10-20 groups;
parsing every copy left the queue hours behind. A copy refreshes the dealer's existing offers."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import pipeline


def test_split_and_key():
    text = ("[25.11.26, 10:00:00] +852 9000 0001: 5711/1A N11 hkd 1.1m\n5712/1R 2024 hkd 2.1m\n"
            "[25.11.26, 10:05:00] +852 9000 0002: ok\n")
    msgs = pipeline.split_messages(text)
    assert [m["sender"] for m in msgs] == ["+852 9000 0001", "+852 9000 0002"]
    assert msgs[0]["body"] == "5711/1A N11 hkd 1.1m\n5712/1R 2024 hkd 2.1m" and len(msgs[0]["lines"]) == 2
    a = pipeline.message_key("+852 9000 0001", "5711/1A  N11 HKD 1.1m\n5712/1R 2024 hkd 2.1m")
    assert a == pipeline.message_key("+85290000001", "5711/1a n11 hkd 1.1m 5712/1r 2024 hkd 2.1m")
    assert a != pipeline.message_key("+852 9000 0003", "5711/1A N11 hkd 1.1m\n5712/1R 2024 hkd 2.1m")
    assert pipeline.message_key("+852 9000 0002", "ok") is None


@pytest_asyncio.fixture
async def sdb(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.pipeline import PipelineGroupState, PipelineSeenMessage, PipelineUpload

    client = AsyncMongoMockClient()
    await init_beanie(database=client["seen_test"],
                      document_models=[Order, PipelineUpload, PipelineGroupState, PipelineSeenMessage])
    runs = []
    chats = {}

    async def fake_get(bucket, fid):
        return chats[fid]

    async def admin():
        return type("Admin", (), {"id": "admin"})()

    async def fake_generator(chat_txt, media, group_name, mode, ref, admin_id):
        runs.append((group_name, mode, chat_txt))
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
    return runs, chats


async def _run(chats, group, text, sha):
    from app.models.pipeline import PipelineUpload

    chats[sha] = text.encode()
    up = PipelineUpload(group_name=group, chat_gridfs_id=sha, chat_sha256=sha, status="processing", backfill=True)
    await up.insert()
    return await pipeline._process_claimed(up)


@pytest.mark.asyncio
async def test_a_repost_in_another_group_is_not_parsed_again_and_refreshes_the_offer(sdb):
    from app.models.order import Order, OrderStatus, OrderType

    runs, chats = sdb
    t1 = datetime(2026, 11, 25, 10, 0)
    msg = "5711/1A N11 hkd 1.1m\n5712/1R 2024 hkd 2.1m"
    await _run(chats, "HK group A", f"[25.11.26, 10:00:00] +852 9000 0001: {msg}\n", "a")
    assert len(runs) == 2  # WTS and WTB

    offer = Order(order_type=OrderType.SELL, brand="Patek", model="M", reference="5712/1R", ws_code="5712/1R",
                  price=2_100_000, currency="HKD", country_code="HK", user_id="admin", whatsapp_phone="+85290000001",
                  source_text="5712/1R 2024 hkd 2.1m", created_at=t1, status=OrderStatus.EXPIRED)
    await offer.insert()

    stats = await _run(chats, "HK group B", f"[25.11.26, 14:00:00] +852 9000 0001: {msg}\n", "b")
    assert len(runs) == 2 and stats["reposts_skipped"] == 1 and stats["reposts_refreshed_offers"] == 1
    o = await Order.get(offer.id)
    assert o.status == OrderStatus.ACTIVE and o.created_at == datetime(2026, 11, 25, 14, 0)
    assert o.expires_at == datetime(2026, 12, 5, 14, 0)

    # a new message next to the repost: only the new one goes to the generator
    await _run(chats, "HK group C", f"[25.11.26, 15:00:00] +852 9000 0001: {msg}\n"
                                    f"[25.11.26, 15:01:00] +852 9000 0001: 5167A 2024 hkd 420k\n", "c")
    assert len(runs) == 4 and all("5167A" in r[2] and "5711" not in r[2] for r in runs[2:])


@pytest.mark.asyncio
async def test_another_dealer_posting_the_same_text_is_parsed(sdb):
    runs, chats = sdb
    msg = "5711/1A N11 hkd 1.1m\n5712/1R 2024 hkd 2.1m"
    await _run(chats, "G", f"[25.11.26, 10:00:00] +852 9000 0001: {msg}\n", "a")
    await _run(chats, "G2", f"[25.11.26, 10:05:00] +852 9000 0009: {msg}\n", "b")
    assert len(runs) == 4
