"""Generator price check (test chats, Nov 2026):
1. a bare "$" from +852/+853/+86 is HKD; when the app median fits only USD, the median decides;
2. the median comes from orders already in the app (>= 3 dealers), never from the uploaded file."""
import pytest

from app.services import wtb_wts_service as svc
from app.services.ws_quality.prices import _dollar_currency
from tests.test_generator_ws_quality_wiring import CATALOG, HK, gen, rows  # noqa: F401
from tests.test_generator_ws_quality_wiring import _no_ai  # noqa: F401


@pytest.fixture(autouse=True)
def _no_ai_verify(monkeypatch):
    async def none(items, watch_index, mode, timeout=None):
        return []
    monkeypatch.setattr(svc, "batch_ai_verify", none)


def _peers(monkeypatch, peers):
    async def load(ws_codes, rates):
        return peers
    monkeypatch.setattr(svc, "_load_app_peers", load)


def _app(ws, hkd, dealers=3, cond="used", year=2024):
    return {ws: [(cond, year, hkd, f"+852 0000 000{i}") for i in range(dealers)]}


def test_dollar_from_hong_kong_is_hkd_even_in_a_usd_context():
    assert _dollar_currency("HK", "USD") == "HKD"
    assert _dollar_currency("MO", None) == "HKD"
    assert _dollar_currency("CN", "USD") == "HKD"
    assert _dollar_currency("DE", "USD") == "USD"
    assert _dollar_currency("DE", None) == "USD"


@pytest.mark.parametrize("text,bare", [
    ("278271g choco oys $141000 n9/26", True),
    ("5712/1R 268,000usd", False),
    ("WGSA0124 459,000HK$/58,900US$", False),
    ("126500LN US$ 30k", False),
    ("no dollar here 30k", False),
])
def test_bare_dollar(text, bare):
    assert svc.bare_dollar(text) is bare


def _gen_many(lines):
    """One message per dealer (the generator keeps one offer per dealer + watch + year)."""
    import asyncio

    txt = "".join(f"[05.11.26, 10:0{i}:00] +852 6547 26{i:02d}: {line}\n" for i, line in enumerate(lines))
    return asyncio.run(svc.process_generation(
        txt_content=txt, mode="WTS", ref_month=11, ref_year=2026,
        group_name="Test group", jsonl_content=CATALOG,
    ))


def test_misread_price_in_the_file_does_not_become_the_median(monkeypatch):
    # The app knows 5712/1R used 2024 at ~2.1m HKD. The file has four correct offers and
    # one misread; before, the file's own rows formed the median.
    _peers(monkeypatch, _app("5712/1R", 2_100_000))
    r = _gen_many([
        "5712/1R used 2024 2.1m hkd",
        "5712/1R used 2024 2.15m hkd",
        "5712/1R used 2024 2.05m hkd",
        "5712/1R used 2024 2.2m hkd",
        "5712/1R used 2024 21k hkd",
    ])
    matched = {x["Preis"] for x in rows(r, "matched")}
    assert {"2,100,000 HKD", "2,150,000 HKD", "2,050,000 HKD", "2,200,000 HKD"} <= matched
    review = [x for x in rows(r, "needs_review") if "app median" in (x.get("Review Reason") or "")]
    assert len(review) == 1 and review[0]["Preis"].startswith("21,000")


def test_no_check_without_three_app_dealers(monkeypatch):
    _peers(monkeypatch, _app("5712/1R", 2_100_000, dealers=2))
    r = gen(HK, "5712/1R used 2024 21k hkd\n5712/1R used 2024 2.1m hkd\n5712/1R used 2024 2.1m hkd")
    assert not [x for x in rows(r, "needs_review") if "outlier" in (x.get("Review Reason") or "").lower()]


def test_app_median_decides_a_bare_dollar(monkeypatch):
    # "$268000" from a HK number reads as HKD 268k; the app median (2.1m HKD) fits only USD.
    _peers(monkeypatch, _app("5712/1R", 2_100_000))
    r = gen(HK, "5712/1R used 2024 $268000")
    m = rows(r, "matched")
    assert [x["Preis"] for x in m] == ["268,000 USD"]
