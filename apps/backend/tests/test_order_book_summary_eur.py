"""The order book footer: best ask / bid / spread in EUR, not raw prices in mixed currencies."""
from types import SimpleNamespace

import pytest

from app.api.v1.endpoints import orders
from app.services import fx

RATES = {"USD": 1.0, "EUR": 0.9, "HKD": 7.8}


@pytest.fixture(autouse=True)
def fixed_rates(monkeypatch):
    async def load_rates(force=False):
        return RATES

    monkeypatch.setattr(fx, "load_rates", load_rates)


def _o(price, currency, usd):
    return SimpleNamespace(price=price, currency=currency, usd_price=usd)


@pytest.mark.asyncio
async def test_hkd_ask_is_converted_not_relabelled():
    # HKD 239,000 = USD 30,641 -> EUR 27,577; the old footer showed "€239.000".
    sell = [_o(239_000, "HKD", 239_000 / 7.8)]
    buy = [_o(25_000, "USD", 25_000)]
    ask, bid, spread = await orders._summary_in_eur(sell, buy)
    assert ask == round(239_000 / 7.8 * 0.9)
    assert bid == 22_500
    assert spread == ask - bid


@pytest.mark.asyncio
async def test_buy_requests_without_price_are_skipped():
    sell = [_o(30_000, "EUR", 30_000 / 0.9)]
    buy = [_o(None, None, None), _o(20_000, "EUR", 20_000 / 0.9)]
    ask, bid, spread = await orders._summary_in_eur(sell, buy)
    assert (ask, bid, spread) == (30_000, 20_000, 10_000)


@pytest.mark.asyncio
async def test_empty_sides():
    assert await orders._summary_in_eur([], []) == (None, None, None)
