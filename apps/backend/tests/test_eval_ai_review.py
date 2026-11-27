"""Pure parts of scripts/eval_ai_review.py (no database, no network)."""
import importlib.util
import pathlib

from app.services.ai_review import ReviewDecision

_spec = importlib.util.spec_from_file_location(
    "eval_ai_review", pathlib.Path(__file__).parent.parent / "scripts" / "eval_ai_review.py")
ev = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ev)

CANDS = [{"ws_code": "A"}, {"ws_code": "B"}]


def test_build_case_variants():
    assert ev.build_case({"_id": 1, "resolution": "picked", "resolved_ws_code": "A",
                          "source_text": "t", "candidates": CANDS})["expected"] == "A"
    assert ev.build_case({"_id": 2, "resolution": "confirmed", "ai_ws_code": "B",
                          "source_text": "t", "candidates": CANDS})["expected"] == "B"
    assert ev.build_case({"_id": 3, "resolution": "corrected", "resolved_ws_code": "B",
                          "ai_ws_code": "A", "source_text": "t", "candidates": CANDS})["expected"] == "B"


def test_build_case_skips_unusable():
    base = {"_id": 1, "source_text": "t", "candidates": CANDS}
    assert ev.build_case({**base, "resolution": "discarded"}) is None
    assert ev.build_case({**base, "resolution": "picked", "resolved_ws_code": "Z"}) is None
    assert ev.build_case({**base, "resolution": "picked", "resolved_ws_code": None}) is None
    assert ev.build_case({**base, "candidates": [], "resolution": "picked", "resolved_ws_code": "A"}) is None


def test_summarize_and_cost():
    cases = [{"id": str(i), "expected": "A"} for i in range(4)]
    decisions = {
        "0": ReviewDecision(True, "A", ""), "1": ReviewDecision(True, "B", ""),
        "2": ReviewDecision(False, None, ""), "3": ReviewDecision(True, "A", ""),
    }
    s = ev.summarize(cases, decisions)
    assert s["rows"] == 4 and s["sure"] == 3 and s["unsure"] == 1
    assert s["sure_correct"] == 2 and abs(s["sure_accuracy"] - 2 / 3) < 1e-9
    usage = {"openai:m": {"input": 2_000_000, "output": 500_000, "calls": 3}}
    assert ev.estimate_cost(usage, 1.0, 4.0) == 4.0
    assert ev.estimate_cost(usage, None, None) is None
