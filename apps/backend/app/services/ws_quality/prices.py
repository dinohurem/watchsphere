"""Price + currency extraction for one watch line.

Fixes over the current extractor (each one seen in production data):
  * "160000 hkd 12/2025"      -> 160,000 HKD   (was 12,000: currency tag followed by a date)
  * "1'480'000 hkd"           -> 1,480,000 HKD (was 9,000)
  * "€11.300,-" / "41.777,-€" -> 11,300 / 41,777 EUR
  * "euro 6.300" / "138k euro"-> EUR
  * "130.000$" from a UK number -> USD (was GBP: '$' never means GBP/EUR/CHF)
  * "Looking for 126518 black" -> no price (was 126,518: reference read as price)
  * "305k usdt" -> USD, never HKD
  * "HKD 150280 (Retail 221000 -32%)" -> 150,280 (list/retail prices are ignored)
"""
import re
from typing import Optional, NamedTuple, Iterable
from .normalize import clean

HK_COUNTRIES = {"HK", "CN", "MO"}
EUR_COUNTRIES = {"DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "IE", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR"}

_CUR_WORDS = [
    ("USD", r"usdt|usd|us\$|u\.s\.d"),
    ("HKD", r"hk\$|hkd|hk(?![a-z])"),
    ("EUR", r"€|euros?|eur"),
    ("GBP", r"£|gbp"),
    ("CHF", r"chf"),
    ("AED", r"aed|dhs?|dirhams?"),
    ("CNY", r"rmb|cny|¥|人民币"),
    ("SGD", r"sgd"),
    ("JPY", r"jpy"),
]
_CUR_ALT = "|".join(f"(?P<c{i}>{p})" for i, (_, p) in enumerate(_CUR_WORDS))
_NUM = r"\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?"
_CUR_PLAIN = "|".join(p for _, p in _CUR_WORDS)
_PRE = _CUR_ALT.replace("?P<c", "?P<p")
_POST = _CUR_ALT.replace("?P<c", "?P<s")
_PRICE_RE = re.compile(
    rf"(?:(?<![A-Za-z])(?P<pre>{_PRE}|\$)\$?\s*(?:[:=\-]|//)?\s*|(?<![A-Za-z0-9])(?<!\d[.,])(?:(?<!-)|(?<=-)(?=\d[\d.,]*\s?(?:[km](?![a-z0-9])|\s?(?:{_CUR_PLAIN})))))"
    rf"(?P<num>{_NUM})\s?(?P<suf>k|m)?"
    rf"(?:(?P<gap>\s?)(?P<post>{_POST}|\$|u(?![a-z]))(?![a-z])|(?![a-z0-9]))",
    re.I,
)
_LIST_PRICE_RE = re.compile(r"\((?:[^()]*\b(?:retail|list|rrp|lp|msrp|uvp)\b[^()]*)\)|\b(?:retail|list(?:\s*price)?|rrp|msrp|uvp)\s*[:=]?\s*[€$£]?\s*[\d.,]+\s?[km]?", re.I)
_DATE_RE = re.compile(
    r"\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)?\d{2}\b"      # 30-10-2026
    r"|\b(?:0?[1-9]|1[0-2])\s?[./-]\s?(?:19|20)\d{2}\b"  # 12/2025, 09-2026
    r"|\b(?:19|20)\d{2}[/-](?:0?[1-9]|1[0-2])\b(?![.,]\d)"  # 2026/10
    r"|\b[nw]\s?(?:0?[1-9]|1[0-2])(?:\s?[/-]\s?(?:20)?\d{2})?\b"   # N11, W10/26
    r"|\b(?:0?[1-9]|1[0-2])\s?/\s?\d{2}\b"               # 4/26
    r"|\b(?:19|20)\d{2}\s?(?:y|yr|year|years|年)?\b"      # 2022, 2022y
    r"|\b\d{2}\s?(?:y|yr|year)\b",                        # 24y
    re.I,
)
_NOISE_RE = re.compile(
    r"\b\d{2}(?:[.,]\d)?\s?mm\b|[-+]\s?\d{1,2}\s?links?\b|\b\d{1,2}\s?links?\b|\b\d{1,3}\s?(?:pcs|pieces|units?)\b|\bx\s?\d{1,2}\b|\(x\d{1,2}\)"
    r"|\b(?:s/?n|serial(?:\s+no\.?)?)\s?[:#]?\s?[a-z0-9]{5,}\b|\b\d{1,2}:\d{2}\b|\+\d[\d ]{7,}|\b\d{1,3}\s?(?:th|st|nd|rd)\b|#\d+",
    re.I,
)


class Price(NamedTuple):
    amount: Optional[int]
    currency: Optional[str]
    how: str          # "tagged" | "bare" | "shorthand" | "discount" | "none"
    raw: str = ""


def _cur_from_match(m, side: str) -> Optional[str]:
    for i, (cur, _) in enumerate(_CUR_WORDS):
        if m.groupdict().get(f"{side}{i}"):
            return cur
    return None


def _value(num: str, suf: Optional[str], tagged: bool):
    """-> (amount, shorthand?)"""
    suf = (suf or "").lower()
    if suf:
        v = float(num.replace(",", ".")) if re.fullmatch(r"\d+[.,]\d+", num) else float(re.sub(r"[.,]", "", num))
        return round(v * (1000 if suf == "k" else 1_000_000)), False
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", num):                 # 435.000 / 1,265,000
        return int(re.sub(r"[.,]", "", num)), False
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}", num):      # 21,500.00
        return int(re.sub(r"[.,]", "", re.sub(r"[.,]\d{1,2}$", "", num))), False
    if re.fullmatch(r"\d+[.,]\d{1,2}", num):                        # 17,5 € = 17,500 (dealer shorthand, only next to a currency)
        return (round(float(num.replace(",", ".")) * 1000), True) if tagged else (None, False)
    if re.fullmatch(r"\d+", num):
        v = int(num)
        if v < 1000:                                               # 125€ = 125,000 (shorthand) - flagged, guard decides
            return (v * 1000, True) if tagged else (None, False)
        return v, False
    return None, False


def message_currency(message: str, sender_country: Optional[str] = None, group_name: str = "") -> Optional[str]:
    """Currency that applies to untagged prices of this message.
    1. an explicit statement ("all prices in HKD", "USDT only")
    2. the currency used on most tagged lines of the same message
    3. a location statement ("HK stock", "ready in HK")
    4. sender country (HK/CN/MO -> HKD, euro zone -> EUR, UK -> GBP, CH -> CHF)
    """
    t = clean(message)
    m = re.search(r"(?:all\s+)?prices?\s+(?:are\s+)?in\s+(hkd|usdt?|eur|euro)", t, re.I)
    if m:
        return {"hkd": "HKD", "usd": "USD", "usdt": "USD", "eur": "EUR", "euro": "EUR"}[m.group(1).lower()]
    counts = {}
    for pm in _PRICE_RE.finditer(_DATE_RE.sub(" ", t)):
        c = _cur_from_match(pm, "p") or _cur_from_match(pm, "s")
        if c:
            counts[c] = counts.get(c, 0) + 1
    if counts:
        best = max(counts, key=counts.get)
        if counts[best] >= 2 or len(counts) == 1:
            return best
    if re.search(r"\bhk\s*(?:stock|ready|deal)\b|\b(?:stock|ready|deal|located|watch(?:es)?)\s+(?:in\s+)?(?:hk|hong\s*kong)\b|🇭🇰", t, re.I):
        return "HKD"
    c = (sender_country or "").upper()
    if c in HK_COUNTRIES:
        return "HKD"
    if c in EUR_COUNTRIES:
        return "EUR"
    if c in ("UK", "GB"):
        return "GBP"
    if c == "CH":
        return "CHF"
    # a dealer from a third country (MY, VN, TW, TH ...) posting in a Hong Kong trading group quotes HKD
    if group_name and re.search(r"\bhk\b|hong\s*kong|🇭🇰|香港", group_name, re.I):
        return "HKD"
    return None


def parse_price(
    line: str,
    sender_country: Optional[str] = None,
    context_currency: Optional[str] = None,
    references: Iterable[str] = (),
    allow_bare: bool = True,
) -> Price:
    """Extract the asking price of ONE watch line.

    references : reference strings found on this line (they are masked so their digits can never become the price)
    allow_bare : False for WTB posts - a buy request only has a price when it carries a currency or k/m
    """
    s = clean(line)
    s = _LIST_PRICE_RE.sub(" ", s)

    # discount notation: "$565000-25%"  "HKD261,000-20%"
    dm = re.search(rf"(?P<pre>hk\$|hkd|usdt?|€|\$)?\s*(?P<num>{_NUM})\s?(?P<suf>k|m)?\s?-\s?(?P<pct>\d{{1,2}})\s?%", s, re.I)
    if dm:
        base, _ = _value(dm.group("num"), dm.group("suf"), True)
        if base and base >= 1000:
            pre = (dm.group("pre") or "").lower()
            cur = "HKD" if pre in ("hk$", "hkd") else "USD" if pre.startswith("usd") else "EUR" if pre == "€" else None
            if cur is None:
                cur = _dollar_currency(sender_country, context_currency) if pre == "$" else (context_currency or _default(sender_country))
            return Price(int(base * (1 - int(dm.group("pct")) / 100)), cur, "discount", dm.group(0))

    # Chinese notation: "97w人民币" = 970,000 CNY, "84w5 rmb" = 845,000 CNY
    wm = re.search(r"(?<![A-Za-z0-9])(\d+(?:[.,]\d+)?)\s?[w万萬]\s?(\d)?\s?(?:人民币|rmb|cny)", s, re.I)
    if wm:
        v = float(wm.group(1).replace(",", ".")) + (int(wm.group(2)) / 10 if wm.group(2) else 0)
        return Price(round(v * 10000), "CNY", "tagged", wm.group(0))

    for ref in sorted({r for r in references if r}, key=len, reverse=True):
        s = re.sub(r"(?<![A-Za-z0-9])" + r"[\s./\-]?".join(re.escape(c) for c in re.sub(r"[\s./\-]", "", ref)) + r"(?:\.[A-Za-z0-9]{2,8}){0,4}(?:[-.]\d{2,4})?(?:-[A-Za-z])?(?![A-Za-z0-9])", " ", s, flags=re.I)
    s = _NOISE_RE.sub(" ", s)
    masked = _DATE_RE.sub(lambda m: " " * len(m.group(0)), s)

    tagged, bare = [], []
    pos = 0
    while True:
        m = _PRICE_RE.search(masked, pos)
        if not m:
            break
        pos = m.end()
        pre, post = m.group("pre"), m.group("post")
        if post and not pre:
            # "Wim Jub 11 HKD121500": the currency after "11" is the prefix of the NEXT number.
            # "212000aed 450000hkd": here it is the suffix of the number before it.
            nxt = re.match(r"(\s*)[:=]?\$?\d", masked[m.end():])
            if nxt is not None:
                small = not m.group("suf") and re.fullmatch(r"\d{1,3}", m.group("num")) is not None
                gap = m.start("post") > (m.end("suf") if m.group("suf") else m.end("num"))
                loose = gap or post == "$"                             # "660hkd" keeps its currency, "11 HKD121500" / "11$168000" do not
                glued_to_next = gap and nxt.group(1) == ""
                if (small and loose) or glued_to_next:
                    pos = m.start("post")
                    amount, _ = _value(m.group("num"), m.group("suf"), False)
                    if amount and 300 <= amount <= 60_000_000:
                        bare.append((amount, None, "bare", m.group("num") + (m.group("suf") or "")))
                    continue
        cur = _cur_from_match(m, "p") or _cur_from_match(m, "s")
        dollar = (pre == "$") or (post == "$")
        if post and post.lower() == "u" and not cur:
            cur = "USD"
        amount, shorthand = _value(m.group("num"), m.group("suf"), bool(cur or dollar))
        if not amount or amount < 300 or amount > 60_000_000:
            continue
        if cur is None and dollar:
            cur = _dollar_currency(sender_country, context_currency)
        rec = (amount, cur, "shorthand" if shorthand else ("tagged" if (cur or dollar) else "bare"), m.group(0).strip())
        (tagged if (cur or dollar) else bare).append(rec)

    if tagged:
        # several currencies for the same watch ("67.4k USDT // 525k HKD"): keep the one of the message context /
        # the sender's home market, otherwise the first one written. Never mix: amount and currency come from the same token.
        home = context_currency or _default(sender_country)
        pick = next((t for t in tagged if t[1] == home and t[2] != "shorthand"), None) or next((t for t in tagged if t[2] != "shorthand"), None) or tagged[0]
        a, c, how, raw = pick
        return Price(a, c, how, raw)
    if bare and allow_bare:
        # numbers carrying k/m first, otherwise the LAST plain number of the line (dealers put the price at the end)
        km = [b for b in bare if re.search(r"[km]$", b[3], re.I)]
        if len(km) > 1 and re.search(r"\d\s?[km]\s?/\s?\d", masked, re.I):
            km = km[:1]                                    # "N3/N4/W10 477K/478K/482K": several pieces - take the first, see parse_multi
        a, _, how, raw = (km or bare)[-1]
        if not km and a < 1000:
            return Price(None, None, "none")
        return Price(a, context_currency or _default(sender_country), "bare", raw)
    return Price(None, None, "none")


def _dollar_currency(sender_country, context_currency):
    """'$' is HKD from a Hong Kong / Macau / China number (+852/+853/+86), whatever
    the message context says; elsewhere the context, else USD. Never GBP, EUR or CHF.
    The generator's price check re-reads it with the app median when only the other
    one fits."""
    if (sender_country or "").upper() in HK_COUNTRIES:
        return "HKD"
    if context_currency in ("HKD", "USD"):
        return context_currency
    return "USD"


def _default(sender_country):
    c = (sender_country or "").upper()
    if c in HK_COUNTRIES:
        return "HKD"
    if c in EUR_COUNTRIES:
        return "EUR"
    if c in ("UK", "GB"):
        return "GBP"
    if c == "CH":
        return "CHF"
    return "USD"
