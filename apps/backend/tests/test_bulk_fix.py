"""Bulk fix of orders from a file: planning (pure) and preview -> commit -> undo (endpoints)."""
import pytest
import pytest_asyncio

from app.services import bulk_fix_plan as b

HEAD = "order_id;action;expect_ws_code;expect_price;expect_currency;new_value;reason;source_line\n"
ORDERS = {
    "a1": {"ws_code": "126610LN", "price": 86000.0, "currency": "HKD", "order_type": "sell"},
    "a2": {"ws_code": "126334 Blue Jub", "price": 11500.0, "currency": "USD", "order_type": "sell"},
    "a3": {"ws_code": "126334 Blue Jub", "price": 91000.0, "currency": "HKD", "order_type": "sell"},
    "b1": {"ws_code": "5711/1A-010", "price": 5711.0, "currency": "EUR", "order_type": "buy"},
    "b2": {"ws_code": "5167A", "price": None, "currency": "EUR", "order_type": "buy"},
}
WS = {"126610LN", "126334 Blue Jub", "126334 Blue Oys", "5711/1A-010", "5167A"}
CUR = {"USD", "HKD", "EUR", "CHF"}


def plan(body, orders=ORDERS):
    rows, err = b.parse_file((chr(0xFEFF) + HEAD + body).encode("utf-8"))
    assert not err, err
    return b.build_plan(rows, orders, WS, CUR)


# --- planning ---------------------------------------------------------------

def test_delete_applies_when_order_unchanged():
    it = plan("a1;delete;126610LN;86000;HKD;;price belongs to another line;x\n")[0]
    assert it.status == "apply"
    assert {k: it.before[k] for k in ("ws_code", "price", "currency")} == {
        "ws_code": "126610LN", "price": 86000.0, "currency": "HKD"}


def test_row_is_skipped_when_price_changed_since_file_was_built():
    it = plan("a1;delete;126610LN;84000;HKD;;;\n")[0]
    assert it.status == "changed" and "price" in it.detail


def test_row_is_skipped_when_order_was_moved_meanwhile():
    assert plan("a1;delete;126610LV;86000;HKD;;;\n")[0].status == "changed"


def test_missing_order_is_reported_not_an_error():
    assert plan("zz;delete;126610LN;86000;HKD;;;\n")[0].status == "not_found"


def test_move_needs_existing_target():
    P = plan("a2;move;126334 Blue Jub;11500;USD;126334 Blue Oys;;\na3;move;126334 Blue Jub;91000;HKD;126334 Blau;;\n")
    assert [i.status for i in P] == ["apply", "invalid"]


def test_move_to_same_code_is_already_done():
    assert plan("a2;move;;;;126334 Blue Jub;;\n")[0].status == "already_done"


def test_set_currency():
    P = plan("a2;set_currency;126334 Blue Jub;11500;USD;hkd;;\na3;set_currency;;;;HKD;;\na1;set_currency;;;;XXX;;\n")
    assert [i.status for i in P] == ["apply", "already_done", "invalid"]


def test_clear_price_only_for_buy_orders():
    P = plan("b1;clear_price;5711/1A-010;5711;EUR;;;\nb2;clear_price;;;;;;\na1;clear_price;;;;;;\n")
    assert [i.status for i in P] == ["apply", "already_done", "invalid"]


def test_duplicate_and_unknown_action():
    P = plan("a1;delete;;;;;;\na1;delete;;;;;;\na2;remove;;;;;;\n")
    assert [i.status for i in P] == ["apply", "duplicate", "invalid"]


def test_expect_columns_are_optional():
    assert plan("a1;delete;;;;;;\n")[0].status == "apply"


def test_comma_file_and_german_numbers():
    rows, err = b.parse_file(b"order_id,action,expect_ws_code,expect_price,expect_currency,new_value\na1,delete,126610LN,\"86.000,00\",HKD,\n")
    assert not err and rows[0].expect_price == 86000.0
    assert b.build_plan(rows, ORDERS, WS, CUR)[0].status == "apply"


def test_file_without_required_columns_is_rejected():
    rows, err = b.parse_file(b"id;aktion\n1;delete\n")
    assert not rows and "Missing columns" in err[0]


def test_bad_number_blocks_the_file():
    rows, err = b.parse_file((HEAD + "a1;delete;126610LN;abc;HKD;;;\n").encode())
    assert err


def test_summary_counts_and_warnings():
    P = plan("a1;delete;126610LN;86000;HKD;;Doppelt: derselbe Händler (gleicher Preis);\n"
             "a2;move;;;;126334 Blue Oys;Variante passt nicht (x);\nzz;delete;;;;;;\n")
    s = b.summarize(P, total_active_orders=1000)
    assert s["apply"] == {"delete": 1, "move": 1, "set_currency": 0, "clear_price": 0}
    assert s["skipped"] == {"not_found": 1} and s["apply_total"] == 2
    assert s["top_reasons"][0]["reason"] in ("Doppelt", "Variante passt nicht")
    assert any("stale" in w for w in s["warnings"])  # 1 of 3 rows no longer fits
    assert b.summarize(P, total_active_orders=1)["warnings"][0].startswith("This file deletes")


# --- endpoints --------------------------------------------------------------

@pytest_asyncio.fixture
async def bf_app(admin_user):
    from beanie import init_beanie
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from mongomock_motor import AsyncMongoMockClient

    import app.services.fx as fx
    from app.api.v1.endpoints import orders_bulk_fix as bf
    from app.core.deps import get_current_admin_user
    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order, OrderType
    from app.models.order_fix import OrderArchive, OrderFixBatch, OrderFixItem
    from app.models.watch import Watch

    fx._cache = None
    client = AsyncMongoMockClient()
    await init_beanie(database=client["bulk_fix_test"], document_models=[
        Order, Watch, FxRate, FxRateHistory, WatchMarketStats, OrderFixBatch, OrderFixItem, OrderArchive])
    for n, (ws, ref) in enumerate([("126610LN", "126610LN"), ("126334 Blue Jub", "126334"),
                                   ("126334 Blue Oys", "126334"), ("5167A", "5167A")]):
        await Watch(brand="Rolex", model=f"M{n}", reference=ref, ws_code=ws, dealer_id="d",
                    serial_number=f"s{n}", status="active").insert()

    async def order(ws, price, cur="HKD", typ=OrderType.SELL):
        o = Order(order_type=typ, brand="Rolex", model="M", reference=ws.split()[0], ws_code=ws,
                  price=price, currency=cur, usd_price=price, country_code="HK", user_id="u",
                  whatsapp_phone="+852")
        await o.insert()
        return str(o.id)

    ids = {
        "wrong": await order("126610LN", 86000),
        "dup": await order("126610LN", 87000),
        "keep": await order("126610LN", 88000),
        "move": await order("126334 Blue Jub", 91000),
        "cur": await order("126334 Blue Jub", 11500, "HKD"),
        "changed": await order("5167A", 300000),
        "wtb": await order("5167A", 5167, "EUR", OrderType.BUY),
    }
    application = FastAPI()
    application.include_router(bf.router, prefix="/orders/admin/bulk-fix")
    application.dependency_overrides[get_current_admin_user] = lambda: admin_user
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://t") as c:
        yield c, ids
    fx._cache = None


def file_for(ids):
    return (HEAD
            + f"{ids['wrong']};delete;126610LN;86000;HKD;;Preis gehört zur Zeile einer anderen Referenz;x\n"
            + f"{ids['dup']};delete;126610LN;87000;HKD;;Doppelt;x\n"
            + f"{ids['move']};move;126334 Blue Jub;91000;HKD;126334 Blue Oys;Variante passt nicht;x\n"
            + f"{ids['cur']};set_currency;126334 Blue Jub;11500;HKD;USD;Währung;x\n"
            + f"{ids['changed']};delete;5167A;290000;HKD;;stale;x\n"
            + f"{ids['wtb']};clear_price;5167A;5167;EUR;;Preis ist die Referenznummer;x\n"
            + "aaaaaaaaaaaaaaaaaaaaaaaa;delete;;;;;gone;x\n").encode("utf-8")


async def _preview(c, ids):
    r = await c.post("/orders/admin/bulk-fix/preview", files={"file": ("fix.csv", file_for(ids), "text/csv")})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_preview_commit_undo(bf_app):
    from app.models.market_stats import WatchMarketStats
    from app.models.order import Order
    from app.models.order_fix import OrderArchive

    c, ids = bf_app
    p = await _preview(c, ids)
    assert p["apply"] == {"delete": 2, "move": 1, "set_currency": 1, "clear_price": 1}
    assert p["skipped"] == {"changed": 1, "not_found": 1}
    assert await Order.find_all().count() == 7  # preview changes nothing
    bid = p["batch_id"]

    r = await c.post(f"/orders/admin/bulk-fix/{bid}/commit", json={"confirm_apply_total": 4})
    assert r.status_code == 400  # wrong confirmation number
    r = await c.post(f"/orders/admin/bulk-fix/{bid}/commit", json={"confirm_apply_total": 5})
    assert r.status_code == 200, r.text
    assert r.json()["done"] == {"delete": 2, "move": 1, "set_currency": 1, "clear_price": 1}
    assert r.json()["failed"] == 0
    assert await Order.get(ids["wrong"]) is None and await Order.get(ids["dup"]) is None
    assert (await Order.get(ids["keep"])).price == 88000
    assert (await Order.get(ids["changed"])).price == 300000
    moved = await Order.get(ids["move"])
    assert moved.ws_code == "126334 Blue Oys" and moved.model == "M2"
    cur = await Order.get(ids["cur"])
    assert cur.currency == "USD" and cur.usd_price == 11500
    wtb = await Order.get(ids["wtb"])
    assert wtb.price is None and wtb.usd_price is None
    assert await OrderArchive.find_all().count() == 2
    # market stats were refreshed for the touched watches
    assert await WatchMarketStats.find_one({"ws_code": "126334 Blue Oys"}) is not None

    r = await c.post(f"/orders/admin/bulk-fix/{bid}/commit", json={"confirm_apply_total": 5})
    assert r.status_code == 409  # a batch runs once

    r = await c.get(f"/orders/admin/bulk-fix/{bid}/skipped.csv")
    assert r.status_code == 200 and "changed" in r.text and "not_found" in r.text
    r = await c.get("/orders/admin/bulk-fix")
    assert r.json()[0]["status"] == "committed"

    r = await c.post(f"/orders/admin/bulk-fix/{bid}/undo")
    assert r.status_code == 200 and r.json() == {"batch_id": bid, "restored": 2, "reverted": 3}, r.text
    assert await Order.find_all().count() == 7
    back = await Order.get(ids["wrong"])
    assert back.price == 86000 and back.ws_code == "126610LN" and back.whatsapp_phone == "+852"
    moved = await Order.get(ids["move"])
    assert moved.ws_code == "126334 Blue Jub" and moved.model == "M"
    assert (await Order.get(ids["cur"])).currency == "HKD"
    assert (await Order.get(ids["wtb"])).price == 5167
    assert (await c.post(f"/orders/admin/bulk-fix/{bid}/undo")).status_code == 409


@pytest.mark.asyncio
async def test_order_changed_between_preview_and_commit_is_left_alone(bf_app):
    from app.models.order import Order

    c, ids = bf_app
    p = await _preview(c, ids)
    o = await Order.get(ids["cur"])
    o.price = 12000
    await o.save()  # the pipeline updated the order in the meantime
    o = await Order.get(ids["wrong"])
    o.price = 85000
    await o.save()
    r = await c.post(f"/orders/admin/bulk-fix/{p['batch_id']}/commit", json={"confirm_apply_total": 5})
    body = r.json()
    assert body["done"]["set_currency"] == 0 and body["done"]["delete"] == 1 and body["failed"] == 2
    assert (await Order.get(ids["cur"])).currency == "HKD"
    assert (await Order.get(ids["wrong"])).price == 85000

    # Undo must not revert what the commit never changed.
    r = await c.post(f"/orders/admin/bulk-fix/{p['batch_id']}/undo")
    assert r.json()["restored"] == 1 and r.json()["reverted"] == 2
    assert (await Order.get(ids["cur"])).price == 12000


@pytest.mark.asyncio
async def test_undo_leaves_an_order_edited_after_commit(bf_app):
    from app.models.order import Order

    c, ids = bf_app
    p = await _preview(c, ids)
    await c.post(f"/orders/admin/bulk-fix/{p['batch_id']}/commit", json={"confirm_apply_total": 5})
    o = await Order.get(ids["cur"])
    o.price = 13000
    await o.save()  # a newer message changed it after the fix
    r = await c.post(f"/orders/admin/bulk-fix/{p['batch_id']}/undo")
    assert r.json()["reverted"] == 2
    o = await Order.get(ids["cur"])
    assert o.price == 13000 and o.currency == "USD"


@pytest.mark.asyncio
async def test_bad_file_is_rejected(bf_app):
    c, _ = bf_app
    r = await c.post("/orders/admin/bulk-fix/preview", files={"file": ("x.csv", b"id;aktion\n1;delete\n", "text/csv")})
    assert r.status_code == 400 and "Missing columns" in r.text
