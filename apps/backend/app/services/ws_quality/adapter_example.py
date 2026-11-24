"""Example wiring into app/services/wtb_wts_service.py (state of 29 Oct 2026). Not a drop-in for production:
it shows WHERE each function plugs in and is what the before/after numbers in the report were measured with.

    import app.services.wtb_wts_service as svc
    from ws_quality import adapter_example
    adapter_example.install(svc)
"""
import re
from typing import Optional
from .normalize import clean, strip_invisible
from .prices import parse_price, message_currency
from .classify import split_sections, _refs as _section_refs, _STRONG_PRICE
from .wtb import parse_wtb_line, _YEARLIKE


def _fmt(amount: Optional[int]) -> Optional[str]:
    return f"{amount:,}" if amount else None


def install(svc):
    """Monkeypatch the four spots. `svc` is the imported wtb_wts_service module."""
    state = {"ctx": None}

    # 1. invisible characters: extend the strip list (U+180E & friends, hyphen look-alikes)
    svc._strip_invisible = strip_invisible

    # 2. post type: sections instead of "first keyword wins"
    def detect_post_type(content: str) -> Optional[str]:
        if svc.should_skip_message(content):
            return None
        modes = [m for m, _ in split_sections(content)]
        if not modes:
            return None
        return modes[0] if len(set(modes)) == 1 else "MIXED"
    svc.detect_post_type = detect_post_type

    # 3. price extraction: one parser for message level and line level
    def extract_price(content: str, sender_country: Optional[str] = None):
        p = parse_price(content, sender_country, state["ctx"], _refs(svc, content))
        return (_fmt(p.amount), p.currency) if p.amount and p.how != "bare" else (None, None)

    def extract_price_from_line(line: str, sender_country: Optional[str] = None):
        p = parse_price(line, sender_country, state["ctx"], _refs(svc, line))
        return (_fmt(p.amount), p.currency) if p.amount else (None, None)

    def extract_wtb_price(content: str, sender_country: Optional[str] = None):
        f = parse_wtb_line(content, "", sender_country)           # one parser for every WTB field
        return (_fmt(f["price"]), f["currency"]) if f["price"] else (None, None)

    svc.extract_price = extract_price
    svc.extract_price_from_line = extract_price_from_line
    svc.extract_wtb_price = extract_wtb_price

    # 4. process each section in its own mode, with the message-level currency context
    orig = svc._process_messages_sync

    def process(messages, mode, watch_index, group_name, ref_month, ref_year, progress_state=None):
        out = {"matched_rows": [], "needs_review_rows": [], "not_in_database_rows": [], "detected_posts": 0, "fuzzy_match_count": 0}
        for msg in messages:
            content = clean_message(msg["content"])
            phone = svc.extract_phone_number(msg["sender"])
            country = svc.get_country_from_phone(phone) if phone else None
            state["ctx"] = message_currency(content, country, group_name)
            for sec_mode, text in split_sections(content):
                if sec_mode != mode:
                    continue
                if mode == "WTB":
                    ls = [l for l in text.split("\n") if l.strip() and not _MEDIA.match(l.strip())]
                    one = {m.group(0).lower() for l in ls for m in _section_refs(l) if not _YEARLIKE.match(m.group(0))}
                    if len(one) == 1 and 1 < len(ls) <= 8 and sum(1 for l in ls if _STRONG_PRICE.search(l)) <= 1:
                        text = ", ".join(ls)                      # one watch described over several lines: reference, condition and target belong together
                keep = svc.detect_post_type
                svc.detect_post_type = lambda _c, _m=sec_mode: _m          # the section already has its type
                try:
                    r = orig([{**msg, "content": text}], mode, watch_index, group_name, ref_month, ref_year)
                finally:
                    svc.detect_post_type = keep
                for k in ("matched_rows", "needs_review_rows", "not_in_database_rows"):
                    out[k].extend(r[k])
                out["detected_posts"] += r["detected_posts"]
        return out
    svc._process_messages_sync = process
    return svc


_MEDIA = re.compile(r"^(?:bild|video|sticker|audio|dokument|gif)\s+weggelassen$|^(?:image|video|sticker|audio|document|gif)\s+omitted$|^<media omitted>$", re.I)


def clean_message(content: str) -> str:
    return "\n".join(clean(l) for l in content.split("\n"))


_PRICE_CTX = r"(?:[.,]\d{3}|\s?(?:k|m|hkd|hk\$|usdt?|usd|eur|euros?|aed|rmb|cny|u|€|\$|£)(?![a-z]))"
_PRICE_BEFORE = re.compile(r"(?:hk\$|hkd|usdt?|eur|euros?|aed|€|\$|£)\s*[:=\-]?\s*$", re.I)


def _is_price_token(token: str, line: str) -> bool:
    """A 'reference' found by the generator that is really a price: '112' in '112,000$', '71500' in '71500 usdt', '336k'."""
    if re.fullmatch(r"\d[\d.,]*\s?[km]", token, re.I):
        return True
    for m in re.finditer(re.escape(token), line):
        if not token.isdigit():
            return False
        if re.match(_PRICE_CTX, line[m.end():m.end() + 8], re.I) or _PRICE_BEFORE.search(line[max(0, m.start() - 8):m.start()]):
            return True
    return False


def _refs(svc, text: str):
    """References on this line, so their digits can never be read as a price."""
    out = []
    for l in text.split("\n"):
        r = svc._extract_ref_from_line(l)
        if r and len(re.sub(r"[^A-Za-z0-9]", "", r)) >= 4 and not _is_price_token(r, l):
            out.append(r)
        for m in re.findall(r"(?<![A-Za-z0-9])(?:\d{5,6}[A-Za-z]{1,6}|\d{4}/\d{1,4}[A-Za-z]{0,3}(?:-\d{3})?|\d{4}[A-Za-z]{1,3}(?:-\d{3})?)(?![A-Za-z0-9])", l):
            if not re.fullmatch(r"\d+(?:usdt?|hkd|eur|aed|rmb|cny|k|m|u|y|yr|year|mm)", m, re.I):
                out.append(m)
    return out
