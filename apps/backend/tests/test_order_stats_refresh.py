"""Manual order edits refresh that watch's market stats right away (not at the next FX run)."""
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def stats_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.watch import Watch
    import app.services.fx as fx

    client = AsyncMongoMockClient()
    await init_beanie(
        database=client["order_stats_test"],
        document_models=[Order, Watch, FxRate, FxRateHistory, WatchMarketStats],
    )
    fx._cache = None
    yield client
    fx._cache = None


async def _stats(ws_code):
    from app.models.market_stats import WatchMarketStats

    return await WatchMarketStats.get_motor_collection().find_one({"ws_code": ws_code})


@pytest.mark.asyncio
async def test_admin_edit_moves_listing_between_watches(stats_db):
    from app.api.v1.endpoints.orders import OrderUpdate, admin_update_order
    from app.models.order import Order, OrderCondition, OrderType

    order = Order(order_type=OrderType.SELL, brand="Rolex", model="Submariner",
                  reference="126610LN", ws_code="126610LN", price=120_000, currency="HKD",
                  condition=OrderCondition.USED, condition_raw="Used", country_code="HK",
                  country_name=None, user_id="dealer", year=2023)
    await order.insert()
    assert await _stats("126610LN") is None  # inserted directly, nothing computed yet

    await admin_update_order(str(order.id), OrderUpdate(price=125_000), current_admin=None)
    assert (await _stats("126610LN"))["wts_count"] == 1

    await admin_update_order(str(order.id), OrderUpdate(ws_code="126610LV"), current_admin=None)
    assert (await _stats("126610LV"))["wts_count"] == 1
    assert (await _stats("126610LN"))["wts_count"] == 0  # old watch no longer counts it


@pytest.mark.asyncio
async def test_refresh_never_fails_the_request(stats_db, monkeypatch):
    import app.services.market_stats as ms
    from app.api.v1.endpoints.orders import _refresh_stats

    calls = []

    async def boom(codes):
        calls.append(codes)
        raise RuntimeError("db down")

    monkeypatch.setattr(ms, "recompute_for", boom)
    await _refresh_stats(None, "A", "A", "")
    assert calls == [["A"]]
