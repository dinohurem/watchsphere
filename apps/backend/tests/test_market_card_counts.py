"""Card counts come from live orders, so the card and the watch page always show the same number."""
import asyncio

from app.services import market_cards, market_stats


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_stats_for_uses_live_counts_over_stored_stats(monkeypatch):
    async def stored(codes):
        return {"WS1": {"wts_count": 713, "wtb_count": 9, "change_1m_pct": 2.5, "retail_pct": 10.0}}

    async def live(codes):
        return {"WS1": {"wts_count": 642, "wtb_count": 4}}

    monkeypatch.setattr(market_stats, "card_stats", stored)
    monkeypatch.setattr(market_cards, "_live_counts", live)
    out = _run(market_cards.stats_for(["WS1", "WS2"]))
    assert out["WS1"]["wts_count"] == 642 and out["WS1"]["wtb_count"] == 4
    assert out["WS1"]["change_1m_pct"] == 2.5  # the rest of the stored stats is kept
    assert out["WS2"]["wts_count"] == 0  # no live orders at all


def test_stats_for_keeps_stored_counts_when_live_query_fails(monkeypatch):
    async def stored(codes):
        return {"WS1": {"wts_count": 713, "wtb_count": 9}}

    async def broken(codes):
        return None

    monkeypatch.setattr(market_stats, "card_stats", stored)
    monkeypatch.setattr(market_cards, "_live_counts", broken)
    assert _run(market_cards.stats_for(["WS1"]))["WS1"]["wts_count"] == 713
