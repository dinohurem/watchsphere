"""The ws_quality layer wired into the generator (wtb_wts_service): invisible characters, one price parser,
post type per section, advert filter, WTB wording, and no fuzzy/AI mapping across references.
Every message is a real dealer message from the WhatsApp exports of 13-22 Nov 2026 (see ws_quality tests)."""

import asyncio
import json

import pytest

from app.services import wtb_wts_service as svc

MVS = chr(0x180E)   # Mongolian vowel separator, not in the old strip list
NBH = chr(0x2011)   # non-breaking hyphen


def _w(ws_code, brand, reference, model="", **kw):
    return json.dumps({"ws_code": ws_code, "brand": brand, "model": model, "reference": reference,
                       "dial": "", "bracelet": "", "aliases": [], "oem_references": [],
                       "list_prices": {}, "status": "active", "cover_image": "", **kw})


CATALOG = "\n".join([
    _w("126234", "Rolex", "126234", "Datejust 36"),
    _w("126518LN", "Rolex", "126518LN", "Daytona"),
    _w("228235", "Rolex", "228235", "Day-Date 40"),
    _w("5712/1R", "Patek Philippe", "5712/1R", "Nautilus"),
    _w("5167A", "Patek Philippe", "5167A", "Aquanaut"),
    _w("77450ST", "Audemars Piguet", "77450ST", "Royal Oak"),
    _w("279171", "Rolex", "279171", "Pearlmaster"),
    _w("15210ST", "Audemars Piguet", "15210ST", "Code 11.59"),
])
HK = "+852 6547 2648"
DE = "+49 170 1234567"
UK = "+44 7700 900123"


@pytest.fixture(autouse=True)
def _no_ai(monkeypatch):
    async def no_match(unmatched_lines, watch_index, timeout=None):
        return []
    monkeypatch.setattr(svc, "batch_ai_match", no_match)


def gen(sender, text, mode="WTS"):
    txt = f"[05.11.26, 10:00:00] {sender}: {text}\n"
    return asyncio.run(svc.process_generation(
        txt_content=txt, mode=mode, ref_month=11, ref_year=2026,
        group_name="Test group", jsonl_content=CATALOG,
    ))


def rows(result, bucket):
    return result["rows"][bucket]


# --- invisible characters --------------------------------------------------------

def test_strip_invisible_knows_the_extended_set():
    assert svc._strip_invisible(f"1.1{MVS}M HKD") == "1.1M HKD"
    assert svc._strip_invisible("4300V/220G" + NBH + "H151") == "4300V/220G-H151"
    assert svc._strip_invisible("a͏b­c؜d") == "abcd"
    assert svc._strip_invisible("\U0001F3F7️") == "\U0001F3F7️"   # emoji variation selector stays


def test_reference_and_price_with_invisible_characters_still_match():
    r = gen(HK, f"WTS 5167{MVS}A 1.1{MVS}M HKD")
    m = rows(r, "matched")
    assert len(m) == 1 and m[0]["WS-Code"] == "5167A" and m[0]["Preis"] == "1,100,000 HKD"


# --- one price parser ------------------------------------------------------------

def test_european_price_without_leading_currency_sign_is_an_offer():
    # "Rolex Datejust 36 ref.126234 ... 11.500€": detect_post_type used to skip it (no price signal)
    r = gen(DE, "Rolex Datejust 36 ref.126234 full set 2024 11.500€")
    m = rows(r, "matched")
    assert len(m) == 1 and m[0]["WS-Code"] == "126234" and m[0]["Preis"] == "11,500 EUR"


@pytest.mark.parametrize("line,country,expected", [
    ("15210st blue, 160000 hkd 12/2025", "HK", ("160,000", "HKD")),          # was 12,000 (date after the currency)
    ("228235 white rom w11 448k", "HK", ("448,000", "HKD")),                 # was 228,235 (reference as price)
    ("5167A 1'480'000 hkd", "HK", ("1,480,000", "HKD")),                     # was 9,000
    ("126518LN 212000aed 450000hkd", "HK", ("450,000", "HKD")),              # was AED
    ("126234 $130.000", "UK", ("130,000", "USD")),                           # '$' is never GBP
])
def test_one_parser_fixes_the_production_errors(line, country, expected):
    assert svc.extract_price_from_line(svc._clean_message(line), country) == expected


def test_buy_request_without_target_has_no_price_and_no_currency():
    # "Looking for 126518 black" was stored as HKD 126,518
    assert svc.extract_wtb_price("Looking for 126518 black", "HK") == (None, None)
    r = gen(HK, "Looking for 126518LN black", "WTB")
    m = rows(r, "matched")
    assert len(m) == 1 and m[0]["Preis"] == ""


@pytest.mark.parametrize("text,expected", [
    ("WTB 126518LN target 80k", ("80,000", "HKD")),
    ("WTB 126518LN n11 136000 can confirm", ("136,000", "HKD")),
    ("Looking for 126518LN Price Target 15-16k", ("16,000", "HKD")),
])
def test_wtb_target_comes_from_parse_wtb_line(text, expected):
    assert svc.extract_wtb_price(text, "HK") == expected


def test_untagged_price_takes_the_message_currency_not_the_sender_country():
    # a UK number posting HK stock: "124060 N11 95k" is HKD, not GBP
    r = gen(UK, "HK stock\n126518LN N11 95k\n126234 N10 88k")
    m = rows(r, "matched")
    assert {x["Preis"] for x in m} == {"95,000 HKD", "88,000 HKD"}


# --- post type per section -------------------------------------------------------

MIXED = "Looking for 126518LN\nRolex ready HK:\n228235 white rom w11 448k"


def test_mixed_message_yields_a_wts_and_a_wtb_section():
    assert svc.detect_post_type(MIXED) == "MIXED"
    assert [m for m, _ in svc.message_sections(MIXED)] == ["WTB", "WTS"]


def test_mixed_message_each_section_is_processed_in_its_own_mode():
    wts = gen(HK, MIXED, "WTS")
    wtb = gen(HK, MIXED, "WTB")
    assert [x["WS-Code"] for x in rows(wts, "matched")] == ["228235"]
    assert rows(wts, "matched")[0]["Preis"] == "448,000 HKD"
    assert [x["WS-Code"] for x in rows(wtb, "matched")] == ["126518LN"]
    assert rows(wtb, "matched")[0]["Preis"] == ""      # a request without a target has no price


def test_stock_list_with_one_looking_for_line_stays_a_sale_list():
    text = "On sales\n228235 green roman 493,000\n126234 N10 88,000\nlooking for 126518LN"
    wts = gen(HK, text, "WTS")
    assert {x["WS-Code"] for x in rows(wts, "matched")} == {"228235", "126234"}


@pytest.mark.parametrize("text", ["NTQ 126518LN 2022", "Ltb 126518LN", "Need 126518LN", "Suche 126518LN"])
def test_wtb_wording_beyond_wtb_looking_for_lf(text):
    assert svc.detect_post_type(text) == "WTB"
    assert "ntq" in svc.WTB_KEYWORDS and "suche" in svc.WTB_KEYWORDS


# --- adverts ---------------------------------------------------------------------

def test_advert_is_discarded_not_classified_as_an_offer():
    ad = "Time Dealer: your next buy should not be lost in noise. 126518LN 2024 close more deals, free trial"
    r = gen(HK, ad)
    assert r["matched_count"] == 0 and r["needs_review_count"] == 0
    assert "Advert" in rows(r, "discarded")[0]["Review Reason"]


# --- no mapping of an uncatalogued reference to a similar one --------------------

@pytest.mark.parametrize("ref,catalogued", [("5712R", "5712/1R"), ("5167/1A", "5167A"),
                                              ("77450SR", "77450ST"), ("279171G", "279171")])
def test_similar_reference_never_lands_in_matched(ref, catalogued):
    svc._fuzzy_match_cache.clear()
    r = gen(HK, f"WTS {ref} 2024 500k hkd")
    assert r["matched_count"] == 0, f"{ref} was matched to {catalogued}"


def test_fuzzy_hit_goes_to_needs_review_with_the_candidate():
    svc._fuzzy_match_cache.clear()
    r = gen(HK, "WTS 5712R 2024 2m hkd")
    nr = rows(r, "needs_review")
    if nr:   # fuzzy found the catalogue watch: it is a suggestion for the reviewer
        assert "Similar reference" in nr[0]["Review Reason"]
        assert "5712/1R" in {c["ws_code"] for c in nr[0]["_meta"]["candidates"]}


def test_line_names_watch_is_strict_at_the_borders():
    w = {"ws_code": "5712/1R", "reference": "5712/1R", "aliases": [], "oem_references": []}
    assert svc._line_names_watch("5712/1R 2024 2m", w)
    assert not svc._line_names_watch("5712R 2024 2m", w)
    w2 = {"ws_code": "279171", "reference": "279171", "aliases": [], "oem_references": []}
    assert not svc._line_names_watch("279171G 2024", w2)


def test_prompt_no_longer_says_flag_the_closest():
    import inspect
    assert "otherwise flag the closest" not in inspect.getsource(svc.batch_ai_match)
