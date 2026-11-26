"""/market/aggregated prices: per WS code, converted before comparing, active offers only,
no generated history."""
import inspect

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def db(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.user import User
    from app.models.watch import Watch
    from app.services import fx

    client = AsyncMongoMockClient()
    await init_beanie(database=client["agg"], document_models=[Order, Watch, User, WatchMarketStats])

    async def rates(force=False):
        return {"USD": 1.0, "HKD": 7.8, "EUR": 0.9}

    monkeypatch.setattr(fx, "load_rates", rates)
    return client


async def _watch(ws, ref="126508", price=99999.0):
    from app.models.watch import Watch, WatchStatus

    w = Watch(brand="Rolex", model="Daytona", reference=ref, ws_code=ws, dealer_id="d",
              status=WatchStatus.ACTIVE, price=price, currency="USD")
    await w.insert()
    return w


async def _offer(ws, price, currency="USD", status="active", ref="126508"):
    from app.models.order import Order, OrderStatus, OrderType

    await Order(order_type=OrderType.SELL, brand="Rolex", model="Daytona", reference=ref, ws_code=ws,
                price=price, currency=currency, user_id="u", user_name="d", country_code="HK",
                status=OrderStatus(status)).insert()


@pytest.mark.asyncio
async def test_variants_of_one_reference_get_their_own_price(db):
    from app.api.v1.endpoints.market import get_aggregated_watch_by_reference

    await _watch("126508-A")
    await _watch("126508-B")
    await _offer("126508-A", 77_500)
    await _offer("126508-B", 90_000)
    a = await get_aggregated_watch_by_reference("126508-A")
    b = await get_aggregated_watch_by_reference("126508-B")
    assert (a.display_price, b.display_price) == (77_500, 90_000)


@pytest.mark.asyncio
async def test_converts_before_comparing_and_returns_offer_currency(db):
    from app.api.v1.endpoints.market import get_aggregated_watch_by_reference

    await _watch("126508-A")
    await _offer("126508-A", 206_000, "HKD")   # about 26,410 USD
    await _offer("126508-A", 26_500, "EUR")    # about 29,444 USD
    r = await get_aggregated_watch_by_reference("126508-A")
    assert (r.display_price, r.currency) == (206_000, "HKD")
    assert r.lowest_order_price == 206_000


@pytest.mark.asyncio
async def test_expired_offers_are_ignored_and_no_active_means_no_price(db):
    from app.api.v1.endpoints.market import get_aggregated_watch_by_reference

    await _watch("126508-A", price=88_000)
    await _offer("126508-A", 10_000, status="expired")
    r = await get_aggregated_watch_by_reference("126508-A")
    assert r.display_price == 0 and r.lowest_order_price is None and r.admin_price is None
    await _offer("126508-A", 80_000)
    r = await get_aggregated_watch_by_reference("126508-A")
    assert r.display_price == 80_000


@pytest.mark.asyncio
async def test_list_endpoint_prices_per_variant(db):
    from app.api.v1.endpoints.market import get_aggregated_market_data

    await _watch("126508-A")
    await _watch("126508-B")
    await _watch("126508-C")
    await _offer("126508-A", 77_500)
    await _offer("126508-B", 26_500, "EUR")
    rows = {r.ws_code: r for r in await get_aggregated_market_data(
        category="hot", brand=None, search=None, skip=0, limit=50)}
    assert rows["126508-A"].display_price == 77_500
    assert (rows["126508-B"].display_price, rows["126508-B"].currency) == (26_500, "EUR")
    assert rows["126508-C"].display_price == 0 and rows["126508-C"].lowest_order_price is None


@pytest.mark.asyncio
async def test_history_is_empty_without_recorded_data_and_never_random(db):
    from app.api.v1.endpoints import market, orders
    from app.api.v1.endpoints.market import get_aggregated_watch_by_reference

    await _watch("126508-A")
    await _offer("126508-A", 77_500)
    r1 = await get_aggregated_watch_by_reference("126508-A")
    assert r1.price_history == [] and r1.price_change == 0.0
    assert "random" not in inspect.getsource(market) and "random" not in inspect.getsource(orders)
    assert not hasattr(market, "generate_price_history_from_change")
    assert not hasattr(orders, "generate_price_history_from_change")


@pytest.mark.asyncio
async def test_history_comes_from_recorded_series(db):
    from app.api.v1.endpoints.market import get_aggregated_watch_by_reference
    from app.models.market_stats import WatchMarketStats

    await _watch("126508-A")
    await _offer("126508-A", 77_500)
    doc = WatchMarketStats(ws_code="126508-A", periods={"1M": {"fresh": {"series": [
        {"date": "2026-11-01", "median_usd": 70_000.0}, {"date": "2026-11-08", "median_usd": 72_000.0}]}}})
    await doc.insert()
    r = await get_aggregated_watch_by_reference("126508-A")
    assert r.price_history == [70_000.0, 72_000.0]


def test_orders_market_price_route_removed():
    from app.api.v1.endpoints.orders import router

    assert not [r for r in router.routes if "market-price" in getattr(r, "path", "")]
