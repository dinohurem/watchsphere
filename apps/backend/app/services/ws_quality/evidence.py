"""Evidence helpers: does the text literally name this watch, and does it carry this price?"""
import re
from typing import Iterable, Set, Optional, List, Tuple
from .normalize import clean

_DESC = (r"black|blk|blue|blu|green|grn|white|wht|grey|gray|silver|champ|choco|chocolate|pink|purple|ombre|index|roman|rom|jub|jubilee|"
         r"oys|oyster|mete|meteorite|wim|wimbledon|tiffany|tiff|ice|mint|olive|pave|red|yellow|orange|salmon|brown|cream|beige|lavender|"
         r"pistachio|candy|coral|sundust|panda|rainbow|motif|slate|rhodium|turquoise|mop|yml|pikachu|pika|celebration|palm|aubergine|choc|cho")
_GLUE = re.compile(r"(?<=\d)(?=(?:" + _DESC + r")(?![a-z]))", re.I)


def norm(s: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


_BRAND_GLUE = re.compile(r"(?<![A-Za-z0-9])(AP|PP|VC|ROLEX|PATEK|TUDOR|OMEGA|CARTIER)(?=\d{4})", re.I)


def prep(text: str) -> str:
    """clean() + split glued descriptors and brand prefixes: 228239OMBRE -> 228239 OMBRE, AP16202ST -> AP 16202ST"""
    return _BRAND_GLUE.sub(r"\1 ", _GLUE.sub(" ", clean(text)))


def watch_forms(ws_code: str, reference: str = "", oem_references: Iterable[str] = (), aliases: Iterable[str] = ()) -> Tuple[Set[str], Set[str]]:
    """-> (forms, short_forms), all normalised.
    forms       : every spelling that identifies the reference (ws code token, reference, OEM refs with/without catalogue number, alias tokens)
    short_forms : first chunk of a long reference ("26393NR" for 26393NR.OO.A002KB.02) - valid only if the text does not continue with another suffix
    """
    forms, short = set(), set()
    first = ws_code.split()[0] if ws_code.split() else ""
    forms.add(norm(first))
    for ref in [reference] + list(oem_references or []):
        if ref:
            forms.add(norm(ref))
            forms.add(norm(re.sub(r"-\d{3,4}$", "", ref)))
    for a in aliases or []:
        parts = a.split()
        if parts and re.search(r"\d{3}", parts[0]):
            forms.add(norm(parts[0]))
        if re.search(r"\d{3}", a) and len(norm(a)) <= 24 and not re.search(r"[A-Za-z]{3,}\s", a):
            forms.add(norm(a))
    for full in [first, reference] + list(oem_references or []):
        if not full:
            continue
        chunks = re.split(r"[.\-]", full)
        if len(chunks) > 1 and len(norm(chunks[0])) >= 5 and re.search(r"\d{4}", chunks[0]) and re.search(r"[A-Za-z]", chunks[0]):
            short.add(norm(chunks[0]))
    return {f for f in forms if len(f) >= 4}, short


def _alt(forms: Iterable[str]) -> str:
    return "|".join(r"[\s./\-]?".join(re.escape(c) for c in f) for f in sorted(forms, key=len, reverse=True))


def compile_matcher(forms: Set[str], short_forms: Set[str] = frozenset()):
    """Pre-compiled version of names_watch for bulk checks: returns f(text) -> bool. `text` must already be prep()-ed."""
    a = re.compile(r"(?<![A-Za-z0-9])(?:" + _alt(forms) + r")(?:[-.]\d{3,4})?(?![A-Za-z0-9])(?!/[A-Za-z0-9])", re.I) if forms else None
    b = re.compile(r"(?<![A-Za-z0-9])(?:" + _alt(short_forms) + r")(?![A-Za-z0-9])(?![./\-][A-Za-z0-9])", re.I) if short_forms else None
    return lambda t: bool(a and a.search(t)) or bool(b and b.search(t))


def names_watch(text: str, forms: Set[str], short_forms: Set[str] = frozenset()) -> bool:
    """True if `text` literally names the reference.
    Strict at the borders: "5712R" does not name 5712/1R, "5167/1A" does not name 5167A, "279171G" does not name 279171.
    A trailing catalogue number is fine: "91550-0013" names 91550, "5711/1A-018" names 5711/1A."""
    t = prep(text)
    if forms and re.search(r"(?<![A-Za-z0-9])(?:" + _alt(forms) + r")(?:[-.]\d{3,4})?(?![A-Za-z0-9])(?!/[A-Za-z0-9])", t, re.I):
        return True
    if short_forms and re.search(r"(?<![A-Za-z0-9])(?:" + _alt(short_forms) + r")(?![A-Za-z0-9])(?![./\-][A-Za-z0-9])", t, re.I):
        return True
    return False


_CHUNK = re.compile(r"(?<![A-Za-z0-9])([A-Za-z0-9]+(?:[/.\-][A-Za-z0-9]+){0,6})(?![A-Za-z0-9])")
_UNIT = re.compile(r"^(HKD|USD|USDT|EUR|AED|RMB|CNY|HK|N|W|Y|K|M|NO|X)?\d+([.,]\d+)?(K|M|MIL|Y|YR|YEAR|HKD|USD|USDT|EUR|U|MM|PCS|LINKS?)?$")


def reference_tokens(text: str) -> List[str]:
    """Reference-like tokens in a text (raw spelling). Prices, dates, years and units are dropped."""
    out = []
    for m in _CHUNK.finditer(prep(text)):
        raw = m.group(1)
        n = norm(raw)
        if sum(c.isdigit() for c in n) < 3 or not 4 <= len(n) <= 22:
            continue
        if re.fullmatch(r"(19|20)\d\d[YR]*", n) or re.fullmatch(r"[NW]\d{1,2}(20)?\d{2}", n) or re.fullmatch(r"\d{1,2}(ST|ND|RD|TH)", n):
            continue
        if re.fullmatch(r"\d{1,3}([.,]\d{3})+([.,]\d{1,2})?", raw) or re.fullmatch(r"\d+[.,]\d+[A-Za-z]{0,4}", raw):
            continue
        if re.fullmatch(r"\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?", raw) or re.fullmatch(r"\d{1,2}[/.-](19|20)\d{2}", raw) or re.fullmatch(r"(19|20)\d{2}[/.-]\d{1,2}([/.-]\d{1,2})?", raw):
            continue
        if not re.search(r"[-/]", raw) and raw.count(".") < 2 and _UNIT.match(n) and not re.fullmatch(r"\d{4,6}", n):
            continue
        if re.fullmatch(r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[-./]?\d{2,4}", raw, re.I):
            continue
        if re.search(r"hkd|usdt?|eur|aed|rmb|cny", raw, re.I) or re.fullmatch(r"\d+(?:\.\d+)?[km](?:/\d+(?:\.\d+)?[km]u?)*", raw, re.I):
            continue                                                   # HKD570k/73.3kU, 159k/168k
        if re.fullmatch(r"[nw]\d{1,2}(?:/[nw]?\d{1,2})+", raw, re.I) or re.fullmatch(r"(?:19|20)\d\d[nw]\d{1,2}", raw, re.I) or re.fullmatch(r"\d{4,7}-\d{1,2}", raw):
            continue                                                   # N1/N10, 2026N1, 39500-10(%)
        out.append(raw)
    return out


_NUMRE = re.compile(
    r"(?<![A-Za-z0-9])(?:hk\$|hkd|usdt?|eur|€|\$|£|rmb|cny|aed)?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)\s*(k|m|w|万|萬)?\s*(?:hkd|usdt?|eur|euros?|rmb|cny|aed|gbp|u)?(?![A-Za-z0-9])",
    re.I,
)


def price_readings(text: str) -> Set[int]:
    """Every plausible numeric reading of the numbers in a text (k/m expanded, any thousands separator, dealer shorthand)."""
    out: Set[int] = set()
    t = prep(text)
    for m in _NUMRE.finditer(t):
        raw, suf = m.group(1), (m.group(2) or "").lower()
        try:
            if suf and re.fullmatch(r"\d+[.,]\d+", raw):
                v = float(raw.replace(",", "."))
            elif re.fullmatch(r"\d{1,3}([.,]\d{3})+", raw):
                v = float(re.sub(r"[.,]", "", raw))
            elif re.fullmatch(r"\d{1,3}([.,]\d{3})+[.,]\d{1,2}", raw):
                v = float(re.sub(r"[.,]", "", re.sub(r"[.,]\d{1,2}$", "", raw)))
            elif re.fullmatch(r"\d+[.,]\d{1,2}", raw):
                v = float(raw.replace(",", "."))
            else:
                v = float(re.sub(r"[.,]", "", raw))
        except ValueError:
            continue
        if suf == "k":
            out.add(round(v * 1000))
        elif suf == "m":
            out.add(round(v * 1_000_000))
        elif suf in ("w", "万", "萬"):
            out.add(round(v * 10_000))
        else:
            out.add(round(v))
            if v < 1000:
                out.add(round(v * 1000))
    for m in re.finditer(r"(\d[\d,.]*\d)\s*-\s*(\d{1,2}(?:\.\d)?)\s*%", t):      # 565000-25%, "$71000  -23%", "$108900 -26.5%"
        try:
            v = float(re.sub(r"[.,]", "", m.group(1))) * (100 - float(m.group(2))) / 100
            out.update({int(v + 1e-6), round(v)})
        except ValueError:
            pass
    return out


_CURS = [("USD", r"usdt|usd|us\$|(?<=\d)k?\s?u(?![a-z])"), ("HKD", r"hkd|hk\$|(?<![a-z])hk(?![a-z])"), ("EUR", r"€|eur"), ("CNY", r"rmb|cny|人民币"), ("AED", r"aed"), ("GBP", r"£|gbp")]


def currencies_in(text: str) -> Set[str]:
    t = clean(text)
    return {c for c, p in _CURS if re.search(p, t, re.I)}
