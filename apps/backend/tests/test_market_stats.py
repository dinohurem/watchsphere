"""Pure market-data rules (generator spec §9) and FX conversion (§8)."""
from datetime import datetime, timedelta

import pytest

from app.services import market_stats as ms
from app.services.fx import SEED_RATES, convert, normalize_currency

NOW = datetime(2026, 11, 8, 12, 0, 0)


def L(i, price_usd, *, dealer="+1", ws="126610LN", cond="Unworn", year=2026, month=10,
      days_ago=1, otype="sell", excluded=False, price=None, currency="USD", active=True):
    return ms.Listing(
        id=str(i), ws_code=ws, order_type=otype, dealer=dealer,
        price=price if price is not None else price_usd, currency=currency,
        price_usd=price_usd, condition=cond, year=year, month=month,
        created_at=NOW - timedelta(days=days_ago), excluded=excluded, active=active,
    )


# --- FX ---------------------------------------------------------------------

def test_convert_roundtrip_and_aliases():
    rates = {"USD": 1.0, "EUR": 0.9, "HKD": 7.8, "USDT": 1.0, "CNY": 7.2}
    assert convert(100, "USD", "EUR", rates) == pytest.approx(90)
    assert convert(780, "HKD", "USD", rates) == pytest.approx(100)
    assert convert(90, "EUR", "HKD", rates) == pytest.approx(780)
    assert convert(100, "USDT", "USD", rates) == pytest.approx(100)
    assert convert(72, "RMB", "USD", rates) == pytest.approx(10)
    assert normalize_currency("hk$") == "HKD"


def test_convert_unknown_currency_is_none_not_usd():
    assert convert(100, "XYZ", "USD", SEED_RATES) is None
    assert convert(None, "USD", "EUR", SEED_RATES) is None


# --- median -----------------------------------------------------------------

def test_median_needs_three():
    assert ms.median_or_none([1, 2]) is None
    assert ms.median_or_none([1, 2, 3]) == 2
    assert ms.median_or_none([1, 2, 3, 10]) == 2.5
    assert ms.median_or_none([None, 1, 2]) is None


def test_pct_change():
    assert ms.pct_change(110, 100) == pytest.approx(10)
    assert ms.pct_change(None, 100) is None
    assert ms.pct_change(100, 0) is None


# --- dedup ------------------------------------------------------------------

def test_dedup_same_dealer_watch_price_counts_once():
    items = [
        L(1, 100, dealer="+1", days_ago=5),
        L(2, 100, dealer="+1", days_ago=1),  # repost in another group
        L(3, 100, dealer="+2"),              # other dealer, same price → counts
        L(4, 101, dealer="+1"),              # other price → counts
    ]
    out = ms.dedup_listings(items)
    assert len(out) == 3
    assert "2" in {l.id for l in out}  # newest kept


def test_median_eligible_skips_wtb_excluded_and_unpriced():
    items = [
        L(1, 100), L(2, 200, dealer="+2", excluded=True),
        L(3, 300, dealer="+3", otype="buy"), L(4, None, dealer="+4"),
    ]
    assert [l.id for l in ms.median_eligible(items)] == ["1"]


# --- fresh / used -----------------------------------------------------------

@pytest.mark.parametrize("cond,year,month,expected", [
    ("Unworn", 2026, 10, True),   # 1 month
    ("Unworn", 2026, 8, True),    # 3 months
    ("Unworn", 2026, 7, False),   # 4 months
    ("Unworn", 2026, None, False),  # month unknown
    ("Unworn", None, None, False),
    ("Used", 2026, 11, False),
    ("Unworn", 2026, 12, True),   # card dated after the listing
])
def test_is_fresh(cond, year, month, expected):
    assert ms.is_fresh(cond, year, month, NOW) is expected


def test_fresh_is_relative_to_listing_date():
    listing_date = datetime(2026, 2, 1)
    assert ms.is_fresh("Unworn", 2025, 11, listing_date) is True
    assert ms.is_fresh("Unworn", 2025, 10, listing_date) is False


# --- same-year change -------------------------------------------------------

def test_used_change_compares_same_year_only():
    # Prices per year are flat, but the current window has more expensive 2025
    # watches. A naive median would show a big rise; same-year shows 0 %.
    previous = [(2021, 100), (2021, 100), (2021, 100), (2025, 200)]
    current = [(2021, 100), (2025, 200), (2025, 200), (2025, 200)]
    assert ms.same_year_change_pct(current, previous) == pytest.approx(0)


def test_used_change_averages_per_year_changes():
    previous = [(2021, 100), (2021, 100), (2024, 200), (2024, 200)]
    current = [(2021, 110), (2021, 110), (2024, 180), (2024, 180)]
    # +10 % and -10 % → 0 %
    assert ms.same_year_change_pct(current, previous) == pytest.approx(0)
    current2 = [(2021, 120), (2024, 220), (2024, 220)]
    assert ms.same_year_change_pct(current2, previous) == pytest.approx(15)


def test_used_change_needs_data_and_overlap():
    assert ms.same_year_change_pct([(2021, 1)] * 2, [(2021, 1)] * 3) is None
    assert ms.same_year_change_pct([(2021, 1)] * 3, [(2022, 1)] * 3) is None


# --- period stats -----------------------------------------------------------

def test_period_stats_not_enough_data():
    out = ms.period_stats([L(1, 100), L(2, 110, dealer="+2")], "1M", NOW)
    assert out["enough_data"] is False
    assert out["fresh"]["median_usd"] is None


def test_period_stats_fresh_change_and_counts():
    items = [
        # current month, fresh
        L(1, 110, dealer="a", days_ago=2), L(2, 110, dealer="b", days_ago=3),
        L(3, 110, dealer="c", days_ago=4),
        # previous month, fresh relative to its own listing date
        L(4, 100, dealer="d", days_ago=40, month=9), L(5, 100, dealer="e", days_ago=40, month=9),
        L(6, 100, dealer="f", days_ago=40, month=9),
    ]
    out = ms.period_stats(items, "1M", NOW)
    assert out["fresh"]["median_usd"] == 110
    assert out["fresh"]["count"] == 3
    assert out["fresh"]["change_pct"] == pytest.approx(10)
    assert out["wts_change_pct"] == pytest.approx(10)
    assert out["used"]["median_usd"] is None
    assert out["fresh"]["series"]


# --- retail -----------------------------------------------------------------

def test_retail_average_over_countries_with_list_price():
    rates = {"USD": 1.0, "HKD": 8.0, "EUR": 0.8}
    out = ms.retail_breakdown(200.0, {"HK": 800, "DE": 80}, False, rates, "EUR")
    assert out["status"] == "ok"
    hk = next(c for c in out["countries"] if c["code"] == "HK")
    de = next(c for c in out["countries"] if c["code"] == "DE")
    cn = next(c for c in out["countries"] if c["code"] == "CN")
    assert hk["vs_retail_pct"] == pytest.approx(100)   # 200 vs 100 USD
    assert de["vs_retail_pct"] == pytest.approx(100)
    assert hk["list_price_converted"] == pytest.approx(80)
    assert cn["status"] == "no_data"
    assert out["avg_vs_retail_pct"] == pytest.approx(100)
    assert out["fresh_median"] == pytest.approx(160)
    assert len(out["countries"]) == 13
    assert out["countries"][0]["code"] == "HK"


def test_retail_discontinued_and_no_data():
    rates = {"USD": 1.0}
    disc = ms.retail_breakdown(100.0, {"US": 50}, True, rates)
    assert disc["status"] == "discontinued"
    assert all(c["status"] == "discontinued" for c in disc["countries"])
    assert disc["avg_vs_retail_pct"] is None
    none = ms.retail_breakdown(100.0, {}, False, rates)
    assert none["status"] == "no_data"
    below = ms.retail_breakdown(80.0, {"US": 100}, False, rates)
    assert below["avg_vs_retail_pct"] == pytest.approx(-20)


# --- outliers ---------------------------------------------------------------

def test_outlier_same_year_band():
    peers = [L(i, 100, dealer=str(i), cond="Used", year=2021) for i in range(3)]
    target = L(9, 130, dealer="x", cond="Used", year=2021)
    res = ms.outlier_check(target, peers + [target])
    assert res["is_outlier"] is True and res["tolerance_pct"] == 25
    ok = L(10, 120, dealer="y", cond="Used", year=2021)
    assert ms.outlier_check(ok, peers)["is_outlier"] is False


def test_outlier_uses_neighbouring_year_with_wider_band():
    peers = [L(i, 100, dealer=str(i), cond="Used", year=2022) for i in range(3)]
    target = L(9, 130, dealer="x", cond="Used", year=2021)
    res = ms.outlier_check(target, peers)
    assert res["basis_year"] == 2022 and res["tolerance_pct"] == 35
    assert res["is_outlier"] is False


def test_outlier_never_compares_different_condition():
    peers = [L(i, 300, dealer=str(i), cond="Unworn", year=2021) for i in range(3)]
    assert ms.outlier_check(L(9, 100, cond="Used", year=2021), peers) is None
