"""Collapse duplicate dealer offers: one offer per dealer line, the newest reading wins.

Before the repost fix an import kept the old offer and added a second one when the new reading
differed, and the same line posted in two groups became two offers. This clean-up goes over the
active imported offers and, per dealer + side + WS code:

1. offers with the same dealer line (``source_text``, normalised): keep the newest, the rest are
   older readings of the same line;
2. of what is left, offers with exactly the same reading (year, month, condition, price,
   currency): keep the newest, the rest are exact copies (a line that reached the app with
   slightly different source text, e.g. from two groups).

A source text that several offers share because it is a whole message (a year per offer) is told
apart by the reading, so a dealer's 2019/2022/2024 pieces from one message stay three offers.

The older ones are not deleted: they are set to ``expired`` with ``superseded_by`` = the id of the
kept offer, so imports never bring them back and the clean-up can be undone from the database.
"""
import logging
from datetime import datetime
from typing import Any, Optional

from app.services import offer_lifecycle as lifecycle

logger = logging.getLogger(__name__)

SAMPLE_SIZE = 25
BATCH = 1000


def _reading(o: dict) -> tuple:
    my = ""
    if o.get("watch_month") and o.get("year"):
        my = f"{o['watch_month']:02d}/{o['year'] % 100:02d}"
    elif o.get("year_raw"):
        my = str(o["year_raw"]).strip().lower()
    elif o.get("year"):
        my = str(o["year"])
    return (my, str(o.get("condition") or "").lower(), round(o.get("price") or 0), (o.get("currency") or "").upper())


def _rank(o: dict) -> tuple:
    return (o.get("created_at") or datetime.min, o.get("last_seen_at") or datetime.min, str(o["_id"]))


def plan(orders: list[dict]) -> list[tuple[dict, dict, str]]:
    """[(older offer, kept offer, reason)] for a list of offer dicts (pure, no database)."""
    slots: dict[tuple, list[dict]] = {}
    for o in orders:
        ws = (o.get("ws_code") or "").strip().upper()
        phone = (o.get("whatsapp_phone") or "").strip()
        if ws and phone:
            slots.setdefault((str(o.get("order_type") or "").lower(), ws, phone), []).append(o)

    out: list[tuple[dict, dict, str]] = []
    for offers in slots.values():
        if len(offers) < 2:
            continue
        gone: set = set()
        # 1. the same dealer line. A text shared by several different readings is a whole
        # message with one offer per reading: only identical readings are copies there.
        by_line: dict[str, list[dict]] = {}
        for o in offers:
            lk = lifecycle.line_key(o.get("source_text"))
            if lk:
                by_line.setdefault(lk, []).append(o)
        for group in by_line.values():
            if len(group) < 2:
                continue
            if len({_reading(o) for o in group}) > 1 and _is_multi_offer_text(group):
                continue
            keep = max(group, key=_rank)
            for o in group:
                if o is not keep:
                    out.append((o, keep, "same_line"))
                    gone.add(o["_id"])
        # 2. exact copies
        by_reading: dict[tuple, list[dict]] = {}
        for o in offers:
            if o["_id"] not in gone and o.get("price"):
                by_reading.setdefault(_reading(o), []).append(o)
        for group in by_reading.values():
            if len(group) < 2:
                continue
            keep = max(group, key=_rank)
            for o in group:
                if o is not keep:
                    out.append((o, keep, "exact_copy"))
    return out


def _is_multi_offer_text(group: list[dict]) -> bool:
    """A source text of several lines (a whole message) shared by offers of different years is one
    offer per piece. A single line is one piece: its other readings are older versions."""
    text = (group[0].get("source_text") or "").strip()
    return "\n" in text and len({_reading(o)[0] for o in group}) > 1


async def collapse_duplicates(dry_run: bool = True) -> dict[str, Any]:
    from app.models.order import Order, OrderStatus

    col = Order.get_motor_collection()
    cur = col.find(
        {"status": OrderStatus.ACTIVE.value, "whatsapp_phone": {"$nin": [None, ""]}, "superseded_by": None},
        {"ws_code": 1, "whatsapp_phone": 1, "order_type": 1, "source_text": 1, "year": 1, "watch_month": 1,
         "year_raw": 1, "condition": 1, "price": 1, "currency": 1, "created_at": 1, "last_seen_at": 1},
    )
    orders = [o async for o in cur]
    pairs = plan(orders)

    by_reason: dict[str, int] = {}
    samples = []
    for old, keep, reason in pairs:
        by_reason[reason] = by_reason.get(reason, 0) + 1
        if len(samples) < SAMPLE_SIZE:
            samples.append({
                "reason": reason, "phone": old.get("whatsapp_phone"), "ws_code": old.get("ws_code"),
                "line": (keep.get("source_text") or "")[:120],
                "older": {"id": str(old["_id"]), "price": old.get("price"), "currency": old.get("currency"),
                          "year": old.get("year"), "month": old.get("watch_month"),
                          "condition": old.get("condition"), "posted": old.get("created_at")},
                "kept": {"id": str(keep["_id"]), "price": keep.get("price"), "currency": keep.get("currency"),
                         "year": keep.get("year"), "month": keep.get("watch_month"),
                         "condition": keep.get("condition"), "posted": keep.get("created_at")},
            })
    result: dict[str, Any] = {
        "dry_run": dry_run,
        "scanned_active_offers": len(orders),
        "duplicates": len(pairs),
        "by_reason": by_reason,
        "samples": samples,
    }
    if dry_run or not pairs:
        return result

    now = datetime.utcnow()
    by_keeper: dict[Any, list] = {}
    codes: set[str] = set()
    for old, keep, _reason in pairs:
        by_keeper.setdefault(keep["_id"], []).append(old["_id"])
        if old.get("ws_code"):
            codes.add(old["ws_code"])
    changed = 0
    for keeper_id, ids in by_keeper.items():
        for i in range(0, len(ids), BATCH):
            res = await col.update_many(
                {"_id": {"$in": ids[i:i + BATCH]}, "status": OrderStatus.ACTIVE.value},
                {"$set": {"status": OrderStatus.EXPIRED.value, "superseded_by": str(keeper_id), "updated_at": now}},
            )
            changed += res.modified_count
    if codes:
        from app.services.market_stats import recompute_for_safe

        await recompute_for_safe(sorted(codes))
    result["expired"] = changed
    logger.info("offer clean-up: %d duplicate offer(s) expired on %d watch(es)", changed, len(codes))
    return result
