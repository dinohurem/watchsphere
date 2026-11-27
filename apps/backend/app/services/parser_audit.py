"""Daily audit of the offers imported from WhatsApp: every new offer against its own dealer line.

Kenan found the parser bugs of 25/26 Nov 2026 by hand (wrong year, price from another line,
discount from "-4 links", ...). This runs the same checks automatically, once a day over the
offers created or updated in the last 24 hours, so a parser bug shows up within a day.

The checks are deliberately independent of the parser: they read numbers and years straight from
the raw line with their own small regexes. A parser bug therefore cannot hide itself by being
repeated here. Each check is conservative: when the line is ambiguous it does not flag.

Finding codes: PRICE_NOT_IN_LINE, YEAR_NOT_IN_LINE, YEAR_MISSING, WRONG_BLOCK,
DISCOUNT_WITHOUT_PERCENT, DISCOUNT_FROM_LINKS, CONDITION_INVALID, DUPLICATE_LINE,
WTB_FROM_SALE_LINE.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Optional

from app.services import offer_dedupe
from app.services import offer_lifecycle as lifecycle

logger = logging.getLogger(__name__)

CODES = [
    "PRICE_NOT_IN_LINE", "YEAR_NOT_IN_LINE", "YEAR_MISSING", "WRONG_BLOCK",
    "DISCOUNT_WITHOUT_PERCENT", "DISCOUNT_FROM_LINKS", "CONDITION_INVALID", "DUPLICATE_LINE",
    "WTB_FROM_SALE_LINE",
]
EXAMPLES_PER_CODE = 50
STATE_KEY = "parser_audit"
CHECK_INTERVAL_SECONDS = 15 * 60
VALID_CONDITIONS = {"Unworn", "Used", None}

# --------------------------------------------------------------------------- #
# Reading numbers and years from a raw line (independent of the generator's parser)

_NUM_RE = re.compile(r"(\d[\d.,]*)(?:([kKmM万])(?!a[ry]\b))?")
_CURRENCY_BEFORE = re.compile(r"(?:hk\$|hkd|usdt|usd|eur|aed|chf|gbp|cny|rmb|sgd|jpy|[$€£¥])\s*$", re.I)
_YEAR4 = re.compile(r"(?<![A-Za-z0-9$€£¥])(?<!\d[.,])((?:19|20)\d{2})(?![\d]|\s*[kKmM](?![a-zA-Z])|[.,]\d)"
                    r"|(?<![\d])((?:19|20)\d{2})[yY](?![A-Za-z])")
_DEDUCT = re.compile(r"(?<![\w.,/])-\s*(\d{1,2}(?:\.\d)?)(?![\d.,%/])|(?<![\d.,])(\d{1,2}(?:\.\d)?)\s*(links?\b|off\b)", re.I)
_YEAR2_Y = re.compile(r"(?<![\d.,])(\d{2})\s*[yY](?![a-zA-Z])")
_YEAR_APOS = re.compile(r"['’](\d{2})(?!\d)")
_MONTH_YEAR = re.compile(r"(?<![\w/.,])(?:[nNwW]\s*)?(1[0-2]|0?[1-9])\s*/\s*(\d{4}|\d{2})(?![\d/])")
_NMONTH = re.compile(r"(?<![A-Za-z0-9])[nNwW]\s*(1[0-2]|0?[1-9])(?![\d/])")
_PERCENT = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")
_LINKS = re.compile(r"^\s*-?\s*links?\b", re.I)
_REMARK_PCT = re.compile(r"(\d+(?:[.,]\d+)?)\s*%\s*retail", re.I)


def number_values(token: str, suffix: Optional[str]) -> list[float]:
    """Every plausible value of a written number: 192k, 1.86m, 105.000, 126,500, 2,100,000.00."""
    mult = {"k": 1e3, "m": 1e6, "万": 1e4}.get((suffix or "").lower(), 1.0)
    token = token.rstrip(".,")
    out: list[float] = []
    for variant in (token, token.replace(",", ""), token.replace(".", "").replace(",", ""),
                    token.replace(",", ".")):
        try:
            out.append(float(variant) * mult)
        except ValueError:
            continue
    return out


def line_numbers(line: str) -> list[tuple[str, float, bool]]:
    """[(written token, one value, written with a currency/k/m marker)] for every number in the line."""
    out = []
    for m in _NUM_RE.finditer(line or ""):
        tok, suffix = m.group(1), m.group(2)
        marked = bool(suffix) or bool(_CURRENCY_BEFORE.search(line[: m.start()])) or bool(
            re.match(r"\s*(?:hk\$|hkd|usdt|usd|eur|aed|chf|gbp|[$€£])", line[m.end():], re.I))
        for v in number_values(tok, suffix):
            out.append((m.group(0), v, marked))
        if suffix:  # "57000m": also the number as written
            for v in number_values(tok, None):
                out.append((m.group(0), v, marked))
    return out


def _close(a: float, b: float, rel: float = 0.0002) -> bool:
    return abs(a - b) <= max(1.0, abs(b) * rel)


def price_in_line(price: float, line: str) -> bool:
    for _tok, v, _marked in line_numbers(line):
        if _close(v, price):
            return True
        # "$195" / "HKD 28.5": a bare short number meaning thousands
        if v < 1000 and _close(v * 1000, price):
            return True
    return False


def percents_in(line: str) -> list[float]:
    return [float(m.group(1).replace(",", ".")) for m in _PERCENT.finditer(line or "")]


def written_years(line: str) -> set[int]:
    """Explicit years in the line, in every notation the dealers use (2026New, 22y, N8/26, 11/2020)."""
    years: set[int] = set()
    for m in _YEAR4.finditer(line or ""):
        years.add(int(m.group(1) or m.group(2)))
    for m in _YEAR2_Y.finditer(line or ""):
        years.add(2000 + int(m.group(1)))
    for m in _YEAR_APOS.finditer(line or ""):
        years.add(2000 + int(m.group(1)))
    for m in _MONTH_YEAR.finditer(line or ""):
        y = m.group(2)
        years.add(int(y) if len(y) == 4 else 2000 + int(y))
    return {y for y in years if 1990 <= y <= 2035}


def has_n_month(line: str) -> bool:
    return bool(_NMONTH.search(line or ""))


# --------------------------------------------------------------------------- #
# Lines, blocks and watch lines

_REF_TOKEN = re.compile(r"^[A-Za-z]{0,3}\d{3,6}[A-Za-z]{0,6}(?:[-/.][A-Za-z0-9]+)*$")
_NOT_REF = re.compile(
    r"^(?:(?:19|20)\d{2}[A-Za-z]{0,4}|\d{2}[yY]|[nNwW]\d{1,2}(?:/\d{2,4})?|\d{1,2}/\d{2,4})$")


def split_lines(text: str) -> list[str]:
    return (text or "").replace("\r", "").split("\n")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def ref_tokens(line: str) -> list[str]:
    """Reference-like tokens of a line (not prices, years, N-months)."""
    out = []
    for raw in re.split(r"[\s|,;:()\[\]*]+", line or ""):
        tok = re.sub(r"^[^\w]+|[^\w]+$", "", raw)
        if len(tok) < 4 or not re.search(r"\d", tok) or _NOT_REF.match(tok):
            continue
        if re.fullmatch(r"\d+[kKmM]", tok) or "," in tok:
            continue
        if not _REF_TOKEN.match(tok):
            continue
        if tok.isdigit() and len(tok) not in (5, 6):
            continue
        # a pure number right after a currency is a price
        pos = (line or "").find(raw)
        if tok.isdigit() and pos >= 0 and _CURRENCY_BEFORE.search(line[:pos]):
            continue
        out.append(tok)
    return out


def own_refs(order: dict) -> set[str]:
    """The offer's reference as a dealer would write it (normalised), plus its leading digits."""
    refs: set[str] = set()
    for field in ("ws_code", "reference"):
        first = (order.get(field) or "").split()
        if first:
            n = _norm(first[0])
            if len(n) >= 4:
                refs.add(n)
                lead = re.match(r"\d{5,6}", n)
                if lead:
                    refs.add(lead.group(0))
    for alias in order.get("aliases") or []:
        n = _norm(alias)
        if len(n) >= 4:
            refs.add(n)
    return refs


def mentions_ref(line: str, refs: set[str]) -> bool:
    n = _norm(line)
    return any(r in n for r in refs)


def own_lines(order: dict, lines: list[str]) -> list[int]:
    """Indexes of the lines that carry the offer: its price first, else its reference."""
    price = order.get("price")
    if price:
        idx = [i for i, ln in enumerate(lines) if price_in_line(price, ln)]
        if idx:
            return idx
    refs = own_refs(order)
    return [i for i, ln in enumerate(lines) if refs and mentions_ref(ln, refs)]


# --------------------------------------------------------------------------- #
# Findings

def _finding(code: str, order: dict, why: str, line: str) -> dict[str, Any]:
    cond = order.get("condition")
    return {
        "code": code,
        "order_id": str(order.get("_id")),
        "ws_code": order.get("ws_code"),
        "dealer": order.get("whatsapp_phone"),
        "side": order.get("order_type"),
        "line": (line or "")[:300],
        "price": order.get("price"),
        "currency": order.get("currency"),
        "year": order.get("year"),
        "month": order.get("watch_month"),
        "condition": cond if isinstance(cond, str) or cond is None else str(cond),
        "remarks": order.get("remarks"),
        "why": why,
    }


def _ref_year(order: dict) -> int:
    d = order.get("created_at") or datetime.utcnow()
    return d.year


def deductions(text: str) -> list[tuple[float, bool]]:
    """[(number, followed by link(s))] for every deduction-looking number: '-25', '-4links', '4 links', '3 off'."""
    out = []
    for m in _DEDUCT.finditer(text or ""):
        if m.group(1):
            links = bool(_LINKS.match((text or "")[m.end():]))
            out.append((float(m.group(1)), links))
        else:
            out.append((float(m.group(2)), (m.group(3) or "").lower().startswith("link")))
    return out


def check_price(order: dict, text: str, lines: list[str]) -> list[dict]:
    price = order.get("price")
    if not price or not text:
        return []
    if any(price_in_line(price, ln) for ln in lines):
        return []
    # after a discount written in the line: listed price minus a percent
    # (written with a % sign, or bare as "-4 links" / "-25": the discount checks judge which)
    pcts = percents_in(text) + [p for p, _links in deductions(text)]
    for _tok, v, _m in line_numbers(text):
        if v >= 1000:
            for p in pcts:
                if 0 < p <= 60 and _close(v * (1 - p / 100.0), price):
                    return []
    return [_finding("PRICE_NOT_IN_LINE", order,
                     f"stored price {price:,.0f} {order.get('currency') or ''} is not written in the line", _best_line(order, lines))]


def _best_line(order: dict, lines: list[str]) -> str:
    if len([ln for ln in lines if ln.strip()]) <= 1:
        return " ".join(ln.strip() for ln in lines if ln.strip())
    idx = own_lines(order, lines)
    return lines[idx[0]].strip() if idx else (lines[0] if lines else "")


def check_year(order: dict, text: str, lines: list[str]) -> list[dict]:
    multi = len([ln for ln in lines if ln.strip()]) > 1
    year = order.get("year")
    if year:
        if multi:
            idx = own_lines(order, lines)
            if not idx:
                return []
            # the line, and everything in the text: a year may sit on the header of the block
            seen = written_years(text)
            nm = any(has_n_month(lines[i]) for i in idx)
            shown = lines[idx[0]].strip()
            own_years = set().union(*(written_years(lines[i]) for i in idx))
            if own_years and year not in own_years and year not in seen:
                return [_finding("YEAR_NOT_IN_LINE", order,
                                 f"offer year {year}, the line says {sorted(own_years)}", shown)]
            return []
        found = written_years(text)
        if found:
            if year in found:
                return []
            return [_finding("YEAR_NOT_IN_LINE", order,
                             f"offer year {year}, the line says {sorted(found)}", _best_line(order, lines))]
        # no explicit year: N-month (new in month X) or a brand-new piece means this/last year
        ref = _ref_year(order)
        if has_n_month(text) and year in (ref, ref - 1):
            return []
        if year >= ref:
            return []
        return [_finding("YEAR_NOT_IN_LINE", order,
                         f"offer year {year}, no year written in the line", _best_line(order, lines))]
    # offer without year: the line must clearly state one
    if order.get("year_raw") or order.get("watch_month"):
        return []
    idx = own_lines(order, lines) if multi else [0]
    if not idx:
        return []
    target = lines[idx[0]] if multi else " ".join(lines)
    price = order.get("price")
    years = set()
    for m in _YEAR4.finditer(target):
        y = int(m.group(1) or m.group(2))
        if price and _close(float(y), price, 0.0001):
            continue
        years.add(y)
    years = {y for y in years if 1990 <= y <= 2035}
    years |= {y for y in written_years(target) if y not in years and _YEAR2_Y.search(target)}
    if years:
        return [_finding("YEAR_MISSING", order, f"the line says {sorted(years)}, the offer has no year", target.strip())]
    return []


def _section_headers(lines: list[str]) -> list[Optional[str]]:
    """'sale' / 'buy' / None for every line: the kind of the nearest header above (or on) it."""
    sale = re.compile(r"\b(wts|for sale|selling|sale list|stock list|available|in stock|offers?)\b", re.I)
    buy = re.compile(r"\b(wtb|want(?:ed)?|looking for|need(?:ed)?|buying|buyers?|requests?)\b", re.I)
    out: list[Optional[str]] = []
    current: Optional[str] = None
    for ln in lines:
        s = ln.strip()
        if s and len(s) <= 60 and not ref_tokens(s):
            a, b = bool(sale.search(s)), bool(buy.search(s))
            if a and not b:
                current = "sale"
            elif b and not a:
                current = "buy"
            elif a and b:
                current = None
        out.append(current)
    return out


def check_block(order: dict, text: str, lines: list[str]) -> list[dict]:
    if len([ln for ln in lines if ln.strip()]) < 2 or not order.get("price"):
        return []
    refs = own_refs(order)
    if not refs or not mentions_ref(text, refs):
        return []
    price_idx = [i for i, ln in enumerate(lines) if price_in_line(order["price"], ln)]
    if len(price_idx) != 1:
        return []
    i = price_idx[0]
    if mentions_ref(lines[i], refs):
        return []
    # the watch line above, inside the block (an empty line ends it)
    j = i - 1
    while j >= 0 and lines[j].strip():
        if ref_tokens(lines[j]):
            if mentions_ref(lines[j], refs):
                return []
            return [_finding("WRONG_BLOCK", order,
                             f"the price line sits under the watch line '{lines[j].strip()[:80]}', not under {order.get('ws_code')}",
                             lines[i].strip())]
        j -= 1
    return []


def check_discount(order: dict, text: str, lines: list[str]) -> list[dict]:
    """A deduction the dealer wrote without a percent sign ('-25', '-4links') that the offer treats as a
    percent: a '-x% Retail' remark, or a price lowered by x%. A remark whose number is nowhere in the line
    is a retail comparison the system computed, not a deduction: not flagged."""
    price = order.get("price")
    out: list[dict] = []
    remarks = order.get("remarks") or ""
    pcts = percents_in(text)
    deds = deductions(text)
    shown = _best_line(order, lines)
    for m in _REMARK_PCT.finditer(remarks):
        p = float(m.group(1).replace(",", "."))
        if any(abs(q - p) < 0.01 for q in pcts):
            continue
        for q, links in deds:
            if abs(q - p) < 0.01:
                if links:
                    out.append(_finding("DISCOUNT_FROM_LINKS", order,
                                        f"remark '{m.group(0)}' but the line writes '{m.group(1)} link(s)', not a percent", shown))
                else:
                    out.append(_finding("DISCOUNT_WITHOUT_PERCENT", order,
                                        f"remark '{m.group(0)}' but the line has no '{m.group(1)}%'", shown))
                return out
    if not price or out:
        return out
    # a deducted price: a listed number x (1 - p/100), where p is not written as a percent
    nums = [v for _t, v, _m in line_numbers(text) if v >= 1000]
    if not nums or any(_close(v, price) for v in nums):
        return out
    for v in nums:
        for p, links in deds:
            if 1 <= p <= 60 and not any(abs(q - p) < 0.01 for q in pcts) and _close(v * (1 - p / 100.0), price):
                code = "DISCOUNT_FROM_LINKS" if links else "DISCOUNT_WITHOUT_PERCENT"
                what = "link(s)" if links else "no percent sign"
                return [_finding(code, order,
                                 f"price is {v:,.0f} less {p:g}%, but the line writes {p:g} with {what}", shown)]
    return out


def check_condition(order: dict, text: str, lines: list[str]) -> list[dict]:
    cond = order.get("condition")
    if cond in VALID_CONDITIONS:
        return []
    return [_finding("CONDITION_INVALID", order, f"condition {cond!r} is not Unworn, Used or empty", _best_line(order, lines))]


def check_wtb_from_sale(order: dict, text: str, lines: list[str]) -> list[dict]:
    if str(order.get("order_type") or "").lower() != "buy":
        return []
    nonempty = [ln for ln in lines if ln.strip()]
    refs = own_refs(order)
    sections = _section_headers(lines)
    idx = own_lines(order, lines)
    if not idx or not refs:
        return []
    i = idx[0]
    has_price = any(m[2] or m[1] >= 1000 for m in line_numbers(lines[i])
                    if not _close(m[1], 0) and not mentions_ref_token(lines[i], m[0]))
    if len(nonempty) > 1 and sections[i] == "sale" and has_price:
        return [_finding("WTB_FROM_SALE_LINE", order, "request created from a priced line under a sale header", lines[i].strip())]
    if len(nonempty) > 1 and not any(s == "buy" for s in sections) and not re.search(r"\b(wtb|want|looking|need)", text, re.I):
        priced = [ln for ln in nonempty if ref_tokens(ln) and any(m[2] for m in line_numbers(ln))]
        reflines = [ln for ln in nonempty if ref_tokens(ln)]
        if len(priced) >= 3 and len(priced) >= 0.8 * len(reflines) and has_price:
            return [_finding("WTB_FROM_SALE_LINE", order, "request created from a message that is a sale list", lines[i].strip())]
    if len(nonempty) == 1 and has_price and re.search(r"\b(wts|for sale|selling)\b", lines[i], re.I) \
            and not re.search(r"\b(wtb|want|looking|need)", lines[i], re.I):
        return [_finding("WTB_FROM_SALE_LINE", order, "request created from a line marked WTS / for sale", lines[i].strip())]
    return []


def mentions_ref_token(line: str, token: str) -> bool:
    """The number token is part of a reference written in the line (not a price)."""
    t = token.strip()
    return any(t.rstrip(".,") in rt and rt != t.rstrip(".,") for rt in ref_tokens(line))


CHECKS = (check_price, check_year, check_block, check_discount, check_condition, check_wtb_from_sale)


def audit_order(order: dict) -> list[dict]:
    """Findings of one imported offer against its own source text (no database)."""
    text = order.get("source_text") or ""
    lines = split_lines(text)
    found: list[dict] = []
    for check in CHECKS:
        try:
            found.extend(check(order, text, lines))
        except Exception as exc:  # one broken check must never stop the audit
            logger.warning("parser audit: %s failed on %s: %s", check.__name__, order.get("_id"), exc)
    return found


def audit_duplicates(window: list[dict], peers: list[dict]) -> list[dict]:
    """DUPLICATE_LINE: same dealer + side + WS code + normalised line, reusing the dedupe plan."""
    in_window = {o["_id"] for o in window}
    out: list[dict] = []
    for old, keep, reason in offer_dedupe.plan(peers):
        if old["_id"] in in_window or keep["_id"] in in_window:
            if not lifecycle.line_key(old.get("source_text")):
                continue
            out.append(_finding("DUPLICATE_LINE", old,
                                f"{reason.replace('_', ' ')}: offer {keep['_id']} has the same dealer line",
                                (old.get("source_text") or "")[:300]))
    return out


def audit_orders(window: list[dict], peers: Optional[list[dict]] = None) -> list[dict]:
    findings: list[dict] = []
    for order in window:
        findings.extend(audit_order(order))
    findings.extend(audit_duplicates(window, peers if peers is not None else window))
    return findings


def summarise(findings: list[dict], per_code: int = EXAMPLES_PER_CODE) -> tuple[dict[str, int], dict[str, list[dict]]]:
    counts: dict[str, int] = {}
    examples: dict[str, list[dict]] = {}
    for f in findings:
        counts[f["code"]] = counts.get(f["code"], 0) + 1
        bucket = examples.setdefault(f["code"], [])
        if len(bucket) < per_code:
            bucket.append(f)
    return counts, examples


# --------------------------------------------------------------------------- #
# Database

_FIELDS = {
    "order_type": 1, "ws_code": 1, "reference": 1, "aliases": 1, "whatsapp_phone": 1, "source_text": 1,
    "price": 1, "currency": 1, "year": 1, "watch_month": 1, "year_raw": 1, "condition": 1, "remarks": 1,
    "created_at": 1, "updated_at": 1, "last_seen_at": 1,
}


async def collect(since: datetime) -> tuple[list[dict], list[dict]]:
    """(offers created/updated since, all active offers of the same dealer + WS code)."""
    from app.models.order import Order, OrderStatus

    col = Order.get_motor_collection()
    base = {"status": OrderStatus.ACTIVE.value, "whatsapp_phone": {"$nin": [None, ""]},
            "source_text": {"$nin": [None, ""]}, "superseded_by": None}
    window = [o async for o in col.find(
        {**base, "$or": [{"created_at": {"$gte": since}}, {"updated_at": {"$gte": since}}]}, _FIELDS)]
    keys = {(o.get("whatsapp_phone"), o.get("ws_code")) for o in window if o.get("ws_code")}
    peers: list[dict] = []
    if keys:
        phones = sorted({k[0] for k in keys})
        codes = sorted({k[1] for k in keys})
        peers = [o async for o in col.find({**base, "whatsapp_phone": {"$in": phones}, "ws_code": {"$in": codes}}, _FIELDS)]
    return window, peers


async def run_audit(hours: float = 24, now: Optional[datetime] = None) -> dict[str, Any]:
    """Audit the offers of the last ``hours``. Read-only; returns the report as a dict."""
    now = now or datetime.utcnow()
    since = now - timedelta(hours=hours)
    window, peers = await collect(since)
    findings = audit_orders(window, peers)
    counts, examples = summarise(findings)
    return {"run_at": now, "since": since, "hours": hours, "checked": len(window),
            "total_findings": len(findings), "counts": counts, "examples": examples}


async def store_report(result: dict[str, Any], trigger: str, emailed: int = 0):
    from app.models.parser_audit import ParserAuditReport

    report = ParserAuditReport(**result, trigger=trigger, emailed_to=emailed)
    await report.insert()
    return report


# --------------------------------------------------------------------------- #
# Email

def email_lines(result: dict[str, Any], per_code: int = 3) -> list[str]:
    lines = [f"{result['checked']} offers checked (last {result['hours']:g} h), "
             f"{result['total_findings']} finding(s)."]
    for code in CODES:
        n = result["counts"].get(code)
        if not n:
            continue
        lines.append(f"{code}: {n}")
        for ex in result["examples"].get(code, [])[:per_code]:
            lines.append(f"    {ex.get('ws_code')} | {ex.get('dealer')} | {ex.get('line')} | {ex.get('why')}")
    return lines


async def send_email(result: dict[str, Any]) -> int:
    from html import escape

    from app.core.config import settings
    from app.models.user import User, UserRole
    from app.services.email import email_service
    from app.services.pipeline import report_recipients

    base = settings.WEB_APP_URL.rstrip("/")
    lines = email_lines(result)
    link = f"{base}/admin/approval"
    api = "GET /api/v1/admin/parser-audit/latest"
    text = "WatchSphere parser audit\n\n" + "\n".join(lines) + f"\n\nFull report: {api}\nApproval page: {link}\n"
    html = email_service._get_email_template(
        "<h2 style=\"margin:0 0 16px\">Parser audit</h2><ul>"
        + "".join(f"<li>{escape(line)}</li>" for line in lines)
        + f"</ul><p>Full report with all examples: <code>{api}</code> (admin login)</p>"
        + f"<p><a href=\"{link}\">Open the approval page</a></p>"
    )
    admins = await User.find({"role": UserRole.ADMIN.value}).to_list()
    sent = 0
    for email in report_recipients([a.email for a in admins], settings.PIPELINE_REPORT_EXTRA_RECIPIENTS):
        if await email_service._send_email(email, "WatchSphere – parser audit findings", html, text):
            sent += 1
    return sent


# --------------------------------------------------------------------------- #
# Schedule: once a day at PARSER_AUDIT_HOUR_UTC, never twice (also across restarts)

def is_due(now: datetime, last_run: Optional[datetime], hour_utc: int) -> bool:
    slot = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    return now >= slot and (last_run is None or last_run < slot)


async def run_scheduled(now: Optional[datetime] = None) -> Optional[dict[str, Any]]:
    """Run the daily audit when it is due. The run is claimed in the state row BEFORE it starts,
    so a restart (or a second instance) during the run does not start another one."""
    from app.core.config import settings
    from app.models.pipeline import PipelineReportState

    now = now or datetime.utcnow()
    state = await PipelineReportState.find_one({"key": STATE_KEY})
    if not is_due(now, state.last_sent_at if state else None, settings.PARSER_AUDIT_HOUR_UTC):
        return None
    if state is None:
        state = PipelineReportState(key=STATE_KEY)
    state.last_sent_at = now
    await state.save()
    result = await run_audit(settings.PARSER_AUDIT_HOURS, now)
    sent = 0
    if result["total_findings"]:
        try:
            sent = await send_email(result)
        except Exception as exc:
            logger.warning("parser audit: email failed: %s", str(exc)[:200])
    await store_report(result, "scheduled", sent)
    logger.info("parser audit: %d offers, %d findings, mailed to %d", result["checked"], result["total_findings"], sent)
    return result


async def parser_audit_loop() -> None:
    from app.core.config import settings

    if not settings.PARSER_AUDIT_ENABLED:
        logger.info("parser audit: disabled (PARSER_AUDIT_ENABLED=false)")
        return
    await asyncio.sleep(120)
    while True:
        try:
            await run_scheduled()
        except Exception as exc:
            logger.warning("parser audit failed: %s", str(exc)[:200])
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
