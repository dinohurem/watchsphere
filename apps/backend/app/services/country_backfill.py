"""One-off maintenance: fill ``Order.country_name`` with the canonical full name.

Fixes orders whose name is empty, equals a country code ("CN"), or differs from the canonical
name of the order's country code. Orders with a code that is not a known country are reported
and left alone. Dry run by default: it only counts.
"""
from typing import Any

from app.core.countries import country_display_name
from app.models.order import Order


async def fix_order_country_names(dry_run: bool = True) -> dict[str, Any]:
    coll = Order.get_motor_collection()
    groups = await coll.aggregate([
        {"$group": {"_id": {"code": "$country_code", "name": "$country_name"}, "n": {"$sum": 1}}},
    ]).to_list(length=None)

    per_code: dict[str, dict[str, Any]] = {}
    unknown: dict[str, int] = {}
    scanned = to_fix = updated = 0
    for g in groups:
        code, old, n = g["_id"].get("code"), g["_id"].get("name"), g["n"]
        scanned += n
        new = country_display_name(code)
        if new is None:
            unknown[str(code)] = unknown.get(str(code), 0) + n
            continue
        if old == new:
            continue
        to_fix += n
        entry = per_code.setdefault(str(code), {"after": new, "count": 0, "before": {}})
        entry["count"] += n
        label = "" if old is None else str(old)
        entry["before"][label] = entry["before"].get(label, 0) + n
        if not dry_run:
            res = await coll.update_many(
                {"country_code": code, "country_name": old}, {"$set": {"country_name": new}}
            )
            updated += res.modified_count

    return {
        "dry_run": dry_run,
        "orders_scanned": scanned,
        "orders_to_fix": to_fix,
        "orders_updated": updated,
        "per_code": dict(sorted(per_code.items())),
        "unknown_codes": unknown,
    }
