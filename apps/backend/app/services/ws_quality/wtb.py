"""Field extraction for buy requests (WTB).

What dealers actually write and what the app needs:
  condition : "only_unworn" | "used" | "any" | None   (None = not stated - never guess)
  year      : earliest/latest acceptable card year and month ("2021+", "2010-2014", "N10-N11", "7+/2026", "any year")
  set       : full set / card / box required
  price     : optional. A buy request without a price is normal ("NTQ" = need to quote).
              Only numbers with a currency, k/m or a budget word count - never a bare number
              (that is how "Looking for 126518 black" became a request at HKD 126,518).
"""
import re
from typing import Optional, Dict, Any
from .normalize import clean
from .prices import parse_price

_NEW = re.compile(r"\b(?:brand[\s-]*new|bnib|unworn|un-worn|new|nos|fresh|sticker(?:s|ed)?|sealed|全新)\b", re.I)
_USED = re.compile(r"\b(?:used|pre-?owned|preowned|second\s*hand|like\s*new|mint|worn|二手)\b", re.I)
_ANY = re.compile(r"\b(?:(?:brand\s*)?(?:new|unworn)\s*(?:or|/|&|and)\s*(?:used|like\s*new|mint|good|pre-?owned)|(?:used|like\s*new|mint)\s*(?:or|/|&|and)\s*(?:brand\s*)?new|any\s+condition|used\s+(?:is\s+)?(?:ok|okay|fine)|can\s+be\s+used)\b", re.I)
_NEW_PART = re.compile(r"\bnew\s+(?:clasp|buckle|paper|papers|card|certificate|strap|bracelet|style|model)\b", re.I)
_MONTH_CODE = re.compile(r"(?<![A-Za-z0-9])([nNwW])\s?(0?[1-9]|1[0-2])(?:\s?[-~]\s?[nNwW]?\s?(0?[1-9]|1[0-2]))?(?:\s?/\s?(?:20)?(\d{2}))?(?![A-Za-z0-9])")
_YEAR_RANGE = re.compile(r"(?<!\d)((?:19|20)\d{2})\s?(?:-|~|to|–)\s?((?:19|20)?\d{2})(?!\d)")
_YEAR_PLUS = re.compile(r"(?<!\d)((?:19|20)\d{2})\s?(?:\+|y?\s?(?:or|and)\s+(?:newer|later|up|younger|above)|onwards?)|(?:not\s+older\s+than|from|after|since)\s+((?:19|20)\d{2})", re.I)
_MONTH_PLUS = re.compile(r"(?<!\d)(0?[1-9]|1[0-2])\s?\+\s?(?://|/)?\s?((?:20)\d{2})")
_YEAR = re.compile(r"(?<![\d/.-])((?:19|20)\d{2})(?:\s?(?:y|yr|year))?(?![\d/.-])|(?<![\d/])(\d{2})\s?(?:y|yr|year)\b", re.I)
_RANGE_K = re.compile(r"(?<![\w.,/])(\d{1,3}(?:[.,]\d{1,2})?)\s?k?\s?(?:-|–|to|till|bis)\s?(\d{1,3}(?:[.,]\d{1,2})?\s?k)(?![a-z])", re.I)
_BARE_CONFIRM = re.compile(r"(?<![\w/.,])(\d{5,7}|\d{1,3}(?:[.,]\d{3})+)\s*(?:hkd|usdt?|usd|eur|aed)?\s+can\s+(?:confirm|take|close)", re.I)
_YEAR_SLASH = re.compile(r"(?<![\d/])((?:19|20)\d{2})\s?[/-]\s?((?:19|20)\d{2})(?![\d/])")
_MONTH_YEAR = re.compile(r"(?<![\d/.])(0?[1-9]|1[0-2])\s?[/.]\s?(20\d{2})(?![\d/])")
_YEARLIKE = re.compile(r"^(?:19|20)\d{2}[-/](?:(?:19|20)\d{2}|[nw]?\d{1,2})y?$|^(?:1[5-9]|2[0-7])[-/](?:1[5-9]|2[0-7])y?$", re.I)
_BUDGET = re.compile(r"\b(?:target(?:\s+price)?|budget|max(?:imum)?|up\s+to|can\s+(?:pay|confirm|take|close)|willing\s+to\s+pay|pay(?:ing)?|offer(?:ing)?)\s*[:\-]?\s*", re.I)


_FIRM = re.compile(r"(?<![A-Za-z])(?:sold\s+orders?|co[nm]f(?:ir|ri)m(?:ed)?\s+(?:the\s+)?orders?|(?:strong|serious)\s+call|can\s+confirm)(?![A-Za-z])", re.I)


def _own_header(line: str, message: str) -> str:
    """The header lines that stand directly above this line's block: in a post with several lists
    ("sold order" list, then "looking for new or used" list) every line belongs to the nearest header above it."""
    lines = [x.strip() for x in message.split("\n") if x.strip()]
    key = line.strip()
    idx = next((i for i, x in enumerate(lines) if x == key), None)
    if idx is None and "\n" in key:
        # the scope of the first watch can include the header ("Looking for 👀\n126508 green")
        last = [x.strip() for x in key.split("\n") if x.strip()][-1]
        idx = next((i for i, x in enumerate(lines) if x == last), None)
    if idx is None:
        return "\n".join(lines[:3])
    i = idx - 1
    while i >= 0 and _refs_in(lines[i]):
        i -= 1                                   # other watches of the same list
    head = []
    while i >= 0 and not _refs_in(lines[i]) and len(head) < 3:
        head.append(lines[i])
        i -= 1
    head = list(reversed(head)) if head else lines[:3]
    foot = []
    j = len(lines) - 1
    while j > idx and not _refs_in(lines[j]) and len(foot) < 2:
        foot.append(lines[j])                    # "Need new 2026" below a list applies to every watch of it
        j -= 1
    return "\n".join(head + [x for x in reversed(foot) if x not in head])


def _refs_in(line: str) -> bool:
    from .classify import _refs
    return any(not _YEARLIKE.match(m.group(0)) for m in _refs(line))


def parse_wtb_line(line: str, message: str = "", sender_country: Optional[str] = None, reference: Optional[str] = None, current_year: int = 2026) -> Dict[str, Any]:
    """Fields of one buy request. `message` is the whole post: condition / year / set statements in a header apply to every line."""
    l = clean(line)
    if message:
        from .classify import _refs
        msg_clean = clean(message)
        if len({m.group(0).lower() for ln in msg_clean.split("\n") for m in _refs(ln) if not _YEARLIKE.match(m.group(0))}) <= 1:
            l = " | ".join(x.strip() for x in msg_clean.split("\n") if x.strip())   # one watch: every line of the post describes it
    scope_own = _NEW_PART.sub(" ", l)
    hdr = _NEW_PART.sub(" ", _own_header(clean(line), clean(message))) if message else ""

    def cond(text):
        if _ANY.search(text):
            return "any"
        new, used = bool(_NEW.search(_USED.sub(" ", text))), bool(_USED.search(text))
        if new and used:
            return "any"
        if used:
            return "used"
        if new:
            return "only_unworn"
        return None

    condition = cond(scope_own)
    mc = _MONTH_CODE.search(l)                       # N11 / W10 = new with that card month
    if condition is None and mc:
        condition = "only_unworn"
    if condition is None and hdr:
        first = hdr       # only the header lines, not other watches' lines
        condition = cond(first)

    year_from = year_to = month_from = None
    any_year = bool(re.search(r"\bany\s+year\b", l + " " + hdr, re.I))
    if mc:
        month_from = int(mc.group(2))
        yy = mc.group(4)
        year_from = (2000 + int(yy)) if yy else current_year
    m = _MONTH_PLUS.search(l)
    if m:
        month_from, year_from = int(m.group(1)), int(m.group(2))
    m = _YEAR_SLASH.search(l)                                          # 2025/2026, 2026-2024
    if m and year_from is None:
        a, b = sorted((int(m.group(1)), int(m.group(2))))
        if 1950 <= a and b <= current_year + 1:
            year_from, year_to = a, b
    m = _MONTH_YEAR.search(l)                                          # need new 11/2026
    if m and year_from is None and not mc:
        month_from, year_from = int(m.group(1)), int(m.group(2))
    m = re.search(r"(?<![\w/.])(1[5-9]|2\d)\s?/\s?(1[5-9]|2\d)(?![\w/.])", l)   # 25/26
    if m and year_from is None and not mc and int(m.group(1)) < int(m.group(2)) <= current_year % 100 + 1:
        year_from, year_to = 2000 + int(m.group(1)), 2000 + int(m.group(2))
    m = re.search(r"(?<!\d)(20\d{2})\s?/\s?(\d{2})(?!\d)", l)          # 2024/25
    if m and year_from is None and int(m.group(2)) > 12:
        year_from, year_to = int(m.group(1)), 2000 + int(m.group(2))
    m = _YEAR_RANGE.search(l)
    if m and year_from is None:
        a, b = int(m.group(1)), int(m.group(2))
        b = b if b > 100 else (a // 100) * 100 + b
        if 1950 <= a <= b <= current_year + 1:
            year_from, year_to = a, b
    m = _YEAR_PLUS.search(l)
    if m and year_from is None:
        year_from = int(m.group(1) or m.group(2))
    if year_from is None and not any_year:
        ys = []
        for a, b in _YEAR.findall(l):
            y = int(a) if a else 2000 + int(b)
            if 1950 <= y <= current_year + 1:
                ys.append(y)
        if ys:
            year_from = min(ys)
            year_to = max(ys)
            if re.search(r"\bnew\b|\bneed\b", l, re.I) and year_from == year_to:
                year_to = None                        # "need new in 2026" = 2026 or newer

    if year_from is None and not any_year and hdr:                    # "Looking for 2026 N10,N11 brand new full set" above a list
        head = " ".join(x for x in hdr.split("\n") if not _refs_in(x))
        hm = _MONTH_CODE.search(head)
        hy = [int(a) if a else 2000 + int(b) for a, b in _YEAR.findall(head)]
        hy = [y for y in hy if 2000 <= y <= current_year + 1]
        if hm:
            month_from = int(hm.group(2))
            year_from = (2000 + int(hm.group(4))) if hm.group(4) else (max(hy) if hy else current_year)
        elif hy:
            year_from = min(hy)
            year_to = max(hy) if len(set(hy)) > 1 else None
    text_all = l + " " + (hdr or "")
    full_set = bool(re.search(r"\b(?:full\s*set|fullset|complete\s+set|box\s*(?:&|and|\+)\s*papers?|b\s?&\s?p|keep\s+card|with\s+(?:card|papers?))\b", text_all, re.I))
    watch_only_ok = bool(re.search(r"\b(?:naked|watch\s+only|only\s+watch|no\s+papers?)\b", text_all, re.I))

    # price: only with a budget word, a currency or k/m
    refs = [reference] if reference else ()
    from .classify import _not_prices
    lp = _RANGE_K.sub(lambda m: m.group(2), _not_prices(l))            # "Price Target 15-16k": the upper end is the budget
    price = parse_price(lp, sender_country, None, refs, allow_bare=False)
    if not price.amount:
        bc = _BARE_CONFIRM.search(lp)                                     # "n11 136000 can confirm"
        if bc:
            price = parse_price(bc.group(1), sender_country, None, refs, allow_bare=True)
    if not price.amount:                                                  # "WTB 126610LN 85k", "2.39M can confirm": k / m without a currency
        km = parse_price(lp, sender_country, None, refs, allow_bare=True)
        if km.amount and re.search(r"\d\s?[km]$", km.raw.strip(), re.I):
            price = km
    if not price.amount and _BUDGET.search(lp):         # "target 600" / "budget: 105k": a bare number is fine right after a budget word
        price = parse_price(_BUDGET.split(lp)[-1], sender_country, None, refs, allow_bare=True)
    amount, currency = price.amount, price.currency
    if amount and reference and re.sub(r"\D", "", reference) == str(amount):
        amount = currency = None

    firm_order = bool(_FIRM.search(l) or (hdr and _FIRM.search(hdr)))     # "sold order", "confirm order", "strong call": the buyer has a customer

    return {
        "firm_order": firm_order,
        "condition": condition,                 # only_unworn | used | any | None
        "year_from": year_from, "year_to": year_to, "month_from": month_from, "any_year": any_year,
        "full_set_required": full_set, "watch_only_ok": watch_only_ok,
        "price": amount, "currency": currency if amount else None,   # never a default currency without a price
    }
