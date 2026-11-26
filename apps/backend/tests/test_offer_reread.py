"""Re-reading existing imported offers with the current generator rules."""
import asyncio
from datetime import datetime

from app.models.order import Order
from app.models.watch import Watch
from app.services import offer_reread as rr

NOW = datetime(2026, 11, 20, 12, 0, 0)
PHONE = "+85291234567"


def _doc(text, **kw):
    base = {"_id": 1, "order_type": "sell", "ws_code": "WSX0001", "reference": "", "whatsapp_phone": PHONE,
            "source_text": text, "price": 1000.0, "currency": "HKD", "created_at": NOW, "condition": None,
            "condition_raw": None, "year": None, "watch_month": None, "year_raw": None, "remarks": None,
            "notes": None, "status": "active", "superseded_by": None}
    base.update(kw)
    return base


def test_old_unworn_with_old_year_becomes_used():
    res = rr.reread(_doc("5712/1A 2018 HKD985k", reference="5712/1A", price=985000.0, condition="Unworn", year=2018))
    assert res["set"]["condition"] == "Used"
    assert res["changed"] == ["condition"]


def test_wood_month_2026_gets_no_condition():
    res = rr.reread(_doc("126711chnr w11/26 $161500", reference="126711CHNR", price=161500.0, currency="USD",
                         condition="Unworn", year=2026, watch_month=11))
    assert res["set"]["condition"] is None
    assert "condition" in res["changed"]


def test_discount_line_gets_discounted_price_and_remark():
    res = rr.reread(_doc("wsbb0044, hkr 49600 19% 2026", ws_code="WSBB0044", price=49600.0, year=2026))
    assert res["set"]["price"] == 40176.0
    assert "price" in res["changed"] and "remarks" in res["changed"]
    assert "19" in res["set"]["remarks"] and "retail" in res["set"]["remarks"].lower()


def test_whole_message_header_applies_used_to_2025_line():
    text = "Rolex used\n126334 2025 hkd 117000\n126710 2019 hkd 99000"
    res = rr.reread(_doc(text, reference="126334", ws_code="WS126334", price=117000.0, year=2025))
    assert res["set"]["condition"] == "Used"


def test_whole_message_other_line_not_mixed_up():
    text = "126334 2025 hkd 117000\n126710 2019 hkd 99000"
    res = rr.reread(_doc(text, reference="126710", ws_code="WS126710", price=99000.0, condition="Used", year=2019))
    assert res["changed"] == []


def test_ambiguous_line_is_skipped():
    text = "126334 2022 hkd 117000\n126334 2023 hkd 117000\n126710 2019 hkd 99000"
    res = rr.reread(_doc(text, reference="126334", ws_code="WS126334", price=117000.0))
    assert res == {"skip": "ambiguous_line"}


def test_line_not_in_message_is_skipped():
    text = "126334 2022 hkd 117000\n126710 2019 hkd 99000"
    res = rr.reread(_doc(text, reference="999999", ws_code="WS999999", price=5000.0))
    assert res == {"skip": "line_not_found"}


def test_correct_offer_is_unchanged():
    res = rr.reread(_doc("5712/1A 2018 HKD985k", reference="5712/1A", price=985000.0, condition="Used", year=2018))
    assert res["changed"] == [] and res["set"] == {}


def test_buy_offer_is_skipped():
    assert rr.reread(_doc("wtb 5712/1A", order_type="buy")) == {"skip": "not_sell"}


def test_other_currency_is_counted_not_changed():
    res = rr.reread(_doc("126711chnr w11/26 usd 161500", reference="126711CHNR", price=161500.0, currency="HKD"))
    assert res["currency_differs"] is True
    assert "price" not in res["set"] and "currency" not in res["set"]


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

    async def bulk_write(self, ops, ordered=False):
        self.ops.extend(ops)

        class R:
            modified_count = len(ops)
        return R()


def _run(monkeypatch, dry_run):
    docs = [
        _doc("5712/1A 2018 HKD985k", _id=1, reference="5712/1A", price=985000.0, condition="Unworn", year=2018),
        _doc("5712/1A 2018 HKD985k", _id=2, reference="5712/1A", price=985000.0, condition="Used", year=2018),
        _doc("126334 2022 hkd 1\n126334 2023 hkd 1\n126710 2019 hkd 9", _id=3, reference="126334", price=1.0),
    ]
    col, wcol = FakeCol(docs), FakeCol([])
    monkeypatch.setattr(Order, "get_motor_collection", classmethod(lambda cls: col))
    monkeypatch.setattr(Watch, "get_motor_collection", classmethod(lambda cls: wcol))
    return col, asyncio.run(rr.reread_offers(dry_run=dry_run))


def test_dry_run_writes_nothing(monkeypatch):
    col, res = _run(monkeypatch, True)
    assert col.ops == [] and res["dry_run"] is True and "written" not in res
    assert res["scanned_active_offers"] == 3 and res["changed_offers"] == 1
    assert res["by_field"]["condition"] == 1
    assert res["skipped"] == {"ambiguous_line": 1}
    assert res["samples"][0]["before"]["condition"] == "Unworn" and res["samples"][0]["after"]["condition"] == "Used"


def test_real_run_writes_only_changed(monkeypatch):
    col, res = _run(monkeypatch, False)
    assert res["written"] == 1 and len(col.ops) == 1
