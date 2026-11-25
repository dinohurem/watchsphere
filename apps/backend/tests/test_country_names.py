"""Country names: always the full name, only UAE and UK are short forms."""
import pytest
import pytest_asyncio

from app.core.countries import COUNTRY_NAMES, canonical_country_code, country_display_name


@pytest.mark.parametrize("code,name", [
    ("CN", "China"), ("MO", "Macau"), ("VN", "Vietnam"), ("IL", "Israel"), ("JO", "Jordan"),
    ("FI", "Finland"), ("HR", "Croatia"), ("CH", "Switzerland"), ("AE", "UAE"), ("GB", "UK"),
    ("US", "United States"), ("HK", "Hong Kong"), ("MY", "Malaysia"), ("IT", "Italy"),
    ("DE", "Germany"), ("SG", "Singapore"), ("TW", "Taiwan"), ("KR", "South Korea"),
])
def test_mapping(code, name):
    assert country_display_name(code) == name


def test_aliases_and_case():
    assert country_display_name("uk") == "UK"
    assert country_display_name("UAE") == "UAE"
    assert country_display_name("USA") == "United States"
    assert canonical_country_code(" gb ") == "GB"
    assert country_display_name("") is None and country_display_name(None) is None
    assert country_display_name("ZZ") is None


def test_complete_iso_list_and_no_code_names():
    assert len([c for c in COUNTRY_NAMES if c != "XK"]) == 249
    assert all(len(c) == 2 for c in COUNTRY_NAMES)
    assert all(n != c for c, n in COUNTRY_NAMES.items())
    assert all(len(n) > 3 for c, n in COUNTRY_NAMES.items() if c not in ("AE", "GB"))
    short = {c for c, n in COUNTRY_NAMES.items() if n in ("UAE", "UK")}
    assert short == {"AE", "GB"}


def test_order_model_fills_full_name():
    from app.models.order import Order

    o = Order(order_type="sell", brand="Rolex", model="M", reference="1", country_code="CN",
              country_name="CN", user_id="u", raw_text="x")
    assert o.country_name == "China"
    o = Order(order_type="sell", brand="Rolex", model="M", reference="1", country_code="UK",
              user_id="u", raw_text="x")
    assert o.country_name == "UK"


@pytest_asyncio.fixture
async def orders_db():
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.order import Order

    client = AsyncMongoMockClient()
    await init_beanie(database=client["country_names_test"], document_models=[Order])
    coll = Order.get_motor_collection()
    base = {"order_type": "sell", "brand": "Rolex", "model": "M", "reference": "1",
            "user_id": "u", "raw_text": "x"}
    rows = [("CN", "CN")] * 3 + [("MO", "MO"), ("CH", ""), ("CH", None), ("HK", "Hong Kong"),
                                 ("AE", "United Arab Emirates"), ("GB", "United Kingdom"),
                                 ("ZZ", "Zedland")]
    await coll.insert_many([{**base, "country_code": c, "country_name": n} for c, n in rows])
    return coll


@pytest.mark.asyncio
async def test_backfill_dry_run_writes_nothing(orders_db):
    from app.services.country_backfill import fix_order_country_names

    r = await fix_order_country_names(dry_run=True)
    assert r["dry_run"] is True and r["orders_updated"] == 0
    assert r["orders_scanned"] == 10 and r["orders_to_fix"] == 8
    assert r["per_code"]["CN"] == {"after": "China", "count": 3, "before": {"CN": 3}}
    assert r["per_code"]["MO"]["after"] == "Macau"
    assert r["per_code"]["CH"]["count"] == 2 and r["per_code"]["CH"]["after"] == "Switzerland"
    assert r["per_code"]["AE"]["after"] == "UAE" and r["per_code"]["GB"]["after"] == "UK"
    assert "HK" not in r["per_code"]
    assert r["unknown_codes"] == {"ZZ": 1}
    assert await orders_db.count_documents({"country_name": "CN"}) == 3  # untouched


@pytest.mark.asyncio
async def test_backfill_applies_and_is_idempotent(orders_db):
    from app.services.country_backfill import fix_order_country_names

    r = await fix_order_country_names(dry_run=False)
    assert r["orders_updated"] == 8
    assert await orders_db.count_documents({"country_name": "China"}) == 3
    assert await orders_db.count_documents({"country_code": "CH", "country_name": "Switzerland"}) == 2
    assert await orders_db.count_documents({"country_name": "Zedland"}) == 1
    again = await fix_order_country_names(dry_run=True)
    assert again["orders_to_fix"] == 0
