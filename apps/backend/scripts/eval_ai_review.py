"""Evaluate the AI review of needs-review rows against decisions an admin already made.

READ-ONLY: only `find` queries on pipeline_items; nothing is ever written. Known-correct answers:
  - resolution "picked"/"corrected" with resolved_ws_code (the admin chose / fixed the watch)
  - ai_decision items an admin "confirmed" (the AI answer ai_ws_code was right)
Rows are sent to the chosen provider/model/passes exactly like the pipeline does (same prompt,
schema, batching), but only the AI is called; the database is never touched.

Usage (from apps/backend, env MONGODB_URL / MONGODB_DB_NAME, plus the provider's API key):
  python scripts/eval_ai_review.py --n 100 --provider openai --model gpt-6-sol --passes 2
  python scripts/eval_ai_review.py --n 100 --provider anthropic --model claude-opus-5-5 --passes 1
Optional: --price-in/--price-out (USD per 1M tokens) to get a cost estimate.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def build_case(doc: dict) -> dict | None:
    """A pipeline_items document -> {"id", "text", "candidates", "expected"} or None when it has no
    usable known answer. The expected ws_code must be one of the candidates.

    With ``--reference ai`` the answer of the previous review model (an AI decision nobody has
    checked yet) is the reference: the result is agreement with that model, not accuracy."""
    resolution = doc.get("resolution")
    if doc.get("kind") == "ai_decision" and resolution is None:
        expected = doc.get("ai_ws_code")
    elif resolution in ("picked", "corrected"):
        expected = doc.get("resolved_ws_code")
    elif resolution == "confirmed":
        expected = doc.get("resolved_ws_code") or doc.get("ai_ws_code")
    else:
        return None
    text = doc.get("source_text")
    candidates = [c for c in (doc.get("candidates") or []) if c.get("ws_code")]
    if not expected or not text or not candidates:
        return None
    if expected not in {c["ws_code"] for c in candidates}:
        return None  # the correct watch was never offered; the review cannot get it right
    return {"id": str(doc["_id"]), "text": text, "candidates": candidates, "expected": expected}


def summarize(cases: list[dict], decisions: dict) -> dict:
    """Rows, sure/unsure rates and accuracy of the sure answers against the admin's answer."""
    rows = len(cases)
    sure = [c for c in cases if decisions.get(c["id"]) and decisions[c["id"]].sure]
    correct = [c for c in sure if decisions[c["id"]].ws_code == c["expected"]]
    return {
        "rows": rows,
        "sure": len(sure),
        "sure_rate": len(sure) / rows if rows else 0.0,
        "unsure": rows - len(sure),
        "unsure_rate": (rows - len(sure)) / rows if rows else 0.0,
        "sure_correct": len(correct),
        "sure_accuracy": len(correct) / len(sure) if sure else None,
    }


def estimate_cost(usage: dict, price_in: float | None, price_out: float | None) -> float | None:
    """USD from token counts and per-1M-token prices; None when no prices are given."""
    if price_in is None or price_out is None:
        return None
    total_in = sum(u["input"] for u in usage.values())
    total_out = sum(u["output"] for u in usage.values())
    return total_in / 1e6 * price_in + total_out / 1e6 * price_out


async def load_cases(n: int, reference: str = "admin") -> list[dict]:
    from motor.motor_asyncio import AsyncIOMotorClient

    url = os.environ["MONGODB_URL"]
    db_name = os.environ.get("MONGODB_DB_NAME") or url.split("/")[-1].split("?")[0] or "watchsphere"
    coll = AsyncIOMotorClient(url)[db_name]["pipeline_items"]
    if reference == "ai":
        query = {"kind": "ai_decision", "resolution": None, "ai_ws_code": {"$ne": None},
                 "source_text": {"$ne": None}, "candidates.1": {"$exists": True}}
        sort_key = "created_at"
    else:
        query = {"resolution": {"$in": ["picked", "corrected", "confirmed"]},
                 "source_text": {"$ne": None}, "candidates.0": {"$exists": True}}
        sort_key = "resolved_at"
    cases, seen = [], set()
    async for doc in coll.find(query).sort(sort_key, -1).limit(n * 5):  # read-only
        case = build_case(doc)
        if case and case["text"] not in seen:  # same dealer text reposted counts once
            seen.add(case["text"])
            cases.append(case)
        if len(cases) >= n:
            break
    return cases


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--provider", choices=["openai", "anthropic"], default="openai")
    ap.add_argument("--model", help="model name (default: the configured review model)")
    ap.add_argument("--passes", type=int, default=2)
    ap.add_argument("--reference", choices=["admin", "ai"], default="admin",
                    help="admin: decisions an admin made or confirmed; ai: unchecked decisions of the previous model")
    ap.add_argument("--price-in", type=float, help="USD per 1M input tokens")
    ap.add_argument("--price-out", type=float, help="USD per 1M output tokens")
    args = ap.parse_args()

    from app.core.config import settings
    from app.services import ai_review

    settings.AI_REVIEW_PROVIDER = args.provider
    settings.AI_REVIEW_PASSES = args.passes
    if args.model:
        if args.provider == "openai":
            settings.OPENAI_REVIEW_MODEL = args.model
        else:
            settings.ANTHROPIC_REVIEW_MODEL = args.model
    # Only the chosen provider, no fallback to the other one.
    if args.provider == "openai":
        settings.ANTHROPIC_API_KEY = ""
    else:
        settings.OPENAI_API_KEY = ""
    if not ai_review.is_enabled():
        sys.exit(f"No API key set for provider {args.provider}")

    cases = await load_cases(args.n, args.reference)
    if not cases:
        sys.exit("No resolved review items with a known answer found")
    decisions = await ai_review.review_rows(
        [{"id": c["id"], "text": c["text"], "candidates": c["candidates"]} for c in cases])
    s = summarize(cases, decisions)

    print(f"provider={args.provider} model="
          f"{settings.OPENAI_REVIEW_MODEL if args.provider == 'openai' else settings.ANTHROPIC_REVIEW_MODEL}"
          f" passes={args.passes}")
    print(f"rows:            {s['rows']}")
    print(f"sure:            {s['sure']} ({s['sure_rate']:.1%})")
    acc = "n/a" if s["sure_accuracy"] is None else f"{s['sure_accuracy']:.1%}"
    print(f"sure accuracy:   {s['sure_correct']}/{s['sure']} ({acc}) vs the admin's answer")
    print(f"unsure:          {s['unsure']} ({s['unsure_rate']:.1%})")
    usage = ai_review.USAGE
    if usage:
        for key, u in usage.items():
            print(f"tokens {key}: input {u['input']}, output {u['output']}, calls {u['calls']}")
        cost = estimate_cost(usage, args.price_in, args.price_out)
        print("estimated cost:  " + (f"${cost:.2f}" if cost is not None
                                      else "pass --price-in/--price-out (USD per 1M tokens)"))
    else:
        print("tokens: not reported by the API")
    wrong = [c for c in cases if decisions[c["id"]].sure and decisions[c["id"]].ws_code != c["expected"]]
    for c in wrong[:10]:
        print(f"WRONG sure: expected {c['expected']}, got {decisions[c['id']].ws_code}: {c['text'][:100]!r}")


if __name__ == "__main__":
    asyncio.run(main())
