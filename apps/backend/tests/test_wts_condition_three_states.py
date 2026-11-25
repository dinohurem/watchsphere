"""WTS condition has three states: Unworn / Used / none (Kenan, Nov 2026).
Rules, first match wins: 1 word in the line, 2 N-month, 3 section header above, 4 the year."""
import asyncio
import json

import pytest

from app.services import wtb_wts_service as svc


def cond(line, section=None, ref_year=2026):
    return svc.extract_condition_from_line(line, section, "WTS", ref_year)


@pytest.mark.parametrize("line,section,expected", [
    ("126508 champ 2026used 456k", None, "Used"),
    ("116518NG white 2022Y🆕 $380K", None, "Unworn"),
    ("126528LN Lemans 99% New HKD1.48m", None, "Used"),
    ("126334 grey jub n11 $117000", None, "Unworn"),
    ("7118/1200R champ 26y hkd1.148m", "Used", None),
    ("5712/1A 2021 hkd1.05m", "Used", "Used"),
    ("5167A 2024 hkd 420k", None, None),
    ("5711/1A 2019 hkd 890k", None, "Used"),
    ("7920v/210a-b334 2025 99%new hkd295k", None, "Used"),
    ("5712/1R N11/2025 Used 99% $2170000", None, "Used"),
    ("126710 2025likenew 100k", None, "Used"),
    ("126710 like new 2024 100k", None, "Used"),
    ("126710 98% 2024 100k", None, "Used"),
    ("126710 二手 100k", None, "Used"),
    ("126710 polished 100k", None, "Used"),
    ("126710 stickers 100k", None, "Unworn"),
    ("126710 bnib 100k", None, "Unworn"),
    ("126710 sealed 100k", None, "Unworn"),
    ("126710 un-worn 100k", None, "Unworn"),
    ("126710 new buckle 2024 100k", None, None),
    ("126710 new style dial 2024 100k", None, None),
    ("126710 mint green 2024 100k", None, None),
    ("126710 full set only watch links 100k", None, None),
    ("126710 N6/2025 100k", "Used", "Unworn"),
    ("126710 n10/26 100k", None, "Unworn"),
    ("126710 2024 100k", "Unworn", "Unworn"),
    ("126710 2025 100k", "Used", "Used"),
    ("126710 100k", "Used", "Used"),
    ("126710 11/2026 100k", None, "Unworn"),
    ("126710 2026/9 100k", None, "Unworn"),
    ("126710 2026 100k", None, None),
    ("126710 W10 100k", None, None),
    ("126710 2025 100k", None, None),
    ("126710 2023 100k", None, "Used"),
    ("126710 100k", None, None),
])
def test_wts_condition_rules(line, section, expected):
    assert cond(line, section) == expected


def test_year_rules_follow_ref_year():
    assert cond("126710 2027 100k", None, 2027) is None
    assert cond("126710 11/2027 100k", None, 2027) == "Unworn"
    assert cond("126710 2024 100k", None, 2027) == "Used"


CATALOG = "\n".join(json.dumps({"ws_code": c, "brand": b, "model": m, "reference": r, "dial": "", "bracelet": "",
                                "aliases": [], "oem_references": [], "list_prices": {}, "status": "active"})
                    for c, b, m, r in [("5712/1A", "Patek Philippe", "Nautilus", "5712/1A"),
                                       ("7118/1200R", "Patek Philippe", "Nautilus", "7118/1200R"),
                                       ("5167A", "Patek Philippe", "Aquanaut", "5167A")])


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    async def none(*a, **k):
        return []

    async def no_peers(ws_codes, rates):
        return {}

    monkeypatch.setattr(svc, "batch_ai_match", none)
    monkeypatch.setattr(svc, "batch_ai_verify", none)
    monkeypatch.setattr(svc, "_load_app_peers", no_peers)


def gen(text):
    txt = f"[25.11.26, 11:01:00] +85200000101: {text}\n"
    res = asyncio.run(svc.process_generation(txt_content=txt, mode="WTS", ref_month=11, ref_year=2026,
                                             group_name="Test", jsonl_content=CATALOG))
    return res["rows"]["matched"]


def test_used_header_applies_until_the_next_header():
    rows = gen("pp used\n7118/1200R champ 26y hkd1.148m\n5712/1A 2021 hkd1.05m")
    assert {r["WS-Code"]: r["Zustand"] for r in rows} == {"7118/1200R": "", "5712/1A": "Used"}


def test_header_between_cancels_the_used_header():
    rows = gen("pp used\n5712/1A 2021 hkd1.05m\nRolex\n5167A 2024 hkd 420k")
    assert {r["WS-Code"]: r["Zustand"] for r in rows} == {"5712/1A": "Used", "5167A": ""}


def test_line_without_word_year_or_header_is_none():
    rows = gen("5167A hkd 420k")
    assert [r["Zustand"] for r in rows] == [""]
