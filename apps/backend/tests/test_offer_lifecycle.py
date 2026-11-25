"""Offer guard before publishing, offer identity without the price, and expiry."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

ADMIN_ID = "000000000000000000000001"


@pytest_asyncio.fixture
async def odb():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    import app.services.fx as fx
    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.watch import Watch
    from app.models.whatsapp_import import ExtractedWatchListing, WhatsAppImport

    client = AsyncMongoMockClient()
    await init_beanie(database=client["offer_lifecycle_test"], document_models=[
        Order, Watch, WhatsAppImport, ExtractedWatchListing, FxRate, FxRateHistory, WatchMarketStats])
    fx._cache = None
    await Watch(brand="Rolex", model="GMT-Master II", reference="126710BLNR", ws_code="126710BLNR Jub",
                dealer_id="x", status="active", bracelet="Jubilee").insert()
    await Watch(brand="Rolex", model="Submariner", reference="126610LN", ws_code="126610LN",
                dealer_id="x", status="active").insert()
    yield client
    fx._cache = None


def _row(ws="126610LN", price="105.000 HKD", text="126610LN 105k hkd", phone="+85212345678",
         posted="20.11.26 14:25:34", kind="WTS", month_year="10/26", cond="Unworn"):
    return {
        "Nachrichten Art": kind, "Marke": "Rolex", "WS-Code": ws, "Monat/Jahr": month_year,
        "Standort": "HK", "Zustand": cond, "Bemerkungen": "", "Preis": price, "Nummer": phone,
        "Gruppe": "HK Dealers", "Nachricht gepostet am": posted,
        "_import": {"match_method": "exact", "source_text": text},
    }


async def _run(rows, guard=True):
    from app.api.v1.endpoints import whatsapp
    from app.models.user import User
    from app.models.whatsapp_import import WhatsAppImport

    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = ADMIN_ID
    rec = WhatsAppImport(filename="t.csv", group_name="g", imported_by="a", imported_by_name="a")
    await rec.insert()
    fields = [k for k in rows[0] if not k.startswith("_")]
    return await whatsapp.import_order_rows(rows, fields, rec, admin, require_phone=True,
                                            dispatch_alerts=False, guard=guard)


# --- guard ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_guard_holds_price_from_another_references_line(odb):
    from app.models.order import Order

    # The real case from the audit: 66k HKD on the GMT came from a 116334 line.
    res = await _run([_row(ws="126710BLNR Jub", price="66.000 HKD",
                           text="116334 Silver Index Oys Used 2014 $66K")])
    assert res["new_order_ids"] == [] and res["guard_held"] == 1
    assert "another reference" in res["guard_held_row_list"][0]["Guard"]
    assert await Order.find_all().count() == 0


@pytest.mark.asyncio
async def test_guard_rejects_reference_number_as_price(odb):
    res = await _run([_row(price="126.610 HKD", text="126610LN 126610 new")])
    assert res["new_order_ids"] == [] and res["guard_rejected"] == 1


@pytest.mark.asyncio
async def test_guard_accepts_offer_backed_by_the_line(odb):
    res = await _run([_row()])
    assert len(res["new_order_ids"]) == 1 and res["guard_held"] == 0


@pytest.mark.asyncio
async def test_without_guard_rows_publish_as_before(odb):
    # Approval page: an admin confirmed the row, the guard does not run again.
    res = await _run([_row(ws="126710BLNR Jub", price="66.000 HKD",
                           text="116334 Silver Index Oys Used 2014 $66K")], guard=False)
    assert len(res["new_order_ids"]) == 1


@pytest.mark.asyncio
async def test_guard_can_be_switched_off(odb, monkeypatch):
    monkeypatch.setenv("OFFER_GUARD_ENABLED", "false")
    res = await _run([_row(ws="126710BLNR Jub", price="66.000 HKD",
                           text="116334 Silver Index Oys Used 2014 $66K")])
    assert len(res["new_order_ids"]) == 1


@pytest.mark.asyncio
async def test_row_without_dealer_text_is_not_guarded(odb):
    row = _row(ws="126710BLNR Jub", price="66.000 HKD")
    row["_import"] = {}
    res = await _run([row])
    assert len(res["new_order_ids"]) == 1


# --- offer identity / price updates --------------------------------------------

@pytest.mark.asyncio
async def test_new_order_gets_expiry_from_post_time(odb):
    from app.models.order import Order

    await _run([_row(posted="20.11.26 14:25:34"), _row(kind="WTB", price="", text="WTB 126610LN")])
    sell = await Order.find_one({"order_type": "sell"})
    buy = await Order.find_one({"order_type": "buy"})
    assert sell.expires_at == datetime(2026, 11, 30, 14, 25, 34)
    assert buy.expires_at == datetime(2026, 12, 4, 14, 25, 34)


@pytest.mark.asyncio
async def test_older_post_does_not_overwrite_newer_price(odb):
    from app.models.order import Order

    await _run([_row(price="99.000 HKD", text="126610LN 99k hkd", posted="21.11.26 10:00:00")])
    res = await _run([_row(price="105.000 HKD", posted="20.11.26 10:00:00")])  # late export
    assert res["price_updated_orders"] == 0
    assert (await Order.find_one({})).price == 99000


@pytest.mark.asyncio
async def test_newer_price_in_the_same_import_wins(odb):
    from app.models.order import Order

    res = await _run([
        _row(price="105.000 HKD", posted="20.11.26 10:00:00"),
        _row(price="99.000 HKD", text="126610LN 99k hkd", posted="21.11.26 10:00:00"),
    ])
    assert len(res["new_order_ids"]) == 1
    assert (await Order.find_one({})).price == 99000


@pytest.mark.asyncio
async def test_buy_and_sell_of_one_dealer_stay_separate(odb):
    res = await _run([_row(), _row(kind="WTB", price="", text="WTB 126610LN")])
    assert len(res["new_order_ids"]) == 2


@pytest.mark.asyncio
async def test_other_card_date_is_another_piece(odb):
    res = await _run([_row(), _row(month_year="03/25", text="126610LN 03/25 105k hkd")])
    assert len(res["new_order_ids"]) == 2


# --- expiry -----------------------------------------------------------------

async def _order(**kw):
    from app.models.order import Order, OrderType

    base = dict(order_type=OrderType.SELL, brand="Rolex", model="Submariner", reference="126610LN",
                ws_code="126610LN", price=100000, currency="HKD", usd_price=12800, country_code="HK",
                user_id=ADMIN_ID, whatsapp_phone="+85212345678")
    base.update(kw)
    o = Order(**base)
    await o.insert()
    return o


@pytest.mark.asyncio
async def test_expiry_sweep(odb):
    from app.models.order import Order, OrderType
    from app.services.offer_lifecycle import expire_stale_orders

    now = datetime(2026, 11, 23, 12, 0)
    old_wts = await _order(created_at=now - timedelta(days=11))  # legacy, no expires_at
    young_wtb = await _order(order_type=OrderType.BUY, created_at=now - timedelta(days=11))
    old_wtb = await _order(order_type=OrderType.BUY, created_at=now - timedelta(days=15))
    app_user = await _order(created_at=now - timedelta(days=40), whatsapp_phone=None, user_id="u1")
    fresh = await _order(created_at=now - timedelta(days=2), expires_at=now + timedelta(days=8))
    past = await _order(created_at=now - timedelta(days=3), expires_at=now - timedelta(minutes=1))

    assert await expire_stale_orders(now) == 3
    status = {o.id: (await Order.get(o.id)).status.value for o in
              (old_wts, young_wtb, old_wtb, app_user, fresh, past)}
    assert status == {old_wts.id: "expired", young_wtb.id: "active", old_wtb.id: "expired",
                      app_user.id: "active", fresh.id: "active", past.id: "expired"}


@pytest.mark.asyncio
async def test_expiry_can_be_switched_off(odb, monkeypatch):
    from app.services.offer_lifecycle import expire_stale_orders

    monkeypatch.setenv("OFFER_EXPIRY_ENABLED", "0")
    await _order(created_at=datetime.utcnow() - timedelta(days=30))
    assert await expire_stale_orders() == 0


@pytest.mark.asyncio
async def test_repost_brings_expired_offer_back(odb):
    from app.models.order import Order, OrderStatus

    first = await _run([_row(posted="01.11.26 10:00:00")])
    o = await Order.get(first["new_order_ids"][0])
    o.status = OrderStatus.EXPIRED
    o.created_at = datetime.utcnow() - timedelta(days=20)
    await o.save()
    res = await _run([_row(posted=datetime.utcnow().strftime("%d.%m.%y %H:%M:%S"))])
    assert res["new_order_ids"] == [] and res["refreshed_order_ids"] == [str(o.id)]
    back = await Order.get(o.id)
    assert back.status == OrderStatus.ACTIVE and back.expires_at > datetime.utcnow()


@pytest.mark.asyncio
async def test_repost_marks_buy_request_as_sold_order(odb):
    from app.models.order import Order

    await _run([_row(kind="WTB", price="", text="WTB 126610LN")])
    row = _row(kind="WTB", price="", text="sold order WTB 126610LN", posted="21.11.26 10:00:00")
    row["Sold Order"] = "Yes"
    await _run([row])
    assert (await Order.find_one({"order_type": "buy"})).firm_order is True


# --- one offer per line (Kenan, 25 Nov 2026) -----------------------------------------------

@pytest.mark.asyncio
async def test_year_only_lines_of_one_message_are_separate_offers(odb):
    from app.models.order import Order

    msg = "Rolex used full set\n126610LN 2019 hkd359k\n126610LN 2022 hkd397k\n126610LN 2024 hkd422k"
    rows = [_row(price=p, month_year=y, cond="Used", posted="25.11.26 10:39:00", text=msg)
            for y, p in (("2019", "359.000 HKD"), ("2022", "397.000 HKD"), ("2024", "422.000 HKD"))]
    res = await _run(rows, guard=False)
    assert len(res["new_order_ids"]) == 3
    assert sorted((o.year, o.price) for o in await Order.find_all().to_list()) == [
        (2019, 359000), (2022, 397000), (2024, 422000)]
    # the same message again (next hourly export): refreshes, nothing new, nothing overwritten
    res = await _run(rows, guard=False)
    assert res["new_order_ids"] == [] and await Order.count() == 3
    assert sorted((o.year, o.price) for o in await Order.find_all().to_list()) == [
        (2019, 359000), (2022, 397000), (2024, 422000)]


@pytest.mark.asyncio
async def test_same_year_twice_in_one_message_with_other_price_is_two_offers(odb):
    from app.models.order import Order

    msg = "126610LN 2024 hkd536k\n126610LN 2024 hkd380k"
    rows = [_row(price=p, month_year="2024", cond="Used", posted="25.11.26 10:39:00", text=msg)
            for p in ("536.000 HKD", "380.000 HKD")]
    res = await _run(rows, guard=False)
    assert len(res["new_order_ids"]) == 2
    assert sorted(o.price for o in await Order.find_all().to_list()) == [380000, 536000]
    res = await _run(rows, guard=False)  # repost of both lines: two refreshes, no third offer
    assert res["new_order_ids"] == [] and await Order.count() == 2
    assert sorted(o.price for o in await Order.find_all().to_list()) == [380000, 536000]


@pytest.mark.asyncio
async def test_other_year_in_a_repost_does_not_overwrite_the_existing_offer(odb):
    from app.models.order import Order

    await _run([_row(price="510.000 HKD", month_year="2024", cond="Used", posted="17.11.26 09:00:00")], guard=False)
    res = await _run([
        _row(price="510.000 HKD", month_year="2024", cond="Used", posted="25.11.26 12:37:00"),
        _row(price="425.000 HKD", month_year="2020", cond="Used", posted="25.11.26 12:37:00"),
    ], guard=False)
    assert len(res["new_order_ids"]) == 1
    assert sorted((o.year, o.price) for o in await Order.find_all().to_list()) == [(2020, 425000), (2024, 510000)]
