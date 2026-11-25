"""Card chip / Rising-Falling value is the weekly (1W) change."""
from app.services.market_stats import card_change_pct, trend_pct, weekly_trend_pct


def test_weekly_uses_1w_even_when_1m_exists():
    periods = {"1M": {"wts_change_pct": 3.2}, "1W": {"wts_change_pct": -1.0}}
    assert weekly_trend_pct(periods) == -1.0


def test_weekly_none_without_1w():
    assert weekly_trend_pct({"1M": {"wts_change_pct": 3.2}, "1W": {"wts_change_pct": None}}) is None
    assert weekly_trend_pct({}) is None


def test_monthly_trend_unchanged():
    assert trend_pct({"1M": {"wts_change_pct": 3.2}, "1W": {"wts_change_pct": -1.0}}) == 3.2
    assert trend_pct({"1M": {"wts_change_pct": None}, "1W": {"wts_change_pct": -1.4}}) == -1.4
    assert trend_pct({}) is None


def test_card_change_reads_weekly_field():
    class Doc:
        change_1w_pct = -1.9
        change_1m_pct = 4.0

    assert card_change_pct(Doc()) == -1.9
    assert card_change_pct({"change_1w_pct": 2.0, "change_1m_pct": 9.0}) == 2.0
    assert card_change_pct({"change_1m_pct": 9.0}) is None
