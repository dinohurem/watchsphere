"""Regression tests for the generator spec (WatchSphere_Generator_Pipeline_Matching.pdf,
07.11.2026): §3 message splitting, §4 matching fixes, §5 image matching, §6 remarks,
§7 prices and discounts, §8.4 currencies, §2 tab 5 discarded, and the structured
output contract for the pipeline. Each test quotes the example from the PDF."""

import asyncio
import csv
import io
import json
from datetime import datetime

import pytest

from app.services import remark_rules
from app.services import vision_matching as vm
from app.services import wtb_wts_service as svc

_REAL_BATCH_AI_MATCH = svc.batch_ai_match


def _w(ws_code, brand, reference, model="", dial="", bracelet="", aliases=(), oem=(), list_prices=None,
       status="active", cover_image=""):
    return json.dumps({
        "ws_code": ws_code, "brand": brand, "model": model, "reference": reference,
        "dial": dial, "bracelet": bracelet, "aliases": list(aliases), "oem_references": list(oem),
        "list_prices": list_prices or {}, "status": status, "cover_image": cover_image,
    })


CATALOG = "\n".join([
    _w("126610LV", "Rolex", "126610LV", "Submariner Date", "Black", aliases=["starbucks"]),
    _w("126610LN", "Rolex", "126610LN", "Submariner Date", "Black"),
    _w("126333", "Rolex", "126333", "Datejust 41"),
    _w("126334 Blue Jub", "Rolex", "126334", "Datejust 41", "Blue", "Jubilee",
       cover_image="https://img/126334-blue.jpg"),
    _w("126334 Black Oys", "Rolex", "126334", "Datejust 41", "Black", "Oyster",
       cover_image="https://img/126334-black.jpg"),
    _w("126300", "Rolex", "126300", "Datejust 41"),
    _w("126300 Blue Jub", "Rolex", "126300", "Datejust 41", "Blue", "Jubilee"),
    _w("126300 Green Oys", "Rolex", "126300", "Datejust 41", "Green", "Oyster"),
    _w("228235 Ombré Jub", "Rolex", "228235", "Day-Date 40", "Ombré", "Jubilee"),
    _w("228235 Ombré Oys", "Rolex", "228235", "Day-Date 40", "Ombré", "Oyster"),
    _w("228349RBR", "Rolex", "228349RBR", "Day-Date 40"),
    _w("116519LN Black", "Rolex", "116519LN", "Daytona", "Black"),
    _w("116519LN White", "Rolex", "116519LN", "Daytona", "White"),
    _w("126500LN White", "Rolex", "126500LN", "Daytona", "White"),
    _w("126613LN", "Rolex", "126613LN", "Submariner Date"),
    _w("35500", "Tudor", "35500", "Royal"),
    _w("15210OR Blue", "Audemars Piguet", "15210OR", "Code 11.59", "Blue", oem=["15210OR.OO.A056KB.01"]),
    _w("15210OR Green", "Audemars Piguet", "15210OR", "Code 11.59", "Green", oem=["15210OR.OO.A057KB.01"]),
    _w("15407ST", "Audemars Piguet", "15407ST", "Royal Oak Double Balance"),
    _w("7014/1G", "Patek Philippe", "7014/1G", "Calatrava"),
    _w("5905/1A", "Patek Philippe", "5905/1A", "Complications"),
    _w("RM72-01", "Richard Mille", "RM72-01", "RM 72-01"),
    _w("4300V/220G", "Vacheron Constantin", "4300V/220G", "Overseas"),
    _w("5711/1A", "Patek Philippe", "5711/1A", "Nautilus", list_prices={"US": 35934}),
    _w("5167A", "Patek Philippe", "5167A", "Aquanaut", list_prices={"US": 32700}),
    _w("5168G", "Patek Philippe", "5168G", "Aquanaut"),
    _w("7118/1200R", "Patek Philippe", "7118/1200R", "Nautilus"),
    _w("126710BLRO", "Rolex", "126710BLRO", "GMT-Master II", status="draft"),
])

DE = "+49 170 1234567"
HK = "+852 6547 2648"


def chat(*messages):
    """messages: (sender, text[, 'HH:MM:SS']) — text may span several lines."""
    out = []
    for i, m in enumerate(messages):
        sender, text = m[0], m[1]
        ts = m[2] if len(m) > 2 else f"10:{i:02d}:00"
        out.append(f"[05.11.26, {ts}] {sender}: {text}")
    return "\n".join(out) + "\n"


def gen(txt, mode="WTS", catalog=CATALOG, media=None):
    return asyncio.run(svc.process_generation(
        txt_content=txt, mode=mode, ref_month=11, ref_year=2026,
        group_name="Test group", jsonl_content=catalog, media_archive=media,
    ))


def rows(result, bucket):
    return result["rows"][bucket]


@pytest.fixture(autouse=True)
def _no_ai(monkeypatch):
    async def no_match(unmatched_lines, watch_index, timeout=None):
        return []
    monkeypatch.setattr(svc, "batch_ai_match", no_match)


@pytest.fixture(scope="module")
def index():
    return asyncio.run(svc.build_watch_index(CATALOG))


# --- §3 split messages ----------------------------------------------------------

def test_eu_multiline_block_is_one_listing():
    # "Starbucks 10-2026 New / 126610LV Fresh / € 13.199 shipped"
    r = gen(chat((DE, "Starbucks 10-2026 New\n126610LV Fresh\n€ 13.199 shipped")))
    m = rows(r, "matched")
    assert len(m) == 1 and r["needs_review_count"] == 0
    assert m[0]["WS-Code"] == "126610LV"
    assert m[0]["Monat/Jahr"] == "10/26"
    assert m[0]["Preis"] == "13,199 EUR"
    assert "Shipped" in m[0]["Bemerkungen"]


def test_eu_block_with_ref_label_and_full_set_date():
    # "FOR SALE ‼ / Rolex Datejust 41 / Ref 126333 / Full set 02/2025 / €13.950,-"
    r = gen(chat((DE, "FOR SALE ‼\nRolex Datejust 41\nRef 126333\nFull set 02/2025\n€13.950,-")))
    m = rows(r, "matched")
    assert len(m) == 1
    assert m[0]["WS-Code"] == "126333"
    assert m[0]["Monat/Jahr"] == "02/25"
    assert m[0]["Preis"] == "13,950 EUR"
    assert "fullset" in m[0]["Bemerkungen"]


def test_several_refs_prices_on_separate_lines_split_into_blocks():
    text = ("FOR SALE\nRolex Datejust 41\nRef 126333\n€13.950,-\n"
            "Submariner Starbucks\nRef 126610LV\nFull set 06/2026\n€ 16.500")
    r = gen(chat((DE, text)))
    m = {row["WS-Code"]: row for row in rows(r, "matched")}
    assert set(m) == {"126333", "126610LV"}
    assert m["126333"]["Preis"] == "13,950 EUR"
    assert m["126610LV"]["Preis"] == "16,500 EUR"
    assert m["126610LV"]["Monat/Jahr"] == "06/26"


def test_hk_one_watch_per_line_is_split_line_by_line(index):
    text = "WTS\n126610LN N3 hkd 120k\n126333 N2 hkd 100k\n15407ST 2024 hkd 900k"
    assert svc.split_message_into_listings(text, index)[0] == "list"
    r = gen(chat((HK, text)))
    assert {row["WS-Code"] for row in rows(r, "matched")} == {"126610LN", "126333", "15407ST"}


def test_dates_and_numbers_are_never_references(index):
    line = "10-2026 06/2026 29/08/2026 N10/26 W10 2025 $126000 35500 usdt 126610LN"
    assert svc.find_references(line, index) == ["126610LN"]


def test_token_counts_only_with_catalog_stem_or_brand_format(index):
    assert svc.find_references("Datejust 41 lot 12345 ok", index) == []
    # not in the catalog but a known Rolex format
    assert svc.find_references("WTS 126711CHNR 2024", index) == ["126711CHNR"]
    # bare digits count when the catalog has that reference
    assert svc.find_references("126334 for sale", index) == ["126334"]


def test_reference_after_ref_label():
    assert svc._extract_ref_from_line("Rolex Datejust 41 Ref 126333") == "126333"
    assert svc._extract_ref_from_line("Ref. 126333") == "126333"
    assert svc._extract_ref_from_line("ref: 5711/1A") == "5711/1A"


# --- §4 lost listings -------------------------------------------------------------

@pytest.mark.parametrize("symbol", ["→", "▶", "▪", "🔹", "｜", "：", "💰", "•"])
def test_leading_symbols_do_not_drop_lines(symbol):
    text = f"WTS\n{symbol} 126610LN N3 hkd 120k\n{symbol} 126333 N2 hkd 100k\n{symbol} 15407ST 2024 hkd 900k"
    r = gen(chat((HK, text)))
    assert r["matched_count"] == 3


@pytest.mark.parametrize("text", ["126610LV 69.000€", "126610LV 46000€ +label", "126610LV 4m hkd"])
def test_detect_post_type_sees_euro_after_number_and_millions(text):
    assert svc.detect_post_type(text) == "WTS"


def test_short_list_of_two_watches_keeps_both():
    r = gen(chat((HK, "126610LN hkd 120k\n126333 hkd 100k")))
    assert {row["WS-Code"] for row in rows(r, "matched")} == {"126610LN", "126333"}


# --- §4 wrong or missing watch ----------------------------------------------------

def test_ref_regex_keeps_full_reference():
    assert svc._extract_ref_from_line("4300V/220G-H151 2024 hkd 300k") == "4300V/220G-H151"
    assert svc._extract_ref_from_line("228349rbr-0036 n3 hkd 1.2m") == "228349rbr-0036"


def test_full_reference_matches_catalog_stem(index):
    assert [w["ws_code"] for w in svc.match_watch_by_ref("228349rbr-0036", index)] == ["228349RBR"]
    assert [w["ws_code"] for w in svc.match_watch_by_ref("4300V/220G-H151", index)] == ["4300V/220G"]


def test_brand_plus_reference_line_is_not_a_header():
    assert svc.detect_brand_header("AP 15407ST 2024 hkd 900k") is None
    assert svc.detect_brand_header("PP 7014/1G N3 hkd 600k") is None
    assert svc.detect_brand_header("Patek Used ✨✨") == "Patek Philippe"
    # The Rolex line after the AP line must stay Rolex.
    r = gen(chat((HK, "AP 15407ST 2024 hkd 900k\nPP 7014/1G N3 hkd 600k\n126610LN N3 hkd 120k")))
    m = {row["WS-Code"]: row["Marke"] for row in rows(r, "matched")}
    assert m == {"15407ST": "Audemars Piguet", "7014/1G": "Patek Philippe", "126610LN": "Rolex"}


def test_short_brand_alias_in_remark_is_not_a_brand_filter():
    assert svc.detect_brand_from_content("126610LN both tag hkd 120k") is None
    r = gen(chat((HK, "WTS 126610LN both tag N3 hkd 120k")))
    assert [row["WS-Code"] for row in rows(r, "matched")] == ["126610LN"]
    assert "white tag" in rows(r, "matched")[0]["Bemerkungen"]


def test_reference_stem_finds_oem_reference_and_colour_decides(index):
    blue = svc.match_watch_by_ref("15210OR", index, line_tokens=["blue", "2024"])
    assert [w["ws_code"] for w in blue] == ["15210OR Blue"]
    diag = {}
    open_variant = svc.match_watch_by_ref("15210OR", index, line_tokens=["2024"], diag=diag)
    assert len(open_variant) == 2 and diag.get("unsure")


def test_reference_stem_without_colour_is_unsure_with_candidates():
    r = gen(chat((HK, "WTS 15210OR 2024 hkd 400k")))
    nr = rows(r, "needs_review")
    assert r["matched_count"] == 0 and len(nr) == 1
    assert nr[0]["WS-Code"] == ""
    assert {c["ws_code"] for c in nr[0]["_meta"]["candidates"]} == {"15210OR Blue", "15210OR Green"}


@pytest.mark.parametrize("ref", ["RM0701", "5980/1A", "116613LN"])
def test_fuzzy_stays_within_the_same_digit_sequence(index, ref):
    # Today: RM0701 → RM7201, 5980/1A → 5905/1A, 116613LN → 126613LN
    svc._fuzzy_match_cache.clear()
    assert svc.fuzzy_match_ref(ref, index) == ([], None)


def test_no_silent_guessing_generic_entry():
    # "126300 Green Ombré Jubilee" must not become "126300"
    r = gen(chat((HK, "WTS 126300 Green Ombré Jubilee N3 hkd 120k")))
    assert r["matched_count"] == 0
    nr = rows(r, "needs_review")
    assert len(nr) == 1 and nr[0]["WS-Code"] == ""
    assert len(nr[0]["_meta"]["candidates"]) >= 2


def test_variant_words_and_accents(index):
    picked = svc.match_watch_by_ref("228235", index, line_tokens=["omb", "jubilee"])
    assert [w["ws_code"] for w in picked] == ["228235 Ombré Jub"]
    picked = svc.match_watch_by_ref("228235", index, line_tokens=["ombre", "oys"])
    assert [w["ws_code"] for w in picked] == ["228235 Ombré Oys"]
    assert svc._resolve_descriptor("motif") == ["motif", "fluted"]
    assert svc._resolve_descriptor("rom") == ["rom", "roman"]


def test_nickname_comes_from_aliases(index):
    assert [w["ws_code"] for w in svc.match_watch("Starbucks fresh 13k eur", index)] == ["126610LV"]


def test_metal_is_not_a_dial_colour(index):
    picked = svc.match_watch_by_ref("116519LN", index, line_tokens=["white", "gold", "black", "2024"])
    assert [w["ws_code"] for w in picked] == ["116519LN Black"]
    choc = {"ws_code": "126505 Chocolate", "dial": "Chocolate"}
    assert not svc._has_descriptor_conflict(choc, ["everose", "2024"])
    assert not svc._has_descriptor_conflict(choc, ["rose", "gold"])


def test_draft_watches_are_matched():
    r = gen(chat((HK, "WTS 126710BLRO N3 hkd 150k")))
    assert [row["WS-Code"] for row in rows(r, "matched")] == ["126710BLRO"]


@pytest.mark.asyncio
async def test_build_watch_index_from_db_includes_drafts():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient
    from app.models.watch import Watch, WatchStatus

    client = AsyncMongoMockClient()
    await init_beanie(database=client["gen_spec"], document_models=[Watch])
    from beanie import PydanticObjectId
    dealer = "dealer-1"
    await Watch(brand="Rolex", model="GMT", reference="126710BLRO", ws_code="126710BLRO",
                status=WatchStatus.DRAFT, dealer_id=dealer).insert()
    await Watch(brand="Rolex", model="Sub", reference="126610LN", ws_code="126610LN",
                status=WatchStatus.ACTIVE, dealer_id=dealer).insert()
    index = await svc.build_watch_index()
    assert {"126710blro", "126610ln"} <= set(index["by_ws_code"])


def test_price_numbers_are_not_references(index):
    # "126500 White … 35500 usdt" → Tudor 35500; "$126000" → WSCode 126000
    m = svc.match_watch("126500LN White full set 35500 usdt", index)
    assert [w["ws_code"] for w in m] == ["126500LN White"]
    r = gen(chat(("+1 305 555 0100", "WTS 126500LN White full set 35500 usdt")))
    assert rows(r, "matched")[0]["Preis"] == "35,500 USD"
    assert svc.find_references("WTS 126610LN $126000", index) == ["126610LN"]


# --- §4 price, year, phone -----------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("126610LN hkld 120k", ("120,000", "HKD")),
    ("126610LN khd 120k", ("120,000", "HKD")),
    ("126610LN hkdd 120k", ("120,000", "HKD")),
    ("126610LN HKKD 120k", ("120,000", "HKD")),
    ("126610LN h kd 120k", ("120,000", "HKD")),
    ("126610LN HKD//390k", ("390,000", "HKD")),
    ("126610LN 💲 149k", ("149,000", "USD")),
    ("126610LN usdt ：35k", ("35,000", "USD")),
])
def test_currency_typos(text, expected):
    assert svc.extract_price_from_line(text, "US") == expected


def test_k_m_multipliers():
    assert svc.extract_price("hkd850k usd110.5k") == ("850,000", "HKD")
    assert svc.extract_price_from_line("143k Datejust 28", "HK") == ("143,000", "HKD")
    assert svc.extract_price("hkd1.763 m") == ("1,763,000", "HKD")


def test_ai_verify_never_accepts_a_price_not_in_the_text(monkeypatch):
    # "7118/1200R … 177000usdt → 7,118 USD"
    from app.core.config import settings
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")

    async def fake_verify(items, watch_index, mode, timeout=None):
        return [{"index": it["index"], "action": "flip", "ws_code": "7118/1200R", "price": "7,118",
                 "currency": "USD", "confidence": 99, "reason": "x"} for it in items]

    monkeypatch.setattr(svc, "batch_ai_verify", fake_verify)
    r = gen(chat(("+1 305 555 0100", "WTS 7118/1200R 2024 177000usdt")))
    assert rows(r, "matched")[0]["Preis"] == "177,000 USD"
    assert svc.price_in_text("177,000", "7118/1200R 177000usdt")
    assert not svc.price_in_text("7,118", "7118/1200R 177000usdt")


def test_year_is_not_read_from_the_reference_and_future_dates_are_rejected():
    # "81010-11-3153 → 11/53"
    assert svc.extract_month_year_from_text("81010-11-3153 hkd 100k") is None
    assert svc.normalize_month_year("n12/26", 11, 2026, "WTS") == ""
    assert svc.normalize_month_year("11/53", 11, 2026, "WTS") == ""
    assert svc.normalize_month_year("n10/26", 11, 2026, "WTS") == "10/26"


@pytest.mark.parametrize("token,expected", [("W10", "10/26"), ("W10/26", "10/26"), ("W9-2026", "09/26")])
def test_w_month_is_month_year_and_wood_card(token, expected):
    r = gen(chat((HK, f"WTS 126610LN {token} hkd 120k")))
    row = rows(r, "matched")[0]
    assert row["Monat/Jahr"] == expected
    assert "Wood Card" in row["Bemerkungen"]


def test_dates_normalised_before_duplicate_check():
    # 10/26 = N10/2026 = W10
    assert svc.canonical_month_year("10/26") == svc.canonical_month_year("n10/2026") == "10/26"
    r = gen(chat((HK, "WTS 126610LN 10/26 hkd 120k"), (HK, "WTS 126610LN N10/2026 hkd 120k"),
                 (HK, "WTS 126610LN W10 hkd 120k")))
    assert r["matched_count"] == 1


def test_phone_with_non_breaking_hyphen():
    assert svc.extract_phone_number("+81 70‑9138‑7979") == "+817091387979"
    r = gen(chat(("+81 70‑9138‑7979", "WTS 126610LN N3 hkd 120k")))
    assert rows(r, "matched")[0]["Nummer"] == "+817091387979"


def test_batch_ai_match_sends_only_row_candidates(monkeypatch, index):
    from app.core.config import settings
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "test-key")
    prompts = []

    async def fake_request(client, prompt, temperature, label):
        prompts.append(prompt)
        return [], False

    monkeypatch.setattr(svc, "_request_json_array", fake_request)
    real = _REAL_BATCH_AI_MATCH
    asyncio.run(real([{"index": 0, "content": "126334 blu jub 2024 hkd 100k", "brand_hint": "Rolex"}], index))
    assert prompts and "126334 Blue Jub" in prompts[0]
    assert "RM72-01" not in prompts[0] and "7014/1G" not in prompts[0]


# --- §5 image matching -----------------------------------------------------------------

def _photo_msg(sender, ts, name="00317560-PHOTO-2026-11-05-10-00-00.jpg"):
    return {"timestamp": ts, "sender": sender, "content": "", "attachments": [name]}


def test_photo_attaches_only_when_clear():
    t = datetime(2026, 11, 5, 10, 0, 0)
    same = [_photo_msg(DE, t), {"timestamp": t.replace(minute=1), "sender": DE, "content": "126334 for sale",
                                "attachments": []}]
    svc.attach_photos(same)
    assert same[1]["attachments"] and same[0]["_photo_attached"]

    other_sender = [_photo_msg(DE, t), {"timestamp": t, "sender": HK, "content": "126334", "attachments": []}]
    svc.attach_photos(other_sender)
    assert not other_sender[1]["attachments"]

    too_late = [_photo_msg(DE, t), {"timestamp": t.replace(minute=3), "sender": DE, "content": "126334",
                                    "attachments": []}]
    svc.attach_photos(too_late)
    assert not too_late[1]["attachments"]


def test_photo_is_dropped_when_message_has_several_watches():
    txt = ("[05.11.26, 10:00:00] +49 170 1234567: <attached: 00000001-PHOTO-2026-11-05-10-00-00.jpg>\n"
           "126334 blue jub €12.000\n126610LN €13.000\n")
    r = gen(txt)
    assert all(not row["_meta"]["image_file"] for b in ("matched", "needs_review") for row in rows(r, b))


def test_photo_caption_single_watch_keeps_image_file():
    txt = ("[05.11.26, 10:00:00] +49 170 1234567: <attached: 00000001-PHOTO-2026-11-05-10-00-00.jpg>\n"
           "126334 for sale €12.000\n")
    r = gen(txt)
    nr = rows(r, "needs_review")
    assert len(nr) == 1 and nr[0]["WS-Code"] == ""
    assert nr[0]["_meta"]["image_file"] == "00000001-PHOTO-2026-11-05-10-00-00.jpg"
    assert {c["ws_code"] for c in nr[0]["_meta"]["candidates"]} == {"126334 Blue Jub", "126334 Black Oys"}


def test_step1_description_filters_catalog_candidates():
    cands = [{"ws_code": "126334 Blue Jub", "dial": "Blue", "bracelet": "Jubilee"},
             {"ws_code": "126334 Black Oys", "dial": "Black", "bracelet": "Oyster"},
             {"ws_code": "126334 Blue Oys", "dial": "Blue", "bracelet": "Oyster"}]
    left = vm.filter_candidates_by_description({"dial_colour": "blue", "bracelet": "jubilee"}, cands)
    assert [c["ws_code"] for c in left] == ["126334 Blue Jub"]
    left = vm.filter_candidates_by_description({"dial_colour": "blue"}, cands)
    assert {c["ws_code"] for c in left} == {"126334 Blue Jub", "126334 Blue Oys"}


class _FakeClient:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []
        self.chat = self
        self.completions = self

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        content = json.dumps(self.answers.pop(0))

        class _Msg:
            pass
        msg = _Msg()
        msg.content = content
        choice = _Msg()
        choice.message = msg
        choice.finish_reason = "stop"
        resp = _Msg()
        resp.choices = [choice]
        return resp


CANDS_126334 = [{"ws_code": "126334 Blue Jub", "reference": "126334", "dial": "Blue", "bracelet": "Jubilee",
                 "cover_image": "https://img/blue.jpg"},
                {"ws_code": "126334 Black Oys", "reference": "126334", "dial": "Black", "bracelet": "Oyster",
                 "cover_image": "https://img/black.jpg"}]


def test_two_step_vision_match_and_token_budget():
    client = _FakeClient([
        {"dial_colour": "blue", "bracelet": "jubilee", "card_reference": "126334", "card_date": "10/26",
         "is_watch_photo": True},
        {"ws_code": "126334 Blue Jub", "confidence": 95, "observed": {}, "reason": "blue dial jubilee"},
    ])
    out = asyncio.run(vm.disambiguate_variant(client, "126334 for sale", ["data:image/jpeg;base64,xx"],
                                              CANDS_126334))
    assert out["ws_code"] == "126334 Blue Jub" and out["card_month_year"] == "10/26"
    assert all(c["max_completion_tokens"] >= 2000 for c in client.calls)
    # Step 2 only shows the catalog image of the filtered candidate.
    step2_images = [p for p in client.calls[1]["messages"][0]["content"] if p.get("type") == "image_url"]
    assert len(step2_images) == 2  # listing photo + one catalog photo


def test_wrong_photo_never_matches():
    # Warranty card shows another reference.
    client = _FakeClient([{"dial_colour": "blue", "card_reference": "228235", "is_watch_photo": True}])
    assert asyncio.run(vm.disambiguate_variant(client, "126334", ["x"], CANDS_126334)) is None
    # Step 2 picks a variant that contradicts the description.
    client = _FakeClient([
        {"dial_colour": "blue", "bracelet": "jubilee", "is_watch_photo": True},
        {"ws_code": "126334 Black Oys", "confidence": 99, "observed": {}, "reason": "?"},
    ])
    assert asyncio.run(vm.disambiguate_variant(client, "126334", ["x"], CANDS_126334)) is None


def test_image_analysis_cap_raised():
    assert svc.IMAGE_ANALYSIS_CAP >= 1000


# --- §6 remarks ---------------------------------------------------------------------

def test_remarks_map_is_appendix_a():
    assert svc.REMARKS_MAP["box & paper"] == "fullset"
    assert svc.REMARKS_MAP["card only"] == "Watch + Card"
    for removed in ("fs", "mercedes", "export"):
        assert removed not in svc.REMARKS_MAP


@pytest.mark.parametrize("text,expected", [
    ("126610LN fs 2024", ""),                          # fs = "for sale", no remark
    ("IWC Mercedes-AMG", ""),                          # mercedes alone
    ("126610LN export", ""),                           # export alone
    ("126610LN mercedes hands", "Mercedes Hands"),
    ("126610LN card only", "Watch + Card"),
    ("126610LN unadjusted", "Unadjusted"),
    ("126610LN un-adj", "Unadjusted"),
    ("126610LN adj", "Adjusted"),
    ("126610LN lc100", "LC100"),
    ("126610LN LC 220", "LC220"),
    ("15210OR LCF036", ""),                            # LC must stand alone
    ("126610LN margin invoice", "margin scheme"),      # not Original Invoice
    ("126610LN + invoice", ""),                        # plain "+ invoice" is no remark
    ("126610LN original invoice", "Original Invoice"),
    ("126610LN 1 link missing", "1 link"),
    ("126610LN 12 links", "12 links"),
    ("126610LN 1.5 links", "1.5 links"),
    ("126610LN serviced 2026", "Serviced 2026"),
    ("126610LN patek service 2025", "Serviced 2025"),
    ("126610LN less 15%", "15% Retail"),
    ("126610LN lc de", "LC Germany"),
    ("126610LN 🪵", "Wood Card"),
])
def test_remark_rules(text, expected):
    assert svc.normalize_remarks(text, "WTS") == expected


def test_locations_written_out():
    assert svc.extract_location_remarks("126610LN watch in Dubai", "WTS") == "Watch in Dubai"
    assert svc.extract_location_remarks("WTB 126610LN need in Miami, New York", "WTB") == "Need in Miami, New York"
    assert svc.extract_location_remarks("WTB need in dxb or hk", "WTB") == "Need in Dubai, Hong Kong"
    assert svc.extract_location_remarks("126610LN ready in HK", "WTS") == "Ready Stock"


def test_wtb_only_remarks():
    assert svc.normalize_remarks("WTB 126610LN used ok any year", "WTB") == "Can be Used, Any Year"
    assert svc.normalize_remarks("126610LN used ok", "WTS") == ""


def test_aftermarket_is_never_imported():
    r = gen(chat((HK, "WTS 126610LN aftermarket diamond bezel N3 hkd 120k")))
    assert r["matched_count"] == 0
    am = rows(r, "aftermarket")
    assert len(am) == 1 and am[0]["WS-Code"] == "126610LN"
    # exceptions
    assert remark_rules.is_aftermarket("126610LN factory diamond") is None
    assert remark_rules.is_aftermarket("126610LN aftermarket stickers") is None
    assert remark_rules.is_aftermarket("customs & shipping included") is None
    assert remark_rules.is_aftermarket("iced out 126610LN") == "iced out"


def test_one_aftermarket_line_in_a_list_only_drops_that_line():
    r = gen(chat((HK, "WTS\n126610LN N3 hkd 120k\n126333 moissanite hkd 100k\n15407ST 2024 hkd 900k")))
    assert {row["WS-Code"] for row in rows(r, "matched")} == {"126610LN", "15407ST"}
    assert [row["WS-Code"] for row in rows(r, "aftermarket")] == ["126333"]


@pytest.mark.asyncio
async def test_remark_rules_are_loaded_from_db_and_editable():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient
    from app.models.remark_rule import RemarkPlace, RemarkRule

    client = AsyncMongoMockClient()
    await init_beanie(database=client["remarks_test"], document_models=[RemarkRule, RemarkPlace])
    cfg = await remark_rules.load_remark_config()  # seeds appendix A
    assert await RemarkRule.count() > 50 and await RemarkPlace.count() > 30
    assert remark_rules.normalize_remarks("126610LN full set", "WTS", cfg) == "fullset"

    rule = await RemarkRule.find_one(RemarkRule.remark == "fullset")
    rule.triggers = rule.triggers + ["komplett"]
    await rule.save()
    await RemarkPlace(name="Vienna", aliases=["wien"], kind="city", order=9999).insert()
    cfg = await remark_rules.load_remark_config()
    assert remark_rules.normalize_remarks("126610LN komplett", "WTS", cfg) == "fullset"
    assert remark_rules.location_remarks("watch in Wien", "WTS", cfg) == ["Watch in Vienna"]


def test_remarks_admin_endpoints():
    from beanie import init_beanie
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from mongomock_motor import AsyncMongoMockClient

    from app.api.v1.endpoints import remarks_admin
    from app.core.deps import get_current_admin_user
    from app.models.remark_rule import RemarkPlace, RemarkRule
    from app.models.user import User

    admin = User.model_construct(email="a@b.c", name="A", role="admin")
    admin.id = None
    app = FastAPI()

    @app.on_event("startup")
    async def _init():
        await init_beanie(database=AsyncMongoMockClient()["remarks_api"], document_models=[RemarkRule, RemarkPlace])

    app.include_router(remarks_admin.router, prefix="/admin/remarks")
    app.dependency_overrides[get_current_admin_user] = lambda: admin
    with TestClient(app) as client:
        data = client.get("/admin/remarks").json()
        assert data["rules"] and data["places"] and "Set and papers" in data["categories"]
        created = client.post("/admin/remarks/rules", json={"remark": "Test", "triggers": ["x1", " ", "x1"],
                                                             "category": "Set and papers"}).json()
        assert created["triggers"] == ["x1"] and created["mode"] == "BOTH"
        upd = client.put(f"/admin/remarks/rules/{created['id']}", json={"mode": "wtb"}).json()
        assert upd["mode"] == "WTB"
        assert client.put(f"/admin/remarks/rules/{created['id']}", json={"kind": "bad"}).status_code == 400
        assert client.delete(f"/admin/remarks/rules/{created['id']}").json() == {"deleted": True}
        place = client.post("/admin/remarks/places", json={"name": "Vienna", "aliases": ["wien"],
                                                            "kind": "city"}).json()
        assert client.delete(f"/admin/remarks/places/{place['id']}").json() == {"deleted": True}
        assert len(client.post("/admin/remarks/reset").json()["rules"]) == len(data["rules"])


# --- §7 prices and discounts ----------------------------------------------------------

def test_two_numbers_one_marked_retail_takes_unmarked():
    # "hkd 71764 (retail 93200 -23%)"
    assert svc.extract_price_from_line("5167A hkd 71764 (retail 93200 -23%)", "HK") == ("71,764", "HKD")


def test_marked_retail_with_discount_is_calculated():
    # "hkr 68500 -15%" → 58,225; a result after "=" wins
    assert svc.extract_price_from_line("5167A hkr 68500 -15%", "HK") == ("58,225", "HKD")
    assert svc.extract_price_from_line("5167A hkr 68500 -15% = 58000", "HK") == ("58,000", "HKD")


def test_unmarked_discount_compared_with_list_price(index):
    # "$32700 -9%": ≈ list price → calculate; ≈ list − discount → keep; else review
    lp = index["by_ws_code"]["5167a"]          # US list price 32,700
    info = svc.price_info("5167A $32700 -9%", "US")
    assert svc.apply_list_price_rule(info, lp) == ("29,757", "USD", None)
    lp2 = index["by_ws_code"]["5711/1a"]       # US list price 35,934 → 32,700 is already −9 %
    info = svc.price_info("5711/1A $32700 -9%", "US")
    assert svc.apply_list_price_rule(info, lp2) == ("32,700", "USD", None)
    nolp = index["by_ws_code"]["5168g"]
    price, cur, reason = svc.apply_list_price_rule(svc.price_info("5168G $32700 -9%", "US"), nolp)
    assert reason and "unclear" in reason


def test_unmarked_discount_without_list_price_goes_to_review():
    r = gen(chat(("+1 305 555 0100", "WTS 5168G $32700 -9%")))
    assert r["matched_count"] == 0 and r["needs_review_count"] == 1


def test_discount_remark_only_when_written():
    assert "15% Retail" in svc.normalize_remarks("5167A hkr 68500 -15%", "WTS")
    assert "Retail" not in svc.normalize_remarks("5167A hkd 58225", "WTS")


# --- §8.4 currencies ---------------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("126610LN AED 350k", ("350,000", "AED")),
    ("126610LN 350k dhs", ("350,000", "AED")),
    ("126610LN S$ 160k", ("160,000", "SGD")),
    ("126610LN SGD 160k", ("160,000", "SGD")),
    ("126610LN CNY 900k", ("900,000", "CNY")),
    ("126610LN JPY 18m", ("18,000,000", "JPY")),
    ("126610LN CHF 12.5k", ("12,500", "CHF")),
    ("126610LN GBP 11k", ("11,000", "GBP")),
    ("126610LN 15k usdt", ("15,000", "USD")),
])
def test_all_currencies_supported(text, expected):
    assert svc.extract_price(text) == expected


def test_unknown_currency_goes_to_review():
    r = gen(chat((HK, "WTS 126610LN N3 450k THB")))
    nr = rows(r, "needs_review")
    assert r["matched_count"] == 0 and len(nr) == 1
    assert nr[0]["_meta"]["currency_unknown"] is True


def test_fixed_fx_table_is_gone():
    import inspect
    assert "FX_TO_HKD" not in inspect.getsource(svc)


# --- §2 tab 5 discarded ------------------------------------------------------------------

def test_discarded_messages():
    txt = (
        "[05.11.26, 10:00:00] +49 170 1234567: <attached: 00000001-PHOTO-2026-11-05-10-00-00.jpg>\nprice?\n"
        "[05.11.26, 10:05:00] +49 170 1111111: thanks bro, received the watch\n"
        "[05.11.26, 10:06:00] +49 170 2222222: anyone in Munich tomorrow?\n"
        "[05.11.26, 10:07:00] +49 170 3333333: WTS Hermes Birkin 25 bag €25.000\n"
    )
    r = gen(txt)
    reasons = [row["_meta"]["discard_reason"] for row in rows(r, "discarded")]
    assert "Photo with only WTB / ? / price? / pm" in reasons
    assert "Thanks" in reasons
    assert "Question" in reasons
    assert "Spare part, bag or jewellery" in reasons
    assert r["matched_count"] == 0 and r["not_in_database_count"] == 0


def test_wtb_without_reference_is_discarded():
    r = gen(chat((HK, "WTB any rolex, pm")), mode="WTB")
    assert [row["_meta"]["discard_reason"] for row in rows(r, "discarded")] == ["WTB without reference or model"]


# --- Structured output contract ------------------------------------------------------------

def test_structured_rows_contract():
    r = gen(chat((HK, "WTS 126610LN N3 hkd 120k"), (HK, "WTS 126334 hkd 100k"), (HK, "hello")))
    assert set(r["rows"]) == {"matched", "matched_via_image", "needs_review", "not_in_database",
                              "discarded", "aftermarket"}
    m = r["rows"]["matched"][0]
    assert m["WS-Code"] == "126610LN" and not any(k.startswith("_") and k != "_meta" for k in m)
    meta = m["_meta"]
    for key in ("source_text", "sender_phone", "timestamp", "group_name", "image_file", "candidates",
                "discard_reason", "currency_unknown"):
        assert key in meta
    assert meta["sender_phone"] == "+85265472648" and meta["group_name"] == "Test group"
    nr = r["rows"]["needs_review"][0]
    assert 2 <= len(nr["_meta"]["candidates"]) <= 4
    assert set(nr["_meta"]["candidates"][0]) == {"ws_code", "brand", "model", "reference", "score", "reason"}
    # CSVs carry no internal fields
    header = next(csv.reader(io.StringIO(r["matched_csv"])))
    assert not any(h.startswith("_") for h in header)


def test_store_and_load_run_rows(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient
    from app.models.wtb_wts import WtbWtsRun

    store: dict[str, str] = {}

    async def put(content, filename):
        store[filename] = content
        return "0123456789abcdef01234567"

    async def get(file_id):
        return next(iter(store.values()))

    monkeypatch.setattr(svc, "_gridfs_put_text", put)
    monkeypatch.setattr(svc, "_gridfs_get_text", get)

    async def scenario():
        await init_beanie(database=AsyncMongoMockClient()["runs"], document_models=[WtbWtsRun])
        run_id = await svc.run_generator_on_export(
            chat_txt=chat((HK, "WTS 126610LN N3 hkd 120k")), media=None, group_name="G1", mode="wts",
            ref_month=11, ref_year=2026, imported_by="pipeline")
        run = await WtbWtsRun.get(run_id)
        assert run.status.value == "completed" and run.rows_json_gridfs_id
        return await svc.load_run_rows(run_id)

    monkeypatch.setattr(svc, "build_watch_index", _index_from_catalog)
    loaded = asyncio.run(scenario())
    assert [row["WS-Code"] for row in loaded["matched"]] == ["126610LN"]
    assert set(loaded) == set(svc.BUCKETS)


_REAL_BUILD_INDEX = svc.build_watch_index


async def _index_from_catalog(jsonl_content=None):
    return await _REAL_BUILD_INDEX(CATALOG)
