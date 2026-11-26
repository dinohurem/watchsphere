"""One offer per dealer line (Kenan's full check, 26 Nov 2026).

Identity of an offer = dealer + side + WS code + the dealer's line. The same line again (another
message, another group, an hourly repost) is the same offer and its new reading overwrites the old
one completely. Different lines of one message stay separate offers. A new line for a watch the
dealer already offers from an EARLIER message, that no line of this message claims, is that offer's
new reading (Test chat 4, cases 521-526). An old offer is only kept alive by a line that supports it.
"""
from datetime import datetime

import pytest
import pytest_asyncio

from tests.test_offer_lifecycle import _row, _run, odb  # noqa: F401  (fixture reuse)

T1 = "26.11.26 12:13:00"
T2 = "26.11.26 12:23:00"
PHONE = "+85200000521"


@pytest_asyncio.fixture
async def rdb(odb):  # noqa: F811
    from app.models.watch import Watch

    await Watch(brand="Rolex", model="Oyster", reference="126710BLRO", ws_code="126710BLRO Oys",
                dealer_id="x", status="active").insert()
    await Watch(brand="Rolex", model="Meteorite", reference="116508", ws_code="116508 Meteorite",
                dealer_id="x", status="active").insert()
    yield odb


async def _orders(**flt):
    from app.models.order import Order

    return await Order.find(flt).to_list()


@pytest.mark.asyncio
async def test_repost_with_changed_condition_overwrites_the_offer(rdb):
    await _run([_row(text="126610LN 2021 used 105k hkd", cond="Used", month_year="2021", posted=T1)])
    await _run([_row(text="126610LN n11 105k hkd", cond="Unworn", month_year="11/26", posted=T2)])
    offers = await _orders()
    assert len(offers) == 1
    o = offers[0]
    assert o.condition.value == "Unworn" and (o.watch_month, o.year) == (11, 2026)
    assert o.source_text == "126610LN n11 105k hkd" and o.created_at == datetime(2026, 11, 26, 12, 23)


@pytest.mark.asyncio
async def test_identical_line_overwrites_everything_even_with_the_same_price(rdb):
    await _run([_row(text="126610LN 105k hkd", cond="Used", month_year="2021", posted=T1)])
    row = _row(text="126610LN 105k hkd", cond="Unworn", month_year="2024", posted=T2)
    row["Bemerkungen"] = "full set"
    await _run([row])
    (o,) = await _orders()
    assert o.condition.value == "Unworn" and o.year == 2024 and o.remarks == "full set"


@pytest.mark.asyncio
async def test_same_line_in_two_groups_is_one_offer(rdb):
    a, b = _row(posted=T1), _row(posted=T1)
    a["Gruppe"], b["Gruppe"] = "Group A", "Group B"
    await _run([a, b])
    assert len(await _orders()) == 1
    # ... and the same line arriving minutes later from the second group
    await _run([_row(posted="26.11.26 12:15:00")])
    assert len(await _orders()) == 1


@pytest.mark.asyncio
async def test_different_lines_of_one_message_stay_separate_offers(rdb):
    msg = "126610LN 2022 hkd397k\n126610LN 2024 hkd422k"
    rows = [_row(price="397.000 HKD", month_year="2022", text="126610LN 2022 hkd397k", posted=T1),
            _row(price="422.000 HKD", month_year="2024", text="126610LN 2024 hkd422k", posted=T1)]
    for r in rows:
        r["_import"]["message_text"] = msg
    await _run(rows)
    assert len(await _orders()) == 2
    # the dealer posts the list again with one price changed: still two offers, the changed one overwritten
    rows2 = [_row(price="397.000 HKD", month_year="2022", text="126610LN 2022 hkd397k", posted=T2),
             _row(price="415.000 HKD", month_year="2024", text="126610LN 2024 hkd415k", posted=T2)]
    await _run(rows2)
    offers = await _orders()
    assert sorted(o.price for o in offers) == [397000, 415000]


@pytest.mark.asyncio
async def test_other_price_on_another_line_next_to_the_old_one_is_a_separate_offer(rdb):
    await _run([_row(price="397.000 HKD", month_year="2022", text="126610LN 2022 hkd397k", posted=T1)])
    # a message that repeats the old line AND adds another price: the old line keeps its offer
    await _run([_row(price="397.000 HKD", month_year="2022", text="126610LN 2022 hkd397k", posted=T2),
                _row(price="380.000 HKD", month_year="2024", text="126610LN 2024 hkd380k", posted=T2)])
    offers = await _orders()
    assert sorted(o.price for o in offers) == [380000, 397000]


@pytest.mark.asyncio
async def test_two_different_dealers_never_share_an_offer(rdb):
    await _run([_row(posted=T1), _row(phone="+85299999999", posted=T1)])
    assert len(await _orders()) == 2


@pytest.mark.asyncio
async def test_older_export_does_not_overwrite_a_newer_reading(rdb):
    await _run([_row(text="126610LN n11 105k hkd", cond="Unworn", month_year="11/26", posted=T2)])
    await _run([_row(text="126610LN 2021 used 105k hkd", cond="Used", month_year="2021", posted=T1)])
    (o,) = await _orders()
    assert o.condition.value == "Unworn"


# --- Test chat 4, Part B ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_521_522_year_and_condition_come_from_the_new_line(rdb):
    r1 = _row(ws="126710BLRO Oys", price="192.000 HKD", cond="Used", month_year="2021",
              text="126710blro oys 2021 used 192k", phone=PHONE, posted=T1)
    r2 = _row(ws="126710BLRO Oys", price="192.000 HKD", cond="Unworn", month_year="11/26",
              text="126710blro oys n11 192k", phone=PHONE, posted=T2)
    await _run([r1, r2])  # both messages in one export
    (o,) = await _orders()
    assert o.condition.value == "Unworn" and (o.watch_month, o.year) == (11, 2026)
    assert o.created_at == datetime(2026, 11, 26, 12, 23)


@pytest.mark.asyncio
async def test_case_523_524_new_price_in_a_repost_one_offer_132k(rdb):
    p = "+85200000523"
    await _run([_row(ws="126710BLNR Jub", price="130.000 HKD", cond="", month_year="11/26",
                     text="126710blnr oys w11 130k", phone=p, posted=T1)], guard=False)
    await _run([_row(ws="126710BLNR Jub", price="132.000 HKD", cond="", month_year="11/26",
                     text="126710blnr oys w11 132k", phone=p, posted=T2)], guard=False)
    (o,) = await _orders()
    assert o.price == 132000 and o.created_at == datetime(2026, 11, 26, 12, 23)
    assert o.price_history and o.price_history[-1]["price"] == 130000


@pytest.mark.asyncio
async def test_case_523_524_in_one_export(rdb):
    p = "+85200000523"
    await _run([_row(ws="126710BLNR Jub", price="130.000 HKD", cond="", month_year="11/26",
                     text="126710blnr oys w11 130k", phone=p, posted=T1),
                _row(ws="126710BLNR Jub", price="132.000 HKD", cond="", month_year="11/26",
                     text="126710blnr oys w11 132k", phone=p, posted=T2)], guard=False)
    (o,) = await _orders()
    assert o.price == 132000


@pytest.mark.asyncio
async def test_case_525_526_same_line_twice_is_one_offer(rdb):
    p = "+85200000525"
    kw = dict(ws="116508 Meteorite", price="757.000 HKD", cond="Used", month_year="2022",
              text="116508 mete 2022 hkd757k", phone=p)
    await _run([_row(posted="26.11.26 12:35:00", **kw)])
    await _run([_row(posted="26.11.26 12:37:00", **kw)])
    (o,) = await _orders()
    assert o.created_at == datetime(2026, 11, 26, 12, 37)
    # and in a single export
    await _run([_row(posted="26.11.26 12:40:00", **kw), _row(posted="26.11.26 12:41:00", **kw)])
    assert len(await _orders()) == 1


# --- refreshing from a repost that is not parsed again -------------------------------------

@pytest_asyncio.fixture
async def pdb(odb):  # noqa: F811
    yield odb


async def _stored(price, year, text, created, status="active"):
    from app.models.order import Order, OrderStatus

    o = Order(order_type="sell", brand="Rolex", model="S", reference="126610LN", ws_code="126610LN",
              price=price, currency="HKD", year=year, country_code="HK", user_id="a",
              whatsapp_phone="+85212345678", source_text=text, created_at=datetime(2026, 11, 20, 10, 0),
              status=OrderStatus(status))
    await o.insert()
    return o


def _repost(body, ts=datetime(2026, 11, 26, 12, 0)):
    return {"ts": ts, "sender": "+852 1234 5678", "body": body, "lines": [body]}


@pytest.mark.asyncio
async def test_a_line_that_still_matches_refreshes_the_old_offer(pdb):
    from app.models.order import Order
    from app.services import pipeline

    o = await _stored(2_018_000, 2022, "5712/1R 22y hkd2.018M", None)
    n, again = await pipeline._refresh_reposts([_repost("5712/1R 22y hkd2.018M")])
    assert n == 1 and again == []
    assert (await Order.get(o.id)).created_at == datetime(2026, 11, 26, 12, 0)


@pytest.mark.asyncio
async def test_a_line_with_another_price_does_not_refresh_and_is_read_again(pdb):
    from app.models.order import Order
    from app.services import pipeline

    o = await _stored(856_000, 2010, "5712/1R 22y hkd2.018M", None)  # the audit's wrong offer
    msg = _repost("5712/1R 22y hkd2.018M")
    n, again = await pipeline._refresh_reposts([msg])
    assert n == 0 and again == [msg]
    assert (await Order.get(o.id)).created_at == datetime(2026, 11, 20, 10, 0)


@pytest.mark.asyncio
async def test_a_line_with_another_year_does_not_refresh(pdb):
    from app.models.order import Order
    from app.services import pipeline

    o = await _stored(82_000, 2016, "25558/000R-B156 2023 HKD82k", None)
    n, again = await pipeline._refresh_reposts([_repost("25558/000R-B156 2023 HKD82k")])
    assert n == 0 and len(again) == 1
    assert (await Order.get(o.id)).created_at == datetime(2026, 11, 20, 10, 0)


@pytest.mark.asyncio
async def test_a_line_that_does_not_match_the_offer_at_all_changes_nothing(pdb):
    from app.models.order import Order
    from app.services import pipeline

    o = await _stored(105_000, 2022, "126610LN 2022 hkd105k", None)
    n, again = await pipeline._refresh_reposts([_repost("126610LN 2024 hkd99k")])
    assert n == 0 and again == []
    assert (await Order.get(o.id)).created_at == datetime(2026, 11, 20, 10, 0)


def test_reading_matches_line_notations():
    from app.services.offer_lifecycle import reading_matches_line as ok

    assert ok(192_000, 2026, "126710blro oys n11 192k")
    assert ok(1_860_000, 2021, "15468bc 2021new 239k USDT // 1.86m HKD")
    assert ok(126_500, None, "126500LN white 126,500")
    assert ok(105_000, None, "126610LN 105.000")
    assert not ok(856_000, 2010, "5712/1R 22y hkd2.018M")
    assert not ok(82_000, 2016, "25558/000R-B156 2023 HKD82k")


# --- maintenance: collapse the duplicates that exist ----------------------------------------

@pytest.mark.asyncio
async def test_collapse_duplicates_dry_run_then_real(pdb):
    from app.models.order import Order, OrderStatus
    from app.services import offer_dedupe

    line = "116400gv blue 2018 hkd101k"
    old = await _stored(101_000, 2018, line, None)
    new = await _stored(101_000, 2018, line, None)
    new.created_at = datetime(2026, 11, 26, 10, 0)
    await new.save()
    copy_a = await _stored(757_000, 2022, "116508 mete 2022 hkd757k", None)  # exact copies, other text
    copy_b = await _stored(757_000, 2022, "116508 mete 2022 hkd757k (HK group B)", None)
    copy_b.created_at = datetime(2026, 11, 25, 10, 0)
    await copy_b.save()
    # a message with one offer per year: not duplicates
    msg = "126610LN\n2019 hkd359k\n2024 hkd422k"
    keep1 = await _stored(359_000, 2019, msg, None)
    keep2 = await _stored(422_000, 2024, msg, None)

    dry = await offer_dedupe.collapse_duplicates(dry_run=True)
    assert dry["dry_run"] and dry["duplicates"] == 2 and dry["by_reason"] == {"same_line": 1, "exact_copy": 1}
    assert dry["samples"] and await Order.find({"status": "active"}).count() == 6

    res = await offer_dedupe.collapse_duplicates(dry_run=False)
    assert res["expired"] == 2
    assert (await Order.get(old.id)).status == OrderStatus.EXPIRED
    assert (await Order.get(old.id)).superseded_by == str(new.id)
    assert (await Order.get(copy_a.id)).superseded_by == str(copy_b.id) or \
        (await Order.get(copy_b.id)).superseded_by == str(copy_a.id)
    for k in (keep1, keep2, new):
        assert (await Order.get(k.id)).status == OrderStatus.ACTIVE
    again = await offer_dedupe.collapse_duplicates(dry_run=True)
    assert again["duplicates"] == 0


@pytest.mark.asyncio
async def test_a_superseded_offer_is_never_matched_by_an_import(pdb):
    from app.models.order import Order, OrderStatus

    o = await _stored(105_000, 2024, "126610LN 105k hkd", None, status="expired")
    o.superseded_by = "x"
    await o.save()
    await _run([_row(posted=T1)])
    assert await Order.find({"status": "active"}).count() == 1
    assert (await Order.get(o.id)).status == OrderStatus.EXPIRED
