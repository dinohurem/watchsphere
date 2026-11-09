"""Catalog admin logic: export, edit import, bulk import checks, bulk image matching, filters.

Spec: "Uploading and editing watches" (bulk/edit spec), §1–§7.

Everything in this module up to the "Mongo-facing helpers" section is pure — it works on plain
dicts (a watch as produced by ``watch_to_dict``) so the import semantics can be tested without a
database. The endpoints in ``app/api/v1/endpoints/catalog_admin.py`` and the bulk import in
``endpoints/market.py`` load the current catalog, call a ``plan_*`` function, then write the plan.

Import semantics (edit import, bulk import "update" mode):
  * field present → overwrite; field missing → unchanged; ``null`` → clear
  * ``aliases`` are added to the existing ones, never replaced (``null`` clears them)
  * ``list_prices`` are merged per country (``{"HK": null}`` clears only HK, ``null`` clears all)
  * changing ``ws_code`` never turns the old code into an alias
  * every string is trimmed; a WS code already held by another watch rejects the row;
    an alias already used by another watch is reported as a warning
"""
from __future__ import annotations

import copy
import csv
import io
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bson import ObjectId

from app.core.market_constants import (
    LIST_PRICE_COUNTRY_CODES,
    normalize_list_price_country,
)

# --------------------------------------------------------------------------------------------
# Field catalogue
# --------------------------------------------------------------------------------------------

STRING_FIELDS = (
    "brand", "model", "reference", "collection", "dial", "bracelet", "ws_code", "description",
    "cover_image",
)
REQUIRED_FIELDS = ("brand", "model")
BOOL_FIELDS = ("featured", "trending", "is_popular_search", "discontinued")
LIST_FIELDS = ("oem_references", "aliases")
STATUS_VALUES = ("draft", "active")

# Every field the edit import can change (canonical Watch attribute names).
EDITABLE_FIELDS = STRING_FIELDS + BOOL_FIELDS + LIST_FIELDS + ("status", "list_prices")

# Import column → Watch attribute.
KEY_ALIASES = {
    "image": "cover_image",
    "popular": "is_popular_search",
    "popular_search": "is_popular_search",
}

# Columns produced by exports (or the old export) that are informational only; ignored silently.
IGNORED_KEYS = {
    "id", "_id", "created_at", "updated_at", "published_at", "views", "dealer_id", "dealer_name",
    "thumbnail", "image_thumbnail", "cover_image_thumbnail", "order_count", "price_change",
    "price_history", "image_thumbnails", "image_paths",
}

# Legacy WatchCreate fields still accepted by the bulk import of new watches.
LEGACY_CREATE_FIELDS = ("price", "currency", "condition", "year", "serial_number", "images", "dealer_id")

# Image fields a cover-image change touches (also what bulk images snapshots for undo).
IMAGE_FIELDS = ("cover_image", "cover_image_thumbnail", "images", "image_thumbnails", "image_paths")

LIST_PRICE_PREFIX = "list_price_"

EXPORT_COLUMNS = [
    "id", "brand", "model", "collection", "reference", "oem_references", "ws_code", "dial",
    "bracelet", "aliases", "description", "status", "image", "featured", "trending", "popular",
    "discontinued",
]
LIST_SEPARATOR = "|"


# --------------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------------

def plain(value: Any) -> Any:
    """Enums → their value, recursively; everything else unchanged (datetimes stay datetimes)."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def watch_to_dict(watch: Any) -> Dict[str, Any]:
    """A Watch document → plain dict with ``id`` as str (the shape every planner works on)."""
    data = watch.model_dump(exclude={"revision_id"})
    data["id"] = str(watch.id) if getattr(watch, "id", None) is not None else None
    return plain(data)


def trim_strings(value: Any) -> Any:
    """Strip leading/trailing whitespace from every string, recursively (spec §3.1)."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return [trim_strings(v) for v in value]
    if isinstance(value, dict):
        return {(k.strip() if isinstance(k, str) else k): trim_strings(v) for k, v in value.items()}
    return value


def ws_key(value: Optional[str]) -> Optional[str]:
    """Comparison key for WS codes and aliases: case-insensitive, whitespace collapsed."""
    if value is None:
        return None
    key = re.sub(r"\s+", " ", str(value).strip()).lower()
    return key or None


def normalize_match_key(value: Optional[str]) -> str:
    """Loose key for file-name / OEM matching.

    Case-insensitive, and ``/``, ``-``, ``_`` and whitespace are interchangeable — a reference
    like ``5811/1G`` cannot be a file name, so ``5811-1G.png`` and ``5811_1G.png`` must match.
    """
    key = (value or "").strip().lower()
    key = re.sub(r"[\s/_\-]+", "-", key)
    return key.strip("-")


_TRUE = {"true", "1", "yes", "y", "x", "on"}
_FALSE = {"false", "0", "no", "n", "off", ""}


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    raise ValueError(f"expected true/false, got {value!r}")


def parse_price(value: Any) -> Optional[float]:
    """599000, "599000", "599,000", "69'500", "69 500" → float. None/"" → None (clear)."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("expected a number")
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip()
        if not text or text.lower() == "null":
            return None
        text = re.sub(r"[\s',]", "", text)
        try:
            number = float(text)
        except ValueError:
            raise ValueError(f"not a number: {value!r}")
    if number < 0:
        raise ValueError("price cannot be negative")
    if number == 0:
        return None
    return int(number) if number.is_integer() else number


def parse_list(value: Any) -> List[str]:
    """List or "a | b" / JSON-array string → trimmed, de-duplicated list (order kept)."""
    if value is None:
        return []
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("["):
            try:
                value = json.loads(text)
            except json.JSONDecodeError:
                raise ValueError("invalid JSON list")
        else:
            value = text.split(LIST_SEPARATOR) if text else []
    if not isinstance(value, list):
        raise ValueError("expected a list")
    out: List[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text and text not in out:
            out.append(text)
    return out


def merge_unique(existing: Iterable[str], new: Iterable[str]) -> List[str]:
    out = list(existing or [])
    for item in new:
        if item not in out:
            out.append(item)
    return out


# --------------------------------------------------------------------------------------------
# Row normalisation
# --------------------------------------------------------------------------------------------

@dataclass
class NormalizedRow:
    values: Dict[str, Any] = field(default_factory=dict)  # canonical field → value (None = clear)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    row_id: Optional[str] = None


def normalize_list_prices(value: Any) -> Tuple[Optional[Dict[str, Optional[float]]], List[str]]:
    """Validate a list_prices mapping. Returns (mapping with None = clear that country, errors)."""
    if value is None:
        return None, []
    if isinstance(value, str):
        text = value.strip()
        if not text or text.lower() == "null":
            return None, []
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            return {}, ["list_prices: invalid JSON"]
    if not isinstance(value, dict):
        return {}, ["list_prices: expected an object like {\"HK\": 599000}"]
    out: Dict[str, Optional[float]] = {}
    errors: List[str] = []
    for raw_code, raw_price in value.items():
        code = normalize_list_price_country(str(raw_code))
        if not code:
            errors.append(f"list_prices: unknown country {raw_code!r}")
            continue
        try:
            out[code] = parse_price(raw_price)
        except ValueError as exc:
            errors.append(f"list_prices.{code}: {exc}")
    return out, errors


def normalize_row(raw: Any, *, allow_legacy: bool = False) -> NormalizedRow:
    """Trim, rename and type-check one import row. Missing keys stay missing."""
    result = NormalizedRow()
    if not isinstance(raw, dict):
        result.errors.append("row is not an object")
        return result

    row = trim_strings(raw)
    raw_id = row.get("id", row.get("_id"))
    if raw_id is not None and str(raw_id).strip():
        result.row_id = str(raw_id).strip()

    list_prices: Optional[Dict[str, Optional[float]]] = None
    list_prices_present = False
    list_prices_cleared = False

    for raw_key, value in row.items():
        if not isinstance(raw_key, str):
            continue
        key = raw_key.strip().lower() if raw_key.lower().startswith(LIST_PRICE_PREFIX) else raw_key.strip()
        key = KEY_ALIASES.get(key, key)

        if key in IGNORED_KEYS:
            continue

        if key.startswith(LIST_PRICE_PREFIX):
            code = normalize_list_price_country(key[len(LIST_PRICE_PREFIX):])
            if not code:
                result.errors.append(f"{raw_key}: unknown country")
                continue
            try:
                price = parse_price(value)
            except ValueError as exc:
                result.errors.append(f"{raw_key}: {exc}")
                continue
            list_prices_present = True
            list_prices = list_prices if list_prices is not None else {}
            list_prices[code] = price
            continue

        if key == "list_prices":
            mapping, errs = normalize_list_prices(value)
            result.errors.extend(errs)
            list_prices_present = True
            if mapping is None:
                list_prices_cleared = True
            else:
                list_prices = {**(list_prices or {}), **mapping}
            continue

        if key in STRING_FIELDS:
            if value is None or (isinstance(value, str) and (value == "" or value.lower() == "null")):
                if key in REQUIRED_FIELDS:
                    result.errors.append(f"{key} cannot be empty")
                    continue
                result.values[key] = None
            elif isinstance(value, (dict, list, bool)):
                result.errors.append(f"{key}: expected text")
            else:
                text = str(value).strip()
                if isinstance(value, float) and value.is_integer():
                    text = str(int(value))
                result.values[key] = text
            continue

        if key in BOOL_FIELDS:
            try:
                result.values[key] = parse_bool(value)
            except ValueError as exc:
                result.errors.append(f"{key}: {exc}")
            continue

        if key in LIST_FIELDS:
            if isinstance(value, str) and value.lower() == "null":
                value = None
            try:
                result.values[key] = None if value is None else parse_list(value)
            except ValueError as exc:
                result.errors.append(f"{key}: {exc}")
            continue

        if key == "status":
            text = str(value).strip().lower() if value is not None else ""
            if text not in STATUS_VALUES:
                result.errors.append(f"status: must be 'active' or 'draft'")
            else:
                result.values["status"] = text
            continue

        if allow_legacy and key in LEGACY_CREATE_FIELDS:
            result.values[key] = value
            continue

        result.warnings.append(f"ignored unknown column '{raw_key}'")

    if list_prices_present:
        if list_prices_cleared and not list_prices:
            result.values["list_prices"] = None
        else:
            # An explicit null for the whole field followed by per-country columns = replace.
            result.values["list_prices"] = list_prices or {}
            if list_prices_cleared:
                result.values["_list_prices_replace"] = True

    return result


# --------------------------------------------------------------------------------------------
# Applying a row to a watch
# --------------------------------------------------------------------------------------------

def compute_changes(current: Dict[str, Any], values: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """New value of every field a normalised row changes on ``current``. Unchanged → omitted."""
    changes: Dict[str, Any] = {}

    for key, value in values.items():
        if key.startswith("_"):
            continue
        if key == "aliases":
            new = [] if value is None else merge_unique(current.get("aliases") or [], value)
            if new != list(current.get("aliases") or []):
                changes["aliases"] = new
        elif key == "oem_references":
            new = [] if value is None else list(value)
            if new != list(current.get("oem_references") or []):
                changes["oem_references"] = new
        elif key == "list_prices":
            base = {} if values.get("_list_prices_replace") else dict(current.get("list_prices") or {})
            if value is None:
                new_prices: Dict[str, float] = {}
            else:
                new_prices = base
                for code, price in value.items():
                    if price is None:
                        new_prices.pop(code, None)
                    else:
                        new_prices[code] = price
            # Keep the fixed country order so exports and diffs stay stable.
            ordered = {c: new_prices[c] for c in LIST_PRICE_COUNTRY_CODES if c in new_prices}
            if ordered != dict(current.get("list_prices") or {}):
                changes["list_prices"] = ordered
        elif key == "cover_image":
            if value != current.get("cover_image"):
                changes["cover_image"] = value
                changes["cover_image_thumbnail"] = None
                changes["images"] = [value] if value else []
                changes["image_thumbnails"] = []
                changes["image_paths"] = []
        elif key in BOOL_FIELDS:
            if bool(value) != bool(current.get(key)):
                changes[key] = bool(value)
        elif key == "status":
            if value != current.get("status"):
                changes["status"] = value
                if value == "active" and not current.get("published_at"):
                    changes["published_at"] = now or datetime.utcnow()
        elif key in STRING_FIELDS:
            if value != current.get(key):
                changes[key] = value
        else:  # legacy pass-through (bulk import update mode)
            if value != current.get(key):
                changes[key] = value
    return changes


# --------------------------------------------------------------------------------------------
# Duplicate WS code / alias checks
# --------------------------------------------------------------------------------------------

def resolve_ws_conflicts(
    current_ws: Dict[str, Optional[str]],
    proposed: Dict[str, Tuple[int, Optional[str]]],
) -> Dict[int, str]:
    """Rows whose new WS code would be held by more than one watch → {line: reason}.

    ``current_ws``: every watch id → its WS code in the database.
    ``proposed``: watch id (or a placeholder for a new watch) → (line, new WS code).
    The final state is evaluated as a whole, so two watches swapping codes is allowed. When a
    code collides with a watch the file does not touch, every row that moves onto it is
    rejected; when only rows of this file collide, the first line wins.
    """
    rejected: Dict[int, str] = {}
    active = dict(proposed)
    while True:
        final = dict(current_ws)
        for wid, (_line, ws) in active.items():
            final[wid] = ws
        holders: Dict[str, List[str]] = defaultdict(list)
        for wid, ws in final.items():
            key = ws_key(ws)
            if key:
                holders[key].append(wid)

        new_rejects: Dict[str, str] = {}
        for key, ids in holders.items():
            if len(ids) < 2:
                continue
            moving = [i for i in ids if i in active]
            if not moving:
                continue  # pre-existing duplicate in the database; not this file's doing
            staying = [i for i in ids if i not in active]
            if staying:
                for wid in moving:
                    new_rejects[wid] = f"WS code '{active[wid][1]}' is already used by watch {staying[0]}"
            else:
                moving.sort(key=lambda i: active[i][0])
                first = moving[0]
                for wid in moving[1:]:
                    new_rejects[wid] = (
                        f"WS code '{active[wid][1]}' is also set on line {active[first][0]}"
                    )
        if not new_rejects:
            return rejected
        for wid, reason in new_rejects.items():
            rejected[active[wid][0]] = reason
            del active[wid]


def build_alias_index(watches: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    """ws_key(alias or WS code) → {watch id: label} for every watch."""
    index: Dict[str, Dict[str, str]] = defaultdict(dict)
    for w in watches:
        wid = w.get("id")
        label = w.get("ws_code") or wid
        for value in list(w.get("aliases") or []) + [w.get("ws_code")]:
            key = ws_key(value)
            if key:
                index[key][wid] = label
    return index


def alias_warnings(
    watch_id: str,
    new_aliases: Iterable[str],
    index: Dict[str, Dict[str, str]],
) -> List[str]:
    """Warnings for aliases already used (as alias or WS code) by another watch (spec §3.3)."""
    out: List[str] = []
    for alias in new_aliases:
        others = {wid: label for wid, label in index.get(ws_key(alias) or "", {}).items() if wid != watch_id}
        if others:
            labels = ", ".join(sorted(set(others.values()))[:3])
            out.append(f"alias '{alias}' is already used by {labels}")
    return out


# --------------------------------------------------------------------------------------------
# Parsing JSONL / CSV
# --------------------------------------------------------------------------------------------

@dataclass
class ParsedRows:
    rows: List[Tuple[int, Any]] = field(default_factory=list)  # (line, raw dict)
    errors: List[Tuple[int, str]] = field(default_factory=list)


def detect_format(text: str) -> str:
    head = text.lstrip("﻿ \t\r\n")
    return "jsonl" if head.startswith("{") or head.startswith("[") else "csv"


def parse_import_text(text: str, fmt: str = "auto") -> ParsedRows:
    fmt = (fmt or "auto").lower()
    if fmt == "auto":
        fmt = detect_format(text)
    if fmt in ("json", "jsonl", "ndjson"):
        return _parse_jsonl(text)
    if fmt == "csv":
        return _parse_csv(text)
    out = ParsedRows()
    out.errors.append((0, f"unsupported format {fmt!r}"))
    return out


def _parse_jsonl(text: str) -> ParsedRows:
    out = ParsedRows()
    stripped = text.lstrip("﻿ \t\r\n")
    if stripped.startswith("["):
        try:
            data = json.loads(stripped)
        except json.JSONDecodeError as exc:
            out.errors.append((exc.lineno, f"invalid JSON: {exc.msg}"))
            return out
        for i, item in enumerate(data, start=1):
            out.rows.append((i, item))
        return out
    for line_no, line in enumerate(text.lstrip("﻿").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            out.rows.append((line_no, json.loads(line)))
        except json.JSONDecodeError as exc:
            out.errors.append((line_no, f"invalid JSON: {exc.msg}"))
    return out


def _parse_csv(text: str) -> ParsedRows:
    out = ParsedRows()
    text = text.lstrip("﻿")
    first_line = text.split("\n", 1)[0]
    delimiter = max([",", ";", "\t"], key=first_line.count)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        return out
    header = [h.strip() for h in header]
    for line_no, cells in enumerate(reader, start=2):
        if not any(c.strip() for c in cells):
            continue
        if len(cells) > len(header):
            out.errors.append((line_no, f"{len(cells)} cells but only {len(header)} columns"))
            continue
        row: Dict[str, Any] = {}
        for name, cell in zip(header, cells):
            if not name:
                continue
            cell = cell.strip()
            if cell == "":
                continue  # empty cell = field missing = no change
            if cell.lower() == "null":
                row[name] = None
            else:
                row[name] = cell
        out.rows.append((line_no, row))
    return out


# --------------------------------------------------------------------------------------------
# Edit import planning
# --------------------------------------------------------------------------------------------

def _row_label(values: Dict[str, Any], current: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    src = current or {}
    return {
        "ws_code": values.get("ws_code", src.get("ws_code")),
        "brand": values.get("brand", src.get("brand")),
        "model": values.get("model", src.get("model")),
    }


def format_summary(total: int, ws_changed: int, errors: int) -> str:
    def plural(n: int, word: str) -> str:
        return f"{n} {word}" + ("" if n == 1 else "s")

    ws = f"{ws_changed} WS code{'' if ws_changed == 1 else 's'} changed"
    return f"{plural(total, 'watch').replace('watchs', 'watches')} · {ws} · {plural(errors, 'error')}"


def plan_edit_import(
    parsed: ParsedRows,
    watches: Dict[str, Dict[str, Any]],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Dry-run of an edit import against the current catalog (``watches``: id → watch dict).

    Returns the per-row report plus ``plans`` = [{"id", "line", "changes"}] to write.
    """
    now = now or datetime.utcnow()
    results: List[Dict[str, Any]] = []
    plans: Dict[int, Dict[str, Any]] = {}
    by_line: Dict[int, Dict[str, Any]] = {}
    seen_ids: Dict[str, int] = {}

    for line, err in parsed.errors:
        res = {"line": line, "id": None, "action": "error", "errors": [err], "warnings": [], "changes": []}
        results.append(res)

    for line, raw in parsed.rows:
        norm = normalize_row(raw)
        res: Dict[str, Any] = {
            "line": line, "id": norm.row_id, "action": "unchanged",
            "errors": list(norm.errors), "warnings": list(norm.warnings), "changes": [],
        }
        results.append(res)
        by_line[line] = res
        current = watches.get(norm.row_id) if norm.row_id else None
        res.update(_row_label(norm.values, current))
        if not norm.row_id:
            res["errors"].append("missing id")
        elif current is None:
            res["errors"].append(f"no watch with id {norm.row_id}")
        elif norm.row_id in seen_ids:
            res["errors"].append(f"id also appears on line {seen_ids[norm.row_id]}")
        if norm.row_id and norm.row_id not in seen_ids:
            seen_ids[norm.row_id] = line
        if res["errors"]:
            res["action"] = "error"
            continue
        changes = compute_changes(current, norm.values, now)
        if changes:
            plans[line] = {"id": norm.row_id, "line": line, "changes": changes}

    # Duplicate WS codes across the final state.
    current_ws = {wid: w.get("ws_code") for wid, w in watches.items()}
    proposed = {p["id"]: (line, p["changes"]["ws_code"]) for line, p in plans.items() if "ws_code" in p["changes"]}
    for line, reason in resolve_ws_conflicts(current_ws, proposed).items():
        by_line[line]["errors"].append(reason)
        by_line[line]["action"] = "error"
        plans.pop(line, None)

    # Alias already used by another watch → warning only.
    index = build_alias_index(watches.values())
    for line in sorted(plans):
        plan = plans[line]
        if "aliases" not in plan["changes"]:
            continue
        before = set(watches[plan["id"]].get("aliases") or [])
        added = [a for a in plan["changes"]["aliases"] if a not in before]
        by_line[line]["warnings"].extend(alias_warnings(plan["id"], added, index))
        for alias in added:  # later rows see aliases added earlier in the same file
            index.setdefault(ws_key(alias), {})[plan["id"]] = plan["changes"].get("ws_code") or watches[plan["id"]].get("ws_code") or plan["id"]

    ws_changed = 0
    for line, plan in plans.items():
        by_line[line]["action"] = "updated"
        by_line[line]["changes"] = sorted(plan["changes"].keys())
        if "ws_code" in plan["changes"]:
            ws_changed += 1
            by_line[line]["old_ws_code"] = watches[plan["id"]].get("ws_code")

    results.sort(key=lambda r: r["line"])
    errors = sum(1 for r in results if r["action"] == "error")
    total = len(results)
    return {
        "total": total,
        "updated": len(plans),
        "unchanged": sum(1 for r in results if r["action"] == "unchanged"),
        "errors": errors,
        "warnings": sum(len(r["warnings"]) for r in results),
        "ws_codes_changed": ws_changed,
        "summary": format_summary(total, ws_changed, errors),
        "results": results,
        "plans": [plans[k] for k in sorted(plans)],
    }


# --------------------------------------------------------------------------------------------
# Bulk import (new watches) planning
# --------------------------------------------------------------------------------------------

def plan_bulk_import(
    parsed: ParsedRows,
    watches: Dict[str, Dict[str, Any]],
    on_duplicate: str = "skip",
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Plan a bulk import of new watches (spec §7).

    A row is a duplicate of an existing watch only when its WS code or one of its OEM references
    matches — never by ``reference`` (RM67-02 has 11 editions). Within the file, a later row with
    the same WS code / OEM reference as an earlier one is rejected.
    """
    now = now or datetime.utcnow()
    ws_index: Dict[str, set] = defaultdict(set)
    oem_index: Dict[str, set] = defaultdict(set)
    for wid, w in watches.items():
        if ws_key(w.get("ws_code")):
            ws_index[ws_key(w.get("ws_code"))].add(wid)
        for oem in w.get("oem_references") or []:
            if normalize_match_key(oem):
                oem_index[normalize_match_key(oem)].add(wid)

    results: List[Dict[str, Any]] = []
    creates: Dict[int, Dict[str, Any]] = {}
    updates: Dict[int, Dict[str, Any]] = {}
    by_line: Dict[int, Dict[str, Any]] = {}
    file_ws: Dict[str, int] = {}
    file_oem: Dict[str, int] = {}

    for line, err in parsed.errors:
        results.append({"line": line, "action": "error", "errors": [err], "warnings": [],
                        "ws_code": None, "reference": None})

    for line, raw in parsed.rows:
        norm = normalize_row(raw, allow_legacy=True)
        values = norm.values
        res: Dict[str, Any] = {
            "line": line, "action": "error", "errors": list(norm.errors), "warnings": list(norm.warnings),
            "ws_code": values.get("ws_code"), "reference": values.get("reference"),
        }
        results.append(res)
        by_line[line] = res
        if res["errors"]:
            continue

        row_ws = ws_key(values.get("ws_code"))
        row_oems = [normalize_match_key(o) for o in (values.get("oem_references") or []) if normalize_match_key(o)]

        # Duplicates within the file.
        dup_line = (file_ws.get(row_ws) if row_ws else None) or next(
            (file_oem[o] for o in row_oems if o in file_oem), None
        )
        if dup_line:
            res["errors"].append(f"duplicate of line {dup_line} (same WS code or OEM reference)")
            continue

        matched = set(ws_index.get(row_ws, set())) if row_ws else set()
        for o in row_oems:
            matched |= oem_index.get(o, set())

        if len(matched) > 1:
            res["errors"].append("matches several existing watches by WS code / OEM reference")
            continue

        if row_ws:
            file_ws[row_ws] = line
        for o in row_oems:
            file_oem.setdefault(o, line)

        if matched:
            wid = next(iter(matched))
            res["id"] = wid
            if on_duplicate != "update":
                res["action"] = "skipped"
                res["errors"] = []
                res["message"] = "Already exists"
                continue
            changes = compute_changes(watches[wid], values, now)
            res["action"] = "updated" if changes else "unchanged"
            if changes:
                updates[line] = {"id": wid, "line": line, "changes": changes}
            continue

        missing = [f for f in REQUIRED_FIELDS if not values.get(f)]
        if missing:
            res["errors"].append(", ".join(missing) + " required")
            continue
        fields = {k: v for k, v in values.items() if not k.startswith("_")}
        prices = {c: p for c, p in (fields.get("list_prices") or {}).items() if p is not None}
        fields["list_prices"] = {c: prices[c] for c in LIST_PRICE_COUNTRY_CODES if c in prices}
        for list_field in LIST_FIELDS:
            fields[list_field] = fields.get(list_field) or []
        res["action"] = "created"
        creates[line] = {"line": line, "fields": fields}

    # WS codes changed by updates must not collide with anything (incl. rows being created).
    current_ws = {wid: w.get("ws_code") for wid, w in watches.items()}
    proposed = {u["id"]: (line, u["changes"]["ws_code"]) for line, u in updates.items() if "ws_code" in u["changes"]}
    for line, c in creates.items():
        if c["fields"].get("ws_code"):
            proposed[f"new:{line}"] = (line, c["fields"]["ws_code"])
    for line, reason in resolve_ws_conflicts(current_ws, proposed).items():
        by_line[line]["errors"].append(reason)
        by_line[line]["action"] = "error"
        creates.pop(line, None)
        updates.pop(line, None)

    index = build_alias_index(watches.values())
    for line in sorted(set(creates) | set(updates)):
        if line in creates:
            wid, aliases = f"new:{line}", creates[line]["fields"].get("aliases") or []
        else:
            u = updates[line]
            before = set(watches[u["id"]].get("aliases") or [])
            wid, aliases = u["id"], [a for a in u["changes"].get("aliases", []) if a not in before]
        by_line[line]["warnings"].extend(alias_warnings(wid, aliases, index))
        label = (creates[line]["fields"].get("ws_code") if line in creates else None) or wid
        for alias in aliases:
            index.setdefault(ws_key(alias), {})[wid] = label

    for res in results:
        if res["errors"]:
            res["action"] = "error"
        if res.get("errors") and "message" not in res:
            res["message"] = "; ".join(res["errors"])
        elif res["warnings"] and "message" not in res:
            res["message"] = "; ".join(res["warnings"])

    results.sort(key=lambda r: r["line"])
    return {
        "total": len(results),
        "created": len(creates),
        "updated": len(updates),
        "skipped": sum(1 for r in results if r["action"] == "skipped"),
        "unchanged": sum(1 for r in results if r["action"] == "unchanged"),
        "errors": sum(1 for r in results if r["action"] == "error"),
        "results": results,
        "creates": [creates[k] for k in sorted(creates)],
        "updates": [updates[k] for k in sorted(updates)],
    }


# --------------------------------------------------------------------------------------------
# Bulk images: file-name matching (spec §4)
# --------------------------------------------------------------------------------------------

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"}


def classify_upload_path(path: str) -> Tuple[str, str]:
    """→ ("ignore", reason) | ("not_image", reason) | ("image", stem)."""
    norm = path.replace("\\", "/")
    parts = [p for p in norm.split("/") if p]
    if not parts or norm.endswith("/"):
        return "ignore", "directory"
    if "__MACOSX" in parts:
        return "ignore", "__MACOSX"
    name = parts[-1]
    if name.startswith("._"):
        return "ignore", "macOS resource fork"
    if name.startswith(".") or name.lower() in ("thumbs.db", "desktop.ini"):
        return "ignore", "hidden file"
    if "." not in name:
        return "not_image", "no file extension"
    stem, ext = name.rsplit(".", 1)
    if ext.lower() not in IMAGE_EXTENSIONS:
        return "not_image", f"not an image (.{ext.lower()})"
    return "image", stem


def build_image_index(watches: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    """normalize_match_key(id | WS code | OEM reference) → {watch id: how it matched}."""
    index: Dict[str, Dict[str, str]] = defaultdict(dict)
    for w in watches:
        wid = w.get("id")
        if not wid:
            continue
        index[normalize_match_key(wid)][wid] = "id"
        if normalize_match_key(w.get("ws_code")):
            index[normalize_match_key(w.get("ws_code"))].setdefault(wid, "ws_code")
        for oem in w.get("oem_references") or []:
            if normalize_match_key(oem):
                index[normalize_match_key(oem)].setdefault(wid, "oem_reference")
    return index


def match_image_names(
    paths: Iterable[str],
    index: Dict[str, Dict[str, str]],
    labels: Optional[Dict[str, str]] = None,
    already_matched: Optional[Dict[str, str]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """Match uploaded file names to watches. One image per watch: the first file wins.

    ``already_matched``: watch id → file name, for uploads split over several requests.
    """
    labels = labels or {}
    taken: Dict[str, str] = dict(already_matched or {})
    matched: List[Dict[str, Any]] = []
    unmatched: List[Dict[str, Any]] = []
    ignored: List[Dict[str, Any]] = []
    for path in paths:
        kind, info = classify_upload_path(path)
        if kind == "ignore":
            ignored.append({"file": path, "reason": info})
            continue
        if kind == "not_image":
            unmatched.append({"file": path, "reason": info})
            continue
        hits = index.get(normalize_match_key(info), {})
        if not hits:
            unmatched.append({"file": path, "reason": "no watch with this id, WS code or OEM reference"})
            continue
        if len(hits) > 1:
            names = ", ".join(sorted(labels.get(h, h) for h in hits)[:4])
            unmatched.append({"file": path, "reason": f"matches {len(hits)} watches ({names})"})
            continue
        wid, how = next(iter(hits.items()))
        if wid in taken:
            unmatched.append({"file": path, "reason": f"{taken[wid]} already matched this watch"})
            continue
        taken[wid] = path
        matched.append({"file": path, "watch_id": wid, "matched_by": how})
    return {"matched": matched, "unmatched": unmatched, "ignored": ignored}


# --------------------------------------------------------------------------------------------
# Watch list filter (spec §5) — shared by the list, count, export and bulk actions
# --------------------------------------------------------------------------------------------

FILTER_KEYS = (
    "status", "brand", "dealer_id", "search", "no_image", "no_ws_code", "no_aliases", "no_list_price",
)


def _flexible_regex(search: str) -> Dict[str, str]:
    escaped = re.escape(search.strip())
    flexible = re.sub(r"(?:\\\s|\\-|\s|_|\\/|/)+", lambda _m: r"[\s\-_/]+", escaped)
    return {"$regex": flexible, "$options": "i"}


def build_watch_query(
    status: Optional[str] = None,
    brand: Optional[str] = None,
    dealer_id: Optional[str] = None,
    search: Optional[str] = None,
    no_image: bool = False,
    no_ws_code: bool = False,
    no_aliases: bool = False,
    no_list_price: bool = False,
    ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Mongo filter for the admin watch list. Empty dict = every watch."""
    clauses: List[Dict[str, Any]] = []
    if ids is not None:
        oids = [ObjectId(i) for i in ids if ObjectId.is_valid(str(i))]
        clauses.append({"_id": {"$in": oids}})
    status_value = plain(status)
    if status_value and status_value != "all":
        clauses.append({"status": status_value})
    if brand:
        clauses.append({"brand": brand})
    if dealer_id:
        clauses.append({"dealer_id": dealer_id})
    if search and search.strip():
        rx = _flexible_regex(search)
        clauses.append({"$or": [
            {"brand": rx}, {"model": rx}, {"reference": rx}, {"ws_code": rx},
            {"oem_references": rx}, {"aliases": rx},
        ]})
    if no_image:
        clauses.append({"$or": [{"cover_image": None}, {"cover_image": ""}]})
    if no_ws_code:
        clauses.append({"$or": [{"ws_code": None}, {"ws_code": ""}]})
    if no_aliases:
        clauses.append({"$or": [{"aliases": {"$exists": False}}, {"aliases": None}, {"aliases": {"$size": 0}}]})
    if no_list_price:
        clauses.append({"$or": [{"list_prices": {"$exists": False}}, {"list_prices": None}, {"list_prices": {}}]})
    if not clauses:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


# --------------------------------------------------------------------------------------------
# Export (spec §1)
# --------------------------------------------------------------------------------------------

def export_record(w: Dict[str, Any]) -> Dict[str, Any]:
    """One watch → the JSONL export shape (re-importable by the edit import as-is)."""
    prices = w.get("list_prices") or {}
    return {
        "id": w.get("id"),
        "brand": w.get("brand"),
        "model": w.get("model"),
        "collection": w.get("collection"),
        "reference": w.get("reference"),
        "oem_references": list(w.get("oem_references") or []),
        "ws_code": w.get("ws_code"),
        "dial": w.get("dial"),
        "bracelet": w.get("bracelet"),
        "aliases": list(w.get("aliases") or []),
        "description": w.get("description"),
        "status": plain(w.get("status")),
        "image": w.get("cover_image"),
        "featured": bool(w.get("featured")),
        "trending": bool(w.get("trending")),
        "popular": bool(w.get("is_popular_search")),
        "discontinued": bool(w.get("discontinued")),
        "list_prices": {c: _num(prices[c]) for c in LIST_PRICE_COUNTRY_CODES if c in prices},
    }


def _num(value: Any) -> Any:
    """599000.0 → 599000 so exports read like what the admin typed."""
    return int(value) if isinstance(value, float) and value.is_integer() else value


def export_jsonl(watches: Iterable[Dict[str, Any]]) -> Iterable[str]:
    for w in watches:
        yield json.dumps(export_record(w), ensure_ascii=False) + "\n"


def csv_header() -> List[str]:
    return EXPORT_COLUMNS + [f"{LIST_PRICE_PREFIX}{c}" for c in LIST_PRICE_COUNTRY_CODES]


def export_csv_row(w: Dict[str, Any]) -> List[str]:
    rec = export_record(w)
    cells: List[str] = []
    for col in EXPORT_COLUMNS:
        value = rec.get(col)
        if isinstance(value, list):
            cells.append(f" {LIST_SEPARATOR} ".join(value))
        elif isinstance(value, bool):
            cells.append("true" if value else "false")
        elif value is None:
            cells.append("")
        else:
            cells.append(str(value))
    for code in LIST_PRICE_COUNTRY_CODES:
        price = rec["list_prices"].get(code)
        cells.append("" if price is None else str(price))
    return cells


def export_csv(watches: Iterable[Dict[str, Any]]) -> Iterable[str]:
    """CSV with one ``list_price_XX`` column per country; lists joined with " | "."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(csv_header())
    yield "﻿" + buf.getvalue()
    for w in watches:
        buf.seek(0)
        buf.truncate()
        writer.writerow(export_csv_row(w))
        yield buf.getvalue()


def deepcopy_values(values: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(values)


# --------------------------------------------------------------------------------------------
# Mongo-facing helpers (thin; all decisions are made by the planners above)
# --------------------------------------------------------------------------------------------

async def load_catalog() -> Dict[str, Dict[str, Any]]:
    """Every watch (active and draft) as id → dict."""
    from app.models.watch import Watch

    return {str(w.id): watch_to_dict(w) for w in await Watch.find_all().to_list()}


async def write_update_plans(plans: List[Dict[str, Any]], catalog: Dict[str, Dict[str, Any]], recorder: Any) -> int:
    """Snapshot then apply ``[{"id", "changes"}]``. The batch is saved before the first write so a
    crash half-way can still be undone."""
    from beanie import PydanticObjectId

    from app.models.watch import Watch

    now = datetime.utcnow()
    for plan in plans:
        recorder.record_update(plan["id"], catalog[plan["id"]], list(plan["changes"].keys()) + ["updated_at"])
    await recorder.save()
    written = 0
    for plan in plans:
        await Watch.find_one(Watch.id == PydanticObjectId(plan["id"])).update(
            {"$set": {**plan["changes"], "updated_at": now}}
        )
        written += 1
    return written
