"""Every case below is a real dealer message (or line) from the WhatsApp exports of 13-22 Nov 2026,
together with what went wrong in production and what the correct result is."""
import sys, os
from datetime import datetime, timedelta
import pytest

from app.services.ws_quality.normalize import clean, strip_invisible
from app.services.ws_quality.prices import parse_price, message_currency
from app.services.ws_quality.classify import post_type, split_sections, is_advert, is_part_or_accessory
from app.services.ws_quality.wtb import parse_wtb_line
from app.services.ws_quality.evidence import watch_forms, names_watch, reference_tokens
from app.services.ws_quality import guard, lifecycle, variants, classify

ZW = chr(0x200C)        # zero width non-joiner
MVS = chr(0x180E)       # Mongolian vowel separator (not in the server's strip list)
NBH = chr(0x2011)       # non-breaking hyphen


# ---------------------------------------------------------------- normalisation
def test_invisible_characters_inside_references():
    assert clean(f"520{ZW}7G - _USE{ZW}D_ Condition") == "5207G - _USED_ Condition"
    assert clean(f"PATEK 5961R - NEW 05/2026 1.1{MVS}M HKD") == "PATEK 5961R - NEW 05/2026 1.1M HKD"
    assert clean(f"336k us{MVS}dt") == "336k usdt"
    assert clean(f"4300V/220G{NBH}H151") == "4300V/220G-H151"


@pytest.mark.parametrize("raw,expected", [
    ("1'480'000 hkd", "1480000 hkd"),
    ("€11.300,- + label", "€11.300 + label"),
    ("41.777,-€", "41.777€"),
    ("AED-74,500/-", "AED-74,500"),
    ("HKD 1.08mil", "HKD 1.08m"),
])
def test_number_notations(raw, expected):
    assert clean(raw) == expected


# ---------------------------------------------------------------- prices
@pytest.mark.parametrize("line,country,refs,amount,currency", [
    # production stored 12,000 HKD: the date after "hkd" was read as the price
    ("15210st blue, 160000 hkd 12/2025", "IT", ["15210st"], 160000, "HKD"),
    # production stored 7,000 HKD
    ("26601NR $1,500,000hkd 7/2026", "HK", ["26601NR"], 1500000, "HKD"),
    # production stored 9,000 HKD: apostrophes as thousands separators
    ("26670st blue tourbillon, 1'480'000 hkd 09/2026", "IT", ["26670st"], 1480000, "HKD"),
    # European notations
    ("Rolex Datejust 36 | Wimbledon | 126234 | €11.300,- + label", "NL", ["126234"], 11300, "EUR"),
    ("126300 Rhodium 41.777,-€", "DE", ["126300"], 41777, "EUR"),
    ("Tudor Black Bay 58 euro 6.300", "DE", [], 6300, "EUR"),
    ("5270p-014 green dial like new 06/25 Full set 138k euro", "IT", ["5270p-014"], 138000, "EUR"),
    ("Datejust 278274, new 2026, full set, 12.8k + ship", "IT", ["278274"], 12800, "EUR"),
    ("Rolex Day Date 18338 | Watch only | 21500,-", "DE", ["18338"], 21500, "EUR"),
    ("Price: €21,500.00 (EUR)", "IT", [], 21500, "EUR"),
    # '$' from a UK / UAE number was stored as GBP / USD although the list is HK stock
    ("PP 5712/1A Used 2020 Year / 130.000$", "UK", ["5712/1A"], 130000, "USD"),
    # USD / USDT must never become HKD
    ("rm65-01 ntpt 305k usdt", "HK", ["rm65-01"], 305000, "USD"),
    ("RM67-02 Italy 2023 - 420.000usdt", "HK", ["RM67-02"], 420000, "USD"),
    ("5167A 2025yr 83000usdt", "DE", ["5167A"], 83000, "USD"),
    ("15245or n7 169k u", "HK", ["15245or"], 169000, "USD"),
    # the usual Hong Kong formats keep working
    ("126613LN N6 150K", "HK", ["126613LN"], 150000, "HKD"),
    ("5968A N2 1.17m hkd", "HK", ["5968A"], 1170000, "HKD"),
    ("126334G Black Jub N12 138,000", "HK", ["126334G"], 138000, "HKD"),
    ("116610LV 2017y 144000HKD", "HK", ["116610LV"], 144000, "HKD"),
    ("4/26 Hkd 968k", "HK", [], 968000, "HKD"),
    ("N4,1.475M hkd", "HK", [], 1475000, "HKD"),
    ("5935A-N10-395k hkd", "HK", ["5935A"], 395000, "HKD"),
    ("26240BA.OO.1320BA.01 2023Y HKD1.10M", "HK", ["26240BA"], 1100000, "HKD"),
    ("126334 Wim Jub 11 HKD121500", "HK", ["126334"], 121500, "HKD"),
    ("26660BC.ZZ.1356BC.01  2024. 2.18m", "HK", ["26660BC"], 2180000, "HKD"),
    ("97w人民币", "CN", [], 970000, "CNY"),
    # retail price in brackets is not the asking price
    ("PFC914-1020001 Black Grey 2026 N10,HKD 150280 (Retail 221000 -32%)", "HK", ["PFC914-1020001"], 150280, "HKD"),
    # discount notation: list price minus x % (production stored the list price)
    ("WJPN0091 | HKD261,000-20% | 5/2026", "HK", ["WJPN0091"], 208800, "HKD"),
    # dual currency: amount and currency always come from the same token
    ("26715st ice blue 2026N1 67.4k USDT // 525k HKD", "HK", ["26715st"], 525000, "HKD"),
    # production stored 450,000 AED: "aed" belongs to the number before it, not to the next one
    ("126518yml 2024 used 212000aed 450000hkd", "HK", ["126518yml"], 450000, "HKD"),
    ("127334 white 11$168000", "HK", ["127334"], 168000, "HKD"),
    ("5072R-001 20y hkd1.452m/187000usdt", "CN", ["5072R-001"], 1452000, "HKD"),
    ("126613LN | AED-74,500/- | USD- 20,300/-", "AE", ["126613LN"], 20300, "USD"),   # two currencies quoted: the sender's default one is kept
])
def test_parse_price(line, country, refs, amount, currency):
    p = parse_price(line, country, None, refs)
    assert (p.amount, p.currency) == (amount, currency)


@pytest.mark.parametrize("line,refs", [
    # production: buy request at HKD 126,518 / offer at HKD 228,235 - the reference was read as price
    ("Looking for 126518 black N10-N11", ["126518"]),
    ("124208 N9/2026 Wood card", ["124208"]),
    # accessories and parts never carry a watch price
    ("Ap x Swatch -LAN BA with strap- new full set 750+", []),
])
def test_no_price(line, refs):
    assert parse_price(line, "HK", None, refs).amount is None


def test_reference_is_never_the_price():
    assert parse_price("228235 white rom w11 448k", "HK", None, ["228235"]).amount == 448000     # production stored 228,235
    assert parse_price("134300 green n10 74000 new card unadj", "HK", None, ["134300"]).amount == 74000   # production stored 134,300


def test_context_currency_for_foreign_numbers():
    # UK number posting a Hong Kong stock list: production stored GBP
    msg = "Super starshine\nRolex HK Stock\n124060 N11 95k\n126000 Multicolour W11 96K"
    ctx = message_currency(msg, "UK")
    assert ctx == "HKD"
    assert parse_price("124060 N11 95k", "UK", ctx, ["124060"])[:2] == (95000, "HKD")
    # UAE number, "TSW HK STOCK ... $730k": production stored USD (7.8x too expensive)
    ctx = message_currency("TSW HK STOCK 19/11/2026\n228348A Pave N10/26 $730k", "AE")
    assert parse_price("228348A Pave N10/26 $730k", "AE", ctx, ["228348A"])[:2] == (730000, "HKD")
    assert message_currency("126334 2025 €12.500\n126234 €11150", "IT") == "EUR"
    assert message_currency("126610ln n11 109000", "MY", group_name="HK Watch Trading & Deal Community") == "HKD"


def test_shorthand_is_flagged():
    p = parse_price("5269/200R. White. 2024. | 890 HKD", "HK", None, ["5269/200R"])
    assert p.how == "shorthand"          # 890 -> 890,000: only acceptable if the guard finds it inside the price band


# ---------------------------------------------------------------- WTS / WTB classification
@pytest.mark.parametrize("msg", [
    # European single-watch posts: none of these was recognised as an offer by detect_post_type
    "Rolex Datejust 36 ref.126234 year 2022 palm dial like new partial stickers 11.500€ Bh / wired + invoice.",
    "Rolex Oyster Perpetual 36mm\nRef: 126000\nYear: 12/25\nCond: NEW\n\nFull Set - 8.000€",
    "Tudor Black Bay 58, 7939A1A0NU, UNWORN, 2026, Full Set. 4700€",
    "Datejust 278274, new 2026, full set, 12.8k + ship",
    "Cartier Santos Large Titanium\nRef: WSSA0089\nYear: 2026\nCond: NEW\nFULL SET - 9.700€",
    "Submariner Date // Black Dual Tone // Brand new 2026 // Ready Dubai. 126613LN\nAED-74,500/-\nUSD- 20,300/-",
    "5168G-010 Green n10/26 hk827k",
    # list without any keyword
    "*AP*\n26238ce n25 545.000hk\n26240st green 50th n22 457.000hk\n26660st purple used good 2024 1.38m hk",
    # decorative header on a seller's list
    "Looking for USDT pay HKD cash\n5711/1A blue 2020 1.03m\n5712/1A 2019 980k\n5167A 2021 600k\n5164A 2019 750k\n5980/1A 2018 900k",
    "Looking to buy USDT, pay HKD cash\n-----\nPatek Philipe 5524R likenew 11/2026\n288,000hkd or 36,800usdt",
])
def test_is_wts(msg):
    assert post_type(msg) == "WTS"


@pytest.mark.parametrize("msg", [
    "Looking for 5968a 2021+ full set",
    "Looking For // Wtb // Ntq\n\n5261R\n\n7+ // 2026",
    ">>> Looking for sold order <<<\n5227R , need new in 2026\n5227G salmon , need new in 2026",
    "WTB 126613LN N11 full set",
    f"WTB / NTQ / LOOKING FOR\n\n507{ZW}4P - _USED_ Condition\nIf you have one, please DM",
    "NTQ | 5980/1400G | Any year",
    "Ltb AP 26331ST.OO.1220ST.03 like new and not older than 2020.",
    "Suche 126710BLRO 2023 fullset",
    "Looking 126710blnr- new /full set",
])
def test_is_wtb(msg):
    assert post_type(msg) == "WTB"


@pytest.mark.parametrize("msg", [
    # "need export", "need service", "needs a polish" are remarks on a sale line, not buy requests
    "Patek Philippe\n5990/1A blue 2025 new HKD1.20m\n5231G 2026/7 new HKD798k (NEED EXPORT)\nBrand new 5930P-001 Green 2026/9 FULLSET HKD615k NEED EXPORT\n5296R HKD210k",
    "Need to contact me\nPP used fullset\n5146J-001 2018y HKD220K\n5146R-001 2018y HKD230K\n5147G-001 2019y HKD262K",
    "Datejust 6917, used 1982, need service, full set, 3.8k + ship",
    "Cartier Santos WSSA0061 used, needs a polish. Card, new leather strap, links, pouch. 5900€ + shipping",
    "Audemars Piguet\n15068BB nak hkd68k\n15159BC nak hkd337k\n15159OR 12y hkd392k\nplease contact me if you need other watch models.",
    "PP 5968G-010\n2023 used looking new\nfull set in DXB\n118K USDT",
    "26545XT.OO.1240XT.01\nEXTRA-THIN SELFWINDING FLYING TOURBILLON CHRONOGRAPH\nLimited 150 pieces New 2026\n$890k USD need Safe sale",
    "126234 fresh new full stickers 11.450 full set shipped",
    # tab separated list: the last number is the price, not a second reference
    "2026/11/12\nROLEX\n124208 blk wo-cr\t09/2026\t286000\n126200 blk jub wo-cr\t11/2026\t77500\n126231 choco jub\t10/2026\t143000",
])
def test_sale_lines_with_weak_words_stay_wts(msg):
    assert post_type(msg) == "WTS"


@pytest.mark.parametrize("msg", [
    "SOLD ORDER  -  Land dweller 36mm steel - 127234 - 100% new - can buy AED 63,000",
    "Need patek 3900",
    "Need Buy : 7010r Purple",
    "WTB daytona 126518 tiffany new/like new full set 25/26 target 80k",
    "5261R looking for, 2026 new",
    "Looking for\nAlange 425.050",
    "Looking for Gerald Genta Mickey Mouse in 36mm.",
    "Confirm order\n15551St blue\n2026 new\n$410000 HKD can confirm",
])
def test_buy_requests_with_weak_or_trailing_words(msg):
    assert post_type(msg) == "WTB"


def test_own_stock_after_a_looking_for_line():
    msg = ("Looking for 116598 leopard print naked\nRM\nRM07-01 black cera side diamond black lipN5 FULL SET 340k USDT\n"
           "RM037 WG SNOW RED LIPN9 FULL SET 290k HKD\nRM74-02 NTPT N9  FULL 490k HKD\n15416cb white ceramic 2025y 750k usdt")
    sections = dict(split_sections(msg))
    assert sections["WTB"].strip().startswith("Looking for 116598") and "340k" not in sections["WTB"]
    assert "RM037" in sections["WTS"] and "750k usdt" in sections["WTS"]


def test_own_stock_in_two_line_format_after_a_buying_remark():
    msg = ("Queen's Success Watches\nBrand New Without Box - HKD\nLooking to purchase Rolex at good prices for stock.\n"
           "124200 Beige N11\n$59K\n126000 Multicolour W11\n$96K\n336933 black jub 205,000 N11 wood card\n15551ST Ice Blue N4 $530000")
    sections = dict(split_sections(msg))
    assert "124200" in sections["WTS"] and "$59K" in sections["WTS"] and "336933" in sections["WTS"] and "15551ST" in sections["WTS"]
    assert "124200" not in sections.get("WTB", "")


def test_sale_list_with_one_looking_for_line():
    # production: all 48 lines of this "On sales" list became buy requests with prices
    msg = "On sales\n228238 green roman 493,000 n10\n126503g black 214,000 n9\n124060 96,500 n10\n126610ln 106,000 n9\nLooking for 126518 black"
    sections = split_sections(msg)
    assert [m for m, _ in sections] == ["WTS", "WTB"]
    assert "126518" in sections[1][1] and "493,000" in sections[0][1]


def test_mixed_message_is_split():
    msg = ("Looking for \n126234g blk jub N11\n279174 white Roma jub N11\n\nRolex ready hk :\n"
           "126283vixi green jub N10 215k\n126000 candy pink N11 77.5k\n134300 pistachio N10 75k")
    sections = dict(split_sections(msg))
    assert "126234g" in sections["WTB"] and "215k" not in sections["WTB"]
    assert "126283vixi" in sections["WTS"]


def test_wtb_first_line_then_own_stock():
    msg = "Looking for 5990/1r 26y/N11\n326939 white roma naked HKD:210000\n326935 grey 2023 HKD:348000\n326934 white oys 2018 HKD:118000"
    sections = dict(split_sections(msg))
    assert sections["WTB"].strip() == "Looking for 5990/1r 26y/N11"
    assert "326939" in sections["WTS"]


@pytest.mark.parametrize("msg", [
    "TOO MUCH NOISE.\nTOO LITTLE SIGNAL.\nSame ref.\nDifferent comps.\nNo clear range.\nThe advantage goes to dealers with a clean market lens.",
    "HERE'S WHY YOUR MARKET FEEL IS OFF\nBecause WhatsApp shows fragments, not the whole picture.\nModern dealers trade with a real market screen.",
    "Good morning brothers",
    "Looking for USDT paying HKD cash",
    "Looking for\nNew",
    "ALWAYS ONLINE = STILL LATE\nWork less on WhatsApp, win more on deals with Time Dealer:\nSpot profitable deals earlier and move before others do",
])
def test_neither(msg):
    assert post_type(msg) is None


def test_list_with_promo_line_is_kept():
    msg = "Updated on 16-NOV-2026\nRolex.PP.AP.RM Serial Check Service\n128348A ombre green n11 $557k\n336239 wht n6 $275k\n336934 blk oys n7 $154.5k"
    assert post_type(msg) == "WTS"


def test_parts():
    assert is_part_or_accessory("Patek Philippe Watch Winder  6500HKD")
    assert is_part_or_accessory("Ap x Swatch -LAN BA with strap- new full set 750+")
    assert not is_part_or_accessory("5712/1A blue 2021 used full set $1050000hkd")


# ---------------------------------------------------------------- WTB fields
def test_wtb_fields():
    f = parse_wtb_line("Looking for 126518 black N10-N11", "", "HK", "126518")
    assert (f["condition"], f["year_from"], f["month_from"], f["price"], f["currency"]) == ("only_unworn", 2026, 10, None, None)
    f = parse_wtb_line("WTB 126613LN N11 full set", "", "HK", "126613LN")
    assert f["condition"] == "only_unworn" and f["full_set_required"]
    f = parse_wtb_line("Looking for 5968a 2021+ full set", "", "HK", "5968a")
    assert (f["condition"], f["year_from"], f["year_to"]) == (None, 2021, None)          # condition not stated: do not guess
    f = parse_wtb_line("5167A 2010-2014year", "Looking for Used\n7968/300R 2025year\n5167A 2010-2014year", "HK", "5167A")
    assert (f["condition"], f["year_from"], f["year_to"]) == ("used", 2010, 2014)
    f = parse_wtb_line("5261R", "Looking For // Wtb // Ntq\n5261R\n7+ // 2026", "AE", "5261R")
    assert (f["year_from"], f["month_from"]) == (2026, 7)
    f = parse_wtb_line("LTB 15412OR FROSTED rainbow 2024/25 MINT 455k usd target. Payment ready", "", "DE", "15412OR")
    assert (f["price"], f["currency"], f["year_from"], f["year_to"]) == (455000, "USD", 2024, 2025)
    f = parse_wtb_line("NTQ | 5980/1400G | Any year", "", "HK", "5980/1400G")
    assert f["any_year"] and f["price"] is None
    f = parse_wtb_line("WTB 326933 White Jubilee", "", "DK", "326933")
    assert f["price"] is None and f["currency"] is None                                  # production: USD 326,933


# ---------------------------------------------------------------- evidence
def test_reference_borders():
    f5712, s = watch_forms("5712/1R", "5712/1R-001", ["5712/1R-001"], ["5712/1R Brown"])
    assert names_watch("5712/1r 2022Y HKD2.022m", f5712, s)
    assert names_watch("5712-1R-001 2023", f5712, s)
    assert not names_watch("5712R Brown 2008 Full Set Used HKD845K", f5712, s)           # a different watch (leather strap, ~40 % of the price)
    assert not names_watch("5712/1A 2023Y old buckle HKD1.131m", f5712, s)
    f5167, s = watch_forms("5167A", "5167A-001", ["5167A-001"], [])
    assert names_watch("5167a-001 13y hkd532k", f5167, s) and not names_watch("5167/1A 2016Y HKD524K", f5167, s)
    f279, s = watch_forms("279171", "279171", [], [])
    assert not names_watch("279171G Purple Jub N9 $134K", f279, s)
    f915, s = watch_forms("91550", "91550", ["M91550-0013"], [])
    assert names_watch("91550-0013 n9 $9.5k", f915, s)
    fap, sap = watch_forms("26393NR.OO.A002KB.02", "26393NR.OO.A002KB.02", [], [])
    assert names_watch("26393nr 2023y 270000hkd", fap, sap)                              # short dealer form
    assert not names_watch("26393NR.OO.A002CR.01 2023", fap, sap)                        # another variant of the reference
    fvc, s = watch_forms("4300V/220G-H151", "4300V/220G-H151", [], [])
    assert names_watch(f"4300V/220G{NBH}H151 11/2026 NEW HKD1.04M", fvc, s)
    assert names_watch("228239OMBRE BLUE N11 $444000", *watch_forms("228239 Blue Ombre", "228239", [], []))


def test_reference_tokens_ignore_prices_and_dates():
    assert reference_tokens("126334G Grey Oys N2/N3/N5 114k/115K/117K") == ["126334G"]
    assert reference_tokens("HK$403,000 Sep-2026") == []
    assert reference_tokens("310.32.42.50.02.001  n11 $ 105500")[0] == "310.32.42.50.02.001"


# ---------------------------------------------------------------- guard
CAT_5712 = {"reference": "5712/1R-001", "oem_references": ["5712/1R-001"], "aliases": ["5712/1R Brown"]}


def _g(line, price, cur, ws="5712/1R", cat=CAT_5712, ref=285000, n=200, side="WTS", **kw):
    return guard.check_offer(side=side, ws_code=ws, price=price, currency=cur, source_line=line, catalog=cat, reference_price_usd=ref, reference_count=n, **kw)


def test_guard_accepts_a_documented_offer():
    v = _g("5712/1R 2025 hkd2.17m", 2170000, "HKD")
    assert v.decision == "accept" and v.headline_eligible


def test_guard_holds_fuzzy_or_ai_mapping_without_literal_evidence():
    v = _g("5712R Brown 2008 Full Set Used HKD845K", 845000, "HKD")
    assert v.decision == "hold" and "different_reference_in_text:5712R" in v.reasons and "price_below_band" in v.reasons


def test_guard_holds_price_from_another_line():
    v = _g("5712/1r 2022Y HKD2.022m", 1131000, "HKD")       # 1.131m is the price of the 5712/1A two lines below
    assert v.decision == "hold" and "price_not_on_watch_line" in v.reasons


def test_guard_fixes_currency():
    v = _g("5712/1R 2023 280k usdt", 280000, "HKD")
    assert v.decision == "fix" and v.suggestion == {"currency": "USD"}
    v = _g("5712/1R 2023 280k", 280000, "HKD")              # no currency written: HKD was a guess, only USD is plausible
    assert v.decision == "fix" and v.suggestion == {"currency": "USD"}
    v = _g("5712/1R 2023 hkd 280k", 280000, "HKD")          # explicitly HKD and far too cheap: a human has to look
    assert v.decision == "hold" and v.reasons == ["price_below_band"]


def test_guard_rejects_reference_as_price():
    v = guard.check_offer(side="WTB", ws_code="126518LN Blk", price=126518, currency="HKD", source_line="Looking for 126518 black N10-N11",
                          catalog={"reference": "126518LN", "aliases": ["126518 Blk"]})
    assert v.decision == "reject" and v.reasons == ["price_equals_reference"]


def test_guard_holds_wrong_variant():
    cat = {"reference": "126234", "aliases": ["126234g Blue Jub", "126234 G Blue Jubilee"], "dial": "Blue"}
    v = _g("126234 wim jub 2026 hkd97k", 97000, "HKD", ws="126234g Blue Jub", cat=cat, ref=12400, n=40)
    assert v.decision == "hold" and v.reasons[0].startswith("variant_conflict")


def test_guard_rejects_sold_and_parts():
    assert _g("5712/1R 2023 SOLD", 2000000, "HKD").decision == "reject"
    assert guard.check_offer(side="WTS", ws_code="5711/1A Blue", price=6500, currency="HKD", source_line="Patek Philippe Watch Winder  6500HKD", catalog={"reference": "5711/1A"}).decision == "reject"


def test_guard_without_reference_price_is_not_headline_eligible():
    v = _g("5712/1R 2025 hkd2.17m", 2170000, "HKD", ref=None, n=0)
    assert v.decision == "accept" and not v.headline_eligible


# ---------------------------------------------------------------- variants
def test_variants():
    cat = {"dial": "Blue", "bracelet": "Jubilee", "aliases": ["126234g Blue Jubilee"]}
    assert variants.check("126234 wim jub 2026 hkd97k", "126234g Blue Jub", cat).startswith("conflict:color")
    assert variants.check("126234g blue jub n10 hkd105k white tag", "126234g Blue Jub", cat) == "confirmed"   # "white tag" is not a dial colour
    assert variants.check("126234 n10 hkd105k", "126234g Blue Jub", cat) == "unspecified"
    assert variants.check("7300/1200R choco 7/2026 $350000", "7300/1200R White", {"dial": "White"}).startswith("conflict")


# ---------------------------------------------------------------- life cycle
def test_one_offer_per_dealer_and_piece():
    t0 = datetime(2026, 11, 17, 10)
    k1 = lifecycle.offer_key("+852 5201 3408", "5712/1R", 2022, None, "Used")
    k2 = lifecycle.offer_key("+85252013408", "5712/1r", 2022, None, "used")
    assert k1 == k2 and k1 != lifecycle.offer_key("+85252013408", "5712/1R", 2023, None, "Used")
    a = lifecycle.upsert(None, {"side": "WTS", "price": 2055000, "currency": "HKD", "message_at": t0}, t0)
    b = lifecycle.upsert(a, {"side": "WTS", "price": 2022000, "currency": "HKD", "message_at": t0 + timedelta(days=2)}, t0 + timedelta(days=2))
    assert b["price"] == 2022000 and b["price_history"][0]["price"] == 2055000 and b["first_seen_at"] == t0
    assert b["expires_at"] == t0 + timedelta(days=2 + lifecycle.OFFER_TTL_DAYS)
    late = lifecycle.upsert(b, {"side": "WTS", "price": 2100000, "currency": "HKD", "message_at": t0 + timedelta(days=1)}, t0 + timedelta(days=3))
    assert late["price"] == 2022000                         # an older export processed late does not overwrite the newer price
    assert not lifecycle.is_live(b, t0 + timedelta(days=13)) and lifecycle.is_live(b, t0 + timedelta(days=11))


def test_headline_price_is_not_simply_the_minimum():
    now = datetime(2026, 11, 22, 12)
    def o(i, usd, dealer, eligible=False, age=0):
        return {"id": i, "usd_price": usd, "dealer": dealer, "headline_eligible": eligible, "last_seen_at": now - timedelta(days=age), "expires_at": now + timedelta(days=5)}
    offers = [o("wrong", 108000, "A"), o("good1", 258000, "B", True), o("good2", 262000, "C", True), o("good3", 280000, "D", True)]
    h = lifecycle.headline_price_usd(offers, now)
    assert h["offer_id"] == "good1" and h["basis"] == "verified_offer"
    two = [o("x", 100000, "A"), o("y", 102000, "B"), o("z", 150000, "C")]
    assert lifecycle.headline_price_usd(two, now)["basis"] == "two_dealers"
    assert lifecycle.headline_price_usd([o("x", 100000, "A"), o("z", 150000, "C")], now)["basis"] == "median_indicative"
    assert lifecycle.headline_price_usd([o("x", 100000, "A", True, age=9)], now) is None    # nothing recent


# ------------------------------------------------------------------ WTB test of 23 Nov (messages of 17-23 Nov)
def _modes(msg):
    return [m for m, _ in classify.split_sections(msg)]


def test_wtb_with_reference_list_is_not_a_price_list():
    assert _modes("WTB / LOOKING to Stock\nCartier Panthère vintage\nRefs: 1057917 / 166921 / 1120 / W25029B8 / 1100 / 112000R / 112000M / W25028B5\nFull set or watch only") == ["WTB"]
    assert _modes("WTB/Looking  A.LANGE&SOHNE\n115.021、115.022、115.025、115.026、115.028、115.029、115.031") == ["WTB"]


def test_gold_purity_and_case_size_are_not_prices():
    assert _modes("WTB! Cartier Santos-Dumont Extra-Plate\nRef. 96054\n• 18K yellow gold\n• 27 × 36 mm\nAny year. PM me with photos") == ["WTB"]
    assert _modes("Need Rolex Datejust 36m\n126203 champagne diamonds dial\nNew 2026") == ["WTB"]


def test_sold_order_with_can_confirm_is_a_request_with_target():
    msg = "Looking for\nsold order 5990/1R N11/26 2.39M can confirm"
    assert _modes(msg) == ["WTB"]
    f = parse_wtb_line("sold order 5990/1R N11/26 2.39M can confirm", msg, "HK")
    assert (f["price"], f["currency"], f["month_from"], f["year_from"]) == (2390000, "HKD", 11, 2026)


def test_confirm_order_with_typo():
    assert _modes("Comfirm Order\nRM67-02 Ogier\nUSED // FULLSET\nPlease PM me if you have") == ["WTB"]


def test_need_shipping_does_not_turn_a_sale_into_a_request():
    assert _modes("116506a\n2022 like new\n800k HKD\n380k AED\nNeed shipping\nReconfirm stock") == ["WTS"]


def test_numbered_stock_list_under_always_looking_for():
    secs = classify.split_sections("Alway looking for 5002R/5002P/5004A/6002R etc.\n1.5980/12R 18K Rose Gold, factory Ruby-Set\n1,3m USDT\n14.5961P-001 Diamond-set platinum chronograph Jun 2026 brand new full set\n380,000 USDT")
    assert [m for m, _ in secs] == ["WTB", "WTS"] and "5961P" in secs[1][1] and "5961P" not in secs[0][1]


def test_two_line_stock_under_a_parts_request():
    secs = classify.split_sections("LOOKING FOR REAL MOP DIALS\n336933 black jub\n185,000 N9 Wood card\n126333 green roma oys 133,000 n10")
    assert all("336933" not in t for m, t in secs if m == "WTB")


def test_wtb_targets():
    assert parse_wtb_line("WTB daytona 126518 tiffany new/like new full set 25/26 target 80k", "", "DE")["price"] == 80000
    assert parse_wtb_line("Looking for 126710grnr oys n11 136000 can confirm", "", "HK")["price"] == 136000
    f = parse_wtb_line("WTB: Rolex Submariner Hulk Ref. 116610LV, 2016 or younger, top condition, EU, Full Set, Price Target 15-16k", "", "DE")
    assert (f["price"], f["currency"], f["year_from"], f["year_to"]) == (16000, "EUR", 2016, None)
    f = parse_wtb_line("Looking for Rolex Daytona black, 126500ln, Must be 100% New 2026, Target 26.500€ only offer if You have in Hands", "", "DE")
    assert (f["price"], f["currency"], f["condition"]) == (26500, "EUR", "only_unworn")
    assert parse_wtb_line("WTB 126610LN 2024 85k", "", "HK")["price"] == 85000
    assert parse_wtb_line("WTB 18K yellow gold Day-Date 18238", "", "DE")["price"] is None
    assert parse_wtb_line("Looking for 126518 black", "", "HK")["price"] is None


def test_wtb_without_any_statement_has_no_condition():
    f = parse_wtb_line("looking for 7118/1200A grey", "looking for 7118/1200A grey", "HK")
    assert f["condition"] is None and f["price"] is None and f["year_from"] is None


def test_wtb_condition_any():
    assert parse_wtb_line("126619LB WHITE GOLD FULL SET UNWORN OR GOOD CONDITION")["condition"] == "any"
    assert parse_wtb_line("Looking 5723/1R-010. Used is ok")["condition"] == "any"
    assert parse_wtb_line("WTB daytona 126518 tiffany new/like new full set")["condition"] == "any"


def test_wtb_years():
    assert parse_wtb_line("WTB Rolex 1908 52508 2025/2026 Full Set - in EU")["year_from"] == 2025
    f = parse_wtb_line("Patek 5740/1G 2026-2024 Full set")
    assert (f["year_from"], f["year_to"]) == (2024, 2026)
    f = parse_wtb_line("5990/1R", "CONFIRM ORDER\n5990/1R\nNEED NEW 11/2026")
    assert (f["condition"], f["year_from"], f["month_from"]) == ("only_unworn", 2026, 11)
    f = parse_wtb_line("126508 green", "Looking for 2026 N10,N11,brand new full set.\nSpot / AD incoming stock\n4946R\n5968A\n126508 green")
    assert (f["condition"], f["year_from"], f["month_from"], f["full_set_required"]) == ("only_unworn", 2026, 10, True)
    f = parse_wtb_line("PP:7118/1300r", "Looking for\nWTB\nPP:7118/1300r\nDate:2022-2026\nCondition:New")
    assert (f["condition"], f["year_from"], f["year_to"]) == ("only_unworn", 2022, 2026)


def test_reference_shapes_in_requests():
    for msg in ("looking for W2SA0051", "NTQ Q3868520", "Looking B6081617 new BH", "Looking for\n279171g17 cho jub n11\ncomfirm order",
                "Looking For RM\n67-01 TI\n67-01 RG\nNeed New Or Used 2020+++", "NTQ 67-01 RG 2020+", "SERIOUS CALL SOLD order need 26579CS",
                "RM30-01，Confirm the order, 2026NEW is required", "Anyone have or can make AM 126679sabr"):
        assert _modes(msg) == ["WTB"], msg


def test_model_only_request_with_budget_stays_a_request():
    assert _modes("looking for OP 31, 34\n2025/2026\nany colour\nbelow 30,000aed\npm me if you have ready in dubai please") == ["WTB"]
    assert _modes("Looking for below retail price man model Rolex 50K till 100K usd") == ["WTB"]


def test_sale_posts_with_buy_words_stay_sales():
    for msg in ("Patek Philippe 7300/1200R-001 (choco) n7/26 - Need export\n~358,000 hkd", "RM11-03Ti\n2018 looking new&good condition\n185K USDT",
                "Need to find me\n7968/300R 2023 used\n$3020000hkd", "26545XT.OO.1240XT.01\nLimited 150 pieces New 2026\n$890k USD need Safe sale",
                "Looking to buy USDT, pay HKD cash\n-----\nPatek Philippe 5231G brandnew 11/2026\n800,000hkd or 102,500usdt"):
        assert _modes(msg) == ["WTS"], msg


def test_order_for_one_watch_keeps_its_target():
    msg = "Confirm order\n126334 Wim jub\nW9-W11\n$116000 HKD can take"
    assert _modes(msg) == ["WTB"]
    f = parse_wtb_line("Confirm order, 126334 Wim jub, W9-W11, $116000 HKD can take", "", "HK")
    assert (f["price"], f["currency"]) == (116000, "HKD")
    assert _modes("Confirm order\n15551St blue\n2026 new\n$410000 HKD can confirm") == ["WTB"]


def test_sold_order_list_followed_by_stock_is_split():
    secs = classify.split_sections("*sold order*\n126334 green oys n11\n126300 white jub n11\n279174g17 silver N10 $106000\nWHSA0015 N11 $249000 -22%")
    assert [m for m, _ in secs] == ["WTB", "WTS"] and "279174g17" in secs[1][1]


def test_mistyped_stock_line_between_stock_lines_is_stock():
    secs = classify.split_sections("Looking for new or used\n126334g grey jub\n278274 green jub\n126610LN N11 $107000\n126710BLNR jub W11 N141000\n126713GRNR N11 $167500\n126720VTNR jub N11 $129500")
    wtb = "\n".join(t for m, t in secs if m == "WTB")
    assert "126334g" in wtb and "278274" in wtb and "126710BLNR" not in wtb


def test_find_who_has_is_a_request():
    assert _modes("Find 7300/1200R white/choco dial 2026. I need in HKG, who has?") == ["WTB"]


def test_stock_by_model_name_under_a_request_is_stock():
    secs = classify.split_sections("Looking for 5990/1r 26y\nNew 65-01 Mclaren N11 HKD:3300000\nUsed 011 lotus 15y nobox HKD:1670000\nUsed 07-04 pink 25y full set 553k usdt")
    wtb = "\n".join(t for m, t in secs if m == "WTB")
    assert "5990/1r" in wtb and "3300000" not in wtb and "553k" not in wtb


def test_discount_line_is_a_priced_stock_line():
    secs = classify.split_sections("Looking for 278273g champ Jub\nQ389848J\nBvlgari 104310 93400-13% n5\nBvlgari 102098 131000-19% n7")
    wtb = "\n".join(t for m, t in secs if m == "WTB")
    assert "Q389848J" in wtb and "104310" not in wtb


def test_single_watch_request_with_price_on_its_own_line():
    assert _modes("Looking for\n5712R\n2020+\n800k hkd") == ["WTB"]
    assert _modes("116506a\n2022 like new\n800k HKD\n380k AED\nNeed shipping") == ["WTS"]


def test_find_in_adverts_is_not_a_request():
    assert _modes("FRESH FIND — OPEN FOR PREORDERS\nPrice: $2.700 / €2.360\nDelivery: 4 weeks\nOrder now for your next stock update!") != ["WTB"]
    assert "WTB" not in _modes("Price Drop\nRM35-03 Blue\n2024 Mint\nFull set\n403k usd only\nYou will not find this price ever again grab now")


def test_firm_order_flag():
    assert parse_wtb_line("sold order 5968a new any month 2026")["firm_order"] is True
    assert parse_wtb_line("5990/1R", "CONFIRM ORDER\n5990/1R\nNEED NEW 11/2026")["firm_order"] is True
    assert parse_wtb_line("Looking for 126710grnr oys n11 136000 can confirm", "", "HK")["firm_order"] is True
    assert parse_wtb_line("looking for 7118/1200A grey")["firm_order"] is False


def test_fields_come_from_the_nearest_header():
    msg = "*sold order*\n126334 green oys n11\n126300 white jub n11\nLooking for new or used\n126334g grey jub\n278274 green jub"
    a = parse_wtb_line("126300 white jub n11", msg)
    b = parse_wtb_line("278274 green jub", msg)
    assert a["firm_order"] is True and a["condition"] == "only_unworn"
    assert b["firm_order"] is False and b["condition"] == "any"


def test_remark_below_the_list_applies_to_the_watches_above():
    f = parse_wtb_line("5924G Green - Blue", "Looking for\n5172G Green - Blue\n5924G Green - Blue\nNeed new 2026")
    assert (f["condition"], f["year_from"]) == ("only_unworn", 2026)
    f = parse_wtb_line("5712/1R", "Looking for\n5712/1R\nNew 2026/n10+")
    assert (f["condition"], f["year_from"], f["month_from"]) == ("only_unworn", 2026, 10)
