"""Block lists (Kenan, 26 Nov 2026): the watch on one line, below it one line per piece. A line without a
reference belongs to the watch ABOVE it; every such line is its own offer with its own year, price and remark.
'Naked' / 'Only watch' / 'Only wacth' = remark only watch, no year. A number before 'link(s)' is no discount."""
import asyncio
import re
from pathlib import Path

import pytest

from app.services import wtb_wts_service as svc
from app.services.ws_quality.discount import find_discount, lone_discount

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
            txt_content=(HERE / "generator_block_lists.txt").read_text(), mode="WTS", ref_month=11, ref_year=2026,
            group_name="Test", jsonl_content=(HERE / "generator_block_lists_catalog.jsonl").read_text()))
    finally:
        mp.undo()
    out = []
    for bucket, rs in res["rows"].items():
        for r in rs:
            out.append({**r, "_bucket": bucket})
    return out


def _remarks(r):
    return [p.strip().lower() for p in re.split(r"[;,]", r.get("Bemerkungen") or "") if p.strip()]


def _sender(r):
    return (r.get("Nummer") or "").replace(" ", "")[-3:]


# (ws_code, price, year or None, only watch?)
BLOCKS = [
    ("5968G-010 Green", "909,000 HKD", "2023", False),
    ("5968G-010 Green", "1,010,000 HKD", "2026", False),
    ("5968G-001 Blue", "950,000 HKD", None, True),
    ("5968G-001 Blue", "995,000 HKD", "2023", False),
    ("5968G-001 Blue", "1,116,000 HKD", "2026", False),
    ("5267/200A Black", "475,000 HKD", None, True),
    ("5267/200A Black", "520,000 HKD", "2021", False),
    ("5726/1A", "838,000 HKD", None, True),
    ("5726/1A", "905,000 HKD", "2021", False),
    ("5167A", "490,000 HKD", None, True),
    ("5167A", "560,000 HKD", "2015", False),
    ("5167A", "716,000 HKD", "2024", False),
    ("5712/1A", "840,000 HKD", None, True),
    ("5712/1A", "900,000 HKD", "2011", False),
    ("5726A", "555,000 HKD", None, True),
    ("5726A", "600,000 HKD", "2019", False),
    ("5711/1A-011 White", "880,000 HKD", "2019", False),
    ("5711/1A-011 White", "998,000 HKD", "2016", False),
    ("5726/1A-014 Blue", "1,015,000 HKD", "2022", False),
    ("5726/1A-014 Blue", "1,025,000 HKD", "2022", False),
    ("5990/1A", "835,000 HKD", None, True),
    ("5990/1A", "1,001,000 HKD", "2020", False),
    ("5711/1A Blue", "835,000 HKD", None, True),
    ("5711/1A Blue", "1,300,000 HKD", "2018", False),
]


def _block_rows(rows):
    return [r for r in rows if _sender(r) == "601"]


@pytest.mark.parametrize("ws_code,price,year,only_watch", BLOCKS, ids=[f"{b[0]}-{b[1]}" for b in BLOCKS])
def test_each_price_line_is_one_row(rows, ws_code, price, year, only_watch):
    hits = [r for r in _block_rows(rows) if r.get("WS-Code") == ws_code and r.get("Preis") == price]
    assert len(hits) == 1, (ws_code, price, [(r.get("WS-Code"), r.get("Preis")) for r in _block_rows(rows)])
    r = hits[0]
    assert r["_bucket"] == "matched", r.get("Review Reason")
    got_year = (r.get("Monat/Jahr") or "")
    if year is None:
        assert got_year == "", got_year
    else:
        assert got_year == year, got_year
    assert ("only watch" in _remarks(r)) == only_watch, r.get("Bemerkungen")


def test_no_extra_rows(rows):
    assert len(_block_rows(rows)) == len(BLOCKS)


@pytest.mark.parametrize("variant", ["-4links", "-4 links", "-1 link", "-2link"])
def test_links_are_no_discount(variant):
    line = f"5740/1G N8/26 $2,100,000.00HKD {variant}"
    assert find_discount(line) is None
    assert lone_discount(line) is None


@pytest.mark.parametrize("case,remark", [("602", "-4 links"), ("603", "-4 links"), ("604", "-1 link"), ("605", "-2 links")])
def test_missing_links_row(rows, case, remark):
    r = [r for r in rows if _sender(r) == case]
    assert len(r) == 1
    assert r[0].get("Preis") == "2,100,000 HKD", r[0].get("Preis")
    got = _remarks(r[0])
    assert not any("retail" in g for g in got), got
    assert remark in got, got


def test_real_discount_still_works(rows):
    assert find_discount("5740/1G $2,100,000 -4% retail").pct == 4
    assert find_discount("wsbb0044, hkr 49600 19% 2026").pct == 19
    r = [r for r in rows if _sender(r) == "606"]
    assert len(r) == 1 and r[0].get("Preis") == "2,016,000 HKD"
