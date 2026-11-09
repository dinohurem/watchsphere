"""Generator pipeline (spec §1): message filtering, AI answer validation, auth,
and the repost-aware import (really-new vs refreshed listings)."""
from datetime import datetime

import pytest
import pytest_asyncio

from app.services import ai_review
from app.services.pipeline import filter_new_messages, parse_header_timestamp, text_key

CHAT = (
    "[06.11.26, 10:00:00] +852 1234 5678: WTS 126610LN N10/26 HKD 105k\n"
    "[07.11.26, 14:25:34] +32483302727: ‎<attached: 00317560-PHOTO-2026-11-07-14-25-34.jpg>\n"
    "126334 for sale\n"
    "€ 13.199 shipped\n"
    "[07.11.26, 15:00:00] +44 7700 900123: WTB 5711/1A\n"
)


def test_header_timestamp_formats():
    assert parse_header_timestamp("[07.11.26, 14:25:34] +1: hi") == datetime(2026, 11, 7, 14, 25, 34)
    assert parse_header_timestamp("‎[07.11.2026, 14:25] +1: hi") == datetime(2026, 11, 7, 14, 25)
    assert parse_header_timestamp("07/11/2026, 14:25 - +1: hi") == datetime(2026, 11, 7, 14, 25)
    assert parse_header_timestamp("126334 for sale") is None


def test_filter_keeps_only_newer_messages_with_continuations():
    out = filter_new_messages(CHAT, datetime(2026, 11, 6, 10, 0, 0))
    assert out["count"] == 2
    assert "126610LN" not in out["text"]
    assert "126334 for sale" in out["text"] and "€ 13.199 shipped" in out["text"]
    assert out["last"] == datetime(2026, 11, 7, 15, 0, 0)
    assert out["attachments"] == ["00317560-PHOTO-2026-11-07-14-25-34.jpg"]


def test_filter_without_watermark_keeps_everything_and_nothing_new_is_empty():
    assert filter_new_messages(CHAT, None)["count"] == 3
    none = filter_new_messages(CHAT, datetime(2026, 11, 8))
    assert none["count"] == 0 and none["text"] == ""


def test_text_key_groups_identical_texts():
    assert text_key("WTS  126610LN\n105k") == text_key("wts 126610ln 105k")


# --- AI answer validation ---------------------------------------------------

ITEMS = [
    {"id": "0", "text": "126500 white jub", "candidates": [
        {"ws_code": "126500LN White"}, {"ws_code": "126500LN Black"}]},
    {"id": "1", "text": "5711", "candidates": [{"ws_code": "5711/1A Blue"}]},
]


def test_parse_decisions_accepts_only_candidates():
    payload = {"decisions": [
        {"id": "0", "ws_code": "126500LN White", "sure": True, "reason": "white dial", "alias": None},
        {"id": "1", "ws_code": "5711/1A Green", "sure": True, "reason": "x", "alias": "Tiffany"},
    ]}
    out = ai_review.parse_decisions(payload, ITEMS)
    assert out["0"].sure and out["0"].ws_code == "126500LN White"
    assert not out["1"].sure and out["1"].ws_code is None and out["1"].alias is None


def test_parse_decisions_missing_rows_are_unsure():
    out = ai_review.parse_decisions({"decisions": []}, ITEMS)
    assert not out["0"].sure and not out["1"].sure


@pytest.mark.asyncio
async def test_review_without_api_key_leaves_everything_unsure(monkeypatch):
    monkeypatch.setattr(ai_review.settings, "ANTHROPIC_API_KEY", "")
    out = await ai_review.review_rows(ITEMS)
    assert all(not d.sure for d in out.values())


# --- auth -------------------------------------------------------------------

def test_pipeline_endpoints_closed_without_key(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.v1.endpoints import pipeline as pipeline_ep
    from app.core import pipeline_auth

    app = FastAPI()
    app.include_router(pipeline_ep.router, prefix="/pipeline")
    client = TestClient(app)

    monkeypatch.setattr(pipeline_auth.settings, "PIPELINE_API_KEY", "")
    assert client.post("/pipeline/process-pending").status_code == 503
    monkeypatch.setattr(pipeline_auth.settings, "PIPELINE_API_KEY", "secret")
    assert client.post("/pipeline/process-pending").status_code == 401
    assert client.post("/pipeline/process-pending", headers={"X-Pipeline-Key": "nope"}).status_code == 401


# --- repost-aware import ----------------------------------------------------

@pytest_asyncio.fixture
async def import_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.watch import Watch
    from app.models.whatsapp_import import ExtractedWatchListing, WhatsAppImport

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["pipeline_test"],
        document_models=[Order, Watch, WhatsAppImport, ExtractedWatchListing, FxRate,
                         FxRateHistory, WatchMarketStats],
    )
    import app.services.fx as fx

    fx._cache = None
    await Watch(brand="Rolex", model="Submariner", reference="126610LN", ws_code="126610LN",
                dealer_id="x", status="active").insert()
    yield client
    fx._cache = None


def _row(phone="+85212345678", price="105.000 HKD", month_year="10/26", cond="Unworn"):
    return {
        "Nachrichten Art": "WTS", "Marke": "Rolex", "WS-Code": "126610LN",
        "Monat/Jahr": month_year, "Standort": "HK", "Zustand": cond, "Bemerkungen": "",
        "Preis": price, "Nummer": phone, "Gruppe": "HK Dealers",
        "Nachricht gepostet am": "07.11.26 14:25:34",
        "_import": {"match_method": "exact", "source_text": "WTS 126610LN 105k"},
    }


@pytest.mark.asyncio
async def test_repost_refreshes_instead_of_creating(import_db, monkeypatch):
    from app.api.v1.endpoints import whatsapp
    from app.models.order import Order
    from app.models.user import User
    from app.models.whatsapp_import import WhatsAppImport

    dispatched = []

    async def fake_dispatch(ids, orders=None):
        dispatched.append(list(ids))
        return len(ids)

    monkeypatch.setattr(whatsapp, "dispatch_new_listings_safe", fake_dispatch)
    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = "000000000000000000000001"

    async def run(rows):
        rec = WhatsAppImport(filename="t.csv", group_name="g", imported_by="a", imported_by_name="a")
        await rec.insert()
        fields = [k for k in rows[0] if not k.startswith("_")]
        return await whatsapp.import_order_rows(rows, fields, rec, admin, require_phone=True)

    first = await run([_row(), _row(phone="")])
    assert len(first["new_order_ids"]) == 1
    assert first["no_phone_rows"] == 1
    order = await Order.find_one({})
    assert order.match_method == "exact" and order.source_text == "WTS 126610LN 105k"
    assert order.usd_price == pytest.approx(105000 / 7.8, rel=1e-3)
    assert order.first_seen_at and order.last_seen_at

    # Same dealer reposts the same watch in another group → refresh only.
    second = await run([_row()])
    assert second["new_order_ids"] == []
    assert len(second["refreshed_order_ids"]) == 1
    assert await Order.find_all().count() == 1

    # Different price → really new.
    third = await run([_row(price="99.000 HKD")])
    assert len(third["new_order_ids"]) == 1
    assert dispatched == [first["new_order_ids"], third["new_order_ids"]]


@pytest_asyncio.fixture
async def route_db(import_db):
    from beanie import init_beanie

    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.pipeline import AliasSuggestion, PipelineItem
    from app.models.watch import Watch
    from app.models.whatsapp_import import ExtractedWatchListing, WhatsAppImport

    await init_beanie(
        database=import_db["pipeline_test"],
        document_models=[Order, Watch, WhatsAppImport, ExtractedWatchListing, FxRate,
                         FxRateHistory, WatchMarketStats, PipelineItem, AliasSuggestion],
    )
    await Watch(brand="Rolex", model="Datejust", reference="126334", ws_code="126334 Blue Jub",
                dealer_id="x", status="active").insert()
    yield import_db


@pytest.mark.asyncio
async def test_route_rows_sends_each_bucket_to_the_right_place(route_db, monkeypatch):
    from app.api.v1.endpoints import whatsapp
    from app.models.order import Order
    from app.models.pipeline import AliasSuggestion, PipelineItem, ReviewKind
    from app.models.user import User
    from app.services import ai_review, pipeline

    async def no_dispatch(ids, orders=None):
        return 0

    monkeypatch.setattr(whatsapp, "dispatch_new_listings_safe", no_dispatch)

    async def fake_review(items):
        return {i["id"]: ai_review.ReviewDecision(
            sure=i["text"].startswith("126334"), ws_code="126334 Blue Jub" if i["text"].startswith("126334") else None,
            reason="blue dial + jubilee stated", alias="Blue Jub" if i["text"].startswith("126334") else None)
            for i in items}

    monkeypatch.setattr(ai_review, "review_rows", fake_review)
    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = "000000000000000000000001"

    def with_meta(row, text, cands=None, **meta):
        r = {k: v for k, v in row.items() if k != "_import"}
        r["_meta"] = {"source_text": text, "candidates": cands or [], **meta}
        return r

    review_row = dict(_row(phone="+4915112345678", price="13.199 EUR"))
    review_row["WS-Code"] = ""
    buckets = {
        "matched": [with_meta(_row(), "WTS 126610LN 105k"), with_meta(_row(phone=""), "no phone")],
        "needs_review": [
            with_meta(review_row, "126334 blue jub 13.199€", [{"ws_code": "126334 Blue Jub"}]),
            with_meta(review_row, "maybe 126334??", [{"ws_code": "126334 Blue Jub"}]),
            with_meta(review_row, "weird", [], currency_unknown=True),
        ],
        "not_in_database": [with_meta({"Marke": "Tudor", "Referenz": "7941A1A0RU"}, "Tudor 7941A1A0RU")],
        "discarded": [with_meta({}, "price?", discard_reason="question")],
        "aftermarket": [with_meta(_row(), "iced out 126610LN")],
    }
    stats = await pipeline.route_rows(buckets, "WTS", {"group_name": "G", "run_id": "r1"}, {}, admin)

    assert stats["imported"] == 1 and stats["ai_imported"] == 1
    assert len(stats["new_order_ids"]) == 2
    ai_order = await Order.find_one({"match_method": "ai"})
    assert ai_order.ws_code == "126334 Blue Jub" and ai_order.ai_reason
    ai_item = await PipelineItem.find_one({"kind": ReviewKind.AI_DECISION.value})
    assert ai_item.order_id == str(ai_order.id)
    assert await PipelineItem.find({"kind": ReviewKind.UNSURE.value}).count() == 2
    assert await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value}).count() == 1
    discarded = await PipelineItem.find({"kind": ReviewKind.DISCARDED.value}).to_list()
    assert len(discarded) == 3  # discarded + aftermarket + no phone
    assert all(d.expires_at for d in discarded)
    assert await Order.find({"source_text": "iced out 126610LN"}).count() == 0
    alias = await AliasSuggestion.find_one({})
    assert alias.alias == "Blue Jub" and alias.status.value == "pending"


def test_item_base_parses_iso_message_time():
    """Generator rows carry the timestamp as an ISO string after the JSON round-trip."""
    from datetime import datetime

    from app.services.pipeline import _item_base, _parse_ts

    assert _parse_ts("2026-11-07T14:25:34") == datetime(2026, 11, 7, 14, 25, 34)
    assert _parse_ts("not a date") is None and _parse_ts(None) is None
    row = {"WS-Code": "5811/1G", "_meta": {"timestamp": "2026-11-07T14:25:34"}}
    assert _item_base(row, "WTS", {})["message_at"] == datetime(2026, 11, 7, 14, 25, 34)
