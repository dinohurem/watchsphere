"""Re-derive the condition of existing WTS (sell) offers with the three-state rules.

Reads ``Order.source_text`` (the dealer's original line) and applies rules 1 (condition word),
2 (N-month) and 4 (year) of ``wtb_wts_service.wts_condition``. The section header above the line
is not stored on the order, so rule 3 cannot be applied: an offer that only got its condition
from a header ("pp used") is re-derived without it (see ``header_not_stored`` in the result).
The year rule is relative to the year the offer was posted (``created_at``).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pymongo import UpdateOne

from app.services.wtb_wts_service import wts_condition

SAMPLE_SIZE = 25
CHUNK = 500


def _label(value) -> str:
    value = getattr(value, "value", value)
    return value if value in ("Unworn", "Used") else "none"


def derive(doc: dict) -> Optional[str]:
    created = doc.get("created_at")
    ref_year = created.year if isinstance(created, datetime) else datetime.utcnow().year
    return wts_condition(doc.get("source_text") or "", None, ref_year)


async def recalculate(dry_run: bool = True, limit: Optional[int] = None) -> dict:
    from app.models.order import Order

    col = Order.get_motor_collection()
    query = {"order_type": "sell", "source_text": {"$nin": [None, ""]}}
    before = {"Unworn": 0, "Used": 0, "none": 0}
    after = {"Unworn": 0, "Used": 0, "none": 0}
    changes: dict[str, int] = {}
    sample: list[dict] = []
    pending: list = []
    scanned = changed = written = 0
    skipped_no_source = await col.count_documents(
        {"order_type": "sell", "$or": [{"source_text": None}, {"source_text": ""}]})

    async def flush() -> None:
        nonlocal written
        if pending and not dry_run:
            res = await col.bulk_write(pending, ordered=False)
            written += res.modified_count
        pending.clear()

    cursor = col.find(query, {"condition": 1, "condition_raw": 1, "source_text": 1, "created_at": 1,
                              "ws_code": 1})
    async for doc in cursor:
        if limit is not None and scanned >= limit:
            break
        scanned += 1
        old = _label(doc.get("condition"))
        new_value = derive(doc)
        new = new_value or "none"
        before[old] += 1
        after[new] += 1
        if old == new:
            continue
        changed += 1
        key = f"{old} -> {new}"
        changes[key] = changes.get(key, 0) + 1
        if len(sample) < SAMPLE_SIZE:
            sample.append({"id": str(doc["_id"]), "ws_code": doc.get("ws_code"),
                           "source_text": (doc.get("source_text") or "")[:200], "old": old, "new": new})
        # condition_raw would keep showing the old label in the app, so it goes with it
        pending.append(UpdateOne({"_id": doc["_id"]},
                                 {"$set": {"condition": new_value, "condition_raw": None}}))
        if len(pending) >= CHUNK:
            await flush()
    await flush()

    if written:
        try:
            from app.services import market_stats as ms
            codes = await col.distinct("ws_code", {"order_type": "sell", "ws_code": {"$nin": [None, ""]}})
            await ms.recompute_for_safe(sorted(codes))
        except Exception:  # the stats catch up with the next scheduled recompute
            pass
    return {
        "dry_run": dry_run,
        "scanned": scanned,
        "skipped_no_source_text": skipped_no_source,
        "changed": changed,
        "written": written,
        "before": before,
        "after": after,
        "changes": changes,
        "sample": sample,
        "header_not_stored": True,
        "note": "Rules 1, 2 and 4 only: the section header above a line is not stored on the order.",
    }
