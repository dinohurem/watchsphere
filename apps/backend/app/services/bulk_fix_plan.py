"""Bulk fix of orders from a file: parsing and planning. No database, no framework.

File: CSV, separator ``;`` or ``,``, UTF-8 (with or without BOM). Columns the server uses:

    order_id         id of the order (the id the order book API returns)
    action           delete | move | set_currency | clear_price
    expect_ws_code   what the order looked like when the file was built. If the order
    expect_price     has changed since (other WS code, price or currency), the row is
    expect_currency  skipped: a repost that arrived in between wins.
    new_value        move: target WS code, set_currency: ISO code, otherwise empty

``reason`` and ``source_line`` are stored with the batch and shown in the preview;
other columns (side, dealer, message_time) are only for reading the file.

Adapted from the audit hand-off of 23 Nov 2026 (code/server/bulk_fix_plan.py).
"""
import csv
import io
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

ACTIONS = ("delete", "move", "set_currency", "clear_price")
REQUIRED = ("order_id", "action")
MAX_ROWS = 300_000
# Fields kept on each planned row so commit can re-check and undo can restore.
SNAPSHOT_FIELDS = (
    "ws_code", "price", "currency", "usd_price",
    "brand", "model", "reference", "watch_id", "aliases", "collection",
)


@dataclass
class Row:
    line: int
    order_id: str
    action: str
    expect_ws_code: str = ""
    expect_price: Optional[float] = None
    expect_currency: str = ""
    new_value: str = ""
    reason: str = ""
    source_line: str = ""


@dataclass
class Item:
    row: Row
    status: str  # apply | already_done | not_found | changed | invalid | duplicate
    detail: str = ""
    before: dict = field(default_factory=dict)


def _num(s: Optional[str]) -> Optional[float]:
    s = (s or "").strip().replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".") if len(s.split(",")[-1]) != 3 else s.replace(",", "")
    return float(s)


def parse_file(data: bytes):
    """-> (rows, errors). Errors are file-level: when there are any, nothing may be committed."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], ["The file is not UTF-8 encoded"]
    head = text.split("\n", 1)[0]
    delim = ";" if head.count(";") >= head.count(",") else ","
    rd = csv.DictReader(io.StringIO(text), delimiter=delim)
    cols = [c.strip().lower() for c in (rd.fieldnames or [])]
    missing = [c for c in REQUIRED if c not in cols]
    if missing:
        return [], ["Missing columns: " + ", ".join(missing)]
    rows: List[Row] = []
    errors: List[str] = []
    for n, raw in enumerate(rd, start=2):
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items() if k is not None}
        if not r.get("order_id") and not r.get("action"):
            continue
        try:
            price = _num(r.get("expect_price"))
        except ValueError:
            errors.append(f"Line {n}: expect_price is not a number")
            continue
        rows.append(Row(
            n, r.get("order_id", ""), r.get("action", "").lower(), r.get("expect_ws_code", ""), price,
            r.get("expect_currency", "").upper(), r.get("new_value", ""), r.get("reason", ""),
            r.get("source_line", ""),
        ))
        if len(rows) > MAX_ROWS:
            return [], [f"More than {MAX_ROWS:,} rows"]
    if not rows and not errors:
        errors.append("The file has no rows")
    return rows, errors


def build_plan(rows: Iterable[Row], orders: Dict[str, dict], known_ws_codes, currencies) -> List[Item]:
    """``orders``: id -> order fields (at least ws_code, price, currency, order_type) for every
    id of the file that exists and is active. ``currencies``: ISO codes the FX table knows."""
    out: List[Item] = []
    seen = set()
    for r in rows:
        if r.action not in ACTIONS:
            out.append(Item(r, "invalid", f"Unknown action '{r.action}'"))
            continue
        if r.order_id in seen:
            out.append(Item(r, "duplicate", "Order appears more than once in the file"))
            continue
        seen.add(r.order_id)
        o = orders.get(r.order_id)
        if o is None:
            out.append(Item(r, "not_found", "Order does not exist (any more)"))
            continue
        if r.action == "move":
            if not r.new_value:
                out.append(Item(r, "invalid", "new_value (target WS code) is empty"))
                continue
            if r.new_value not in known_ws_codes:
                out.append(Item(r, "invalid", f"Target WS code '{r.new_value}' is not in the catalogue"))
                continue
            if o.get("ws_code") == r.new_value:
                out.append(Item(r, "already_done", "Order is already on this WS code"))
                continue
        if r.action == "set_currency":
            cur = r.new_value.upper()
            if cur not in currencies:
                out.append(Item(r, "invalid", f"Unknown currency '{r.new_value}'"))
                continue
            if (o.get("currency") or "").upper() == cur:
                out.append(Item(r, "already_done", "Currency is already right"))
                continue
        if r.action == "clear_price":
            if (o.get("order_type") or "").lower() != "buy":
                out.append(Item(r, "invalid", "clear_price only applies to buy requests"))
                continue
            if not o.get("price"):
                out.append(Item(r, "already_done", "Buy request has no price"))
                continue
        diff = []
        if r.expect_ws_code and (o.get("ws_code") or "") != r.expect_ws_code:
            diff.append(f"WS code is now '{o.get('ws_code')}'")
        if r.expect_price is not None and round(o.get("price") or 0) != round(r.expect_price):
            diff.append(f"price is now {o.get('price')}")
        if r.expect_currency and o.get("price") and (o.get("currency") or "").upper() != r.expect_currency:
            diff.append(f"currency is now {o.get('currency')}")
        if diff:
            out.append(Item(r, "changed", "Changed since the file was built: " + ", ".join(diff)))
            continue
        out.append(Item(r, "apply", before={k: o.get(k) for k in SNAPSHOT_FIELDS}))
    return out


def summarize(items: List[Item], total_active_orders: int, sample: int = 20) -> dict:
    """What the preview shows before anything is changed."""
    by_action = {a: 0 for a in ACTIONS}
    skipped: Dict[str, int] = {}
    for it in items:
        if it.status == "apply":
            by_action[it.row.action] += 1
        else:
            skipped[it.status] = skipped.get(it.status, 0) + 1
    removed = by_action["delete"]
    share = removed / total_active_orders if total_active_orders else 0.0
    warnings = []
    if share > 0.5:
        warnings.append(f"This file deletes {share:.0%} of all active orders")
    if skipped.get("changed", 0) + skipped.get("not_found", 0) > 0.2 * max(1, len(items)):
        warnings.append(
            "More than 20 % of the rows no longer match the app - the file is stale, build a new one"
        )
    reasons: Dict[tuple, int] = {}
    for it in items:
        if it.status == "apply":
            key = (it.row.action, it.row.reason.split("(")[0].split(":")[0].strip()[:60])
            reasons[key] = reasons.get(key, 0) + 1
    return {
        "rows": len(items),
        "apply": by_action,
        "apply_total": sum(by_action.values()),
        "skipped": skipped,
        "delete_share_of_active_orders": round(share, 4),
        "warnings": warnings,
        "top_reasons": [
            {"action": a, "reason": r, "count": n}
            for (a, r), n in sorted(reasons.items(), key=lambda kv: -kv[1])[:15]
        ],
        "sample_apply": [
            {"line": it.row.line, "order_id": it.row.order_id, "action": it.row.action,
             "ws_code": it.before.get("ws_code"), "price": it.before.get("price"),
             "currency": it.before.get("currency"), "new_value": it.row.new_value,
             "reason": it.row.reason, "source_line": it.row.source_line[:200]}
            for it in items if it.status == "apply"
        ][:sample],
        "sample_skipped": [
            {"line": it.row.line, "order_id": it.row.order_id, "status": it.status, "detail": it.detail}
            for it in items if it.status != "apply"
        ][:sample],
    }
