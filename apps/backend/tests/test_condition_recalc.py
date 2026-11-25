"""Recalculation of existing WTS offers + the market stats rule for offers without a condition."""
import asyncio
from datetime import datetime, timedelta

from app.models.order import Order
from app.services import condition_recalc as cr
from app.services import market_stats as ms

NOW = datetime(2026, 11, 25, 12, 0, 0)


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def __aiter__(self):
        async def gen():
            for d in self.docs:
                yield d
        return gen()


class FakeCol:
    def __init__(self, docs):
        self.docs = docs
        self.ops = []

    def find(self, *a, **k):
        return FakeCursor(self.docs)

    async def count_documents(self, *a, **k):
        return 3

    async def distinct(self, *a, **k):
        return []

    async def bulk_write(self, ops, ordered=False):
        self.ops.extend(ops)

        class R:
            modified_count = len(ops)
        return R()


def _docs():
    return [
        {"_id": 1, "ws_code": "A", "condition": "Unworn", "condition_raw": None, "created_at": NOW,
         "source_text": "5167A 2024 hkd 420k"},       # Unworn -> none
        {"_id": 2, "ws_code": "B", "condition": "Unworn", "condition_raw": None, "created_at": NOW,
         "source_text": "5711/1A 2019 hkd 890k"},     # Unworn -> Used
        {"_id": 3, "ws_code": "C", "condition": "Unworn", "condition_raw": None, "created_at": NOW,
         "source_text": "126334 grey jub n11 $117000"},  # stays
        {"_id": 4, "ws_code": "D", "condition": None, "condition_raw": None, "created_at": NOW,
         "source_text": "116518NG 2022Y🆕 $380K"},    # none -> Unworn
    ]


def _run(monkeypatch, dry_run):
    col = FakeCol(_docs())
    monkeypatch.setattr(Order, "get_motor_collection", classmethod(lambda cls: col))
    return col, asyncio.run(cr.recalculate(dry_run=dry_run))


def test_dry_run_reports_and_writes_nothing(monkeypatch):
    col, res = _run(monkeypatch, True)
    assert res["dry_run"] is True and col.ops == [] and res["written"] == 0
    assert res["before"] == {"Unworn": 3, "Used": 0, "none": 1}
    assert res["after"] == {"Unworn": 2, "Used": 1, "none": 1}
    assert res["changed"] == 3
    assert res["changes"] == {"Unworn -> none": 1, "Unworn -> Used": 1, "none -> Unworn": 1}
    assert {s["id"] for s in res["sample"]} == {"1", "2", "4"}


def test_write_run_updates_changed_orders_only(monkeypatch):
    col, res = _run(monkeypatch, False)
    assert res["written"] == 3 and len(col.ops) == 3


def _l(i, cond, price=100.0):
    return ms.Listing(id=str(i), ws_code="X", order_type="sell", dealer=f"d{i}", price=price, currency="USD",
                      price_usd=price, condition=cond, year=2024, month=None,
                      created_at=NOW - timedelta(days=1))


def test_offers_without_condition_are_neither_fresh_nor_used():
    listings = [_l(1, "Used"), _l(2, None), _l(3, ""), _l(4, "Unworn")]
    fresh, used = ms.split_fresh_used(listings)
    assert [l.id for l in fresh] == []      # Unworn without card month is Used, never fresh
    assert [l.id for l in used] == ["1", "4"]
    stats = ms.period_stats([_l(i, None, 100.0 + i) for i in range(5)], "ALL", NOW)
    assert stats["used"]["count"] == 0 and stats["fresh"]["count"] == 0
    assert stats["all"]["count"] == 5 and stats["all"]["median_usd"] is not None
