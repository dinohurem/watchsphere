"""AI review of needs-review rows with the Claude API (generator spec §1.5).

Only the row's original text and its 2–3 catalog candidates are sent — never the
whole catalog. The model must pick one of the given candidates and say whether it
is sure. Sure → the pipeline imports the listing with ``match_method="ai"`` and the
short reason; unsure (or any error, or no API key) → the row waits on the approval
page's "Unsure" tab. A wrong automatic match is worse than a manual decision, so
everything that is not an explicit, valid "sure" counts as unsure.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 15
MAX_CANDIDATES = 3

SYSTEM_PROMPT = """You review watch listings from WhatsApp dealer groups for WatchSphere, a \
watch trading platform. For each listing you get the dealer's original message text and 2-3 \
catalog candidates (WS code, brand, model, reference, and why the generator suggested it).

Decide which candidate the listing refers to. Mark a row "sure" only when the text clearly \
identifies exactly one candidate: the reference matches and every variant detail that \
distinguishes the candidates (dial colour, bracelet such as Jubilee/Oyster, bezel, metal, \
diamonds) is stated in the text or unambiguous. Metal words (white gold, rose gold, Everose) \
are not dial colours. If the text fits several candidates, none of them, or you would have to \
guess a variant, answer sure=false. A wrong automatic match is much worse than asking a human.

If you are sure and the text identifies the watch through a nickname or spelling that is not \
the plain reference (e.g. "Pepsi Jub", "Starbucks"), return that phrase as alias, else null.
Keep each reason under 20 words."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "decisions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "ws_code": {"type": ["string", "null"]},
                    "sure": {"type": "boolean"},
                    "reason": {"type": "string"},
                    "alias": {"type": ["string", "null"]},
                },
                "required": ["id", "ws_code", "sure", "reason", "alias"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["decisions"],
    "additionalProperties": False,
}


@dataclass
class ReviewDecision:
    sure: bool
    ws_code: Optional[str]
    reason: str
    alias: Optional[str] = None


def is_enabled() -> bool:
    return bool((settings.ANTHROPIC_API_KEY or "").strip())


def _candidate_line(c: dict) -> str:
    parts = [f"ws_code={c.get('ws_code')}"]
    for key in ("brand", "model", "reference"):
        if c.get(key):
            parts.append(f"{key}={c[key]}")
    if c.get("reason"):
        parts.append(f"why={c['reason']}")
    return "; ".join(parts)


def build_prompt(items: list[dict]) -> str:
    """items: [{"id", "text", "candidates": [...]}] → user message text."""
    blocks = []
    for item in items:
        cands = "\n".join(f"  - {_candidate_line(c)}" for c in item["candidates"][:MAX_CANDIDATES])
        blocks.append(f"<listing id=\"{item['id']}\">\n<text>\n{item['text']}\n</text>\n"
                      f"<candidates>\n{cands}\n</candidates>\n</listing>")
    return (
        "Review these listings. Return one decision per listing id, choosing ws_code only "
        "from that listing's candidates.\n\n" + "\n\n".join(blocks)
    )


def parse_decisions(payload: dict, items: list[dict]) -> dict[str, ReviewDecision]:
    """Validate the model's answer: unknown ids, ws codes outside the candidates
    or missing rows all become unsure."""
    by_id = {item["id"]: item for item in items}
    out = {item["id"]: ReviewDecision(False, None, "No AI decision") for item in items}
    for d in (payload or {}).get("decisions", []) or []:
        item = by_id.get(str(d.get("id")))
        if not item:
            continue
        allowed = {str(c.get("ws_code")) for c in item["candidates"][:MAX_CANDIDATES] if c.get("ws_code")}
        ws = d.get("ws_code")
        sure = bool(d.get("sure")) and ws in allowed
        reason = (d.get("reason") or "").strip()[:300]
        if d.get("sure") and ws not in allowed:
            reason = f"AI chose a watch outside the candidates ({ws})"
        alias = (d.get("alias") or None) if sure else None
        out[item["id"]] = ReviewDecision(sure, ws if ws in allowed else None, reason, alias)
    return out


async def _review_batch(client, items: list[dict]) -> dict[str, ReviewDecision]:
    import anthropic

    try:
        response = await client.beta.messages.create(
            model=settings.ANTHROPIC_REVIEW_MODEL,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_prompt(items)}],
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
            },
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.APIStatusError as exc:
        logger.warning("ai_review: API error %s: %s", exc.status_code, exc.message)
        return {}
    except anthropic.APIConnectionError as exc:
        logger.warning("ai_review: connection error: %s", exc)
        return {}

    if response.stop_reason in ("refusal", "max_tokens"):
        logger.warning("ai_review: stop_reason=%s, rows left unsure", response.stop_reason)
        return {}
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        logger.warning("ai_review: response was not JSON")
        return {}
    return parse_decisions(payload, items)


async def review_rows(items: list[dict]) -> dict[str, ReviewDecision]:
    """Review needs-review rows.

    items: [{"id": str, "text": str, "candidates": [{"ws_code", "brand", "model",
    "reference", "reason"}]}]. Rows without candidates are unsure without an API call.
    """
    results = {item["id"]: ReviewDecision(False, None, "AI review unavailable") for item in items}
    reviewable = [i for i in items if i.get("text") and i.get("candidates")]
    for item in items:
        if not item.get("candidates"):
            results[item["id"]] = ReviewDecision(False, None, "No catalog candidates")
    if not reviewable or not is_enabled():
        return results

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=300.0)
    for i in range(0, len(reviewable), BATCH_SIZE):
        batch = reviewable[i:i + BATCH_SIZE]
        results.update(await _review_batch(client, batch))
    return results
