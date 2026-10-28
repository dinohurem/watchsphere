"""WTS/WTB generator: AI reply handling, condition keywords and the rule that
AI answers only land on catalog watches."""

import asyncio
import json

import pytest

from app.services import wtb_wts_service as svc


# --- JSON-array replies ------------------------------------------------------

def test_parse_json_array_full_and_fenced():
    assert svc._parse_json_array('[{"index": 0}, {"index": 1}]') == [{"index": 0}, {"index": 1}]
    assert svc._parse_json_array('```json\n[{"index": 2}]\n```') == [{"index": 2}]


def test_parse_json_array_salvages_truncated_reply():
    cut = '[{"index": 0, "confidence": 90}, {"index": 1, "confidence": 85}, {"index": 2, "conf'
    assert svc._parse_json_array(cut) == [
        {"index": 0, "confidence": 90},
        {"index": 1, "confidence": 85},
    ]


def test_parse_json_array_rejects_non_arrays():
    assert svc._parse_json_array('{"index": 0}') == []
    assert svc._parse_json_array("Sorry, I cannot help with that.") == []


def test_truncated_batch_resends_missing_items(monkeypatch):
    monkeypatch.setattr(svc, "AI_BATCH_SIZE", 10)
    items = [{"index": i} for i in range(6)]
    calls = []

    async def request(batch):
        calls.append([it["index"] for it in batch])
        if len(calls) == 1:
            # First reply is cut off after two elements.
            return [{"index": batch[0]["index"]}, {"index": batch[1]["index"]}], True
        return [{"index": it["index"]} for it in batch], False

    results = asyncio.run(svc._run_ai_batches(items, request, "test", timeout=5))

    assert sorted(r["index"] for r in results) == list(range(6))
    assert calls[0] == list(range(6))
    assert sorted(i for call in calls[1:] for i in call) == [2, 3, 4, 5]


def test_timeout_keeps_finished_batches(monkeypatch):
    monkeypatch.setattr(svc, "AI_BATCH_SIZE", 1)
    items = [{"index": 0}, {"index": 1}]

    async def request(batch):
        if batch[0]["index"] == 1:
            await asyncio.sleep(5)
        return [{"index": batch[0]["index"]}], False

    results = asyncio.run(svc._run_ai_batches(items, request, "test", timeout=0.5))

    assert results == [{"index": 0}]


# --- Condition keywords ------------------------------------------------------

def test_new_part_remark_does_not_make_watch_unworn():
    assert svc.extract_condition("126610LN used, new clasp, fullset", "WTS") == "Used"
    assert svc.extract_condition_from_line("5711/1A worn new papers 1.2m hkd", None, "WTS") == "Used"


def test_condition_keywords_need_word_boundaries():
    # "new" inside "renewed" used to read as a buyer asking for unworn only.
    assert svc.extract_condition("WTB 126610LN renewed request", "WTB") is None
    assert svc.extract_condition("126610LN un-worn 2024", "WTS") == "Unworn"
    assert svc.extract_condition("126610LN unworn 2024", "WTS") == "Unworn"
    assert svc.extract_condition("126610LN like new", "WTS") == "Used"


def test_section_header_condition_uses_whole_words():
    assert svc._detect_section_condition("Patek Used ✨✨") == "Used"
    assert svc._detect_section_condition("New Fullset") == "Unworn"
    assert svc._detect_section_condition("Casinos stock") is None


# --- AI answers must resolve to catalog watches ------------------------------

CATALOG = json.dumps({
    "ws_code": "126610LN", "brand": "Rolex", "model": "Submariner Date",
    "reference": "126610LN",
})
CHAT = "[05.03.26, 16:38:28] +852 6547 2648: WTS 999999X 500k hkd\n"


def _run_generation(monkeypatch, ai_result):
    async def fake_match(unmatched_lines, watch_index, timeout=None):
        return [dict(ai_result, index=0)]

    monkeypatch.setattr(svc, "batch_ai_match", fake_match)
    return asyncio.run(svc.process_generation(
        txt_content=CHAT, mode="WTS", ref_month=3, ref_year=2026,
        group_name="Test group", jsonl_content=CATALOG,
    ))


def test_ai_match_outside_catalog_goes_to_review(monkeypatch):
    result = _run_generation(monkeypatch, {
        "ws_code": "999999X Blue", "watch": None, "ai_brand": "Rolex",
        "ai_model": "Unknown", "ai_ws_code": "999999X Blue",
        "confidence": 92, "in_catalog": False,
    })

    assert result["matched_count"] == 0
    assert result["needs_review_count"] == 1
    assert "AI identified 999999X Blue (92%), not in catalog" in result["needs_review_csv"]
    assert result["suggested_additions_count"] == 1


def test_ai_match_in_catalog_is_matched(monkeypatch):
    watch = {"ws_code": "126610LN", "brand": "Rolex", "model": "Submariner Date",
             "reference": "126610LN", "aliases": [], "oem_references": []}
    result = _run_generation(monkeypatch, {
        "ws_code": "126610LN", "watch": watch, "ai_brand": "Rolex",
        "ai_model": "Submariner Date", "ai_ws_code": "126610LN",
        "confidence": 92, "in_catalog": True,
    })

    assert result["matched_count"] == 1
    assert "126610LN" in result["matched_csv"]
    assert result["suggested_additions_count"] == 0
