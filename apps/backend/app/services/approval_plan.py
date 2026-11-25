"""Approval decisions from a file: format, parsing and planning. No database, no framework.

The file is the one the "Download CSV" buttons produce (CSV, separator ``;`` or ``,``, UTF-8
with or without BOM), with the admin's answer in ``decision`` / ``new_value``:

    tab, id, original_text, dealer, chat_group, date, suggested_ws_code, other_candidates,
    price, currency, median, median_currency, offer_count, info, version, decision, new_value

Columns the server reads: ``tab``, ``id``, ``decision``, ``new_value``, ``version``.
``version`` is a fingerprint of the case when the file was built. If the case looks different
now (other candidates, other price, already decided ...) the row is skipped: what the system
did in between wins. A row with an empty ``decision`` is left alone.
"""
import csv
import hashlib
import io
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from app.services.price_actions import parse_price

TABS = ("ai", "unsure", "aliases", "new_watches", "prices")
HEADER = [
    "tab", "id", "original_text", "dealer", "chat_group", "date", "suggested_ws_code",
    "other_candidates", "price", "currency", "median", "median_currency", "offer_count",
    "info", "version", "decision", "new_value",
]
DECISIONS = {
    "ai": ("confirm", "correct", "not_in_catalogue", "discard"),
    "unsure": ("confirm", "correct", "not_in_catalogue", "discard"),
    "aliases": ("approve", "reject", "assign"),
    "new_watches": ("import", "dismiss"),
    "prices": ("approve", "reject", "fix_currency", "correct_price"),
}
# Decisions that need ``new_value`` (a WS code, a currency or a price).
NEEDS_VALUE = {"correct", "assign", "import", "fix_currency", "correct_price"}
MAX_ROWS = 300_000
SPELLINGS = {"not_in_catalog": "not_in_catalogue", "not-in-catalogue": "not_in_catalogue",
             "not in catalogue": "not_in_catalogue"}


def fingerprint(*parts) -> str:
    """Short, stable id of a case's state."""
    raw = "\x1f".join("" if p is None else str(p) for p in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def candidate_codes(candidates) -> list:
    return [c.get("ws_code") for c in (candidates or []) if isinstance(c, dict) and c.get("ws_code")]


def ai_version(d: dict) -> str:
    return fingerprint("ai", d.get("status"), d.get("ai_ws_code"), d.get("order_id"))


def unsure_version(key: str, candidates, reason) -> str:
    return fingerprint("unsure", key, "|".join(candidate_codes(candidates)), reason)


def alias_version(d: dict) -> str:
    return fingerprint("alias", d.get("status"), d.get("alias_key"), d.get("ws_code"))


def new_watch_version(key: str, brand) -> str:
    return fingerprint("new", key, brand)


def price_version(d: dict) -> str:
    return fingerprint("price", d.get("ws_code"), d.get("price"), (d.get("currency") or "").upper())


@dataclass
class Row:
    line: int
    tab: str
    case_id: str
    decision: str
    new_value: str = ""
    version: str = ""


@dataclass
class State:
    """What a case looks like right now (built from the database by the endpoint)."""
    version: str
    info: dict = field(default_factory=dict)


@dataclass
class Item:
    row: Row
    status: str  # apply | not_found | changed | invalid | duplicate
    detail: str = ""


def parse_file(data: bytes):
    """-> (rows, untouched, errors). ``untouched`` counts rows without a decision.
    Errors are file-level: with any, nothing may be committed."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], 0, ["The file is not UTF-8 encoded"]
    head = text.split("\n", 1)[0]
    delim = ";" if head.count(";") >= head.count(",") else ","
    rd = csv.DictReader(io.StringIO(text), delimiter=delim)
    cols = [c.strip().lower() for c in (rd.fieldnames or [])]
    missing = [c for c in ("tab", "id", "decision") if c not in cols]
    if missing:
        return [], 0, ["Missing columns: " + ", ".join(missing)]
    rows: List[Row] = []
    untouched = 0
    for n, raw in enumerate(rd, start=2):
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items() if k is not None}
        if not r.get("id"):
            continue
        decision = r.get("decision", "").lower().replace(" ", "_")
        if not decision:
            untouched += 1
            continue
        rows.append(Row(n, r.get("tab", "").lower(), r["id"], SPELLINGS.get(decision, decision),
                        r.get("new_value", ""), r.get("version", "")))
        if len(rows) > MAX_ROWS:
            return [], 0, [f"More than {MAX_ROWS:,} rows"]
    if not rows:
        return [], untouched, ["The file has no decisions - fill in the 'decision' column"]
    return rows, untouched, []


def build_plan(
    rows: Iterable[Row],
    states: Dict[tuple, Optional[State]],
    known_ws_codes,
    currencies,
) -> List[Item]:
    """``states``: (tab, case id) -> State of every case that still exists and is pending."""
    out: List[Item] = []
    seen = set()
    for r in rows:
        if r.tab not in TABS:
            out.append(Item(r, "invalid", f"Unknown tab '{r.tab}'"))
            continue
        if r.decision not in DECISIONS[r.tab]:
            out.append(Item(r, "invalid", f"'{r.decision}' is not a decision of the {r.tab} tab"))
            continue
        key = (r.tab, r.case_id)
        if key in seen:
            out.append(Item(r, "duplicate", "Case appears more than once in the file"))
            continue
        seen.add(key)
        st = states.get(key)
        if st is None:
            out.append(Item(r, "not_found", "Case no longer exists or was already decided"))
            continue
        if r.version and r.version != st.version:
            out.append(Item(r, "changed", "Case changed since the file was built"))
            continue
        if r.decision in NEEDS_VALUE:
            if not r.new_value:
                out.append(Item(r, "invalid", "new_value is empty"))
                continue
            if r.decision == "fix_currency":
                if r.new_value.upper() not in currencies:
                    out.append(Item(r, "invalid", f"Unknown currency '{r.new_value}'"))
                    continue
            elif r.decision == "correct_price":
                if parse_price(r.new_value) is None:
                    out.append(Item(r, "invalid", f"'{r.new_value}' is not a positive number"))
                    continue
            elif r.new_value not in known_ws_codes:
                out.append(Item(r, "invalid", f"WS code '{r.new_value}' is not in the catalogue"))
                continue
        if r.tab == "unsure" and r.decision == "confirm" and not st.info.get("suggested"):
            out.append(Item(r, "invalid", "No suggested WS code to confirm"))
            continue
        out.append(Item(r, "apply"))
    return out


def summarize(items: List[Item], untouched: int, sample: int = 20) -> dict:
    """What the preview shows before anything is changed."""
    apply: Dict[str, Dict[str, int]] = {t: {} for t in TABS}
    skipped: Dict[str, int] = {}
    for it in items:
        if it.status == "apply":
            apply[it.row.tab][it.row.decision] = apply[it.row.tab].get(it.row.decision, 0) + 1
        else:
            skipped[it.status] = skipped.get(it.status, 0) + 1
    total = sum(sum(v.values()) for v in apply.values())
    warnings = []
    stale = skipped.get("changed", 0) + skipped.get("not_found", 0)
    if items and stale > 0.2 * len(items):
        warnings.append("More than 20 % of the rows no longer match - the file is stale, download a new one")
    return {
        "rows": len(items) + untouched,
        "untouched": untouched,
        "apply": {t: v for t, v in apply.items() if v},
        "apply_total": total,
        "skipped": skipped,
        "warnings": warnings,
        "sample_apply": [
            {"line": it.row.line, "tab": it.row.tab, "id": it.row.case_id,
             "decision": it.row.decision, "new_value": it.row.new_value}
            for it in items if it.status == "apply"
        ][:sample],
        "sample_skipped": [
            {"line": it.row.line, "tab": it.row.tab, "id": it.row.case_id,
             "status": it.status, "detail": it.detail}
            for it in items if it.status != "apply"
        ][:sample],
    }
