"""Expired does not mean hidden: /orders/book?range= lists expired offers inside the
range (marked), the summary uses active offers only, counts include expired, and the
bulk fix reaches expired orders."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def db(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.user import User
    from app.models.watch import Watch, WatchStatus
    from app.services import fx

    client = AsyncMongoMockClient()
    await init_beanie(database=client["book"], document_models=[Order, Watch, User, WatchMarketStats])

    async def rates(force=False):
        return {"USD": 1.0, "HKD": 7.8, "EUR": 0.9}

    monkeypatch.setattr(fx, "load_rates", rates)
    await Watch(brand="Rolex", model="Sub", reference="126610LN", ws_code="126610LN", dealer_id="d",
                status=WatchStatus.ACTIVE).insert()
    return client


async def _o(price, days_ago, status="active", side="sell"):
    from app.models.order import Order, OrderStatus, OrderType

    o = Order(order_type=OrderType(side), brand="Rolex", model="Sub", reference="126610LN", ws_code="126610LN",
              price=price, currency="USD", usd_price=price, user_id="u", user_name="d", country_code="HK",
              status=OrderStatus(status), created_at=datetime.utcnow() - timedelta(days=days_ago))
    await o.insert()
    return o


@pytest.mark.asyncio
async def test_without_range_defaults_to_10d(db):
    from app.api.v1.endpoints.orders import get_order_book

    await _o(14_000, 2)
    await _o(12_000, 5, status="expired")     # inside 10D
    await _o(11_000, 20, status="expired")    # outside 10D
    book = await get_order_book("126610LN", limit=50, skip=0, range=None)
    assert [(e.price, e.expired) for e in book.sell_orders] == [(14_000, False), (12_000, True)]
    assert book.range == "10D"


@pytest.mark.asyncio
async def test_10d_window_and_legacy_1w_still_accepted(db):
    from app.api.v1.endpoints.orders import get_order_book

    await _o(12_000, 9, status="expired")     # inside 10D, outside 1W
    await _o(11_000, 11, status="expired")    # outside both
    book = await get_order_book("126610LN", limit=50, skip=0, range="10d")
    assert [e.price for e in book.sell_orders] == [12_000]
    book = await get_order_book("126610LN", limit=50, skip=0, range="1W")
    assert book.sell_orders == [] and book.range == "1W"


@pytest.mark.asyncio
async def test_active_range_hides_expired(db):
    from app.api.v1.endpoints.orders import get_order_book

    await _o(14_000, 2)
    await _o(12_000, 5, status="expired")
    book = await get_order_book("126610LN", limit=50, skip=0, range="ACTIVE")
    assert [e.price for e in book.sell_orders] == [14_000]
    assert book.range is None


@pytest.mark.asyncio
async def test_range_lists_expired_inside_it_marked_but_not_in_the_summary(db):
    from app.api.v1.endpoints.orders import get_order_book

    await _o(14_000, 2)
    await _o(12_000, 20, status="expired")    # inside 1M
    await _o(11_000, 200, status="expired")   # only in 1Y / ALL
    await _o(13_000, 1, side="buy")

    book = await get_order_book("126610LN", limit=50, skip=0, range="1m")
    assert [(e.price, e.expired) for e in book.sell_orders] == [(14_000, False), (12_000, True)]
    assert book.lowest_ask == 14_000          # expired 12,000 is not the current low
    assert book.spread == 1_000
    assert book.range == "1M"

    book = await get_order_book("126610LN", limit=50, skip=0, range="ALL")
    assert [e.price for e in book.sell_orders] == [14_000, 11_000, 12_000]
    assert book.wts_count_all_time == 3       # all-time count includes expired

    with pytest.raises(Exception):
        await get_order_book("126610LN", limit=50, skip=0, range="2W")


def test_card_counts_include_expired():
    from app.services.market_stats import Listing, compute_stats

    now = datetime.utcnow()

    def l(i, status_active, expired, side="sell"):
        return Listing(id=str(i), ws_code="W", order_type=side, dealer=f"d{i}", price=1.0, currency="USD",
                       price_usd=1.0, condition="Used", year=2020, month=None, created_at=now,
                       active=status_active, expired=expired)

    stats = compute_stats("W", [l(1, True, False), l(2, False, True), l(3, False, False), l(4, False, True, "buy")],
                          None, {"USD": 1.0}, now)
    assert (stats["wts_count"], stats["wtb_count"]) == (2, 1)  # completed (3) is not counted


@pytest.mark.asyncio
async def test_bulk_fix_loads_expired_orders(db):
    from app.api.v1.endpoints.orders_bulk_fix import _orders_by_id

    a = await _o(14_000, 2)
    e = await _o(12_000, 20, status="expired")
    c = await _o(10_000, 20, status="completed")
    got = await _orders_by_id([str(a.id), str(e.id), str(c.id)])
    assert set(got) == {str(a.id), str(e.id)}


@pytest.mark.asyncio
async def test_expired_below_active_and_superseded_copies_hidden(db):
    """26 Nov: expired offers sat between the active ones by price, and the older copies closed
    by the duplicate clean-up showed up as expired rows."""
    from app.api.v1.endpoints.orders import get_order_book

    keep = await _o(14_000, 1)
    await _o(15_000, 2)
    await _o(12_000, 3, status="expired")
    old = await _o(13_000, 3, status="expired")
    old.superseded_by = str(keep.id)
    await old.save()
    book = await get_order_book("126610LN", limit=50, skip=0, range="10D")
    assert [(e.price, e.expired) for e in book.sell_orders] == [(14_000, False), (15_000, False), (12_000, True)]
