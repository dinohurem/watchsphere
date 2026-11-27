"""Daily parser audit: every check with real lines from Kenan's full check (26 Nov 2026)."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import parser_audit as pa

NOW = datetime(2026, 11, 27, 7, 0)


def offer(text, **kw):
    base = {"_id": kw.pop("_id", "o1"), "order_type": "sell", "ws_code": "116500LN Black",
            "reference": "116500LN", "whatsapp_phone": "+85212345678", "source_text": text,
            "price": None, "currency": "HKD", "year": None, "watch_month": None, "condition": "Unworn",
            "remarks": None, "created_at": NOW - timedelta(hours=2)}
    base.update(kw)
    return base


def codes(o):
    return sorted(f["code"] for f in pa.audit_order(o))


# --- price ----------------------------------------------------------------- #

@pytest.mark.parametrize("line,price", [
    ("126710blro oys n11 192k", 192000),
    ("126710 hkd1.86m", 1860000),
    ("126500LN black 105.000", 105000),
    ("124300 black 126,500 hkd", 126500),
    ("5712/1R 22y hkd2.018M", 2018000),
    ("Hk$373k 126610LN", 373000),
    ("5740/1G N8/26 $2,100,000.00HKD", 2100000),
])
def test_price_notations_are_found(line, price):
    assert "PRICE_NOT_IN_LINE" not in codes(offer(line, price=price))


def test_price_not_in_line():
    # "5712/1R 22y hkd2.018M" stored with 856,000
    found = pa.audit_order(offer("5712/1R 22y hkd2.018M", ws_code="5712/1R", price=856000, year=2022))
    assert [f["code"] for f in found] == ["PRICE_NOT_IN_LINE"]
    assert "856" in found[0]["why"]


def test_price_after_a_discount_written_in_the_line_is_fine():
    assert codes(offer("116500LN 2023 HKD 200,000 -5%", price=190000, year=2023)) == []


def test_two_line_price_in_a_multi_line_text():
    text = "116500LN black 2023\nHk$373k"
    assert codes(offer(text, price=373000, year=2023)) == []


# --- year ------------------------------------------------------------------ #

def test_year_not_in_line():
    # "126710blro oys n11 192k" stored 04/2021
    found = pa.audit_order(offer("126710blro oys n11 192k", ws_code="126710BLRO", reference="126710BLRO",
                                 price=192000, year=2021, watch_month=4))
    assert [f["code"] for f in found] == ["YEAR_NOT_IN_LINE"]


def test_year_different_from_the_written_one():
    # K02: "2020y n11" stored 2026
    assert codes(offer("116500 black 2020y n11$191000", price=191000, year=2026, watch_month=11)) == ["YEAR_NOT_IN_LINE"]
    # K03
    assert codes(offer("116400gv blue 2023 hkd113k", ws_code="116400GV Blue", price=113000, year=2021)) == ["YEAR_NOT_IN_LINE"]


@pytest.mark.parametrize("line,year", [
    ("116500LN black 2023 hkd204k", 2023), ("116500LN 22y hkd204k", 2022),
    ("116500LN n11 hkd204k", 2026), ("116500LN N8/26 hkd204k", 2026),
    ("116500LN 11/2020 204K", 2020), ("1100S/000R-H115 2026New 204k", 2026),
    ("116500LN 2022fs | $204,000", 2022),
])
def test_year_in_any_notation_is_not_flagged(line, year):
    assert codes(offer(line, price=204000, year=year)) == []


def test_year_missing():
    # P01: glued year the parser did not read
    found = pa.audit_order(offer("🦇1100S/000R-H115 2026New 278k HKD", ws_code="1100S/000R-H115", price=278000))
    assert [f["code"] for f in found] == ["YEAR_MISSING"]
    assert codes(offer("⭐116500ln blk used 2022fs | $195,500", price=195500)) == ["YEAR_MISSING"]


def test_year_missing_ignores_prices_and_references():
    assert codes(offer("116500LN hkd2023k", price=2023000)) == []
    assert codes(offer("116500LN HKD 2,026", price=2026)) == []
    assert codes(offer("116500LN 204k", price=204000)) == []


# --- wrong block ----------------------------------------------------------- #

BLOCKS = "\n".join([
    "5968G-010 Green",
    "2023 HKD 909,000",
    "2026 HKD 1,010,000",
    "",
    "5968G-001 Blue",
    "2016y HKD 998,000",
    "2023 HKD 995,000",
])


def test_wrong_block():
    # "2016y HKD 998,000" sits under 5968G-001 but is stored on 5968G-010
    wrong = offer(BLOCKS, ws_code="5968G-010 Green", reference="5968G-010", price=998000, year=2016)
    assert codes(wrong) == ["WRONG_BLOCK"]
    right = offer(BLOCKS, ws_code="5968G-001 Blue", reference="5968G-001", price=998000, year=2016)
    assert codes(right) == []
    first = offer(BLOCKS, ws_code="5968G-010 Green", reference="5968G-010", price=909000, year=2023)
    assert codes(first) == []


# --- discount -------------------------------------------------------------- #

def test_discount_from_links():
    # "5740/1G N8/26 $2,100,000.00HKD -4links" with a 4% deduction
    o = offer("5740/1G N8/26 $2,100,000.00HKD -4links", ws_code="5740/1G", reference="5740/1G",
              price=2016000, year=2026, watch_month=8, remarks="4% Retail")
    assert codes(o) == ["DISCOUNT_FROM_LINKS"]


def test_bare_minus_is_its_own_low_priority_code():
    o = offer("131.12.41.21.06.001 HK$50400 -25", ws_code="131.12.41.21.06.001", reference="131.12.41.21.06.001",
              price=37800, remarks="25% Retail")
    assert codes(o) == ["DISCOUNT_BARE_MINUS"]
    assert "DISCOUNT_BARE_MINUS" in pa.LOW_PRIORITY


def test_discount_without_percent_off():
    o = offer("116500LN HK$50400 25 off", price=37800, remarks="25% Retail")
    assert codes(o) == ["DISCOUNT_WITHOUT_PERCENT"]


def test_computed_retail_remark_is_not_a_discount():
    # the remark is the system's retail comparison; the line has no such number
    assert codes(offer("5160/500R 2026new $1.35M", ws_code="5160/500R", reference="5160/500R", price=1350000,
                       year=2026, remarks="40% Retail")) == []
    assert codes(offer("85180/000R-H116 HK$300,000", ws_code="85180/000R-H116", reference="85180/000R-H116",
                       price=300000, remarks="22% Retail")) == []


def test_source_without_price_is_split_out():
    found = pa.audit_order(offer("Patek Philippe 5712/1a", ws_code="5712/1A", reference="5712/1A",
                                 price=200000, currency="USD"))
    assert [f["code"] for f in found] == ["SOURCE_WITHOUT_PRICE"]
    assert "SOURCE_WITHOUT_PRICE" in pa.LOW_PRIORITY
    # a price is written but it is another one: still a real finding
    assert codes(offer("116500LN 570000usdt", price=252000, currency="USD")) == ["PRICE_NOT_IN_LINE"]


def test_sku_line_is_not_a_watch_line():
    text = "\n".join(["5968G-010 Green", "2023 HKD 909,000", "🔖 SKU: 17897", "2026 HKD 1,010,000"])
    o = offer(text, ws_code="5968G-010 Green", reference="5968G-010", price=1010000, year=2026)
    assert codes(o) == []


def test_discount_with_percent_is_fine():
    o = offer("131.12.41.21.06.001 HK$50400 -25%", ws_code="131.12.41.21.06.001", reference="131.12.41.21.06.001",
              price=37800, remarks="25% Retail")
    assert codes(o) == []


# --- condition, duplicates, requests --------------------------------------- #

def test_condition_invalid():
    assert codes(offer("116500LN 204k", price=204000, condition="Mint")) == ["CONDITION_INVALID"]
    assert codes(offer("116500LN 204k", price=204000, condition=None)) == []
    assert codes(offer("116500LN 204k", price=204000, condition="Used")) == []


def test_duplicate_line():
    line = "116508 green 2020 hkd505k"
    a = offer(line, _id="a", price=505000, year=2020, created_at=NOW - timedelta(hours=1))
    b = offer("116508  Green 2020 HKD505K", _id="b", price=505000, year=2020, created_at=NOW - timedelta(hours=3))
    found = pa.audit_orders([a, b], [a, b])
    assert [f["code"] for f in found] == ["DUPLICATE_LINE"]
    assert found[0]["order_id"] == "b"
    other_side = offer(line, _id="c", price=505000, year=2020, order_type="buy")
    assert pa.audit_duplicates([a, other_side], [a, other_side]) == []


SALE_LIST = "\n".join(["WTS", "116500LN black 2023 hkd204k", "126610LN 2022 hkd110k", "124300 black 2024y hkd66k"])


def test_wtb_from_sale_line():
    req = offer(SALE_LIST, order_type="buy", ws_code="126610LN", reference="126610LN", price=110000, year=2022)
    assert codes(req) == ["WTB_FROM_SALE_LINE"]
    # the same line under a WTB header is a real request
    wtb = "WTS\n116500LN black 2023 hkd204k\n\nWTB\n126610LN 2022 hkd110k"
    assert codes(offer(wtb, order_type="buy", ws_code="126610LN", reference="126610LN", price=110000, year=2022)) == []
    # a request without any price under a sale header is not flagged
    assert codes(offer("WTS\n126610LN", order_type="buy", ws_code="126610LN", reference="126610LN")) == []


def test_correct_offer_has_no_finding():
    assert codes(offer("116500LN black 2023 full set hkd204k", price=204000, year=2023)) == []


# --- database run ---------------------------------------------------------- #

@pytest_asyncio.fixture
async def adb():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.parser_audit import ParserAuditReport
    from app.models.pipeline import PipelineReportState
    from app.models.user import User

    client = AsyncMongoMockClient()
    await init_beanie(database=client["audit_test"],
                      document_models=[Order, ParserAuditReport, PipelineReportState, User])
    yield client


async def _insert(client, text, **kw):
    doc = {"order_type": "sell", "brand": "Rolex", "model": "x", "reference": "116500LN", "ws_code": "116500LN Black",
           "country_code": "HK", "user_id": "u", "status": "active", "whatsapp_phone": "+85212345678",
           "source_text": text, "price": 204000, "currency": "HKD", "year": 2023, "condition": "Unworn",
           "superseded_by": None, "created_at": datetime.utcnow() - timedelta(hours=1)}
    doc.update(kw)
    await client["audit_test"]["orders"].insert_one(doc)


@pytest.mark.asyncio
async def test_run_audit_only_looks_at_the_window_and_stores(adb):
    await _insert(adb, "116500LN black 2023 hkd204k")                      # fine
    await _insert(adb, "116500LN black 2023 hkd250k", whatsapp_phone="+85299999999")  # price not in line
    await _insert(adb, "116500LN black 2021 hkd250k", price=1,
                  created_at=datetime.utcnow() - timedelta(days=3))        # old: not audited
    await _insert(adb, "116500LN black 2023 hkd250k", status="expired")     # not active
    result = await pa.run_audit(24)
    assert result["checked"] == 2
    assert result["counts"] == {"PRICE_NOT_IN_LINE": 1}
    await pa.store_report(result, "manual")
    from app.models.parser_audit import ParserAuditReport
    assert (await ParserAuditReport.find_all().first_or_none()).total_findings == 1


@pytest.mark.asyncio
async def test_examples_are_capped(adb):
    for i in range(pa.EXAMPLES_PER_CODE + 5):
        await _insert(adb, "116500LN black 2023 hkd250k", whatsapp_phone=f"+8521000{i:04d}")
    result = await pa.run_audit(24)
    assert result["counts"]["PRICE_NOT_IN_LINE"] == pa.EXAMPLES_PER_CODE + 5
    assert len(result["examples"]["PRICE_NOT_IN_LINE"]) == pa.EXAMPLES_PER_CODE


# --- schedule -------------------------------------------------------------- #

def test_is_due():
    day = datetime(2026, 11, 27)
    assert not pa.is_due(day.replace(hour=5, minute=59), None, 6)
    assert pa.is_due(day.replace(hour=6), None, 6)
    assert not pa.is_due(day.replace(hour=14), day.replace(hour=6, minute=1), 6)
    assert pa.is_due(day.replace(hour=7), day - timedelta(hours=10), 6)


@pytest.mark.asyncio
async def test_scheduled_run_happens_once_a_day_even_after_restart(adb, monkeypatch):
    await _insert(adb, "116500LN black hkd204k")  # year 2023 stored, none in the line (emailed code)
    sent = []

    async def fake_send(result):
        sent.append(result["total_findings"])
        return 2

    monkeypatch.setattr(pa, "send_email", fake_send)
    day = datetime(2026, 11, 27)
    assert await pa.run_scheduled(day.replace(hour=5)) is None
    first = await pa.run_scheduled(day.replace(hour=6, minute=1))
    assert first and first["total_findings"] == 1
    # restart / next loop tick / second instance the same day: nothing
    assert await pa.run_scheduled(day.replace(hour=6, minute=16)) is None
    assert await pa.run_scheduled(day.replace(hour=20)) is None
    assert sent == [1]
    # next morning runs again
    assert await pa.run_scheduled(day.replace(day=28, hour=6, minute=2)) is not None


@pytest.mark.asyncio
async def test_no_email_without_findings(adb, monkeypatch):
    await _insert(adb, "116500LN black 2023 hkd204k")

    async def boom(result):
        raise AssertionError("must not email")

    monkeypatch.setattr(pa, "send_email", boom)
    result = await pa.run_scheduled(datetime(2026, 11, 27, 6, 5))
    assert result["total_findings"] == 0


def test_email_lists_counts_and_examples():
    result = {"checked": 5, "hours": 24, "total_findings": 1, "counts": {"YEAR_NOT_IN_LINE": 1},
              "examples": {"YEAR_NOT_IN_LINE": [{"ws_code": "X", "dealer": "+1", "line": "ln", "why": "w"}]}}
    lines = pa.email_lines(result)
    assert lines[1] == "YEAR_NOT_IN_LINE: 1" and "ln" in lines[2]
