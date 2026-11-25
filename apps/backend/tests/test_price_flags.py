"""Suspicious prices as a held-back queue: the check at creation, the cause, the queue and its
decisions (single, bulk, file), undo, and the scan of existing offers."""
import csv
import io
from datetime import datetime

import pytest
import pytest_asyncio

from app.services import market_stats as ms
from app.services import price_flags as pf

RATES = {"USD": 1.0, "HKD": 7.8, "EUR": 0.92, "CHF": 0.88, "AED": 3.6725, "SGD": 1.34, "GBP": 0.79}


def L(price, cur="HKD", n=0, ws="278271g Choco Oys", year=2026, cond="Unworn"):
    usd = price / RATES[cur]
    return ms.Listing(id=f"l{n}", ws_code=ws, order_type="sell", dealer=f"d{n}", price=price, currency=cur,
                      price_usd=usd, condition=cond, year=year, month=9, created_at=datetime.utcnow())


def peers_hkd(base=140_000, n=4, **kw):
    return [L(base + i * 1000, "HKD", n=i + 1, **kw) for i in range(n)]


# --- the known data bug -----------------------------------------------------------

def test_hkd_amount_labelled_usd_is_wrong_currency_with_hkd_suggestion():
    # "278271g choco oys $141000 n9/26" was imported once as USD; it is HKD 141,000.
    flag = pf.classify(L(141_000, "USD", n=0), peers_hkd(), RATES)
    assert flag["cause"] == "wrong_currency"
    assert flag["suggested_currency"] == "HKD" and flag["peers_currency"] is None
    assert flag["deviation_pct"] > 500 and flag["offer_count"] == 4
    assert flag["median_usd"] == pytest.approx(141_500 / 7.8, rel=1e-3)


def test_minority_right_majority_wrong_is_flagged_but_not_auto_fixable():
    # "459,000HK$/58,900US$" on WGSA0124: the flagged row is right (HKD 459,000 = USD 58,846);
    # its 4 peers are USD amounts stored as HKD.
    peers = [L(p, "HKD", n=i + 1, ws="WGSA0124", year=2024) for i, p in enumerate((58_000, 58_500, 58_900, 59_300))]
    flag = pf.classify(L(459_000, "HKD", n=0, ws="WGSA0124", year=2024), peers, RATES)
    assert flag["cause"] == "wrong_currency"
    assert flag["peers_currency"] == "USD"
    assert flag["suggested_currency"] is None  # nothing to apply to this offer


def test_other_causes():
    peers = peers_hkd()
    typo = pf.classify(L(1_410_000, "HKD", n=0), peers, RATES)
    assert typo["cause"] == "typo" and typo["suggested_price"] == 141_000
    short = pf.classify(L(14_100, "HKD", n=0), peers, RATES)
    assert short["cause"] == "typo" and short["suggested_price"] == 141_000 and short["deviation_pct"] < 0

    plain = pf.classify(L(260_000, "HKD", n=0), peers, RATES)
    assert plain["cause"] == "real_outlier" and plain["suggested_currency"] is None

    sib = pf.classify(L(260_000, "HKD", n=0), peers, RATES, siblings=[("5167A", 260_000, "HKD")])
    assert sib["cause"] == "price_from_other_line" and sib["other_line_ws_code"] == "5167A"
    # a sibling of the same watch or with another price is no evidence
    assert pf.classify(L(260_000, "HKD", n=0), peers, RATES,
                       siblings=[("278271g Choco Oys", 260_000, "HKD"), ("5167A", 250_000, "HKD")]
                       )["cause"] == "real_outlier"


def test_within_tolerance_or_without_basis_is_fine():
    peers = peers_hkd()
    assert pf.classify(L(150_000, "HKD", n=0), peers, RATES) is None  # +7 %
    assert pf.classify(L(260_000, "HKD", n=0), peers[:1], RATES) is None  # one peer is no basis
    # another condition / far year is not compared
    assert pf.classify(L(260_000, "HKD", n=0, cond="Used"), peers, RATES) is None


def test_small_currency_gaps_are_not_called_wrong_currency():
    # 28 % under the median would "fit" as GBP, but USD/GBP differ by only 27 %: a cheap offer.
    peers = [L(100_000, "USD", n=i + 1, ws="X") for i in range(4)]
    flag = pf.classify(L(72_000, "USD", n=0, ws="X"), peers, RATES)
    assert flag["cause"] == "real_outlier" and flag["deviation_pct"] == -28.0


# --- database -----------------------------------------------------------------------

@pytest_asyncio.fixture
async def pdb(admin_user, monkeypatch):
    from beanie import init_beanie
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from mongomock_motor import AsyncMongoMockClient

    import app.services.fx as fx
    from app.api.v1.endpoints import approval, approval_bulk, approval_file, approval_prices
    from app.core.deps import get_current_admin_user
    from app.models.approval_file import ApprovalFileBatch, ApprovalFileItem, ApprovalFileSnapshot
    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.order_fix import OrderArchive
    from app.models.pipeline import AliasSuggestion, PipelineItem
    from app.models.watch import Watch
    from app.models.whatsapp_import import ExtractedWatchListing, WhatsAppImport

    async def load_rates(force=False):
        return RATES

    fx._cache = None
    monkeypatch.setattr(fx, "load_rates", load_rates)
    monkeypatch.setattr(fx, "cached_rates", lambda: RATES)
    client = AsyncMongoMockClient()
    await init_beanie(database=client["price_flags_test"], document_models=[
        Order, Watch, FxRate, FxRateHistory, WatchMarketStats, PipelineItem, AliasSuggestion,
        ApprovalFileBatch, ApprovalFileItem, ApprovalFileSnapshot, OrderArchive,
        WhatsAppImport, ExtractedWatchListing])
    await Watch(brand="Rolex", model="Datejust", reference="278271", ws_code="278271g Choco Oys",
                dealer_id="d", serial_number="s1", status="active").insert()
    await Watch(brand="Patek", model="Nautilus", reference="5711", ws_code="5711/1A", dealer_id="d",
                serial_number="s2", status="active").insert()
    application = FastAPI()
    for r, prefix in ((approval_bulk.router, "/approval"), (approval_file.router, "/approval/file"),
                      (approval_prices.router, "/approval"), (approval.router, "/approval")):
        application.include_router(r, prefix=prefix)
    application.dependency_overrides[get_current_admin_user] = lambda: admin_user
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://t") as c:
        yield c
    fx._cache = None


async def make_order(price, cur="HKD", ws="278271g Choco Oys", year=2026, cond="Unworn", status="active",
                     text=None, phone=None, brand="Rolex", **extra):
    from app.models.order import Order, OrderCondition, OrderStatus, OrderType

    o = Order(order_type=OrderType.SELL, brand=brand, model="M", reference=ws.split()[0], ws_code=ws, price=price,
              currency=cur, usd_price=price / RATES[cur], country_code="HK", user_id="u",
              whatsapp_phone=phone or f"+852{int(price)}", year=year, watch_month=9, condition=OrderCondition(cond),
              status=OrderStatus(status), source_text=text, **extra)
    await o.insert()
    return o


async def seed_peers(n=8, base=140_000, **kw):
    return [await make_order(base + i * 1000, "HKD", **kw) for i in range(n)]


@pytest.mark.asyncio
async def test_new_order_is_held_with_flag_and_stays_out_of_every_count(pdb):
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order, OrderStatus
    from app.services import market_stats as stats

    await seed_peers()
    bad = Order(order_type="sell", brand="Rolex", model="M", reference="278271", ws_code="278271g Choco Oys",
                price=141_000, currency="USD", usd_price=141_000, country_code="HK", user_id="u",
                whatsapp_phone="+85299", year=2026, condition="Unworn")
    held = await pf.check_new_orders([bad])
    assert held == [bad] and bad.status == OrderStatus.HELD
    assert bad.price_flag["cause"] == "wrong_currency" and bad.price_flag["suggested_currency"] == "HKD"
    await bad.insert()

    # the held offer is in no median, count or listing set
    await stats.recompute_for(["278271g Choco Oys"])
    st = await WatchMarketStats.find_one({"ws_code": "278271g Choco Oys"})
    assert st.wts_count == 8
    listings = (await stats._load_listings(["278271g Choco Oys"], RATES))["278271g Choco Oys"]
    assert len(listings) == 8 and all(l.id != str(bad.id) for l in listings)
    assert all(l.id != str(bad.id) for l in await stats.median_listings("278271g Choco Oys"))


@pytest.mark.asyncio
async def test_fine_prices_and_buy_requests_are_not_held(pdb):
    from app.models.order import Order, OrderStatus

    await seed_peers()
    ok = Order(order_type="sell", brand="Rolex", model="M", reference="r", ws_code="278271g Choco Oys",
               price=150_000, currency="HKD", usd_price=150_000 / 7.8, country_code="HK", user_id="u", year=2026,
               condition="Unworn")
    wtb = Order(order_type="buy", brand="Rolex", model="M", reference="r", ws_code="278271g Choco Oys",
                price=20_000, currency="HKD", usd_price=20_000 / 7.8, country_code="HK", user_id="u", year=2026,
                condition="Unworn")
    assert await pf.check_new_orders([ok, wtb]) == []
    assert ok.status == OrderStatus.ACTIVE and wtb.status == OrderStatus.ACTIVE


def _row(price, ws="278271g Choco Oys", text="278271g choco oys 1", phone="+85212345678", month_year="09/26"):
    return {
        "Nachrichten Art": "WTS", "Marke": "Rolex", "WS-Code": ws, "Monat/Jahr": month_year, "Standort": "HK",
        "Zustand": "Unworn", "Bemerkungen": "", "Preis": price, "Nummer": phone, "Gruppe": "HK Dealers",
        "Nachricht gepostet am": "20.11.26 14:25:34", "_import": {"match_method": "exact", "source_text": text},
    }


async def _import(rows):
    from app.api.v1.endpoints import whatsapp
    from app.models.user import User
    from app.models.whatsapp_import import WhatsAppImport

    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = "000000000000000000000001"
    rec = WhatsAppImport(filename="t.csv", group_name="g", imported_by="a", imported_by_name="a")
    await rec.insert()
    fields = [k for k in rows[0] if not k.startswith("_")]
    return await whatsapp.import_order_rows(rows, fields, rec, admin, require_phone=True, dispatch_alerts=False)


@pytest.mark.asyncio
async def test_import_holds_back_a_suspicious_row_and_a_repost_does_not_release_or_duplicate_it(pdb):
    from app.models.order import Order, OrderStatus

    for i in range(4):
        await make_order(100_000 + i * 500, "USD", phone=f"+8521{i}")
    # 70,000 USD is -30 %: inside the import's old +/-60 % quarantine, outside the 25 % band.
    res = await _import([_row("70.000 USD")])
    assert res["held_prices"] == 1 and len(res["new_order_ids"]) == 1
    o = await Order.get(res["new_order_ids"][0])
    assert o.status == OrderStatus.HELD and o.price_flag["cause"] == "real_outlier"
    assert o.price_flag["deviation_pct"] < -25 and o.price_flag["offer_count"] == 4
    assert await Order.find({"status": "active"}).count() == 4

    # the dealer posts the same offer again: refreshed, still held, no second copy
    res = await _import([_row("70.000 USD")])
    assert res["new_order_ids"] == [] and len(res["refreshed_order_ids"]) == 1
    assert await Order.find({"ws_code": "278271g Choco Oys"}).count() == 5
    assert (await Order.get(o.id)).status == OrderStatus.HELD

    # a repost with a sane price releases it
    res = await _import([_row("101.000 USD")])
    o = await Order.get(o.id)
    assert o.status == OrderStatus.ACTIVE and o.price_flag is None and o.price == 101_000


@pytest.mark.asyncio
async def test_scan_existing_orders_dry_run_then_hold_and_approved_is_never_flagged_again(pdb):
    from app.models.order import Order, OrderStatus

    await seed_peers()
    cheap = await make_order(141_000, "USD", phone="+8521")            # HKD amount labelled USD
    typo = await make_order(1_410_000, "HKD", phone="+8522")
    approved = await make_order(900_000, "HKD", phone="+8523", price_approved=True)
    other_ws = await make_order(50_000, "HKD", ws="5711/1A", brand="Patek", phone="+8524")  # no peers

    dry = await pf.scan_active(dry_run=True)
    assert dry["dry_run"] and dry["held"] == 0 and dry["flagged"] == 2
    assert dry["by_cause"]["wrong_currency"] == 1 and dry["by_cause"]["typo"] == 1
    assert await Order.find({"status": "held"}).count() == 0  # nothing changed

    res = await pf.scan_active(dry_run=False)
    assert res["held"] == 2 and res["flagged"] == 2
    assert (await Order.get(cheap.id)).status == OrderStatus.HELD
    assert (await Order.get(typo.id)).price_flag["suggested_price"] == 141_000
    assert (await Order.get(approved.id)).status == OrderStatus.ACTIVE
    assert (await Order.get(other_ws.id)).status == OrderStatus.ACTIVE
    again = await pf.scan_active(dry_run=False)
    assert again["flagged"] == 0 and again["held"] == 0


@pytest.mark.asyncio
async def test_scan_endpoint_defaults_to_dry_run(pdb):
    from app.models.order import Order

    await seed_peers()
    await make_order(141_000, "USD")
    r = await pdb.post("/approval/suspicious-prices/scan-existing")
    assert r.status_code == 200 and r.json()["dry_run"] is True and r.json()["flagged"] == 1
    assert await Order.find({"status": "held"}).count() == 0
    r = await pdb.post("/approval/suspicious-prices/scan-existing", params={"dry_run": "false"})
    assert r.json()["held"] == 1 and await Order.find({"status": "held"}).count() == 1


async def build_queue(pdb):
    await seed_peers()
    o = {
        "cur": await make_order(141_000, "USD", phone="+8521"),            # too expensive, wrong currency
        "cheap": await make_order(14_100, "HKD", phone="+8522"),           # too cheap, typo
        "exp": await make_order(1_410_000, "HKD", phone="+8523"),          # too expensive, typo
        "plain": await make_order(90_000, "HKD", phone="+8524"),           # too cheap, real outlier
    }
    assert (await pf.scan_active(dry_run=False))["held"] == 4
    return o


@pytest.mark.asyncio
async def test_queue_default_sort_too_cheap_first_filters_and_comparison_columns(pdb):
    o = await build_queue(pdb)
    r = (await pdb.get("/approval/suspicious-prices", params={"currency": "EUR"})).json()
    assert r["total"] == 4
    devs = [i["deviation_pct"] for i in r["items"]]
    assert devs == sorted(devs) and devs[0] < 0 and devs[-1] > 0   # negative deviation first
    assert [i["id"] for i in r["items"][:2]] == [str(o["cheap"].id), str(o["plain"].id)]

    first = r["items"][0]
    # the median it was compared with, in the display currency, and what it rests on
    # compared with the 11 other offers (8 normal + 3 other held ones); median in EUR
    from statistics import median

    usd = [(140_000 + i * 1000) / 7.8 for i in range(8)] + [141_000, 1_410_000 / 7.8, 90_000 / 7.8]
    assert first["offer_count"] == 11
    assert first["median"] == pytest.approx(median(usd) * 0.92, rel=1e-3)
    assert first["cause"] == "typo" and first["suggested_price"] == 141_000

    by_cause = (await pdb.get("/approval/suspicious-prices", params={"cause": "wrong_currency"})).json()
    assert [i["id"] for i in by_cause["items"]] == [str(o["cur"].id)]
    assert by_cause["items"][0]["suggested_currency"] == "HKD"
    exp = (await pdb.get("/approval/suspicious-prices", params={"sort": "expensive_first"})).json()["items"]
    assert exp[0]["deviation_pct"] > exp[-1]["deviation_pct"]
    assert (await pdb.get("/approval/suspicious-prices", params={"direction": "cheap"})).json()["total"] == 2
    opts = (await pdb.get("/approval/suspicious-prices/filter-options")).json()
    assert opts["causes"]["typo"] == 2 and opts["causes"]["real_outlier"] == 1 and opts["total"] == 4
    assert (await pdb.get("/approval/summary")).json()["suspicious_prices"] == 4


@pytest.mark.asyncio
async def test_single_approve_makes_it_visible_and_never_flagged_again(pdb):
    from app.models.order import Order, OrderStatus

    o = await build_queue(pdb)
    r = await pdb.post("/approval/suspicious-prices/decide", json={"decision": "approve", "ids": [str(o["plain"].id)]})
    assert r.status_code == 200 and r.json()["decided"] == 1 and r.json()["batch_id"]
    p = await Order.get(o["plain"].id)
    assert p.status == OrderStatus.ACTIVE and p.price_approved is True and p.price_flag is None
    assert (await pdb.get("/approval/suspicious-prices")).json()["total"] == 3
    assert (await pf.scan_active(dry_run=False))["flagged"] == 0
    assert (await Order.get(o["plain"].id)).status == OrderStatus.ACTIVE  # never flagged again


@pytest.mark.asyncio
async def test_reject_is_archived_and_can_be_undone(pdb):
    from app.models.order import Order, OrderStatus

    o = await build_queue(pdb)
    r = await pdb.post("/approval/suspicious-prices/decide", json={"decision": "reject", "ids": [str(o["exp"].id)]})
    bid = r.json()["batch_id"]
    assert await Order.get(o["exp"].id) is None
    hist = (await pdb.get("/approval/file")).json()
    assert hist[0]["batch_id"] == bid and hist[0]["status"] == "committed"
    r = await pdb.post(f"/approval/file/{bid}/undo")
    assert r.status_code == 200 and r.json()["restored"] == 1
    back = await Order.get(o["exp"].id)
    assert back.status == OrderStatus.HELD and back.price == 1_410_000 and back.price_flag["cause"] == "typo"


@pytest.mark.asyncio
async def test_bulk_all_matching_with_filter_and_unticked_row(pdb):
    from app.models.order import Order, OrderStatus

    o = await build_queue(pdb)
    # apply each offer's own suggestion to every typo, except the one that was unticked
    r = await pdb.post("/approval/suspicious-prices/decide", json={
        "decision": "correct_price", "value": "suggested", "all_matching": True,
        "filters": {"cause": "typo"}, "exclude_ids": [str(o["exp"].id)]})
    assert r.status_code == 200 and r.json()["decided"] == 1 and r.json()["failed_count"] == 0
    fixed = await Order.get(o["cheap"].id)
    assert fixed.price == 141_000 and fixed.status == OrderStatus.ACTIVE and fixed.usd_price == pytest.approx(141_000 / 7.8)
    assert (await Order.get(o["exp"].id)).status == OrderStatus.HELD

    # suggested currency on the wrong-currency offer; offers without suggestion fail, stay held
    r = await pdb.post("/approval/suspicious-prices/decide", json={
        "decision": "fix_currency", "value": "suggested", "all_matching": True})
    assert r.json()["decided"] == 1 and r.json()["failed_count"] == 2
    assert (await Order.get(o["cur"].id)).currency == "HKD"
    assert (await Order.get(o["plain"].id)).status == OrderStatus.HELD

    r = await pdb.post("/approval/suspicious-prices/decide", json={
        "decision": "reject", "all_matching": True, "limit": 1})
    assert r.json()["decided"] == 1 and r.json()["remaining"] == 1 and r.json()["next_after"]

    assert (await pdb.post("/approval/suspicious-prices/decide", json={"decision": "fix_currency", "ids": ["x"], "value": "XXX"})).status_code == 400
    assert (await pdb.post("/approval/suspicious-prices/decide", json={"decision": "approve"})).status_code == 400


@pytest.mark.asyncio
async def test_prices_by_file_download_decide_preview_commit_undo(pdb):
    from app.models.order import Order, OrderStatus

    o = await build_queue(pdb)
    text = (await pdb.get("/approval/file/export/prices")).text.lstrip(chr(0xFEFF))
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
    assert [r["id"] for r in rows][:2] == [str(o["cheap"].id), str(o["plain"].id)]  # too cheap first
    by = {r["id"]: r for r in rows}
    cur = by[str(o["cur"].id)]
    assert cur["offer_count"] == "11" and cur["median_currency"] == "EUR" and float(cur["median"]) > 0
    assert "wrong_currency" in cur["info"] and "suggested currency HKD" in cur["info"]

    by[str(o["cur"].id)].update(decision="fix_currency", new_value="suggested")
    by[str(o["cheap"].id)].update(decision="correct_price", new_value="suggested")
    by[str(o["plain"].id)].update(decision="approve")
    by[str(o["exp"].id)].update(decision="reject")
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=list(rows[0].keys()), delimiter=";")
    w.writeheader()
    w.writerows(rows)
    r = await pdb.post("/approval/file/preview", files={"file": ("p.csv", out.getvalue().encode(), "text/csv")})
    pv = r.json()
    assert pv["apply"]["prices"] == {"fix_currency": 1, "correct_price": 1, "approve": 1, "reject": 1}
    assert await Order.find({"status": "held"}).count() == 4
    r = await pdb.post(f"/approval/file/{pv['batch_id']}/commit", json={"confirm_apply_total": 4})
    assert r.status_code == 200 and r.json()["failed"] == 0, r.text
    assert (await Order.get(o["cur"].id)).currency == "HKD" and (await Order.get(o["cheap"].id)).price == 141_000
    assert await Order.get(o["exp"].id) is None
    assert await Order.find({"status": "held"}).count() == 0
    r = await pdb.post(f"/approval/file/{pv['batch_id']}/undo")
    assert r.status_code == 200
    assert await Order.find({"status": "held"}).count() == 4
    assert (await Order.get(o["cur"].id)).currency == "USD"


@pytest.mark.asyncio
async def test_minority_right_case_is_listed_without_a_currency_suggestion(pdb):
    from app.models.order import Order

    for i, p in enumerate((58_000, 58_500, 58_900, 59_300)):
        await make_order(p, "HKD", ws="WGSA0124", year=2024, brand="Rolex", phone=f"+8521{i}")
    right = await make_order(459_000, "HKD", ws="WGSA0124", year=2024, brand="Rolex", phone="+85299")
    assert (await pf.scan_active(dry_run=False))["held"] >= 1
    o = await Order.get(right.id)
    assert o.status == "held" and o.price_flag["cause"] == "wrong_currency"
    item = [i for i in (await pdb.get("/approval/suspicious-prices", params={"cause": "wrong_currency"})).json()["items"]
            if i["id"] == str(right.id)][0]
    assert item["suggested_currency"] is None and item["peers_currency"] == "USD"
    # "suggested" has nothing to apply: it fails, the offer stays in the queue
    r = await pdb.post("/approval/suspicious-prices/decide", json={
        "decision": "fix_currency", "value": "suggested", "ids": [str(right.id)]})
    assert r.json()["decided"] == 0 and r.json()["failed_count"] == 1
    assert (await Order.get(right.id)).status == "held"


@pytest.mark.asyncio
async def test_cheap_second_line_of_the_same_year_is_held(pdb):
    """Kenan, 25 Nov 2026: '228238 a black 2024 hkd536k' and '... 2024 hkd380k' in one message, other
    2024 offers 515k-553k. One offer per line now - the 380k line must be held, the 536k one goes live."""
    from app.models.order import Order, OrderStatus

    for p in (515_000, 530_000, 553_000):
        await make_order(p, "HKD", ws="5711/1A", year=2024, cond="Used", brand="Patek")
    text = "5711/1A 2024 hkd536k\n5711/1A 2024 hkd380k"
    new = [Order(order_type="sell", brand="Patek", model="M", reference="5711", ws_code="5711/1A", price=p,
                 currency="HKD", usd_price=p / RATES["HKD"], country_code="CN", user_id="u", whatsapp_phone="+8617700",
                 year=2024, condition="Used", source_text=text) for p in (536_000, 380_000)]
    held = await pf.check_new_orders(new)
    assert held == [new[1]] and new[1].status == OrderStatus.HELD and new[0].status != OrderStatus.HELD
