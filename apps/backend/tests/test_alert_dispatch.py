"""Alert matching rules, legacy migration and push text formatting (redesign v3 §8, §11)."""

from types import SimpleNamespace as NS

import pytest

from app.services import alert_dispatch as ad

RATES = {"USD": 1.0, "EUR": 0.9, "HKD": 7.8, "GBP": 0.8, "CHF": 0.88}


def alert(**kw):
    base = dict(ws_code="5811/1G", alert_type="wts", year_mode="any", year=None, month=None,
                condition="any", locations=[], price_mode="any", price_amount=None,
                currency="EUR", is_active=True)
    base.update(kw)
    return NS(**base)


def order(**kw):
    base = dict(id="o1", ws_code="5811/1G", order_type="sell", year=2023, watch_month=None,
                year_raw=None, condition="Used", condition_raw="Used", country_code="HK",
                country_name="Hong Kong", price=1_428_000, currency="HKD", usd_price=None,
                whatsapp_phone="+85291234567", reference="5811/1G", brand="Patek Philippe",
                model="Nautilus", watch_id=None, user_id="dealer")
    base.update(kw)
    return NS(**base)


# --- type -----------------------------------------------------------------------------------

def test_type_must_match():
    assert ad.alert_matches(alert(alert_type="wts"), order(order_type="sell"))
    assert not ad.alert_matches(alert(alert_type="wtb"), order(order_type="sell"))
    assert ad.alert_matches(alert(alert_type="wtb"), order(order_type="buy", price=None))


def test_inactive_or_other_watch_never_matches():
    assert not ad.alert_matches(alert(is_active=False), order())
    assert not ad.alert_matches(alert(ws_code="126610LN"), order())


# --- year -----------------------------------------------------------------------------------

@pytest.mark.parametrize("mode,year,month,oy,om,expected", [
    ("any", None, None, None, None, True),
    ("newer", 2022, None, 2022, None, True),     # inclusive: "2022+"
    ("newer", 2022, None, 2021, 12, False),
    ("newer", 2022, 6, 2022, 5, False),
    ("newer", 2022, 6, 2022, 7, True),
    ("newer", 2022, 6, 2022, None, True),         # listing without month: year only
    ("exactly", 2023, None, 2023, 4, True),
    ("exactly", 2023, 11, 2023, 4, False),
    ("exactly", 2023, 11, 2023, 11, True),
    ("exactly", 2023, None, 2024, None, False),
    ("older", 2020, None, 2020, None, True),
    ("older", 2020, None, 2021, None, False),
    ("older", 2020, 3, 2020, 2, True),
    ("newer", 2022, None, None, None, False),     # no card date → no match
])
def test_year_rule(mode, year, month, oy, om, expected):
    assert ad.year_matches(mode, year, month, oy, om) is expected


def test_year_falls_back_to_year_raw():
    o = order(year=None, year_raw="2022+")
    assert ad.order_year_month(o) == (2022, None)
    o = order(year=None, year_raw="11/2023")
    assert ad.order_year_month(o) == (2023, 11)
    assert ad.alert_matches(alert(year_mode="newer", year=2022), order(year=None, year_raw="2024+"))


# --- condition ------------------------------------------------------------------------------

def test_condition_rule():
    assert ad.alert_matches(alert(condition="used"), order(condition="Used"))
    assert not ad.alert_matches(alert(condition="unworn"), order(condition="Used"))
    assert ad.alert_matches(alert(condition="unworn"), order(condition="Unworn", condition_raw=None))
    # WTB without any condition text has no condition → only "any" matches
    wtb = order(order_type="buy", condition="Unworn", condition_raw=None, price=None)
    assert ad.order_condition(wtb) is None
    assert ad.alert_matches(alert(alert_type="wtb"), wtb)
    assert not ad.alert_matches(alert(alert_type="wtb", condition="unworn"), wtb)


# --- location -------------------------------------------------------------------------------

def test_locations_worldwide_and_list():
    assert ad.location_matches([], "HK")
    assert ad.location_matches(["HK", "AE"], "hk")
    assert not ad.location_matches(["AE"], "HK")


def test_locations_eu_set():
    assert ad.location_matches(["EU"], "DE")
    assert ad.location_matches(["EU"], "IT")
    assert not ad.location_matches(["EU"], "CH")   # Switzerland is not in the EU
    assert not ad.location_matches(["EU"], "UK")
    assert ad.location_matches(["EU", "HK"], "HK")


def test_locations_uk_gb_uae_aliases():
    assert ad.location_matches(["GB"], "UK")
    assert ad.location_matches(["UK"], "GB")
    assert ad.location_matches(["AE"], "UAE")
    assert ad.normalize_locations(["gb", "EU", "eu", "UAE"]) == ["UK", "EU", "AE"]


# --- price ----------------------------------------------------------------------------------

def test_price_any_matches_without_price():
    assert ad.alert_matches(alert(alert_type="wtb"), order(order_type="buy", price=None))


def test_wts_max_with_conversion():
    # 1.428.000 HKD = 183.077 USD = 164.769 EUR
    o = order(price=1_428_000, currency="HKD")
    assert ad.alert_matches(alert(price_mode="max", price_amount=165_000, currency="EUR"), o, RATES)
    assert not ad.alert_matches(alert(price_mode="max", price_amount=160_000, currency="EUR"), o, RATES)


def test_wts_max_needs_price_and_rates():
    assert not ad.alert_matches(alert(price_mode="max", price_amount=1e9), order(price=None), RATES)
    # no rate for HKD → cannot compare → no match
    assert not ad.alert_matches(alert(price_mode="max", price_amount=1e9, currency="EUR"),
                                order(currency="HKD"), {"USD": 1.0, "EUR": 0.9})
    # same currency needs no rates
    assert ad.alert_matches(alert(price_mode="max", price_amount=1_500_000, currency="HKD"),
                            order(currency="HKD"), None)


def test_wts_max_uses_usd_price_when_currency_unknown():
    o = order(price=100_000, currency="XYZ", usd_price=100_000)
    assert ad.alert_matches(alert(price_mode="max", price_amount=95_000, currency="EUR"), o, RATES)


def test_wtb_min_rule():
    wtb = dict(order_type="buy", condition_raw=None)
    a = alert(alert_type="wtb", price_mode="min", price_amount=150_000, currency="EUR")
    # 1.350.000 HKD / 7.8 * 0.9 = 155.769 EUR ≥ 150.000 → match
    assert ad.convert(1_350_000, "HKD", "EUR", RATES) == pytest.approx(155_769.23, rel=1e-6)
    assert ad.alert_matches(a, order(price=1_350_000, currency="HKD", **wtb), RATES)
    assert not ad.alert_matches(a, order(price=1_000_000, currency="HKD", **wtb), RATES)


def test_wtb_min_rule_values():
    wtb = dict(order_type="buy", condition_raw=None)
    a = alert(alert_type="wtb", price_mode="min", price_amount=150_000, currency="EUR", condition="any")
    assert ad.price_matches("min", 150_000, "EUR", order(price=1_350_000, currency="HKD", **wtb), RATES)
    assert not ad.price_matches("min", 160_000, "EUR", order(price=1_350_000, currency="HKD", **wtb), RATES)
    # WTB without a target never satisfies "only with a target price"
    assert not ad.price_matches("min", 1, "EUR", order(price=None, **wtb), RATES)
    assert a.price_mode == "min"


def test_usdt_is_usd():
    assert ad.convert(100, "USDT", "USD", {}) == 100
    assert ad.convert(100, "USDT", "EUR", RATES) == pytest.approx(90)


# --- legacy migration -----------------------------------------------------------------------

def test_legacy_both_types_split():
    legacy = NS(notify_wts=True, notify_wtb=True, target_year=2022, target_month=None,
                year_direction="newer", condition="unworn", locations=["gb"],
                price_threshold=150000, price_direction="below", currency="EUR")
    shapes = ad.legacy_to_new(legacy)
    assert [s["alert_type"] for s in shapes] == ["wts", "wtb"]
    assert shapes[0]["price_mode"] == "max" and shapes[0]["price_amount"] == 150000
    assert shapes[1]["price_mode"] == "any" and shapes[1]["price_amount"] is None
    assert all(s["year_mode"] == "newer" and s["year"] == 2022 for s in shapes)
    assert shapes[0]["locations"] == ["UK"]


def test_legacy_single_type_and_no_year():
    legacy = NS(notify_wts=False, notify_wtb=True, target_year=None, target_month=None,
                year_direction="exactly", condition="any", locations=[],
                price_threshold=100000, price_direction="above", currency="USD")
    shapes = ad.legacy_to_new(legacy)
    assert len(shapes) == 1
    s = shapes[0]
    assert s["alert_type"] == "wtb" and s["year_mode"] == "any" and s["year"] is None
    assert s["price_mode"] == "min" and s["currency"] == "USD"


# --- formatting -----------------------------------------------------------------------------

def test_format_price():
    assert ad.format_price(1_428_000, "HKD") == "1.428.000 HKD"
    assert ad.format_price(100_000, "EUR") == "100.000€"
    assert ad.format_price(90_000.4, "GBP") == "90.000£"
    assert ad.format_price(110_000, "USDT") == "110.000$"
    assert ad.format_price(None, "EUR") == "/"


def test_push_single_wts():
    o = order()
    data = ad.build_activity_data("wts", "5811/1G", [o])
    title, body = ad.push_texts(data)
    assert title == "New WTS · 5811/1G"
    assert body == "🇭🇰 Hong Kong · 2023 · Used\nPrice: 1.428.000 HKD"
    assert data["count"] == 1 and data["order_ids"] == ["o1"]
    assert data["year_plus"] is False and data["condition"] == "Used"


def test_push_bundled_shows_cheapest_and_more():
    a = order(id="a", price=1_600_000, currency="HKD")
    b = order(id="b", price=170_000, currency="EUR", country_code="DE", country_name="Germany",
              year=2024, condition="Unworn", condition_raw=None)
    c = order(id="c", price=None)
    data = ad.build_activity_data("wts", "126518LN Pikachu", [a, b, c], rates=RATES)
    title, body = ad.push_texts(data)
    # 1.600.000 HKD ≈ 205.128 USD, 170.000 EUR ≈ 188.889 USD → EUR listing is cheapest
    assert title == "3 new WTS · 126518LN Pikachu"
    assert body == "🇩🇪 Germany · 2024 · Unworn\nPrice: 170.000€ · +2 more"
    assert data["order_ids"][0] == "b" and set(data["order_ids"]) == {"a", "b", "c"}


def test_push_wtb_year_plus_and_target():
    o = order(order_type="buy", year=2025, condition="Unworn", condition_raw="Unworn only",
              price=1_350_000)
    data = ad.build_activity_data("wtb", "5712/1R", [o])
    title, body = ad.push_texts(data)
    assert title == "New WTB · 5712/1R"
    assert body == "🇭🇰 Hong Kong · 2025+ · Unworn\nTarget: 1.350.000 HKD"
    assert data["year_plus"] is True


def test_push_wtb_no_target_no_year_no_condition():
    o = order(order_type="buy", year=None, year_raw=None, condition="Unworn", condition_raw=None,
              price=None, country_code="UK", country_name=None)
    data = ad.build_activity_data("wtb", "5712/1R", [o])
    _, body = ad.push_texts(data)
    assert body == "🇬🇧 United Kingdom\nTarget: /"
    assert data["condition"] is None and data["year"] is None and data["price"] is None


def test_push_payload_strings():
    data = ad.build_activity_data("wts", "5811/1G", [order(id="x"), order(id="y", price=2_000_000)])
    p = ad.push_payload(data)
    assert p == {"type": "alert_match", "ws_code": "5811/1G", "watch_id": "",
                 "order_ids": "x,y", "kind": "wts"}
    assert all(isinstance(v, str) for v in p.values())


def test_flag_emoji():
    assert ad.flag_emoji("HK") == "🇭🇰"
    assert ad.flag_emoji("UK") == "🇬🇧"
    assert ad.flag_emoji("UAE") == "🇦🇪"
    assert ad.flag_emoji("") == ""


# --- end to end against the Mongo stub ----------------------------------------------------

@pytest.mark.asyncio
async def test_dispatch_bundles_per_user_watch_and_respects_toggles(monkeypatch):
    from beanie import init_beanie
    from mongomock_motor import AsyncMongoMockClient

    from app.models.notification import Notification
    from app.models.order import Order, OrderType, OrderCondition
    from app.models.user import User
    from app.models.watch import Watch, WatchStatus
    from app.models.watch_alert import WatchAlert

    client = AsyncMongoMockClient()
    await init_beanie(database=client["alert_dispatch_test"],
                      document_models=[Notification, Order, User, Watch, WatchAlert])

    pushes = []

    async def fake_push(user, title, body, data=None, notification_type=None, category_id=None):
        pushes.append({"user": str(user.id), "title": title, "body": body, "data": data,
                       "category_id": category_id})
        return {"success_count": 1, "failure_count": 0}

    monkeypatch.setattr("app.services.notifications.send_push_to_user", fake_push)

    async def fake_rates():
        return RATES

    monkeypatch.setattr(ad, "_load_rates", fake_rates)

    # usernames set only because mongomock ignores the partial filter on the unique index
    alice = User(email="a@x.io", name="A", approved=True, username="a")
    bob = User(email="b@x.io", name="B", approved=True, notify_alert_matches=False, username="b")
    pending = User(email="p@x.io", name="P", approved=False, username="p")
    dealer = User(email="d@x.io", name="D", approved=True, whatsapp_phone="+85290000000",
                  username="d")
    for u in (alice, bob, pending, dealer):
        await u.insert()
    await Watch(brand="Patek Philippe", model="Nautilus", reference="5811/1G", ws_code="5811/1G",
                dealer_id="x", status=WatchStatus.ACTIVE, cover_image_thumbnail="t.webp").insert()

    for u in (alice, bob, pending):
        await WatchAlert(user_id=str(u.id), ws_code="5811/1G", alert_type="wts").insert()
    # legacy alert for alice on WTB, migrated lazily
    await WatchAlert(user_id=str(alice.id), ws_code="5811/1G", notify_wts=False, notify_wtb=True,
                     condition="any").insert()

    def mk(order_type, price, currency, country="HK"):
        return Order(order_type=order_type, brand="Patek Philippe", model="Nautilus",
                     reference="5811/1G", ws_code="5811/1G", price=price, currency=currency,
                     condition=OrderCondition.USED, condition_raw="Used", country_code=country,
                     country_name=None, user_id=str(dealer.id), year=2023)

    o1, o2, o3 = mk(OrderType.SELL, 1_600_000, "HKD"), mk(OrderType.SELL, 170_000, "EUR", "DE"), \
        mk(OrderType.BUY, None, "EUR")
    for o in (o1, o2, o3):
        await o.insert()

    created = await ad.dispatch_new_listings([str(o1.id), str(o2.id), str(o3.id), "bogus"])
    assert created == 2  # alice: one WTS bundle + one WTB; bob toggled off; pending skipped

    notes = await Notification.find(Notification.user_id == str(alice.id)).to_list()
    by_kind = {n.data["kind"]: n for n in notes}
    wts = by_kind["wts"]
    assert wts.type.value == "alert_match"
    assert wts.title == "2 new WTS · 5811/1G"
    assert wts.body == "🇩🇪 Germany · 2023 · Used\nPrice: 170.000€ · +1 more"
    assert wts.data["count"] == 2 and wts.data["order_ids"][0] == str(o2.id)
    assert wts.data["thumbnail"] == "t.webp" and wts.data["dealer_phone"] == "+85290000000"
    assert by_kind["wtb"].body == "🇭🇰 Hong Kong · 2023+ · Used\nTarget: /"

    assert len(pushes) == 2
    for p in pushes:
        bundled = "," in p["data"]["order_ids"]
        assert p["category_id"] == ("alert_match_multi" if bundled else "alert_match")
    assert {p["category_id"] for p in pushes} == {"alert_match", "alert_match_multi"}
    assert {p["data"]["kind"] for p in pushes} == {"wts", "wtb"}
    assert pushes[0]["data"]["type"] == "alert_match"

    # the legacy alert was converted in place
    legacy = await WatchAlert.find(WatchAlert.user_id == str(alice.id),
                                   WatchAlert.alert_type == "wtb").to_list()
    assert len(legacy) == 1 and legacy[0].notify_wtb is None
