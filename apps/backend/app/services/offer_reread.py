"""Re-read existing imported sell offers with the CURRENT generator rules.

Offers imported before the parser fixes (PR #91 and earlier) still carry the old reading: a condition
the rules no longer give, a list price without the discount taken off, a year or W/N-month the old
date reader got wrong, remarks that miss the "-x% Retail" note. This job goes over the active
imported offers (``whatsapp_phone`` + ``source_text``, status active, not superseded), reads the
dealer's own line again with the generator's own functions (``_fill_fields``: condition, price
after discount, month/year, remarks) and corrects what differs, in bulk.

Which line: ``source_text`` is either one line or a whole message that several offers share. In a
whole message the offer's own line is found like the generator does: it names the watch (WS code,
reference, alias) and carries the stored price. Section headers above it ("used", "new") apply, as
in ``parse_stock_list``. A line that cannot be told apart from another is skipped, never guessed.

Never changed: ws_code, phone, currency (a parsed price in another currency is only counted),
buy offers. A date the parser no longer reads is left alone (never blanked).
"""
import logging
import re
from datetime import datetime
from typing import Any, Optional

from pymongo import UpdateOne

logger = logging.getLogger(__name__)

SAMPLE_SIZE = 30
BATCH = 500
_PRICE_FLAG_SEP = " | PRICE FLAG"
FIELDS = ("condition", "price", "year", "remarks")


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _anchors(doc: dict, watch: Optional[dict]) -> list[str]:
    found: list[str] = []
    for src in (doc, watch or {}):
        for key in ("ws_code", "reference"):
            v = src.get(key)
            if v:
                found.append(str(v))
        for key in ("aliases", "oem_references"):
            for v in src.get(key) or []:
                if v:
                    found.append(str(v))
    out = []
    for a in found:
        n = _norm(a)
        if len(n) >= 3 and n not in out:
            out.append(n)
    return out


def _price_values(line: str, country: Optional[str]) -> set[int]:
    from app.services import wtb_wts_service as g

    info = g.price_info(line, country, line_level=True)
    values = {int(round(v)) for v in (g._num(info.get("price")), g._num(info.get("base_price"))) if v}
    values |= g._price_values_in_text(line)
    return values


def _section_candidates(text: str) -> list[tuple[str, Optional[str], str]]:
    """(line, section condition above it, message-level remarks) per listing line of a whole message,
    walked like ``parse_stock_list``: a brand / condition header sets the condition for the lines below,
    another header ends it, a closing line ("all full set") applies to all."""
    from app.services import wtb_wts_service as g

    lines = _merge_split_lines(text.split("\n"), None)
    msg_remarks = g.extract_location_remarks(text, "WTS") or ""
    footer: list[str] = []
    for tail in reversed([l.strip() for l in lines if l.strip()]):
        if (g._extract_ref_from_line(tail) or g._line_has_price(tail) or g.detect_brand_header(tail) is not None
                or len(footer) >= 2):
            break
        footer.insert(0, tail)
    footer_text = "\n".join(footer)
    section = None
    if footer_text:
        fr = g.normalize_remarks(footer_text, "WTS")
        if fr:
            msg_remarks = "; ".join(x for x in (msg_remarks, fr) if x)
        section = g._detect_section_condition(footer_text, "WTS")
    out = []
    for line in lines:
        s = line.strip()
        if not s or s in footer:
            continue
        if g.detect_brand_header(s) is not None:
            section = g._detect_section_condition(s, "WTS")
            continue
        if g._is_section_header(s) or g._is_condition_header(s, "WTS", {}):
            cond = g._detect_section_condition(s, "WTS")
            if cond:
                section = cond
            elif re.search(r"[A-Za-z0-9一-鿿]", g._clean_text(s)):
                section = None
            continue
        if re.search(r"\bsold\b", s, re.I):
            continue
        if g._extract_ref_from_line(s) or g._line_has_price(s):
            out.append((s, section, msg_remarks))
    return out


def _merge_split_lines(raw_lines: list[str], country: Optional[str]) -> list[str]:
    """Reference on one line, price / year on the next 1-3 lines: one listing, as ``parse_stock_list`` merges it."""
    from app.services import wtb_wts_service as g

    lines: list[str] = []
    i = 0
    while i < len(raw_lines):
        cur = raw_lines[i].strip()
        if cur:
            ref = g._extract_ref_from_line(cur)
            price = g.extract_price_from_line(cur, country)[0] if ref else None
            if ref and not price:
                merged, consumed = cur, 0
                for look in range(1, 4):
                    if i + look >= len(raw_lines):
                        break
                    nxt = raw_lines[i + look].strip()
                    if not nxt:
                        continue
                    if g._extract_ref_from_line(nxt) or g.detect_brand_header(nxt):
                        break
                    price_nxt = g.extract_price_from_line(nxt, country)[0]
                    if price_nxt and g._has_reflike_token(nxt):
                        break
                    year_nxt = g.extract_year_from_line(nxt) or g.extract_month_year_from_text(nxt)
                    merged += " " + nxt
                    consumed = look
                    if price_nxt:
                        break
                    if not year_nxt and not re.search(r"\b(?:used|new|unworn|nos|bnib|full\s*set|brand\s*new)\b", nxt, re.I):
                        break
                if consumed > 0:
                    lines.append(merged)
                    i += consumed + 1
                    continue
        lines.append(raw_lines[i])
        i += 1
    return lines


def merge_remarks(old: str, new: str) -> str:
    """Existing remarks are never removed: every old remark stays, the current rules add theirs, each once
    ("Ready Stock; Ready Stock" -> "Ready Stock"), and the old discount format "17% Retail" becomes
    "-17% Retail"."""
    def fix(item: str) -> str:
        m = re.fullmatch(r"\s*(\d+(?:[.,]\d+)?)\s*%\s*retail\s*", item, re.I)
        return f"-{m.group(1)}% Retail" if m else item.strip()

    seen: set[str] = set()
    segments: list[str] = []
    for text in (old, new):
        for seg in (text or "").split("; "):
            items = []
            for item in seg.split(", "):
                item = fix(item)
                key = _norm(item)
                if key and key not in seen:
                    seen.add(key)
                    items.append(item)
            if items:
                segments.append(", ".join(items))
    return "; ".join(segments)


def locate_line(doc: dict, watch: Optional[dict], country: Optional[str]) -> tuple[Optional[dict], str]:
    """The offer's own line. Returns ({"scope", "line_level", "section", "extra", "price_ok"}, "") or
    (None, reason) with reason in ``line_not_found`` / ``ambiguous_line``."""
    text = (doc.get("source_text") or "").strip()
    stored = int(round(doc.get("price") or 0))
    nonempty = [l for l in text.split("\n") if l.strip()]
    if len(nonempty) <= 1:
        return {"scope": text, "line_level": True, "section": None, "extra": "",
                "price_ok": stored in _price_values(text, country)}, ""
    cands = _section_candidates(text)
    if len(cands) <= 1:
        # one watch with context lines around it: the generator reads the whole text as one listing
        return {"scope": text, "line_level": False, "section": None, "extra": "",
                "price_ok": stored in _price_values(text, country)}, ""
    anchors = _anchors(doc, watch)
    anchored = [c for c in cands if any(a in _norm(c[0]) for a in anchors)]
    if not anchored:
        return None, "line_not_found"
    if len(anchored) == 1:
        c = anchored[0]
        return {"scope": c[0], "line_level": True, "section": c[1], "extra": c[2],
                "price_ok": stored in _price_values(c[0], country)}, ""
    priced = [c for c in anchored if stored in _price_values(c[0], country)]
    if len(priced) == 1:
        c = priced[0]
        return {"scope": c[0], "line_level": True, "section": c[1], "extra": c[2], "price_ok": True}, ""
    return None, "ambiguous_line" if priced else "line_not_found"


def read_line(doc: dict, loc: dict, watch: Optional[dict], rates: Optional[dict] = None) -> dict:
    """Run the generator's own field filling on the located line: returns the generator row."""
    from app.services import wtb_wts_service as g
    from app.services.ws_quality.prices import message_currency

    created = doc.get("created_at") if isinstance(doc.get("created_at"), datetime) else datetime.utcnow()
    phone = doc.get("whatsapp_phone")
    country = g.get_country_from_phone(phone) if phone else None
    ctx = {"mode": "WTS", "watch_index": {}, "sender": phone or "", "timestamp": created,
           "group_name": doc.get("source_group") or "", "ref_month": created.month, "ref_year": created.year,
           "phone": phone, "sender_country": country, "attachments": [], "msg_index": -1,
           "content": loc["scope"], "rates": rates}
    row = g._ctx_base_row(ctx, watch)
    g._MESSAGE_CURRENCY.set(message_currency((doc.get("source_text") or ""), country, ctx["group_name"]))
    try:
        g._fill_fields(row, loc["scope"], ctx, watch, line_level=loc["line_level"],
                       section_condition=loc["section"], extra_remarks=loc["extra"])
    finally:
        g._MESSAGE_CURRENCY.set(None)
    return row


def _cond_label(v) -> Optional[str]:
    v = getattr(v, "value", v)
    return v if v in ("Unworn", "Used") else None


def _my_key(year, month, raw) -> tuple:
    return (year or None, month or None, (raw or None))


def reread(doc: dict, watch: Optional[dict] = None, rates: Optional[dict] = None) -> dict:
    """Pure (no database). ``{"skip": reason}`` or ``{"set": {...}, "changed": [fields], "currency_differs": bool,
    "date_not_read": bool, "price_not_in_line": bool, "old": {...}, "new": {...}}``."""
    from app.api.v1.endpoints.whatsapp import parse_csv_price, parse_month_year
    from app.services import fx as fx_service
    from app.services import wtb_wts_service as g

    if str(getattr(doc.get("order_type"), "value", doc.get("order_type")) or "").lower() != "sell":
        return {"skip": "not_sell"}
    phone = doc.get("whatsapp_phone")
    country = g.get_country_from_phone(phone) if phone else None
    loc, why = locate_line(doc, watch, country)
    if loc is None:
        return {"skip": why}
    row = read_line(doc, loc, watch, rates)

    new_cond = row.get("Zustand") or None
    sets: dict[str, Any] = {}
    changed: list[str] = []
    old = {"condition": _cond_label(doc.get("condition")), "price": doc.get("price"), "currency": doc.get("currency"),
           "year": doc.get("year"), "month": doc.get("watch_month"), "year_raw": doc.get("year_raw"),
           "remarks": doc.get("remarks")}

    if new_cond != old["condition"]:
        sets["condition"] = new_cond
        sets["condition_raw"] = None  # would keep showing the old label
        changed.append("condition")

    price, currency = parse_csv_price(row.get("Preis") or "")
    currency_differs = price_not_in_line = False
    new_price = old["price"]
    if price:
        if (currency or "").upper() != (doc.get("currency") or "").upper():
            currency_differs = True
        elif not loc["price_ok"]:
            price_not_in_line = True
        elif abs(price - (old["price"] or 0)) >= 0.5:
            new_price = price
            sets["price"] = price
            rates = rates or fx_service.cached_rates()
            usd = fx_service.convert(price, currency, "USD", rates)
            sets["usd_price"] = round(usd, 2) if usd is not None else None
            changed.append("price")

    month_year = (row.get("Monat/Jahr") or "").strip()
    date_not_read = not month_year
    if month_year:
        y, m, raw = parse_month_year(month_year)
        if _my_key(y, m, raw) != _my_key(doc.get("year"), doc.get("watch_month"), doc.get("year_raw")):
            sets.update({"year": y, "watch_month": m, "year_raw": raw})
            changed.append("year")

    stored_remarks = (doc.get("remarks") or "").strip()
    flag = ""
    if _PRICE_FLAG_SEP in stored_remarks:
        stored_remarks, flag = stored_remarks.split(_PRICE_FLAG_SEP, 1)
        stored_remarks, flag = stored_remarks.strip(), _PRICE_FLAG_SEP + flag
    new_remarks = merge_remarks(stored_remarks, (row.get("Bemerkungen") or "").strip())
    if new_remarks != stored_remarks:
        if "price" in changed:  # the old flag judged the old amount
            flag = ""
        full = (new_remarks + flag).strip(" |") if flag else new_remarks
        if "price" in changed and new_price:
            ok, reason = g.validate_price(str(int(new_price)), (watch or {}).get("brand") or doc.get("brand"))
            if not ok:
                full = f"{new_remarks} | PRICE FLAG: {reason}" if new_remarks else f"PRICE FLAG: {reason}"
        sets["remarks"] = full or None
        notes = doc.get("notes") or ""
        old_full = doc.get("remarks") or ""
        if old_full and notes.startswith("Imported from") and notes.endswith(old_full):
            sets["notes"] = notes[: len(notes) - len(old_full)] + (full or "")
            sets["notes"] = sets["notes"].rstrip() or notes
        changed.append("remarks")

    new = {"condition": new_cond, "price": new_price, "currency": doc.get("currency"),
           "year": sets.get("year", old["year"]), "month": sets.get("watch_month", old["month"]),
           "year_raw": sets.get("year_raw", old["year_raw"]), "remarks": sets.get("remarks", old["remarks"])}
    return {"set": sets, "changed": changed, "currency_differs": currency_differs,
            "date_not_read": date_not_read, "price_not_in_line": price_not_in_line, "old": old, "new": new}


async def _load_watches(codes: set[str]) -> dict[str, dict]:
    from app.models.watch import Watch

    out: dict[str, dict] = {}
    if not codes:
        return out
    cur = Watch.get_motor_collection().find(
        {"ws_code": {"$in": sorted(codes)}},
        {"ws_code": 1, "reference": 1, "brand": 1, "aliases": 1, "oem_references": 1, "list_prices": 1})
    async for w in cur:
        if w.get("ws_code"):
            out[str(w["ws_code"]).strip().upper()] = w
    return out


async def reread_offers(dry_run: bool = True, limit: Optional[int] = None) -> dict[str, Any]:
    """Re-read active imported sell offers with the current generator rules and correct them.

    Dry run by default: counts per field, skips by reason, before/after samples, nothing written."""
    from app.models.order import Order, OrderStatus
    from app.services import fx as fx_service
    from app.services import remark_rules
    from app.services import wtb_wts_service as g

    col = Order.get_motor_collection()
    query = {"status": OrderStatus.ACTIVE.value, "whatsapp_phone": {"$nin": [None, ""]},
             "source_text": {"$nin": [None, ""]}, "superseded_by": None}
    try:
        rates = await fx_service.load_rates()
    except Exception:
        rates = dict(fx_service.SEED_RATES)
    prev_config = g._ACTIVE_REMARK_CONFIG
    try:
        g._ACTIVE_REMARK_CONFIG = await remark_rules.load_remark_config()
    except Exception:
        pass

    by_field = {f: 0 for f in FIELDS}
    skipped: dict[str, int] = {}
    scanned = changed_offers = written = currency_differs = date_not_read = price_not_in_line = 0
    samples: list[dict] = []
    codes: set[str] = set()
    pending: list = []

    async def flush() -> None:
        nonlocal written
        if pending and not dry_run:
            res = await col.bulk_write(pending, ordered=False)
            written += res.modified_count
        pending.clear()

    try:
        cursor = col.find(query, {
            "ws_code": 1, "reference": 1, "brand": 1, "aliases": 1, "oem_references": 1, "order_type": 1,
            "whatsapp_phone": 1, "source_text": 1, "source_group": 1, "created_at": 1, "price": 1, "currency": 1,
            "condition": 1, "condition_raw": 1, "year": 1, "watch_month": 1, "year_raw": 1, "remarks": 1,
            "notes": 1})
        async def process(chunk: list[dict]) -> None:
            nonlocal scanned, changed_offers, currency_differs, date_not_read, price_not_in_line
            watches = await _load_watches({str(d["ws_code"]).strip().upper() for d in chunk if d.get("ws_code")})
            now = datetime.utcnow()
            for doc in chunk:
                scanned += 1
                watch = watches.get(str(doc.get("ws_code") or "").strip().upper())
                try:
                    res = reread(doc, watch, rates)
                except Exception as exc:  # one odd line never stops the run
                    logger.warning("offer re-read: %s failed: %s", doc.get("_id"), exc)
                    skipped["error"] = skipped.get("error", 0) + 1
                    continue
                if "skip" in res:
                    skipped[res["skip"]] = skipped.get(res["skip"], 0) + 1
                    continue
                currency_differs += res["currency_differs"]
                date_not_read += res["date_not_read"]
                price_not_in_line += res["price_not_in_line"]
                if not res["changed"]:
                    continue
                changed_offers += 1
                for f in res["changed"]:
                    by_field[f] += 1
                if doc.get("ws_code"):
                    codes.add(doc["ws_code"])
                if len(samples) < SAMPLE_SIZE:
                    samples.append({"id": str(doc["_id"]), "ws_code": doc.get("ws_code"),
                                    "line": (doc.get("source_text") or "")[:160], "changed": res["changed"],
                                    "before": res["old"], "after": res["new"]})
                if not dry_run:
                    pending.append(UpdateOne({"_id": doc["_id"]}, {"$set": {**res["set"], "updated_at": now}}))
            await flush()

        chunk: list[dict] = []
        n = 0
        async for d in cursor:
            if limit is not None and n >= limit:
                break
            n += 1
            chunk.append(d)
            if len(chunk) >= BATCH:
                await process(chunk)
                chunk = []
        if chunk:
            await process(chunk)
    finally:
        g._ACTIVE_REMARK_CONFIG = prev_config

    result: dict[str, Any] = {
        "dry_run": dry_run,
        "scanned_active_offers": scanned,
        "changed_offers": changed_offers,
        "by_field": by_field,
        "skipped": skipped,
        "skipped_total": sum(skipped.values()),
        "currency_differs_not_changed": currency_differs,
        "date_not_read_kept": date_not_read,
        "price_not_in_line_kept": price_not_in_line,
        "samples": samples,
    }
    if not dry_run:
        result["written"] = written
        if codes:
            from app.services.market_stats import recompute_for_safe

            await recompute_for_safe(sorted(codes))
        logger.info("offer re-read: %d offer(s) corrected on %d watch(es)", written, len(codes))
    return result
