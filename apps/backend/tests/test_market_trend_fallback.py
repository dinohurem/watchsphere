"""Card chip / Rising-Falling value: 1M change, else 1W (1M needs two months of history)."""
from app.services.market_stats import trend_pct


def test_uses_1m_when_present():
    assert trend_pct({"1M": {"wts_change_pct": 3.2}, "1W": {"wts_change_pct": -1.0}}) == 3.2


def test_falls_back_to_1w_when_1m_is_empty():
    assert trend_pct({"1M": {"wts_change_pct": None}, "1W": {"wts_change_pct": -1.4}}) == -1.4


def test_none_without_any_change():
    assert trend_pct({"1M": {"wts_change_pct": None}, "1W": {}}) is None
    assert trend_pct({}) is None
