"""Kenan's generator test chats of 25 Nov 2026 (README points 3-9). Messages verbatim from the chats;
dealer numbers are the invalid test numbers (+852000001xx)."""
import asyncio
import json

import pytest

from app.services import wtb_wts_service as svc
from app.services.ws_quality.classify import split_sections


def _w(ws_code, reference, model, aliases=(), brand="Rolex"):
    return json.dumps({"ws_code": ws_code, "brand": brand, "model": model, "reference": reference, "dial": "",
                       "bracelet": "", "aliases": list(aliases), "oem_references": [], "list_prices": {},
                       "status": "active"})


CATALOG = "\n".join([
    _w("126508 Green", "126508", "Daytona", ["126508 John Mayer", "John Mayer 2.0"]),
    _w("126508 White", "126508", "Daytona"),
    _w("126500LN White", "126500LN", "Daytona", ["126500 panda"]),
    _w("126710GRNR Jub", "126710GRNR", "GMT-Master II", ["Bruce Wayne Jub"]),
    _w("126710GRNR Oys", "126710GRNR", "GMT-Master II"),
    _w("126710BLRO Oys", "126710BLRO", "GMT-Master II"),
    _w("5164R", "5164R", "Aquanaut", brand="Patek Philippe"),
    _w("15510ST Blue", "15510ST", "Royal Oak", brand="Audemars Piguet"),
])


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    async def none(*a, **k):
        return []

    async def no_peers(ws_codes, rates):
        return {}

    monkeypatch.setattr(svc, "batch_ai_match", none)
    monkeypatch.setattr(svc, "batch_ai_verify", none)
    monkeypatch.setattr(svc, "_load_app_peers", no_peers)


def gen(text, mode, case="101"):
    txt = f"[25.11.26, 11:01:00] +85200000{case}: {text}\n"
    res = asyncio.run(svc.process_generation(txt_content=txt, mode=mode, ref_month=11, ref_year=2026,
                                             group_name="Test", jsonl_content=CATALOG))
    return res["rows"]


# --- 3. buy requests in one line with a price ------------------------------------

@pytest.mark.parametrize("text", [
    "Need 126500LN white x10 any year, 34.2k usdt each, usdt payment",
    "Strong call 5164R used 2019-2022 fullset pay 960k HKD ready stock only",
    "5164R wtb 1.08m",
    "Confirm order: 126508 green 2023-2024 used with card, 590k hkd, usdt",
    "126710GRNR jub wanted, EU stock, 2026, unworn, 18.900€",
    "Sold order!! 15510ST blue 2026 new fullset, pay 500k hkd today, cash",
])
def test_single_line_request_with_price_is_wtb(text):
    assert [m for m, _ in split_sections(text)] == ["WTB"]


@pytest.mark.parametrize("text", [
    "126500LN white N10/2026 full set 276k hkd, need shipping from HK to Dubai",
    "Looking new 126710GRNR jub 2025 full set 157k hkd",
    "15510ST blue 2023 used full set 428k hkd",
])
def test_traps_stay_offers(text):
    assert [m for m, _ in split_sections(text)] == ["WTS"]


def test_single_line_request_gets_its_target():
    m = gen("Sold order!! 15510ST blue 2026 new fullset, pay 500k hkd today, cash", "WTB", "029")["matched"]
    assert [(r["WS-Code"], r["Preis"]) for r in m] == [("15510ST Blue", "500,000 HKD")]


# --- 4. closing line of a list ----------------------------------------------------

def test_closing_line_applies_to_every_requested_watch():
    m = gen("Looking for 👀\n126508 green\n126500LN white\n126710GRNR jub\nAll new 2026 full set, HK stock", "WTB", "018")["matched"]
    assert len(m) == 3
    assert {r["Zustand"] for r in m} == {"Only Unworn"} and {r["Monat/Jahr"] for r in m} == {"2026+"}


def test_closing_line_of_a_stock_list_adds_its_remarks():
    m = gen("🇭🇰 HK stock\n126508 green N11 $639k\n126500LN white N11 $275k\nall full set, usdt accepted", "WTS", "118")["matched"]
    assert len(m) == 2
    assert all("fullset" in r["Bemerkungen"].lower() and "USDT" in r["Bemerkungen"] for r in m)
    assert {r["Preis"] for r in m} == {"639,000 HKD", "275,000 HKD"}  # '$' from +852 is HKD


# --- 5. nickname before the reference ----------------------------------------------

def test_nickname_before_the_reference_picks_the_variant():
    m = gen("John Mayer 126508 2025 unworn white tag 81.5k usdt", "WTS", "115")["matched"]
    assert [r["WS-Code"] for r in m] == ["126508 Green"]


# --- 6. condition not stated ------------------------------------------------------------

def test_condition_stays_empty_when_not_stated():
    m = gen("5164R naked 2019 HKD 880,000", "WTS", "110")["matched"]
    assert [r["Zustand"] for r in m] == [""]
    m = gen("126500LN white N11/2026 276k hkd", "WTS", "101")["matched"]
    assert [r["Zustand"] for r in m] == ["Unworn"]  # an N card date is new


# --- 7. offer inside a request line --------------------------------------------------------

def test_offer_after_have_in_a_request_line():
    assert split_sections("Looking for 126508 green 2026, have 126508 white N10 620k hkd") == [
        ("WTB", "Looking for 126508 green 2026"), ("WTS", "126508 white N10 620k hkd")]


# --- 8. remarks ----------------------------------------------------------------------------

def test_white_tag_is_not_full_set():
    m = gen("WTB Daytona 126500LN white\nnew 2026 white tag\n265-268k hkd", "WTB", "007")["matched"]
    assert "fullset" not in m[0]["Bemerkungen"].lower()


def test_watch_only_ok_replaces_only_watch():
    m = gen("ntq 15510st blue 2021 used watch only ok", "WTB", "028")["matched"]
    assert m[0]["Bemerkungen"] == "Watch only OK"


def test_plus_shipping_is_not_your_label():
    m = gen("For sale\nPatek Philippe Aquanaut Travel Time\nRef 5164R-001\nNew, 08/2026, full set, double sealed\n€ 132.500 + shipping\nEU stock", "WTS", "111")["matched"]
    assert "Your Label" not in m[0]["Bemerkungen"]


# --- 9. reference with a separated suffix ------------------------------------------------------

def test_separated_suffix_offers_its_own_variants_not_a_fuzzy_neighbour():
    rows = gen("126710 grnr 2025 new card 155k", "WTS", "123")
    assert not any(r.get("WS-Code") == "126710BLRO Oys" for b in rows.values() for r in b)
    review = rows["needs_review"]
    assert review and "126710GRNR" in review[0]["Review Reason"] and review[0]["Preis"] == "155,000 HKD"
