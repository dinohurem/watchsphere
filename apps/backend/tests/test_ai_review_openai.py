"""AI review: OpenAI by default, several independent passes, fallback between providers."""
import json
from types import SimpleNamespace

import pytest

from app.services import ai_credit, ai_review, pipeline

CANDS = [{"ws_code": "A"}, {"ws_code": "B"}]
ITEMS = [{"id": "0", "text": "5711 steel blue", "candidates": CANDS}]


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    ai_credit.reset()
    ai_review.USAGE.clear()
    s = ai_review.settings
    monkeypatch.setattr(s, "OPENAI_API_KEY", "ok")
    monkeypatch.setattr(s, "ANTHROPIC_API_KEY", "ak")
    monkeypatch.setattr(s, "AI_REVIEW_PROVIDER", "openai")
    monkeypatch.setattr(s, "AI_REVIEW_PASSES", 2)
    yield
    ai_credit.reset()


def _dec(ws="A", sure=True, alias=None, reason="ok"):
    return {"decisions": [{"id": "0", "ws_code": ws, "sure": sure, "reason": reason, "alias": alias}]}


class FakeOpenAI:
    """Answers each call with the next payload (or raises it when it is an exception)."""

    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []
        self.chat = SimpleNamespace(completions=self)

    async def create(self, **kw):
        self.calls.append(kw)
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return SimpleNamespace(
            choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content=json.dumps(a)))],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=10))


class FakeAnthropic:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = 0
        self.beta = SimpleNamespace(messages=self)

    async def create(self, **kw):
        self.calls += 1
        p = self.payloads.pop(0)
        return SimpleNamespace(
            stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(p))],
            usage=SimpleNamespace(input_tokens=50, output_tokens=5))


def _credit_error():
    return RuntimeError("Error code: 429 - {'error': {'code': 'insufficient_quota'}}")


async def _run(clients, items=ITEMS):
    return await ai_review._review_batch(clients, items)


@pytest.mark.asyncio
async def test_two_passes_agreeing_is_sure():
    client = FakeOpenAI([_dec("A", alias="Pepsi"), _dec("A", alias="pepsi")])
    out = await _run({"openai": client})
    assert out["0"].sure and out["0"].ws_code == "A" and out["0"].alias == "Pepsi"
    assert len(client.calls) == 2
    assert client.calls[0]["model"] == "gpt-6-sol"
    assert client.calls[0]["response_format"]["json_schema"]["strict"] is True
    assert ai_review.USAGE["openai:gpt-6-sol"]["input"] == 200


@pytest.mark.asyncio
async def test_alias_dropped_when_passes_disagree_on_it():
    out = await _run({"openai": FakeOpenAI([_dec("A", alias="Pepsi"), _dec("A", alias=None)])})
    assert out["0"].sure and out["0"].alias is None


@pytest.mark.asyncio
async def test_disagreeing_ws_code_is_unsure():
    out = await _run({"openai": FakeOpenAI([_dec("A"), _dec("B")])})
    assert not out["0"].sure and out["0"].ws_code is None
    assert "disagreed" in out["0"].reason


@pytest.mark.asyncio
async def test_one_unsure_pass_makes_it_unsure():
    out = await _run({"openai": FakeOpenAI([_dec("A"), _dec("A", sure=False, reason="variant unclear")])})
    assert not out["0"].sure and out["0"].reason == "variant unclear"


@pytest.mark.asyncio
async def test_ws_code_outside_candidates_is_unsure():
    out = await _run({"openai": FakeOpenAI([_dec("Z"), _dec("Z")])})
    assert not out["0"].sure and out["0"].ws_code is None


@pytest.mark.asyncio
async def test_failed_pass_is_unsure():
    out = await _run({"openai": FakeOpenAI([_dec("A"), RuntimeError("boom")])})
    assert not out["0"].sure


def test_passes_shuffle_candidates_deterministically():
    items = [{"id": str(i), "text": "t", "candidates": [{"ws_code": c} for c in "ABC"]} for i in range(30)]
    first = ai_review.shuffled_for_pass(items, 0)
    assert first == ai_review.shuffled_for_pass(items, 0)
    assert first != ai_review.shuffled_for_pass(items, 1)
    assert all(sorted(c["ws_code"] for c in i["candidates"]) == list("ABC") for i in first)


@pytest.mark.asyncio
async def test_response_format_rejected_retries_without_it():
    client = FakeOpenAI([RuntimeError("400 unsupported response_format"), _dec("A")])
    payload = await ai_review._request_openai(client, ITEMS)
    assert payload and "response_format" not in client.calls[1]


@pytest.mark.asyncio
async def test_openai_out_of_credit_falls_back_to_anthropic():
    oa = FakeOpenAI([_credit_error(), _credit_error()])
    an = FakeAnthropic([_dec("A"), _dec("A")])
    out = await _run({"openai": oa, "anthropic": an})
    assert out["0"].sure and an.calls == 2
    assert ai_credit.is_exhausted("openai") and not ai_credit.is_exhausted("anthropic")
    # OpenAI-only steps (matching, verification) still pause the pipeline.
    assert pipeline.ai_blocked_provider() == "openai"


@pytest.mark.asyncio
async def test_exhausted_provider_is_skipped_next_time():
    ai_credit.mark_exhausted("openai")
    oa, an = FakeOpenAI([]), FakeAnthropic([_dec("A"), _dec("A")])
    out = await _run({"openai": oa, "anthropic": an})
    assert out["0"].sure and oa.calls == []


@pytest.mark.asyncio
async def test_provider_setting_is_respected(monkeypatch):
    assert ai_review.providers() == ["openai", "anthropic"]
    monkeypatch.setattr(ai_review.settings, "AI_REVIEW_PROVIDER", "anthropic")
    assert ai_review.providers() == ["anthropic", "openai"]
    an, oa = FakeAnthropic([_dec("A"), _dec("A")]), FakeOpenAI([])
    out = await _run({"openai": oa, "anthropic": an})
    assert out["0"].sure and an.calls == 2 and oa.calls == []
    monkeypatch.setattr(ai_review.settings, "ANTHROPIC_API_KEY", "")
    assert ai_review.providers() == ["openai"]


@pytest.mark.asyncio
async def test_both_exhausted_returns_nothing_and_pauses_pipeline(monkeypatch):
    oa = FakeOpenAI([_credit_error(), _credit_error()])

    async def anthropic_out_of_credit(client, items):
        ai_credit.mark_exhausted("anthropic")
        raise ai_review._CreditError

    monkeypatch.setattr(ai_review, "_request_anthropic", anthropic_out_of_credit)
    out = await _run({"openai": oa, "anthropic": FakeAnthropic([])})
    assert out == {}
    assert ai_review.blocked_provider() is not None
    assert await pipeline.pause_reason() is not None
    with pytest.raises(pipeline.ProcessingPaused):
        pipeline._raise_if_ai_exhausted()


def test_anthropic_exhausted_alone_does_not_pause_while_openai_works():
    ai_credit.mark_exhausted("anthropic")
    assert pipeline.ai_blocked_provider() is None


def test_anthropic_only_exhausted_pauses(monkeypatch):
    monkeypatch.setattr(ai_review.settings, "OPENAI_API_KEY", "")
    ai_credit.mark_exhausted("anthropic")
    assert pipeline.ai_blocked_provider() == "anthropic"
