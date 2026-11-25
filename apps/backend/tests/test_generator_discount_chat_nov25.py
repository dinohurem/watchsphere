"""Kenan's discount test chat of 25 Nov 2026 (28 messages, invented numbers +85200000401..428), run in WTS
mode: list price minus discount in every notation, impossible discounts and lines that must not hand their
price or remark to another watch. Expected values from Expected_results.xlsx."""
import asyncio
from pathlib import Path

import pytest

from app.services import wtb_wts_service as svc
from app.services.ws_quality.discount import find_discount

HERE = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def rows():
    async def none(*a, **k):
        return []

    async def no_peers(ws_codes, rates):
        return {}

    mp = pytest.MonkeyPatch()
    mp.setattr(svc, "batch_ai_match", none)
    mp.setattr(svc, "batch_ai_verify", none)
    mp.setattr(svc, "_load_app_peers", no_peers)
    try:
        res = asyncio.run(svc.process_generation(
            txt_content=(HERE / "discount_test_chat_nov25.txt").read_text(), mode="WTS", ref_month=11, ref_year=2026,
            group_name="Test", jsonl_content=(HERE / "discount_test_catalog.jsonl").read_text()))
    finally:
        mp.undo()
    out = {}
    for bucket, rs in res["rows"].items():
        for r in rs:
            case = (r.get("Nummer") or "").replace(" ", "")[-3:]
            out.setdefault(case, []).append({**r, "_bucket": bucket})
    return out


def _one(rows, case, ws_code):
    hits = [r for r in rows.get(case, []) if r.get("WS-Code") == ws_code]
    assert len(hits) == 1, (case, rows.get(case))
    return hits[0]


OFFERS = [
    ("401", "WSSA0061", "52,290 HKD", "-17%"),
    ("402", "WSSA0062", "57,540 HKD", "-16%"),
    ("403", "WSSA0061", "53,550 HKD", "-15%"),
    ("404", "WSPN0015", "40,482 HKD", "-13.5%"),
    ("405", "WSPN0012", "28,552 HKD", "-14%"),
    ("406", "WSSA0061", "52,290 HKD", "-17%"),
    ("407", "W2SA0009", "90,950 HKD", "-15%"),
    ("408", "WSSA0082", "43,350 HKD", "-15%"),
    ("409", "310.30.42.50.01.001", "43,371 HKD", "-21%"),
    ("410", "210.32.42.20.01.001", "33,075 HKD", "-25%"),
    ("411", "AB0147101A1X1", "32,670 HKD", "-45%"),
    ("412", "217.30.42.21.01.003", "48,618 HKD", "-27%"),
    ("413", "WSSA0062", "57,883 HKD", "-15.5%"),
    ("414", "WGBA0081", "101,400 HKD", "-22%"),
    ("415", "CAW218F.FC6356", "48,060 HKD", "-40%"),
    ("416", "4600E/000R-B441", "177,840 HKD", "-24%"),
    ("417", "WGBA0081", "97,500 HKD", "-25%"),
    ("418", "WGBA0081", "100,100 HKD", "-23%"),
    ("419", "WSPN0015", "40,248 HKD", "-14%"),
    ("420", "WSSA0085", "33,235 HKD", "-15%"),
    ("421", "79360N", "24,225 HKD", "-43%"),
    ("425", "310.30.42.50.01.002", "47,880 HKD", "-24%"),
]


@pytest.mark.parametrize("case,ws_code,price,remark", OFFERS)
def test_list_price_minus_discount(rows, case, ws_code, price, remark):
    r = _one(rows, case, ws_code)
    assert r["_bucket"] == "matched", r.get("Review Reason")
    assert r["Preis"] == price
    assert f"{remark} Retail" in (r.get("Bemerkungen") or "")


@pytest.mark.parametrize("case,ws_code,price", [
    ("424", "126518LN Meteorit", "600,000 HKD"),      # two unknown discount lines above it
    ("425", "310.60.42.50.01.001", "295,000 HKD"),    # undotted Omega reference + header above it
    ("426", "35800", "11,000 HKD"),                   # unknown Breguet discount line above it
    ("427", "5712/1R", "2,170,000 HKD"),              # "Used 99%" is a condition grade
    ("428", "7920V/210A-B334", "295,000 HKD"),        # "99%new" is a condition grade
])
def test_no_price_or_remark_from_another_line(rows, case, ws_code, price):
    r = _one(rows, case, ws_code)
    assert r["_bucket"] == "matched", r.get("Review Reason")
    assert r["Preis"] == price
    assert "Retail" not in (r.get("Bemerkungen") or "")


def test_unknown_discount_lines_stay_on_their_own(rows):
    unknown = [r for r in rows["424"] if r["_bucket"] == "not_in_database"]
    assert sorted(r["Preis"] for r in unknown if "Retail" in (r.get("Bemerkungen") or "")) == ["108,500 HKD", "65,280 HKD"]


def test_impossible_discount_goes_to_review(rows):
    r = _one(rows, "422", "WSSA0096")
    assert r["_bucket"] == "needs_review" and "Impossible discount -117%" in r["Review Reason"]


def test_discount_without_price_goes_to_review(rows):
    r = _one(rows, "423", "WSSA0061")
    assert r["_bucket"] == "needs_review" and "without a price" in r["Review Reason"]


@pytest.mark.parametrize("line", [
    "126610LN -15%", "126610LN 2024 -15%", "hkd 150k - 2 pcs", "150k-160k", "150000-155000", "2024 -15%",
    "hkd 120k -14 days", "usdt 36500 +2%", "5712/1R N11/2025 Used 99% $2170000", "$2170000 99%",
    "7920v/210a-b334 2025 99%new hkd295k", "$63000 2026 -15",
])
def test_not_a_discount(line):
    assert find_discount(line) is None
