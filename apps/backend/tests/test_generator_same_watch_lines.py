"""One watch listed several times in one message (usually different years): one listing per line
(Kenan, 25 Nov 2026). Two currencies for one watch without years stay one listing."""
import asyncio
import json

import pytest

from app.services import wtb_wts_service as svc


def _w(ws_code, reference, brand="Patek Philippe"):
    return json.dumps({"ws_code": ws_code, "brand": brand, "model": "M", "reference": reference, "dial": "",
                       "bracelet": "", "aliases": [], "oem_references": [], "list_prices": {}, "status": "active"})


CATALOG = "\n".join([_w("5167A", "5167A"), _w("5961P", "5961P"), _w("7140G", "7140G"),
                     _w("126610LN", "126610LN", "Rolex"), _w("228238A Champ", "228238A", "Rolex")])


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    async def none(*a, **k):
        return []

    async def no_peers(ws_codes, rates):
        return {}

    monkeypatch.setattr(svc, "batch_ai_match", none)
    monkeypatch.setattr(svc, "batch_ai_verify", none)
    monkeypatch.setattr(svc, "_load_app_peers", no_peers)


def rows(text):
    txt = f"[25.11.26, 12:38:00] +85200000003: {text}\n"
    res = asyncio.run(svc.process_generation(txt_content=txt, mode="WTS", ref_month=11, ref_year=2026,
                                             group_name="Test", jsonl_content=CATALOG))
    return sorted((r["WS-Code"], r["Preis"], r["Monat/Jahr"]) for r in res["rows"]["matched"])


@pytest.mark.parametrize("text,expected", [
    ("5167A\n2013Y HKD534k\n2024Y HKD716k", [("5167A", "534,000 HKD", "2013"), ("5167A", "716,000 HKD", "2024")]),
    ("5961P 2015 hkd776k\n5961P 2023 hkd917k", [("5961P", "776,000 HKD", "2015"), ("5961P", "917,000 HKD", "2023")]),
    ("7140G\n2017 HKD355k\n2020 HKD405k", [("7140G", "355,000 HKD", "2017"), ("7140G", "405,000 HKD", "2020")]),
    ("Patek 5167A used full set 2013Y HKD534k, 2024Y HKD716k",
     [("5167A", "534,000 HKD", "2013"), ("5167A", "716,000 HKD", "2024")]),
    ("Rolex used full set\n228238a champ 2019 hkd359k\n228238a champ 2022 hkd397k\n228238a champ 2024 hkd422k",
     [("228238A Champ", "359,000 HKD", "2019"), ("228238A Champ", "397,000 HKD", "2022"),
      ("228238A Champ", "422,000 HKD", "2024")]),
])
def test_one_listing_per_line(text, expected):
    assert rows(text) == expected


def test_two_currencies_for_one_watch_stay_one_listing():
    assert len(rows("126610LN N11\nhkd 150k\nusdt 19.2k")) == 1
