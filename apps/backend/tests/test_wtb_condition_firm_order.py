"""Buy requests: condition can be empty, no default currency without a target, firm_order ("sold order"),
and the fields parse_wtb_line carries (year range / year+, full set, watch only)."""

import asyncio
import json

import pytest
import pytest_asyncio

from app.services import wtb_wts_service as svc

HK = "+852 6547 2648"


def _w(ws_code, brand, reference):
    return json.dumps({"ws_code": ws_code, "brand": brand, "model": "", "reference": reference,
                       "dial": "", "bracelet": "", "aliases": [], "oem_references": [],
                       "list_prices": {}, "status": "active", "cover_image": ""})


CATALOG = "\n".join([_w("126610LN", "Rolex", "126610LN"), _w("126518LN", "Rolex", "126518LN")])


@pytest.fixture(autouse=True)
def _no_ai(monkeypatch):
    async def no_match(unmatched_lines, watch_index, timeout=None):
        return []
    monkeypatch.setattr(svc, "batch_ai_match", no_match)


def run_wtb(text):
    txt = f"[05.11.26, 10:00:00] {HK}: {text}\n"
    return asyncio.run(svc.process_generation(txt_content=txt, mode="WTB", ref_month=11, ref_year=2026,
                                              group_name="Test group", jsonl_content=CATALOG))


def wtb_rows(text):
    return run_wtb(text)["rows"]["matched"]


# --- generator ---------------------------------------------------------------------

@pytest.mark.parametrize("text,zustand", [
    ("WTB 126610LN brand new", "Only Unworn"),
    ("WTB 126610LN N11", "Only Unworn"),
    ("WTB 126610LN used is ok", "Can be Used"),
    ("WTB 126610LN new or used", "Can be Used"),
    ("WTB 126610LN like new", "Can be Used"),
    ("WTB 126610LN", ""),                      # nothing stated: no status
])
def test_wtb_condition_comes_from_parse_wtb_line(text, zustand):
    m = wtb_rows(text)
    assert len(m) == 1 and m[0]["Zustand"] == zustand


def test_wtb_without_target_has_no_price_no_currency():
    m = wtb_rows("WTB 126610LN")
    assert m[0]["Preis"] == ""


def test_wtb_target_keeps_price_and_currency():
    m = wtb_rows("WTB 126610LN target 80k")
    assert m[0]["Preis"] == "80,000 HKD"


@pytest.mark.parametrize("text,flag", [
    ("Sold order 126610LN new 2026", "Yes"),
    ("Confirm order\n126610LN\nnew", "Yes"),
    ("WTB 126610LN strong call", "Yes"),
    ("WTB 126610LN new", ""),
])
def test_firm_order_flag(text, flag):
    m = wtb_rows(text)
    assert len(m) == 1 and m[0]["Sold Order"] == flag


def test_year_range_full_set_and_watch_only_are_carried():
    m = wtb_rows("WTB 126610LN 2022-2024 full set")
    assert m[0]["Monat/Jahr"] == "2022-2024"
    assert "fullset" in m[0]["Bemerkungen"].lower()
    m = wtb_rows("WTB 126610LN watch only is fine")
    assert "Watch only OK" in m[0]["Bemerkungen"]


def test_sold_order_column_is_in_the_generator_csv():
    r = run_wtb("Sold order 126610LN new")
    assert "Sold Order" in r["matched_csv"].splitlines()[0]


# --- import ------------------------------------------------------------------------

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
    await init_beanie(database=client["wtb_test"],
                      document_models=[Order, Watch, WhatsAppImport, ExtractedWatchListing, FxRate,
                                       FxRateHistory, WatchMarketStats])
    import app.services.fx as fx

    fx._cache = None
    await Watch(brand="Rolex", model="Submariner", reference="126610LN", ws_code="126610LN",
                dealer_id="x", status="active").insert()
    yield client
    fx._cache = None


def _wtb_row(cond="", price="", sold="", phone="+85212345678"):
    return {"Nachrichten Art": "WTB", "Marke": "Rolex", "WS-Code": "126610LN", "Monat/Jahr": "2024+",
            "Standort": "HK", "Zustand": cond, "Bemerkungen": "", "Preis": price, "Nummer": phone,
            "Gruppe": "HK Dealers", "Nachricht gepostet am": "07.11.26 14:25:34", "Sold Order": sold,
            "_import": {"match_method": "exact", "source_text": "WTB 126610LN"}}


async def _import(rows, monkeypatch):
    from app.api.v1.endpoints import whatsapp
    from app.models.user import User
    from app.models.whatsapp_import import WhatsAppImport

    async def fake_dispatch(ids, orders=None):
        return len(ids)

    monkeypatch.setattr(whatsapp, "dispatch_new_listings_safe", fake_dispatch)
    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = "000000000000000000000001"
    rec = WhatsAppImport(filename="t.csv", group_name="g", imported_by="a", imported_by_name="a")
    await rec.insert()
    fields = [k for k in rows[0] if not k.startswith("_")]
    return await whatsapp.import_order_rows(rows, fields, rec, admin, require_phone=True)


@pytest.mark.asyncio
async def test_wtb_without_condition_price_currency_is_stored_empty(import_db, monkeypatch):
    from app.models.order import Order

    await _import([_wtb_row()], monkeypatch)
    o = await Order.find_one({})
    assert o.condition is None and o.condition_raw is None
    assert o.price is None and o.currency is None and o.usd_price is None
    assert o.firm_order is False


@pytest.mark.asyncio
async def test_wtb_condition_labels_and_firm_order(import_db, monkeypatch):
    from app.models.order import Order, OrderCondition

    await _import([_wtb_row(cond="Only Unworn", sold="Yes", phone="+85211111111"),
                   _wtb_row(cond="Can be Used", price="80.000 HKD", phone="+85222222222")], monkeypatch)
    a = await Order.find_one(Order.whatsapp_phone == "+85211111111")
    b = await Order.find_one(Order.whatsapp_phone == "+85222222222")
    assert a.condition == OrderCondition.UNWORN and a.condition_raw == "Only Unworn" and a.firm_order is True
    assert b.condition == OrderCondition.USED and b.condition_raw == "Can be Used" and b.firm_order is False
    assert b.price == 80000 and b.currency == "HKD"


@pytest.mark.asyncio
async def test_wtb_repost_without_condition_is_refreshed_not_duplicated(import_db, monkeypatch):
    from app.models.order import Order

    await _import([_wtb_row()], monkeypatch)
    second = await _import([_wtb_row()], monkeypatch)
    assert second["new_order_ids"] == [] and len(second["refreshed_order_ids"]) == 1
    assert await Order.find_all().count() == 1


@pytest.mark.asyncio
async def test_sell_order_keeps_condition_and_currency(import_db, monkeypatch):
    from app.models.order import Order, OrderCondition

    row = _wtb_row(price="105.000 HKD", cond="Unworn")
    row.update({"Nachrichten Art": "WTS"})
    await _import([row], monkeypatch)
    o = await Order.find_one({})
    assert o.condition == OrderCondition.UNWORN and o.currency == "HKD" and o.firm_order is False


def test_order_book_entry_accepts_empty_condition_and_currency():
    from app.api.v1.endpoints.orders import OrderBookEntry

    e = OrderBookEntry(id="1", date="", country_code="HK", has_box=False, has_papers=False,
                       user_id="u", firm_order=True)
    assert e.condition is None and e.currency is None and e.price is None and e.firm_order is True
