"""Approval page: bulk decisions (filters, select-all, grouped texts) and decisions by file
(download, preview, commit, undo)."""
import csv
import io
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.services import approval_plan as p

# --- pure planning ------------------------------------------------------------

HEAD = "tab;id;version;decision;new_value\n"


def parse(body):
    rows, untouched, err = p.parse_file((chr(0xFEFF) + HEAD + body).encode("utf-8"))
    assert not err, err
    return rows, untouched


def test_rows_without_decision_are_untouched_and_spellings_normalised():
    rows, untouched = parse("ai;a1;v;;\nai;a2;v;not_in_catalog;\nai;a3;v;Not In Catalogue;\n")
    assert untouched == 1 and [r.decision for r in rows] == ["not_in_catalogue"] * 2


def test_plan_statuses():
    rows, _ = parse(
        "ai;ok;v1;confirm;\n"
        "ai;old;v1;confirm;\n"
        "ai;gone;v1;confirm;\n"
        "ai;dup;v1;confirm;\nai;dup;v1;confirm;\n"
        "ai;nocode;v1;correct;\n"
        "ai;badcode;v1;correct;NOPE\n"
        "aliases;al;v1;approve;\n"
        "aliases;al2;v1;confirm;\n"
        "prices;pr;v1;fix_currency;xxx\n"
        "prices;pr2;v1;correct_price;abc\n"
        "prices;pr3;v1;correct_price;1.250,50\n"
        "unsure;u1;v1;confirm;\nunsure;u2;v1;confirm;\n"
        "zzz;q;v1;confirm;\n")
    S = {("ai", "ok"): p.State("v1"), ("ai", "old"): p.State("v2"), ("ai", "dup"): p.State("v1"),
         ("ai", "nocode"): p.State("v1"), ("ai", "badcode"): p.State("v1"),
         ("aliases", "al"): p.State("v1"), ("aliases", "al2"): p.State("v1"),
         ("prices", "pr"): p.State("v1"), ("prices", "pr2"): p.State("v1"), ("prices", "pr3"): p.State("v1"),
         ("unsure", "u1"): p.State("v1", {"suggested": "126610LN"}), ("unsure", "u2"): p.State("v1", {})}
    items = p.build_plan(rows, S, {"126610LN"}, {"USD", "HKD"})
    got = [(i.row.case_id, i.status) for i in items]
    assert got == [
        ("ok", "apply"), ("old", "changed"), ("gone", "not_found"), ("dup", "apply"), ("dup", "duplicate"),
        ("nocode", "invalid"), ("badcode", "invalid"), ("al", "apply"), ("al2", "invalid"),
        ("pr", "invalid"), ("pr2", "invalid"), ("pr3", "apply"), ("u1", "apply"), ("u2", "invalid"),
        ("q", "invalid"),
    ]
    s = p.summarize(items, untouched=3)
    assert s["apply"]["ai"] == {"confirm": 2} and s["apply_total"] == 5 and s["rows"] == len(items) + 3
    assert s["skipped"]["invalid"] == 7


def test_missing_columns_and_empty_file():
    assert p.parse_file(b"id;decision\n1;confirm\n")[2][0].startswith("Missing columns")
    assert p.parse_file((HEAD + "ai;a;v;;\n").encode())[2]


# --- endpoints ---------------------------------------------------------------

RATES = {"USD": 1.0, "EUR": 0.9, "HKD": 7.8}


@pytest_asyncio.fixture
async def ap_app(admin_user, monkeypatch):
    from beanie import init_beanie
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from mongomock_motor import AsyncMongoMockClient

    import app.services.fx as fx
    from app.api.v1.endpoints import approval, approval_bulk, approval_file
    from app.core.deps import get_current_admin_user
    from app.models.approval_file import ApprovalFileBatch, ApprovalFileItem, ApprovalFileSnapshot
    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.order_fix import OrderArchive
    from app.models.pipeline import AliasSuggestion, PipelineItem
    from app.models.watch import Watch

    async def load_rates(force=False):
        return RATES

    monkeypatch.setattr(fx, "load_rates", load_rates)
    client = AsyncMongoMockClient()
    await init_beanie(database=client["approval_bulk_test"], document_models=[
        Order, Watch, FxRate, FxRateHistory, WatchMarketStats, PipelineItem, AliasSuggestion,
        ApprovalFileBatch, ApprovalFileItem, ApprovalFileSnapshot, OrderArchive])
    for n, ws in enumerate(["126610LN", "126610LV", "5167A"]):
        await Watch(brand="Rolex" if ws.startswith("12") else "Patek", model=f"M{n}", reference=ws,
                    ws_code=ws, dealer_id="d", serial_number=f"s{n}", status="active").insert()
    application = FastAPI()
    application.include_router(approval_bulk.router, prefix="/approval")
    application.include_router(approval_file.router, prefix="/approval/file")
    application.include_router(approval.router, prefix="/approval")
    application.dependency_overrides[get_current_admin_user] = lambda: admin_user
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://t") as c:
        yield c


async def make_order(ws="126610LN", price=10000, cur="USD"):
    from app.models.order import Order, OrderType

    o = Order(order_type=OrderType.SELL, brand="Rolex", model="M", reference=ws, ws_code=ws, price=price,
              currency=cur, usd_price=price, country_code="HK", user_id="u", whatsapp_phone="+852")
    await o.insert()
    return o


async def make_item(kind, text, status="pending", group="Group A", brand="Rolex", reason=None,
                    ai_ws=None, order=None, candidates=None, key=None, minutes=0):
    from app.models.pipeline import PipelineItem, ReviewKind
    from app.services.pipeline import text_key

    it = PipelineItem(
        kind=ReviewKind(kind), status=status, group_name=group, source_text=text,
        text_key=text_key(text) if key is None else key, sender_phone="+49", reason=reason,
        ai_ws_code=ai_ws, ai_reason=reason, order_id=str(order.id) if order else None,
        row={"Marke": brand, "Referenz": "126610"}, candidates=candidates or [],
        created_at=datetime.utcnow() - timedelta(minutes=minutes),
        guessed_reference="126610" if kind == "not_in_database" else None,
        guessed_brand=brand if kind == "not_in_database" else None,
    )
    await it.insert()
    return it


def table(text):
    return list(csv.DictReader(io.StringIO(text.lstrip(chr(0xFEFF))), delimiter=";"))


@pytest.mark.asyncio
async def test_unsure_groups_identical_texts_and_filters(ap_app):
    c = ap_app
    cand = [{"ws_code": "126610LN"}, {"ws_code": "126610LV"}]
    for i in range(3):
        await make_item("unsure", "Rolex 126610 Sub  full set", reason="two variants", candidates=cand,
                        group=f"G{i % 2}", minutes=i)
    await make_item("unsure", "Patek 5167A", brand="Patek", reason="no match", group="G1")
    await make_item("unsure", "", brand="Patek", key="")  # no text: stays alone
    await make_item("unsure", "", brand="Patek", key="")

    r = (await c.get("/approval/unsure")).json()
    assert r["total"] == 4 and r["item_total"] == 6
    top = r["groups"][0]
    assert top["count"] == 3 and len(top["item_ids"]) == 3 and top["groups"] == ["G0", "G1"]
    assert [x["ws_code"] for x in top["candidates"]] == ["126610LN", "126610LV"]

    assert (await c.get("/approval/unsure", params={"brand": "rolex"})).json()["total"] == 1
    assert (await c.get("/approval/unsure", params={"group": "G1"})).json()["item_total"] == 2
    assert (await c.get("/approval/unsure", params={"reason": "NO MATCH"})).json()["total"] == 1

    opts = (await c.get("/approval/filter-options", params={"tab": "unsure"})).json()
    assert opts["brands"] == ["Patek", "Rolex"] and opts["groups"] == ["G0", "G1", "Group A"]
    assert {o["reason"] for o in opts["reasons"]} == {"two variants", "no match"}


@pytest.mark.asyncio
async def test_bulk_discard_all_matching_minus_unticked_group(ap_app):
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    c = ap_app
    for i in range(5):
        await make_item("unsure", "Rolex 126610", group="G0")
    await make_item("unsure", "Patek 5167A", brand="Patek")
    await make_item("unsure", "Rolex Daytona", group="G1")

    r = await c.post("/approval/bulk/decide", json={
        "tab": "unsure", "action": "discard", "all_matching": True, "filters": {"brand": "Rolex"},
        "exclude_keys": ["rolex daytona"]})
    assert r.status_code == 200, r.text
    assert r.json()["decided"] == 5 and r.json()["remaining"] == 0
    discarded = await PipelineItem.find({"kind": ReviewKind.DISCARDED.value}).to_list()
    assert len(discarded) == 5 and all(i.status == ReviewStatus.RESOLVED and i.expires_at for i in discarded)
    assert await PipelineItem.find({"kind": ReviewKind.UNSURE.value}).count() == 2  # Patek + unticked


@pytest.mark.asyncio
async def test_bulk_by_keys_not_in_catalogue_and_limit(ap_app):
    from app.models.pipeline import PipelineItem, ReviewKind

    c = ap_app
    for i in range(6):
        await make_item("unsure", f"Text {i}")
    r = await c.post("/approval/bulk/decide", json={
        "tab": "unsure", "action": "not_in_catalog", "all_matching": True, "limit": 4})
    assert r.json()["decided"] == 4 and r.json()["remaining"] == 2
    prev = r.json()
    moved = await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value}).to_list()
    assert len(moved) == 4 and moved[0].guessed_reference == "126610" and moved[0].guessed_brand == "Rolex"
    # the page calls again from where the last call stopped until nothing remains
    r = await c.post("/approval/bulk/decide", json={
        "tab": "unsure", "action": "not_in_catalog", "all_matching": True, "limit": 4,
        "after_id": prev["next_after"]})
    assert r.json()["decided"] == 2 and r.json()["remaining"] == 0

    assert (await c.post("/approval/bulk/decide", json={"tab": "unsure", "action": "discard"})).status_code == 400
    assert (await c.post("/approval/bulk/decide", json={
        "tab": "ai", "action": "correct", "all_matching": True})).status_code == 400


@pytest.mark.asyncio
async def test_bulk_ai_confirm_correct_discard(ap_app):
    from app.models.order import Order
    from app.models.pipeline import PipelineItem, ReviewKind, ReviewStatus

    c = ap_app
    ids = {}
    for name, brand in [("a", "Rolex"), ("b", "Rolex"), ("c", "Rolex"), ("d", "Patek")]:
        o = await make_order()
        ids[name] = (await make_item("ai_decision", f"text {name}", brand=brand, ai_ws="126610LN",
                                     order=o, reason="AI says so"), o)
    r = await c.post("/approval/bulk/decide", json={"tab": "ai", "action": "confirm",
                                                    "ids": [str(ids["a"][0].id)]})
    assert r.json()["decided"] == 1
    assert (await PipelineItem.get(ids["a"][0].id)).resolution == "confirmed"

    r = await c.post("/approval/bulk/decide", json={
        "tab": "ai", "action": "correct", "ws_code": "126610LV", "all_matching": True,
        "filters": {"brand": "Rolex"}})
    assert r.json()["decided"] == 2  # b and c; a is decided, d is Patek
    assert (await Order.get(ids["b"][1].id)).ws_code == "126610LV"
    assert (await Order.get(ids["d"][1].id)).ws_code == "126610LN"

    r = await c.post("/approval/bulk/decide", json={
        "tab": "ai", "action": "discard", "all_matching": True, "filters": {"reason": "ai says"}})
    assert r.json()["decided"] == 1 and await Order.get(ids["d"][1].id) is None
    assert await PipelineItem.find({"kind": ReviewKind.AI_DECISION.value,
                                    "status": ReviewStatus.PENDING.value}).count() == 0
    r = await c.get("/approval/ai-decisions", params={"status": "resolved", "brand": "patek"})
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_bulk_bad_ws_code_is_rejected(ap_app):
    o = await make_order()
    await make_item("ai_decision", "x", ai_ws="126610LN", order=o)
    r = await ap_app.post("/approval/bulk/decide", json={
        "tab": "ai", "action": "correct", "ws_code": "NOPE", "all_matching": True})
    assert r.status_code == 404


# --- decision files --------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_has_one_row_per_case_with_version_and_empty_decision(ap_app):
    from app.models.pipeline import AliasSuggestion

    c = ap_app
    o = await make_order()
    await make_item("ai_decision", "AI text", ai_ws="126610LN", order=o, reason="exact",
                    candidates=[{"ws_code": "126610LN"}, {"ws_code": "126610LV"}])
    for i in range(3):
        await make_item("unsure", "Same text", candidates=[{"ws_code": "126610LN"}, {"ws_code": "5167A"}])
    await make_item("not_in_database", "Unknown watch", brand="Rolex")
    await AliasSuggestion(alias="Sub Date", alias_key="sub date", ws_code="126610LN", examples=["ex"]).insert()

    r = await c.get("/approval/file/export/ai")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    rows = table(r.text)
    assert list(rows[0].keys()) == p.HEADER and len(rows) == 1
    assert rows[0]["original_text"] == "AI text" and rows[0]["suggested_ws_code"] == "126610LN"
    assert rows[0]["other_candidates"] == "126610LV" and rows[0]["dealer"] == "+49"
    assert rows[0]["version"] and rows[0]["decision"] == "" and rows[0]["new_value"] == ""

    u = table((await c.get("/approval/file/export/unsure")).text)
    assert len(u) == 1 and u[0]["suggested_ws_code"] == "126610LN" and u[0]["other_candidates"] == "5167A"
    assert "3x same text" in u[0]["info"]
    assert len(table((await c.get("/approval/file/export/aliases")).text)) == 1
    nw = table((await c.get("/approval/file/export/new_watches")).text)
    assert len(nw) == 1 and nw[0]["id"] == "126610"
    assert (await c.get("/approval/file/export/nope")).status_code == 404


async def _file(c, body, name="d.csv"):
    r = await c.post("/approval/file/preview", files={"file": (name, (p.HEADER_LINE + body).encode(), "text/csv")})
    return r


p.HEADER_LINE = ";".join(p.HEADER) + "\n"


def line(tab, id_, version="", decision="", value=""):
    cells = {c: "" for c in p.HEADER}
    cells.update(tab=tab, id=id_, version=version, decision=decision, new_value=value)
    return ";".join(cells[c] for c in p.HEADER) + "\n"


@pytest.mark.asyncio
async def test_prices_export_median_and_offer_count(ap_app):
    c = ap_app
    for v in (10000, 10100, 9900):
        await make_order("5167A", v, "USD")
    odd = await make_order("5167A", 100000, "USD")
    from app.services import price_flags
    assert (await price_flags.scan_active(dry_run=False))["held"] == 1
    rows = table((await c.get("/approval/file/export/prices")).text)
    assert [r["id"] for r in rows] == [str(odd.id)]
    r = rows[0]
    assert r["price"] == "100000.0" and r["currency"] == "USD" and r["median_currency"] == "EUR"
    assert float(r["median"]) == 9000.0 and r["offer_count"] == "3" and r["version"]


@pytest.mark.asyncio
async def test_file_preview_commit_undo_all_tabs(ap_app):
    from app.models.approval_file import ApprovalFileSnapshot
    from app.models.order import Order
    from app.models.order_fix import OrderArchive
    from app.models.pipeline import AliasSuggestion, PipelineItem, ReviewKind, ReviewStatus
    from app.models.watch import Watch

    c = ap_app
    # AI: confirm / correct / discard / not in catalogue
    ai = {}
    for name in ("confirm", "correct", "discard", "nic", "changed"):
        o = await make_order()
        ai[name] = (await make_item("ai_decision", f"ai {name}", ai_ws="126610LN", order=o), o)
    # Unsure: one group of 3 identical texts -> discard; one -> not in catalogue
    for _ in range(3):
        await make_item("unsure", "same text", candidates=[{"ws_code": "126610LN"}])
    await make_item("unsure", "other text")
    # Alias + new watch
    al = await AliasSuggestion(alias="Sub", alias_key="sub", ws_code="126610LN").insert()
    nw = await make_item("not_in_database", "unknown", brand="Rolex")
    # Prices
    for v in range(9900, 10700, 100):
        await make_order("5167A", v)
    pr = {k: await make_order("5167A", 100000 + n) for n, k in enumerate(("approve", "reject", "currency", "price"))}

    from app.services import price_flags
    assert (await price_flags.scan_active(dry_run=False))["held"] == 4  # the four 10x offers
    exp = {t: table((await c.get(f"/approval/file/export/{t}")).text) for t in
           ("ai", "unsure", "aliases", "new_watches", "prices")}
    ver = {(t, r["id"]): r["version"] for t, rs in exp.items() for r in rs}
    # a repost/other admin changes one AI case after the download
    ch = await PipelineItem.get(ai["changed"][0].id)
    ch.ai_ws_code = "126610LV"
    await ch.save()

    body = (
        line("ai", str(ai["confirm"][0].id), ver[("ai", str(ai["confirm"][0].id))], "confirm")
        + line("ai", str(ai["correct"][0].id), ver[("ai", str(ai["correct"][0].id))], "correct", "126610LV")
        + line("ai", str(ai["discard"][0].id), ver[("ai", str(ai["discard"][0].id))], "discard")
        + line("ai", str(ai["nic"][0].id), ver[("ai", str(ai["nic"][0].id))], "not_in_catalogue")
        + line("ai", str(ai["changed"][0].id), ver[("ai", str(ai["changed"][0].id))], "confirm")
        + line("ai", "aaaaaaaaaaaaaaaaaaaaaaaa", "x", "confirm")
        + line("unsure", "same text", ver[("unsure", "same text")], "discard")
        + line("unsure", "other text", ver[("unsure", "other text")], "not_in_catalogue")
        + line("aliases", str(al.id), ver[("aliases", str(al.id))], "approve")
        + line("new_watches", "126610", ver[("new_watches", "126610")], "dismiss")
        + line("prices", str(pr["approve"].id), ver[("prices", str(pr["approve"].id))], "approve")
        + line("prices", str(pr["reject"].id), ver[("prices", str(pr["reject"].id))], "reject")
        + line("prices", str(pr["currency"].id), ver[("prices", str(pr["currency"].id))], "fix_currency", "HKD")
        + line("prices", str(pr["price"].id), ver[("prices", str(pr["price"].id))], "correct_price", "10.050")
        + line("ai", "empty-decision-row")  # untouched
    )
    r = await _file(c, body)
    assert r.status_code == 200, r.text
    pv = r.json()
    assert pv["untouched"] == 1
    assert pv["apply"]["ai"] == {"confirm": 1, "correct": 1, "discard": 1, "not_in_catalogue": 1}
    assert pv["apply"]["prices"] == {"approve": 1, "reject": 1, "fix_currency": 1, "correct_price": 1}
    assert pv["skipped"] == {"changed": 1, "not_found": 1}
    assert pv["apply_total"] == 12
    # nothing changed by the preview
    assert await PipelineItem.find({"status": ReviewStatus.RESOLVED.value}).count() == 0
    assert await Order.find_all().count() == 5 + 8 + 4
    bid = pv["batch_id"]

    assert (await c.post(f"/approval/file/{bid}/commit", json={"confirm_apply_total": 11})).status_code == 400
    r = await c.post(f"/approval/file/{bid}/commit", json={"confirm_apply_total": 12})
    assert r.status_code == 200, r.text
    assert r.json()["failed"] == 0 and sum(r.json()["done"].values()) == 12, r.json()
    assert (await c.post(f"/approval/file/{bid}/commit", json={"confirm_apply_total": 12})).status_code == 409

    # AI
    assert (await PipelineItem.get(ai["confirm"][0].id)).resolution == "confirmed"
    assert (await Order.get(ai["correct"][1].id)).ws_code == "126610LV"
    assert await Order.get(ai["discard"][1].id) is None and await Order.get(ai["nic"][1].id) is None
    assert await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value, "text_key": "ai nic"}).count() == 1
    assert (await PipelineItem.get(ai["changed"][0].id)).status == ReviewStatus.PENDING
    # Unsure group: all three items discarded, other moved
    assert await PipelineItem.find({"kind": ReviewKind.DISCARDED.value, "text_key": "same text"}).count() == 3
    assert await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value, "text_key": "other text"}).count() == 1
    # alias approved -> alias on the watch; new watch dismissed
    assert "Sub" in (await Watch.find_one({"ws_code": "126610LN"})).aliases
    assert (await PipelineItem.get(nw.id)).resolution == "dismissed"
    # prices
    assert (await Order.get(pr["approve"].id)).price_approved is True
    assert await Order.get(pr["reject"].id) is None
    cur = await Order.get(pr["currency"].id)
    assert cur.currency == "HKD" and cur.usd_price == pytest.approx(100002 / 7.8, rel=1e-3)
    assert (await Order.get(pr["price"].id)).price == 10050

    hist = (await c.get("/approval/file")).json()
    assert hist[0]["status"] == "committed" and hist[0]["apply_total"] == 12
    sk = (await c.get(f"/approval/file/{bid}/skipped.csv")).text
    assert "changed" in sk and "not_found" in sk

    # --- undo ---
    r = await c.post(f"/approval/file/{bid}/undo")
    assert r.status_code == 200, r.text
    assert (await c.post(f"/approval/file/{bid}/undo")).status_code == 409
    assert (await PipelineItem.get(ai["confirm"][0].id)).status == ReviewStatus.PENDING
    back = await Order.get(ai["correct"][1].id)
    assert back.ws_code == "126610LN"
    assert await Order.get(ai["discard"][1].id) is not None and await Order.get(ai["nic"][1].id) is not None
    assert await PipelineItem.find({"kind": ReviewKind.NOT_IN_DATABASE.value, "text_key": "ai nic"}).count() == 0
    assert await PipelineItem.find({"kind": ReviewKind.UNSURE.value, "text_key": "same text"}).count() == 3
    assert await PipelineItem.find({"kind": ReviewKind.UNSURE.value, "text_key": "other text"}).count() == 1
    assert (await AliasSuggestion.get(al.id)).status.value == "pending"
    assert "Sub" not in ((await Watch.find_one({"ws_code": "126610LN"})).aliases or [])
    assert (await PipelineItem.get(nw.id)).status == ReviewStatus.PENDING
    assert (await Order.get(pr["approve"].id)).price_approved is False
    assert await Order.get(pr["reject"].id) is not None
    cur = await Order.get(pr["currency"].id)
    assert cur.currency == "USD" and cur.usd_price == 100002
    assert (await Order.get(pr["price"].id)).price == 100003
    assert await ApprovalFileSnapshot.find_all().count() == 0
    assert await Order.find_all().count() == 5 + 8 + 4
    assert (await c.get("/approval/file")).json()[0]["status"] == "undone"


@pytest.mark.asyncio
async def test_commit_skips_case_changed_after_preview_and_undo_leaves_later_edits(ap_app):
    from app.models.order import Order
    from app.models.pipeline import PipelineItem, ReviewStatus

    c = ap_app
    a, b = await make_order(), await make_order()
    ia = await make_item("ai_decision", "a", ai_ws="126610LN", order=a)
    ib = await make_item("ai_decision", "b", ai_ws="126610LN", order=b)
    ver = {r["id"]: r["version"] for r in table((await c.get("/approval/file/export/ai")).text)}
    pv = (await _file(c, line("ai", str(ia.id), ver[str(ia.id)], "correct", "126610LV")
                      + line("ai", str(ib.id), ver[str(ib.id)], "correct", "126610LV"))).json()
    assert pv["apply_total"] == 2
    ia = await PipelineItem.get(ia.id)
    ia.ai_ws_code = "5167A"  # the pipeline re-decided it between preview and commit
    await ia.save()
    r = await c.post(f"/approval/file/{pv['batch_id']}/commit", json={"confirm_apply_total": 2})
    assert r.json()["failed"] == 1 and (await Order.get(a.id)).ws_code == "126610LN"
    assert (await Order.get(b.id)).ws_code == "126610LV"

    o = await Order.get(b.id)
    o.ws_code = "5167A"  # someone corrected it again after the commit
    await o.save()
    r = await c.post(f"/approval/file/{pv['batch_id']}/undo")
    assert r.json()["left_alone"] == 1
    assert (await Order.get(b.id)).ws_code == "5167A"
    assert (await PipelineItem.get(ib.id)).status == ReviewStatus.PENDING  # the item itself is back in the queue


@pytest.mark.asyncio
async def test_unsure_pick_creates_listing_and_undo_removes_it(ap_app, monkeypatch):
    from app.models.order import Order
    from app.models.pipeline import PipelineItem, ReviewStatus
    from app.services import pipeline

    c = ap_app

    async def fake_import(rows, admin, label, group):
        o = await make_order(rows[0]["WS-Code"], 11111)
        return {"new_order_ids": [str(o.id)], "refreshed_order_ids": []}

    async def no_dispatch(ids):
        return None

    import app.api.v1.endpoints.whatsapp as wa
    monkeypatch.setattr(pipeline, "import_rows", fake_import)
    monkeypatch.setattr(wa, "dispatch_new_listings_safe", no_dispatch)
    for _ in range(2):
        await make_item("unsure", "pick me", candidates=[{"ws_code": "126610LN"}])
    await make_item("unsure", "no suggestion")
    ver = {r["id"]: r["version"] for r in table((await c.get("/approval/file/export/unsure")).text)}
    pv = (await _file(c, line("unsure", "pick me", ver["pick me"], "confirm")
                      + line("unsure", "no suggestion", ver["no suggestion"], "confirm")
                      + line("unsure", "no suggestion", "", "correct", "5167A"))).json()
    assert pv["apply_total"] == 1 and pv["skipped"] == {"invalid": 1, "duplicate": 1}
    r = await c.post(f"/approval/file/{pv['batch_id']}/commit", json={"confirm_apply_total": 1})
    assert r.status_code == 200 and r.json()["failed"] == 0, r.text
    assert await Order.find_all().count() == 2
    assert await PipelineItem.find({"status": ReviewStatus.RESOLVED.value}).count() == 2
    r = await c.post(f"/approval/file/{pv['batch_id']}/undo")
    assert r.json()["removed"] == 2 and await Order.find_all().count() == 0
    assert await PipelineItem.find({"status": ReviewStatus.PENDING.value}).count() == 3


@pytest.mark.asyncio
async def test_file_validation_errors(ap_app):
    c = ap_app
    r = await c.post("/approval/file/preview", files={"file": ("x.csv", b"a;b\n1;2\n", "text/csv")})
    assert r.status_code == 400
    r = await _file(c, line("ai", "aaaaaaaaaaaaaaaaaaaaaaaa"))  # no decision at all
    assert r.status_code == 400
