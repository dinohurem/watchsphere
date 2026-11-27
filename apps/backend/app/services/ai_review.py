"""AI review of needs-review rows (generator spec §1.5), on OpenAI (default) or Claude.

Only the row's original text and its 2–3 catalog candidates are sent — never the
whole catalog. The model must pick one of the given candidates and say whether it
is sure. Sure → the pipeline imports the listing with ``match_method="ai"`` and the
short reason; unsure (or any error, or no API key) → the row waits on the approval
page's "Unsure" tab. A wrong automatic match is worse than a manual decision, so
everything that is not an explicit, valid "sure" counts as unsure.

Every batch is reviewed ``AI_REVIEW_PASSES`` times independently (candidate order shuffled
per pass). A row is sure only when every pass is sure and all picked the same candidate.
A provider that is out of credit is skipped; the other one (if it has a key) takes the batch.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 15
REVIEW_CONCURRENCY = 8      # batches in flight at once
MAX_REVIEW_ROWS = 450       # per export; the rest goes to Unsure
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


def providers() -> list[str]:
    """Providers that can review, in order of preference (the configured one first)."""
    have = {
        "openai": bool((settings.OPENAI_API_KEY or "").strip()),
        "anthropic": bool((settings.ANTHROPIC_API_KEY or "").strip()),
    }
    primary = "anthropic" if (settings.AI_REVIEW_PROVIDER or "").strip().lower() == "anthropic" else "openai"
    order = [primary, "anthropic" if primary == "openai" else "openai"]
    return [p for p in order if have[p]]


def is_enabled() -> bool:
    return bool(providers())


def blocked_provider() -> Optional[str]:
    """A provider name when every provider that could review is out of credit, else None."""
    from app.services import ai_credit

    usable = providers()
    if usable and all(ai_credit.is_exhausted(p) for p in usable):
        return ai_credit.provider() or usable[0]
    return None


def review_passes() -> int:
    return max(1, int(settings.AI_REVIEW_PASSES or 1))


# Token usage reported by the APIs, summed per "provider:model" (read by scripts/eval_ai_review.py).
USAGE: dict[str, dict[str, int]] = {}


def _add_usage(provider: str, model: str, input_tokens, output_tokens) -> None:
    u = USAGE.setdefault(f"{provider}:{model}", {"input": 0, "output": 0, "calls": 0})
    u["input"] += int(input_tokens or 0)
    u["output"] += int(output_tokens or 0)
    u["calls"] += 1


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


class _CreditError(Exception):
    """The provider refused the call for lack of credit."""


def shuffled_for_pass(items: list[dict], pass_no: int) -> list[dict]:
    """Copy of items with each row's candidates in a per-pass, per-row deterministic order."""
    out = []
    for item in items:
        cands = list(item["candidates"][:MAX_CANDIDATES])
        random.Random(f"ai-review:{pass_no}:{item['id']}").shuffle(cands)
        out.append({**item, "candidates": cands})
    return out


def _parse_json(text: str) -> Optional[dict]:
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        logger.warning("ai_review: response was not JSON")
        return None
    return payload if isinstance(payload, dict) else None


async def _request_anthropic(client, items: list[dict]) -> Optional[dict]:
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
        logger.warning("ai_review: Anthropic API error %s: %s", exc.status_code, exc.message)
        from app.services import ai_credit
        if ai_credit.check("anthropic", exc):
            raise _CreditError from exc
        return None
    except anthropic.APIConnectionError as exc:
        logger.warning("ai_review: Anthropic connection error: %s", exc)
        return None

    usage = getattr(response, "usage", None)
    _add_usage("anthropic", settings.ANTHROPIC_REVIEW_MODEL,
               getattr(usage, "input_tokens", 0), getattr(usage, "output_tokens", 0))
    if response.stop_reason in ("refusal", "max_tokens"):
        logger.warning("ai_review: stop_reason=%s, rows left unsure", response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == "text"), "")
    return _parse_json(text)


async def _request_openai(client, items: list[dict]) -> Optional[dict]:
    """Chat Completions, the call surface batch_ai_verify uses for OPENAI_TEXT_MODEL (model,
    messages, max_completion_tokens) plus a strict json_schema response_format. If the model
    rejects response_format, the call is repeated once with the schema in the prompt."""
    from app.services import ai_credit

    model = settings.OPENAI_REVIEW_MODEL
    user = build_prompt(items)
    structured = True
    for _ in range(2):
        kwargs: dict = {}
        content = user
        if structured:
            kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "review_decisions", "strict": True, "schema": OUTPUT_SCHEMA},
            }
        else:
            content = (user + "\n\nAnswer with only a JSON object matching this JSON schema:\n"
                       + json.dumps(OUTPUT_SCHEMA))
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": SYSTEM_PROMPT},
                          {"role": "user", "content": content}],
                max_completion_tokens=16000,
                **kwargs,
            )
        except Exception as exc:
            logger.warning("ai_review: OpenAI call failed: %s: %s", type(exc).__name__, exc)
            if ai_credit.check("openai", exc):
                raise _CreditError from exc
            msg = str(exc).lower()
            if structured and ("response_format" in msg or "json_schema" in msg):
                structured = False
                continue
            return None
        usage = getattr(response, "usage", None)
        _add_usage("openai", model, getattr(usage, "prompt_tokens", 0), getattr(usage, "completion_tokens", 0))
        choice = response.choices[0]
        if choice.finish_reason in ("length", "content_filter"):
            logger.warning("ai_review: finish_reason=%s, rows left unsure", choice.finish_reason)
            return None
        return _parse_json(choice.message.content or "")
    return None


def combine_passes(passes: list[Optional[dict[str, ReviewDecision]]],
                   items: list[dict]) -> dict[str, ReviewDecision]:
    """Merge independent passes: sure only if every pass is sure and all chose the same candidate
    (a pass that failed counts as unsure); the alias is kept only when the passes agree on it."""
    out: dict[str, ReviewDecision] = {}
    for item in items:
        rid = item["id"]
        ds = [p.get(rid) if p else None for p in passes]
        if any(d is None for d in ds):
            out[rid] = ReviewDecision(False, None, "AI review incomplete: a pass failed")
        elif len({d.ws_code for d in ds if d.sure}) > 1:
            out[rid] = ReviewDecision(False, None, "AI passes disagreed on the watch")
        elif not all(d.sure for d in ds):
            reason = next((d.reason for d in ds if not d.sure), "") or "AI was not sure"
            out[rid] = ReviewDecision(False, None, reason)
        else:
            aliases = {(d.alias or "").strip().lower() for d in ds}
            alias = ds[0].alias if len(aliases) == 1 else None
            out[rid] = ReviewDecision(True, ds[0].ws_code, ds[0].reason, alias or None)
    return out


async def _review_with(provider: str, client, items: list[dict]) -> dict[str, ReviewDecision]:
    request = _request_openai if provider == "openai" else _request_anthropic

    async def one_pass(n: int) -> Optional[dict[str, ReviewDecision]]:
        view = shuffled_for_pass(items, n)
        payload = await request(client, view)
        return parse_decisions(payload, view) if payload is not None else None

    results = await asyncio.gather(*(one_pass(n) for n in range(review_passes())), return_exceptions=True)
    if any(isinstance(r, _CreditError) for r in results):
        raise _CreditError
    for r in results:
        if isinstance(r, BaseException):
            raise r
    return combine_passes(list(results), items)


async def _review_batch(clients: dict, items: list[dict]) -> dict[str, ReviewDecision]:
    """One batch: all passes on the preferred provider; when it is out of credit, the whole batch
    goes to the next provider. Returns {} when no provider could review it."""
    from app.services import ai_credit

    for provider in providers():
        if provider not in clients or ai_credit.is_exhausted(provider):
            continue
        try:
            return await _review_with(provider, clients[provider], items)
        except _CreditError:
            logger.warning("ai_review: %s is out of credit, trying the other provider", provider)
    return {}


def make_clients() -> dict:
    clients: dict = {}
    for provider in providers():
        if provider == "openai":
            from openai import AsyncOpenAI
            clients[provider] = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=300.0)
        else:
            import anthropic
            clients[provider] = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=300.0)
    return clients


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

    # One export can hold thousands of review rows (a group's first run, a catch-up after an
    # outage). Reviewing them one batch after another held a worker for hours and stalled the
    # whole queue (Nov 2026): batches run in parallel, and past MAX_REVIEW_ROWS the rest goes
    # to "Unsure" for a human instead of blocking every other group.
    for item in reviewable[MAX_REVIEW_ROWS:]:
        results[item["id"]] = ReviewDecision(False, None, "Not reviewed by the AI: too many rows in one export")
    reviewable = reviewable[:MAX_REVIEW_ROWS]
    clients = make_clients()
    gate = asyncio.Semaphore(REVIEW_CONCURRENCY)

    async def run(batch):
        async with gate:
            return await _review_batch(clients, batch)

    for part in await asyncio.gather(*(run(reviewable[i:i + BATCH_SIZE])
                                       for i in range(0, len(reviewable), BATCH_SIZE))):
        results.update(part)
    return results
