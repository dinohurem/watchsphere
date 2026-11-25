"""Price history converts every offer to one currency before taking the daily low."""
from datetime import datetime, timedelta

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def db(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order
    from app.models.watch import Watch
    from app.services import fx

    client = AsyncMongoMockClient()
    await init_beanie(database=client["ph"], document_models=[Order, Watch])

    async def rates(force=False):
        return {"USD": 1.0, "HKD": 7.8, "EUR": 0.9}

    monkeypatch.setattr(fx, "load_rates", rates)
    return client


async def _order(price, currency, day, status="active", ws_code="5712/1R"):
    from app.models.order import Order, OrderStatus, OrderType

    o = Order(order_type=OrderType.SELL, brand="Patek Philippe", model="Nautilus", reference="5712/1R",
              ws_code=ws_code, price=price, currency=currency, user_id="u", user_name="d", country_code="HK",
              status=OrderStatus(status), created_at=datetime(2026, 11, day, 12))
    await o.insert()
    return o


@pytest.mark.asyncio
async def test_usd_offer_is_converted_before_the_daily_low(db, monkeypatch):
    from app.api.v1.endpoints import orders as ep
    from app.models.watch import Watch, WatchStatus

    monkeypatch.setattr(ep, "datetime", type("D", (), {"utcnow": staticmethod(lambda: datetime(2026, 11, 25))}))
    await Watch(brand="Patek Philippe", model="Nautilus", reference="5712/1R", ws_code="5712/1R", dealer_id="d",
                status=WatchStatus.ACTIVE).insert()
    await _order(2_100_000, "HKD", 22)
    await _order(268_000, "USD", 22)          # = 2,090,400 HKD: the real daily low
    await _order(2_200_000, "HKD", 23)
    await _order(1_000, "XYZ", 23)            # no rate: left out
    await _order(1_500_000, "HKD", 23, ws_code="5712/1R Other")  # other WS code, same reference

    res = await ep.get_price_history("5712/1R", days=365, currency="HKD")
    assert res.currency == "HKD"
    assert [(p.date, p.price) for p in res.points] == [("2026-11-22", 2_090_400.0), ("2026-11-23", 2_200_000.0)]
    assert res.current_price == 2_090_400.0

    usd = await ep.get_price_history("5712/1R", days=365, currency="USD")
    assert usd.points[0].price == 268_000.0
