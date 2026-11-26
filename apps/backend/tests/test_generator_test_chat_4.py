"""Kenan's generator test chat 4 of 26 Nov 2026 (39 messages, invented numbers +85200000501..582).

Offers are read in WTS mode, requests in WTB mode. Cases 521-526 (repost pairs) belong to the import step;
here only the parser is checked: every line must be read completely. Expected values from
Expected_results.xlsx."""
import asyncio
import re
from pathlib import Path

import pytest

from app.services import wtb_wts_service as svc

HERE = Path(__file__).parent / "fixtures"


def _run(mode):
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
            txt_content=(HERE / "generator_test_chat_4.txt").read_text(), mode=mode, ref_month=11, ref_year=2026,
            group_name="Test", jsonl_content=(HERE / "generator_test_chat_4_catalog.jsonl").read_text()))
    finally:
        mp.undo()
    out = {}
    for bucket, rs in res["rows"].items():
        for r in rs:
            case = (r.get("Nummer") or "").replace(" ", "")[-3:]
            out.setdefault(case, []).append({**r, "_bucket": bucket})
    return out


@pytest.fixture(scope="module")
def wts():
    return _run("WTS")


@pytest.fixture(scope="module")
def wtb():
    return _run("WTB")


def _find(rows, case, ws_code, price=None, month_year=None):
    hits = [r for r in rows.get(case, []) if r.get("WS-Code") == ws_code
            and (price is None or r.get("Preis") == price)
            and (month_year is None or r.get("Monat/Jahr") == month_year)]
    assert hits, (case, ws_code, price, rows.get(case))
    return hits[0]


def _remarks(r):
    return [p.strip().lower() for p in re.split(r"[;,]", r.get("Bemerkungen") or "") if p.strip()]


# (case, ws_code, price, condition, "Monat/Jahr", remarks that must be present)
OFFERS = [
    ("501", "5712/1A", "1,100,000 HKD", "Unworn", "12/22", ["old buckle"]),
    ("502", "5990/1A", "1,162,000 HKD", "Used", "03/24", []),
    ("503", "5164R", "1,180,000 HKD", "Unworn", "10/26", []),
    ("504", "15510ST Green", "355,000 HKD", "Used", "2022", []),
    ("505", "116506A", "720,000 HKD", "Used", "2013", []),
    ("506", "26240ST Blue", "510,000 HKD", "Unworn", "12/25", []),
    ("507", "5270J", "1,060,000 HKD", "Used", "2025", []),
    ("508", "278288g Red Ombre", "445,000 HKD", "", "12/25", []),
    ("509", "5821/1AR", "705,000 HKD", "Unworn", "09/26", []),
    ("510", "124060", "95,500 HKD", "Unworn", "11/26", []),
    ("511", "127334", "167,000 HKD", "Unworn", "11/26", []),
    ("512", "7200/50G", "197,000 HKD", "Unworn", "11/26", []),
    ("513", "116500LN Black", "198,000 HKD", "Used", "11/20", []),
    # repost pairs: the parser reads each line completely on its own
    ("521", "126710BLRO Oys", "192,000 HKD", "Used", "2021", []),
    ("521", "126710BLRO Oys", "192,000 HKD", "Unworn", "11/26", []),
    ("523", "126710BLNR Oys", "130,000 HKD", "", "11/26", []),
    ("523", "126710BLNR Oys", "132,000 HKD", "", "11/26", []),
    ("525", "116508 Meteorit", "757,000 HKD", "Used", "2022", []),
    # two-line format: the price is the line BELOW the watch
    ("531", "126508 Green", "640,000 HKD", "", "11/26", []),
    ("531", "126508 Pikachu", "495,000 HKD", "", "09/26", []),
    ("532", "WSSA0061", "52,290 HKD", "", None, ["-17% retail"]),
    ("532", "WSSA0089", "70,110 HKD", "", None, ["-18% retail"]),
    ("541", "WSBB0044", "40,176 HKD", "", None, ["-19% retail"]),
    ("542", "WSSA0083", "87,200 HKD", None, None, ["-20% retail"]),
    ("551", "5164R", "989,000 HKD", "Used", "2021", ["old buckle"]),
    ("552", "116500LN White", "219,000 HKD", "Used", "2019", ["-1 link", "bezel scratch"]),
    ("553", "5822P", "128,000 USD", "Used", None, ["only watch"]),
    ("554", "5822P", "940,000 HKD", "", "2024", ["china set"]),
    ("555", "15605SK", "208,000 HKD", "", None, ["only watch"]),
    ("556", "134300 Lavender", "64,000 HKD", "Unworn", "08/26", ["only watch"]),
    # section headers
    ("561", "5261R", "1,380,000 HKD", "Used", "2025", []),
    ("561", "5164R", "990,000 HKD", "Used", "2024", []),
    ("562", "5270/1R", "1,260,000 HKD", "Unworn", "09/26", []),
    ("562", "5822P", "1,060,000 HKD", "Unworn", "2025", []),
    ("563", "116505 Black", "410,000 HKD", "Unworn", "2023", []),
    ("564", "126500LN White", "276,000 HKD", "Unworn", "09/26", []),
    ("565", "126233 Black Rom Jub", "135,000 HKD", "Unworn", "2026", []),
    ("566", "5205R Green", "387,000 HKD", "Used", "12/22", []),
    ("571", "WJPN0088", "238,620 HKD", None, "06/26", ["-18% retail"]),
    # two amounts in two currencies: HKD preferred
    ("581", "126508 Green", "669,500 HKD", "Unworn", "05/26", []),
    ("582", "15468BC", "1,860,000 HKD", "Unworn", "2021", []),
]


@pytest.mark.parametrize("case,ws_code,price,cond,month_year,remarks", OFFERS,
                         ids=[f"{o[0]}-{o[1]}-{o[2]}" for o in OFFERS])
def test_offer(wts, case, ws_code, price, cond, month_year, remarks):
    r = _find(wts, case, ws_code, price, month_year)
    assert r["_bucket"] == "matched", r.get("Review Reason")
    if cond is not None:
        assert (r.get("Zustand") or "") == cond
    if month_year is not None:
        assert (r.get("Monat/Jahr") or "") == month_year
    got = _remarks(r)
    for want in remarks:
        assert want in got, (want, got)


def test_no_offer_for_sale_lines_without_a_price(wts, wtb):
    """A sale line without a price is no offer (at most a needs-review row, which is never imported) and
    never a request."""
    for case in ("571", "572"):
        for rows in (wts, wtb):
            for r in rows.get(case, []):
                if r.get("WS-Code") == "WSTA0108" or r.get("WS-Code") in (None, "") or "228345" in (r.get("WS-Code") or ""):
                    assert r["_bucket"] != "matched" and r["Nachrichten Art"] == "WTS", r
    assert not [r for r in wtb.get("571", []) if r.get("WS-Code") == "WSTA0108"]
    assert not wtb.get("572", [])[1:]


def test_one_offer_per_price_line(wts):
    assert len([r for r in wts["531"] if r.get("WS-Code") == "126508 Green"]) == 1
    assert len([r for r in wts["532"]]) == 2
    assert len([r for r in wts["525"]]) == 1


def test_condition_only_unworn_used_or_empty(wts):
    for rows in wts.values():
        for r in rows:
            assert (r.get("Zustand") or "") in ("", "Unworn", "Used"), r


def test_no_doubled_remarks_and_one_discount_format(wts, wtb):
    for rows in list(wts.values()) + list(wtb.values()):
        for r in rows:
            parts = _remarks(r)
            assert len(parts) == len(set(parts)), r.get("Bemerkungen")
            for p in parts:
                if p.endswith("% retail"):
                    assert p[0] in "-+", r.get("Bemerkungen")


# --- requests (WTB mode) ----------------------------------------------------------------------

@pytest.mark.parametrize("case,ws_code", [("571", "5711/1A Blue"), ("571", "5164R"), ("572", "5711/1A Blue")])
def test_request(wtb, case, ws_code):
    r = _find(wtb, case, ws_code)
    assert r["Nachrichten Art"] == "WTB"


def test_looking_for_part_ends_at_the_sale_header(wtb):
    assert sorted(r["WS-Code"] for r in wtb["571"]) == ["5164R", "5711/1A Blue"]
    assert [r["WS-Code"] for r in wtb["572"]] == ["5711/1A Blue"]


def test_sale_line_with_price_is_not_a_request(wtb):
    assert not [r for r in wtb.get("571", []) if r.get("WS-Code") == "WJPN0088"]


def test_ready_stock_header_is_no_request_remark(wtb):
    assert all("ready stock" not in _remarks(r) for r in wtb["571"])


@pytest.mark.parametrize("line", ["WTB 126718 can confirm", "looking for 126718", "wtb 126718 126718LN"])
def test_reference_number_is_not_a_request_budget(line):
    from app.services.ws_quality.wtb import parse_wtb_line
    assert parse_wtb_line(line, line)["price"] is None


def test_real_request_budget_is_kept():
    from app.services.ws_quality.wtb import parse_wtb_line
    assert parse_wtb_line("WTB 5164R 1.08m", "WTB 5164R 1.08m")["price"] == 1080000
    assert parse_wtb_line("WTB 126710 n11 136000 can confirm", "WTB 126710 n11 136000 can confirm")["price"] == 136000
