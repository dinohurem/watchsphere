"""List price minus discount on one watch line ("$63000-17%", "HKD:63,000 (-17%)", "// HKD54900 // -21%").

Dealers post Cartier, Omega, TAG, Vacheron ... as list price minus a discount. The price shown in the app is
list price x (1 - discount). Rules (discount test chat, 25 Nov 2026):
  * the line is normalised first: full-width ％ ， （ ）, dash variants, non-breaking spaces, "~" (struck-through
    price), tabs
  * a discount is a number that follows the price - with or without "%", with or without brackets, with or
    without a minus - also behind "//", "|", a comma, the currency or one short word ("$63000 GRN -15%")
  * without "%" a minus (or "less") is required: "$63000 -15 9/2026", "33200 -14"
  * a number followed by "new" or 90 and above is a condition grade ("99% new"), never a discount
  * over 70 % is impossible (a typo): the line goes to review
  * "46800 - 14% = 40248": the dealer's own result wins
"""
import re
from dataclasses import dataclass
from typing import Optional

from .normalize import clean

MAX_DISCOUNT = 70.0
MIN_DISCOUNT = 3.0
CONDITION_GRADE = 90.0

_CUR = r"hk\$|us\$|hkd|usdt|usd|eur|euros?|gbp|chf|aed|sgd|€|£|\$"
_NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?![\d,])|\d+(?:[.,]\d+)?(?=\s?[km](?![a-z]))|\d{4,8}"
_PRICE = (rf"(?:(?P<pre>{_CUR})[ \t]*:?[ \t]*|(?<![A-Za-z0-9.,/\-]))(?P<num>{_NUM})(?![\d])[ \t]?(?P<suf>[km](?![a-z]))?"
          rf"(?:[ \t]*(?P<post>{_CUR})(?![a-z]))?(?![A-Za-z])")
# between price and discount: spaces, "//", "|", ",", "(", "=" never; at most one short word ("GRN", "net")
_GAP = r"(?:[ \t]*(?://+|\||,|\())*[ \t]*(?:(?<=[\s/|,(])(?P<word>[a-z]{1,4})[ \t]*(?:(?://+|\||,|\()[ \t]*)*)?"
_DISC = (r"(?P<minus>-|−|less[ \t]+|minus[ \t]+|off[ \t]+)?[ \t]*\(?[ \t]*(?P<minus2>-)?[ \t]*(?P<pct>\d{1,3}(?:[.,]\d{1,2})?)"
         r"(?![\d/]|[.,]\d|[ \t]?[km](?![a-z])|[ \t]*(?:pcs|pieces?|days?|mm|x)\b)[ \t]*(?P<pc>%)?(?P<new>[ \t]*new)?[ \t]*\)?"
         rf"(?:[ \t]*=[ \t]*(?:{_CUR})?[ \t]*(?P<res>{_NUM})[ \t]?(?P<ressuf>[km](?![a-z]))?)?")
_RX = re.compile(_PRICE + _GAP + _DISC, re.I)
# "less 16" / "-16%" with no price in front: a discount without a price
_LONE_RX = re.compile(r"(?<![\w.,])(?:less[ \t]+(?P<a>\d{1,2}(?:[.,]\d)?)(?![\d%k])|-[ \t]?(?P<b>\d{1,2}(?:[.,]\d)?)[ \t]?%)", re.I)
_NOT_A_WORD = {"n", "w", "y", "yr", "new", "used", "full", "set"}


def normalize_discount_text(line: str) -> str:
    s = clean(line or "")
    s = s.replace("\t", " ").replace("~", " ").replace("−", "-").replace("–", "-").replace("—", "-")
    return s


@dataclass
class Discount:
    base: int                  # list price as written
    pct: float                 # 17.0 for -17 %
    price: Optional[int]       # list price x (1 - pct); the dealer's own "= result" when written
    pre: Optional[str]         # currency written before the price
    post: Optional[str]        # currency written after the price
    impossible: bool = False   # over 70 %: a typo, the line goes to review
    span: tuple = (0, 0)

    @property
    def currency_tag(self) -> str:
        return (self.pre or self.post or "").lower()

    @property
    def remark(self) -> str:
        return f"-{self.pct:g}% Retail"


def _amount(num: str, suf: Optional[str]) -> Optional[float]:
    n = num.replace(" ", "")
    if suf:
        try:
            v = float(n.replace(",", "."))
        except ValueError:
            return None
        return v * (1000 if suf.lower() == "k" else 1_000_000)
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", n):
        n = n.replace(".", "")
    n = n.replace(",", "")
    try:
        return float(n)
    except ValueError:
        return None


def find_discount(line: str) -> Optional[Discount]:
    """The first 'price - discount' of a line, else None. `line` should be ONE watch line."""
    s = normalize_discount_text(line)
    for m in _RX.finditer(s):
        word = (m.group("word") or "").lower()
        if word in _NOT_A_WORD:
            continue
        pc = bool(m.group("pc"))
        minus = bool(m.group("minus") or m.group("minus2"))
        if not (pc or minus):
            continue
        if m.group("new"):
            continue                                  # "99% new": condition grade
        try:
            pct = float(m.group("pct").replace(",", "."))
        except ValueError:
            continue
        if pc and pct >= CONDITION_GRADE and not minus:
            continue                                  # "$2170000 99%": condition grade
        if pct < MIN_DISCOUNT and not pc:
            continue
        base = _amount(m.group("num"), m.group("suf"))
        if not base or base < 1000:
            continue
        if not (m.group("pre") or m.group("post") or m.group("suf")) and 1990 <= base <= 2035:
            continue                                  # a year, not a price ("2024 -15%")
        if not pc and not m.group("suf") and 1990 <= base <= 2035:
            continue                                  # "hkd 2026-9": a year and its month, not a price and a discount
        if pct > MAX_DISCOUNT:
            return Discount(int(base), pct, None, m.group("pre"), m.group("post"), True, m.span())
        price = int(base * (1 - pct / 100) + 0.5)
        if m.group("res"):
            res = _amount(m.group("res"), m.group("ressuf"))
            if res and abs(res - price) <= max(base * 0.03, 5):
                price = int(res)
        return Discount(int(base), pct, price, m.group("pre"), m.group("post"), False, m.span())
    return None


def lone_discount(line: str) -> Optional[float]:
    """A discount with no price in front ('WSSA0061 N10 less 16'): the percentage, else None."""
    s = normalize_discount_text(line)
    if find_discount(s):
        return None
    m = _LONE_RX.search(s)
    if not m:
        return None
    return float((m.group("a") or m.group("b")).replace(",", "."))
