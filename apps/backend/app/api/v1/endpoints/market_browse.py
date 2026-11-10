"""
Market browse endpoints for the redesigned app (redesign v3 §4, §1–3 data).

Mounted under ``/market`` **before** ``market.py`` (whose ``/{watch_id:path}`` catch-all would
otherwise swallow these paths) – see ``app/api/v1/router.py``.

- GET /market/cards               card grid (Show signal for "All", collection/model/reference
                                  filters for a brand)
- GET /market/brand-tabs          brand tab order
- GET /market/facets/collections  [{collection, model_count}]
- GET /market/facets/models       [str]   (Model button only when > 1)
- GET /market/facets/references   [str]
- GET /market/search?q=           alias / nickname aware search → cards
- GET /market/detail/{ws_code}/trend   market_stats.price_trend
- GET /market/detail/{ws_code}/retail  market_stats.retail_comparison
"""

import logging
import re
import time
import unicodedata
from typing import Any, Iterable, Optional

from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import get_current_active_user
from app.core.market_constants import APP_CURRENCIES, PERIOD_DAYS
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.watch import Watch, WatchStatus
from app.services.market_cards import cards_for_watches

logger = logging.getLogger(__name__)
router = APIRouter()

SIGNALS = ("top_movers", "most_requested", "rising", "falling", "above_retail", "below_retail")
SIGNAL_SCAN_LIMIT = 500  # show_signal caps a page at 500


# ============================================================================================
# Pure helpers (unit-tested in tests/test_market_browse.py)
# ============================================================================================


def normalize_text(s: Optional[str]) -> str:
    """Lower-case, accents stripped, punctuation → space, whitespace collapsed."""
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(s))
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = re.sub(r"[^0-9a-z]+", " ", no_accents.lower())
    return " ".join(cleaned.split())


def compact(s: Optional[str]) -> str:
    """normalize_text without spaces: '126518 LN' → '126518ln', 'Pepsi-Jubilée' → 'pepsijubilee'."""
    return normalize_text(s).replace(" ", "")


def model_button_visible(models: Iterable[Optional[str]]) -> bool:
    """UI M9: show the Model button only if the collection has > 1 distinct model."""
    distinct = {normalize_text(m) for m in models if m and normalize_text(m)}
    return len(distinct) > 1


def _alias_tables() -> tuple[dict, dict]:
    """Brand and descriptor alias tables shared with the WhatsApp generator."""
    try:
        from app.services.wtb_wts_service import BRAND_ALIASES, WATCH_DESCRIPTOR_ALIASES

        return dict(BRAND_ALIASES), dict(WATCH_DESCRIPTOR_ALIASES)
    except Exception:  # generator module unavailable – search still works on catalog data
        return {}, {}


def token_alternatives(token: str, brand_aliases: dict, descriptor_aliases: dict) -> list[str]:
    alts = [token]
    b = brand_aliases.get(token)
    if b:
        alts.append(normalize_text(b))
    d = descriptor_aliases.get(token)
    if d:
        alts.append(normalize_text(d))
    return list(dict.fromkeys(a for a in alts if a))


def build_search_entry(w: dict) -> dict:
    """Pre-normalised search keys for one catalog watch (dict from Mongo)."""
    codes = [w.get("ws_code"), w.get("reference")] + list(w.get("oem_references") or [])
    aliases = list(w.get("aliases") or [])
    text_parts = [w.get("brand"), w.get("model"), w.get("collection"), w.get("dial"),
                  w.get("bracelet")] + codes + aliases
    text = " ".join(normalize_text(p) for p in text_parts if p)
    return {
        "id": w.get("_id"),
        "ws_code": w.get("ws_code"),
        "codes": [compact(c) for c in codes if c],
        "aliases": [compact(a) for a in aliases if a],
        "alias_text": [normalize_text(a) for a in aliases if a],
        "text": text,
        "text_compact": text.replace(" ", ""),
    }


def score_entry(query: str, entry: dict, brand_aliases: Optional[dict] = None,
                descriptor_aliases: Optional[dict] = None) -> int:
    """0 = no match. Exact code/alias 100, code prefix 80, alias phrase 70, all tokens 50."""
    qn = normalize_text(query)
    qc = qn.replace(" ", "")
    if not qc:
        return 0
    if qc in entry["codes"] or qc in entry["aliases"]:
        return 100
    if len(qc) >= 3 and any(c.startswith(qc) for c in entry["codes"]):
        return 80
    if len(qc) >= 3 and any(qc in a for a in entry["aliases"]):
        return 70
    brand_aliases = brand_aliases or {}
    descriptor_aliases = descriptor_aliases or {}
    tokens = qn.split()
    for t in tokens:
        alts = token_alternatives(t, brand_aliases, descriptor_aliases)
        if not any(a in entry["text"] or a.replace(" ", "") in entry["text_compact"] for a in alts):
            return 0
    return 50


# ============================================================================================
# Data access helpers
# ============================================================================================


def _ci_exact(value: str) -> dict:
    return {"$regex": f"^{re.escape(value.strip())}$", "$options": "i"}


def _catalog_query(brand: Optional[str] = None, collection: Optional[str] = None,
                   model: Optional[str] = None, reference: Optional[str] = None) -> dict:
    q: dict = {"status": WatchStatus.ACTIVE.value, "ws_code": {"$nin": [None, ""]}}
    if brand:
        q["brand"] = _ci_exact(brand)
    if collection:
        q["collection"] = _ci_exact(collection)
    if model:
        q["model"] = _ci_exact(model)
    if reference:
        q["$or"] = [{"reference": _ci_exact(reference)}, {"ws_code": _ci_exact(reference)}]
    return q


async def _signal_codes(signal: str, brand: Optional[str], direction: Optional[str]) -> list[str]:
    try:
        from app.services.market_stats import show_signal  # agent C
    except ImportError:
        return []
    try:
        return await show_signal(signal, brand=brand, direction=direction,
                                 limit=SIGNAL_SCAN_LIMIT, offset=0) or []
    except Exception as e:
        logger.error("show_signal(%s) failed: %s", signal, e, exc_info=True)
        return []


def _rank(watches: list[Watch], ranked_codes: list[str]) -> list[Watch]:
    pos = {c: i for i, c in enumerate(ranked_codes)}
    big = len(pos) + 1
    return sorted(watches, key=lambda w: (pos.get(w.ws_code, big), -(w.order_count or 0),
                                          w.ws_code or ""))


# ============================================================================================
# Endpoints
# ============================================================================================


@router.get("/cards")
async def market_cards(
    brand: Optional[str] = None,
    signal: Optional[str] = None,
    direction: Optional[str] = None,
    collection: Optional[str] = None,
    model: Optional[str] = None,
    reference: Optional[str] = None,
    limit: int = Query(default=40, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Market card grid → ``{"items": [card], "total": int}``.

    No brand: ordered by ``signal`` (default top_movers; above/below_retail honour
    ``direction`` most|least). With a brand: filtered by collection/model/reference and sorted
    by top movers (unranked watches after, by listing volume)."""
    sig = (signal or "top_movers").lower()
    if sig not in SIGNALS:
        raise HTTPException(status_code=422, detail=f"signal must be one of {', '.join(SIGNALS)}")
    dirn = (direction or "most").lower()
    if dirn not in ("most", "least"):
        raise HTTPException(status_code=422, detail="direction must be 'most' or 'least'")

    if not brand:
        codes = await _signal_codes(sig, None, dirn)
        if codes:
            # Stats exist for every ordered WS code; only active catalog watches are shown, so
            # filter before paging or offsets drift and the client re-appends the tail forever.
            active = set(await Watch.get_motor_collection().distinct(
                "ws_code", {"ws_code": {"$in": codes}, "status": WatchStatus.ACTIVE.value}
            ))
            codes = [c for c in codes if c in active]
        if codes:
            page_codes = codes[offset:offset + limit]
            docs = await Watch.find(In(Watch.ws_code, page_codes),
                                    Watch.status == WatchStatus.ACTIVE).to_list()
            by_code: dict = {}
            for w in docs:
                by_code.setdefault(w.ws_code, w)
            ordered = [by_code[c] for c in page_codes if c in by_code]
            return {"items": await cards_for_watches(ordered), "total": len(codes)}
        if sig != "top_movers":
            return {"items": [], "total": 0}
        # Stats not computed yet: fall back to listing volume so the grid is never empty.
        q = _catalog_query()
        total = await Watch.find(q).count()
        docs = await Watch.find(q).sort([("order_count", -1), ("ws_code", 1)]) \
            .skip(offset).limit(limit).to_list()
        return {"items": await cards_for_watches(docs), "total": total}

    q = _catalog_query(brand, collection, model, reference)
    watches = await Watch.find(q).to_list()
    ranked = await _signal_codes("top_movers", watches[0].brand if watches else brand, None)
    ordered = _rank(watches, ranked)
    page = ordered[offset:offset + limit]
    return {"items": await cards_for_watches(page), "total": len(ordered)}


@router.get("/brand-tabs")
async def brand_tabs(current_user: User = Depends(get_current_active_user)) -> Any:
    """Brand names for the tab row, most listed first ("All" is added by the client)."""
    coll = Watch.get_motor_collection()
    rows = await coll.aggregate([
        {"$match": _catalog_query()},
        {"$group": {"_id": "$brand", "watches": {"$sum": 1}, "orders": {"$sum": "$order_count"}}},
    ]).to_list(length=None)
    brands = {r["_id"]: r for r in rows if r.get("_id")}
    if not brands:
        return []

    order_rows = await Order.get_motor_collection().aggregate([
        {"$match": {"status": OrderStatus.ACTIVE.value}},
        {"$group": {"_id": {"$toLower": "$brand"}, "n": {"$sum": 1}}},
    ]).to_list(length=None)
    active = {r["_id"]: r["n"] for r in order_rows if r.get("_id")}

    def key(b: str):
        r = brands[b]
        return (-(active.get(b.lower(), 0)), -(r.get("orders") or 0), -(r.get("watches") or 0), b)

    return sorted(brands.keys(), key=key)


@router.get("/facets/collections")
async def facet_collections(
    brand: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Collections of a brand → ``[{"collection": str, "model_count": int}]``."""
    rows = await Watch.get_motor_collection().aggregate([
        {"$match": {**_catalog_query(brand), "collection": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$collection", "models": {"$addToSet": "$model"},
                    "watches": {"$sum": 1}}},
    ]).to_list(length=None)
    merged: dict[str, dict] = {}
    for r in rows:
        name = (r["_id"] or "").strip()
        if not name:
            continue
        k = normalize_text(name)
        entry = merged.setdefault(k, {"collection": name, "models": set(), "watches": 0})
        entry["models"].update(normalize_text(m) for m in r.get("models") or [] if m)
        entry["watches"] += r.get("watches") or 0
    out = sorted(merged.values(), key=lambda e: (-e["watches"], e["collection"].lower()))
    return [{"collection": e["collection"], "model_count": len({m for m in e["models"] if m})}
            for e in out]


@router.get("/facets/models")
async def facet_models(
    brand: str,
    collection: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Distinct models of a collection → ``[str]`` (client shows Model button if > 1)."""
    values = await Watch.get_motor_collection().distinct("model", _catalog_query(brand, collection))
    seen: dict[str, str] = {}
    for v in values:
        if v and normalize_text(v) and normalize_text(v) not in seen:
            seen[normalize_text(v)] = v.strip()
    return sorted(seen.values(), key=lambda s: (len(s), s.lower()))


@router.get("/facets/references")
async def facet_references(
    brand: str,
    collection: Optional[str] = None,
    model: Optional[str] = None,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Reference numbers (no description) → ``[str]``; ``q`` filters live (space/case-insensitive)."""
    values = await Watch.get_motor_collection().distinct(
        "reference", _catalog_query(brand, collection, model)
    )
    needle = compact(q)
    seen: dict[str, str] = {}
    for v in values:
        if not v:
            continue
        c = compact(v)
        if needle and needle not in c:
            continue
        seen.setdefault(c, v.strip())
    return sorted(seen.values(), key=lambda s: s.lower())


_SEARCH_CACHE: dict = {"at": 0.0, "entries": []}
_SEARCH_TTL = 300.0


async def _search_entries() -> list[dict]:
    now = time.monotonic()
    if _SEARCH_CACHE["entries"] and now - _SEARCH_CACHE["at"] < _SEARCH_TTL:
        return _SEARCH_CACHE["entries"]
    proj = {"brand": 1, "model": 1, "collection": 1, "dial": 1, "bracelet": 1, "ws_code": 1,
            "reference": 1, "oem_references": 1, "aliases": 1, "order_count": 1}
    docs = await Watch.get_motor_collection().find(_catalog_query(), proj).to_list(length=None)
    entries = [build_search_entry(d) for d in docs]
    for e, d in zip(entries, docs):
        e["order_count"] = d.get("order_count") or 0
    _SEARCH_CACHE.update(at=now, entries=entries)
    return entries


@router.get("/search")
async def market_search(
    q: str = Query(default="", max_length=100),
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Search reference, model or brand – resolves aliases / dealer slang ("Pepsi Jubilee",
    "Pikachu") via the catalog's aliases / OEM references / WS codes → ``{"items": [card]}``."""
    if not normalize_text(q):
        return {"items": []}
    brand_aliases, descriptor_aliases = _alias_tables()
    scored = []
    for e in await _search_entries():
        s = score_entry(q, e, brand_aliases, descriptor_aliases)
        if s:
            scored.append((s, e))
    scored.sort(key=lambda t: (-t[0], -t[1]["order_count"], t[1]["ws_code"] or ""))
    top = scored[:limit]
    if not top:
        return {"items": []}
    ids = [PydanticObjectId(e["id"]) for _, e in top]
    docs = {str(w.id): w for w in await Watch.find(In(Watch.id, ids)).to_list()}
    ordered = [docs[str(e["id"])] for _, e in top if str(e["id"]) in docs]
    return {"items": await cards_for_watches(ordered)}


def _currency(currency: Optional[str], user: User) -> str:
    cur = (currency or user.preferred_currency or "EUR").upper()
    if cur not in APP_CURRENCIES:
        raise HTTPException(status_code=422, detail=f"currency must be one of {', '.join(APP_CURRENCIES)}")
    return cur


@router.get("/detail/{ws_code:path}/trend")
async def detail_trend(
    ws_code: str,
    period: str = "1M",
    currency: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Price trend sheet data (``market_stats.price_trend``)."""
    p = (period or "1M").upper()
    if p not in PERIOD_DAYS:
        raise HTTPException(status_code=422, detail=f"period must be one of {', '.join(PERIOD_DAYS)}")
    cur = _currency(currency, current_user)
    try:
        from app.services.market_stats import price_trend
    except ImportError:
        raise HTTPException(status_code=503, detail="Market stats not available yet")
    return await price_trend(ws_code, p, cur)


@router.get("/detail/{ws_code:path}/retail")
async def detail_retail(
    ws_code: str,
    currency: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Retail prices sheet data (``market_stats.retail_comparison``)."""
    cur = _currency(currency, current_user)
    try:
        from app.services.market_stats import retail_comparison
    except ImportError:
        raise HTTPException(status_code=503, detail="Market stats not available yet")
    return await retail_comparison(ws_code, cur)
