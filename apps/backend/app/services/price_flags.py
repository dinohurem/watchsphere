"""Suspicious prices: check an offer when it is created, say why, hold it back.

A WTS offer is compared with the other active offers of the same WS code, the same condition
and the same year (else the nearest year), in USD (``market_stats.outlier_check``: ±25 %, ±35 %
for a neighbouring year). An offer outside that band is created with status ``held`` and a
``price_flag`` on it: invisible in the app, the order book, the lowest price, the medians and
the counts until an admin decides on the Approval page (tab "Suspicious prices").

Cause of a flag (first match wins):

``wrong_currency``       the amount read in another common currency (HKD, USD, EUR, CHF, AED, SGD,
                         GBP) lands close to the median. Two flavours: this offer is mislabelled
                         (``suggested_currency``), or the offers it is compared with are
                         (``peers_currency``, HKD/USD only: the minority is right, the majority wrong; the
                         flag carries no suggestion for the offer itself, so nothing is ever
                         auto-fixed in that case).
``price_from_other_line``the price equals the price of another offer of the same message.
``typo``                 x10, /10 or one digit dropped/added puts it inside the band
                         (``suggested_price``).
``real_outlier``         none of the above.

Only currencies at least 1.5x apart count for ``wrong_currency`` (HKD/USD 7.8x, AED/USD 3.7x,
...): USD/EUR/GBP/CHF differ by 10-27 %, and a 28 % cheap offer is not a mislabelled currency.
"""
import logging
from collections import Counter
from datetime import datetime
from statistics import median
from typing import Any, Dict, Iterable, List, Optional

from pymongo import UpdateOne

from app.models.order import Order, OrderStatus, OrderType
from app.services import fx
from app.services import market_stats as ms

logger = logging.getLogger(__name__)

CAUSES = ("wrong_currency", "price_from_other_line", "typo", "real_outlier")
COMMON_CURRENCIES = ("HKD", "USD", "EUR", "CHF", "AED", "SGD", "GBP")
# Dealers in this market confuse HKD and USD. "The other offers carry the wrong label" is only
# claimed for that pair: re-reading many amounts in a third currency lands near the offer by chance.
PEER_MISLABEL = ("HKD", "USD")
MIN_RATE_RATIO = 1.5
# A re-read amount must land this close to the median: half of the outlier tolerance.
CURRENCY_FIT = 0.5
SAME_PRICE = 0.005

SCAN_PROJECTION = {**ms.ORDER_PROJECTION, "source_text": 1, "price_approved": 1, "brand": 1}


def _ratio(rates: dict, a: str, b: str) -> Optional[float]:
    if a not in rates or b not in rates or not rates[a] or not rates[b]:
        return None
    r = rates[b] / rates[a]
    return max(r, 1 / r)


def _digit_variants(price: float) -> set:
    """One digit dropped or added: 14100 -> 1410, 4100, 141000, 114100 ..."""
    s = str(int(round(price)))
    out = set()
    if len(s) > 1:
        for i in range(len(s)):
            rest = (s[:i] + s[i + 1:]).lstrip("0")
            if rest:
                out.add(int(rest))
    for i in range(len(s) + 1):
        for d in "0123456789":
            out.add(int(s[:i] + d + s[i:]))
    out.discard(int(round(price)))
    out.discard(0)
    return out


def classify(
    target: ms.Listing,
    peers: List[ms.Listing],
    rates: Dict[str, float],
    siblings: Iterable[tuple] = (),
) -> Optional[dict]:
    """None when the price is fine (or there is nothing to compare with), else the flag.

    ``peers``: the offers to compare with (the target may be among them).
    ``siblings``: (ws_code, price, currency) of the other offers of the target's message."""
    if target.price is None or target.price_usd is None or not target.price:
        return None
    found = ms.outlier_basis(target, peers)
    if found is None:
        return None
    basis, tol, basis_listings = found
    med = float(median([p.price_usd for p in basis_listings]))
    if not med:
        return None
    dev = (target.price_usd - med) / med * 100.0
    if abs(dev) <= tol * 100:
        return None
    cur = (target.currency or "USD").upper()
    flag: Dict[str, Any] = {
        "cause": "real_outlier",
        "deviation_pct": round(dev, 1),
        "median_usd": med,
        "offer_count": len(basis_listings),
        "basis_year": basis,
        "tolerance_pct": int(tol * 100),
        "suggested_currency": None,
        "suggested_price": None,
        "peers_currency": None,
        "other_line_ws_code": None,
        "price": target.price,
        "currency": cur,
        "flagged_at": datetime.utcnow(),
    }

    def within(usd: float, band: float) -> Optional[float]:
        d = abs(usd - med) / med
        return d if d <= band else None

    # 1. This offer carries the wrong currency label.
    best = None
    for c in COMMON_CURRENCIES:
        r = _ratio(rates, cur, c)
        if c == cur or r is None or r < MIN_RATE_RATIO:
            continue
        d = within(target.price / rates[c], tol * CURRENCY_FIT)
        if d is not None and (best is None or d < best[0]):
            best = (d, c)
    if best:
        # HKD is almost exactly 10x GBP (7.8 / 0.79): a /10 typo also looks like a GBP label. When
        # a clean x10 or /10 explains the price better than the currency does, call it a typo.
        rate0 = rates.get(cur)
        tens = [d for d in (within(target.price * k / rate0, tol) for k in (10, 0.1)) if d is not None] \
            if rate0 else []
        if not tens or min(tens) >= best[0]:
            return {**flag, "cause": "wrong_currency", "suggested_currency": best[1]}

    # 2. The offers it is compared with carry the wrong label (this one is the minority and right).
    stored = Counter((p.currency or "USD").upper() for p in basis_listings).most_common(1)[0][0]
    best = None
    for c in PEER_MISLABEL if stored in PEER_MISLABEL else ():
        r = _ratio(rates, stored, c)
        if c == stored or r is None or r < MIN_RATE_RATIO:
            continue
        reread = median([p.price / rates[c] for p in basis_listings if p.price])
        d = abs(target.price_usd - reread) / reread if reread else None
        if d is not None and d <= tol * CURRENCY_FIT and (best is None or d < best[0]):
            best = (d, c)
    if best:
        return {**flag, "cause": "wrong_currency", "peers_currency": best[1]}

    # 3. The price belongs to another line of the same message.
    for ws, price, c in siblings:
        if (ws or "") != target.ws_code and price and abs(price - target.price) / target.price <= SAME_PRICE \
                and (c or "").upper() == cur:
            return {**flag, "cause": "price_from_other_line", "other_line_ws_code": ws}

    # 4. Typo: x10, /10 or a digit more or less.
    rate = rates.get(cur)
    if rate:
        # A clean x10 or /10 first; a single digit more or less only when that does not explain it.
        for cands in ({target.price * 10, target.price / 10}, _digit_variants(target.price)):
            best = None
            for cand in cands:
                d = within(cand / rate, tol)
                if d is not None and (best is None or d < best[0]):
                    best = (d, cand)
            if best:
                price = best[1]
                return {**flag, "cause": "typo",
                        "suggested_price": round(price) if price >= 100 else round(price, 2)}
    return flag


# --- database side ---------------------------------------------------------------

async def _active_pools(ws_codes: Iterable[str], rates: dict) -> Dict[str, List[ms.Listing]]:
    """Active, counted WTS offers per WS code (what a new offer is compared with)."""
    codes = sorted({c for c in ws_codes if c})
    out: Dict[str, List[ms.Listing]] = {c: [] for c in codes}
    for i in range(0, len(codes), 200):
        cur = Order.get_motor_collection().find(
            {"ws_code": {"$in": codes[i:i + 200]}, "order_type": OrderType.SELL.value,
             "status": OrderStatus.ACTIVE.value, "excluded_from_median": {"$ne": True}},
            SCAN_PROJECTION,
        )
        async for d in cur:
            l = ms.listing_from_order(d, rates)
            out.setdefault(l.ws_code, []).append(l)
    return out


async def _siblings_by_text(texts: Iterable[str]) -> Dict[tuple, List[tuple]]:
    """(source_text, phone) -> [(ws_code, price, currency)] of the stored offers of that message."""
    texts = sorted({t for t in texts if t})
    out: Dict[tuple, List[tuple]] = {}
    for i in range(0, len(texts), 200):
        cur = Order.get_motor_collection().find(
            {"source_text": {"$in": texts[i:i + 200]}, "price": {"$ne": None}},
            {"source_text": 1, "whatsapp_phone": 1, "ws_code": 1, "price": 1, "currency": 1},
        )
        async for d in cur:
            out.setdefault((d.get("source_text"), d.get("whatsapp_phone")), []).append(
                (d.get("ws_code"), d.get("price"), d.get("currency")))
    return out


def _is_checkable(o) -> bool:
    otype = getattr(o.order_type, "value", o.order_type)
    return bool(otype == OrderType.SELL.value and o.price and o.ws_code and o.usd_price)


async def check_new_orders(orders: List[Order], rates: Optional[dict] = None) -> List[Order]:
    """Check not-yet-inserted (or just created) orders against the active offers and each other;
    hold the suspicious ones (status HELD + price_flag on the document, not saved here).
    Returns the held orders."""
    if rates is None:
        rates = await fx.load_rates()
    todo = [(i, o) for i, o in enumerate(orders) if _is_checkable(o)]
    if not todo:
        return []
    pools = await _active_pools((o.ws_code for _, o in todo), rates)
    news: Dict[str, List[ms.Listing]] = {}
    listing_of: Dict[int, ms.Listing] = {}
    for i, o in todo:
        l = ms.listing_from_order(o, rates)
        l.id = f"new:{i}"
        listing_of[i] = l
        news.setdefault(l.ws_code, []).append(l)
    pairs = [(o.source_text, o.whatsapp_phone) for _, o in todo if o.source_text]
    stored_siblings = await _siblings_by_text(t for t, _ in pairs)
    held: List[Order] = []
    for i, o in todo:
        l = listing_of[i]
        pool = ms.median_eligible(pools.get(l.ws_code, []) + news.get(l.ws_code, []))
        siblings = list(stored_siblings.get((o.source_text, o.whatsapp_phone), []))
        for j, other in todo:  # the other offers of this import that came from the same message
            if j != i and o.source_text and other.source_text == o.source_text \
                    and other.whatsapp_phone == o.whatsapp_phone:
                siblings.append((other.ws_code, other.price, other.currency))
        flag = classify(l, pool, rates, siblings)
        if flag:
            o.status = OrderStatus.HELD
            o.price_flag = flag
            held.append(o)
    return held


async def recheck_held(order: Order, rates: Optional[dict] = None) -> None:
    """A held offer got a new price from a repost: check again; fine now -> visible, else new flag."""
    if rates is None:
        rates = await fx.load_rates()
    if not _is_checkable(order):
        return
    l = ms.listing_from_order(order, rates)
    pool = ms.median_eligible((await _active_pools([l.ws_code], rates)).get(l.ws_code, []))
    flag = classify(l, pool, rates)
    if flag:
        order.status = OrderStatus.HELD
        order.price_flag = flag
    else:
        order.status = OrderStatus.ACTIVE
        order.price_flag = None


async def scan_active(dry_run: bool = True) -> dict:
    """Check the active WTS offers that exist today (admin button). ``dry_run`` only counts.
    Offers an admin approved are skipped. Held offers leave every public count at once."""
    rates = await fx.load_rates()
    col = Order.get_motor_collection()
    base = {"order_type": OrderType.SELL.value, "status": OrderStatus.ACTIVE.value,
            "ws_code": {"$nin": [None, ""]}, "price": {"$ne": None}}
    codes = sorted(c for c in await col.distinct("ws_code", base) if c)
    total_active = await col.count_documents({"status": OrderStatus.ACTIVE.value})
    by_cause: Dict[str, int] = {c: 0 for c in CAUSES}
    flagged_ids: List[tuple] = []
    touched: set = set()
    for i in range(0, len(codes), 200):
        chunk = codes[i:i + 200]
        by_ws: Dict[str, List[ms.Listing]] = {}
        docs: Dict[str, dict] = {}
        async for d in col.find({**base, "ws_code": {"$in": chunk}, "excluded_from_median": {"$ne": True}},
                                SCAN_PROJECTION):
            l = ms.listing_from_order(d, rates)
            by_ws.setdefault(l.ws_code, []).append(l)
            docs[l.id] = d
        pending = []
        for ws, listings in by_ws.items():
            pool = ms.median_eligible(listings)
            for l in pool:
                d = docs[l.id]
                if d.get("price_approved"):
                    continue
                flag = classify(l, pool, rates)
                if flag:
                    pending.append((l, d, flag))
        texts = [d.get("source_text") for _, d, f in pending
                 if f["cause"] in ("typo", "real_outlier") and d.get("source_text")]
        siblings = await _siblings_by_text(texts) if texts else {}
        for l, d, flag in pending:
            if flag["cause"] in ("typo", "real_outlier"):
                # These two may really be another line's price: look at the rest of the message.
                sib = siblings.get((d.get("source_text"), d.get("whatsapp_phone")), [])
                again = classify(l, by_ws[l.ws_code], rates, sib)
                if again:
                    flag = again
            by_cause[flag["cause"]] += 1
            flagged_ids.append((d["_id"], flag))
            touched.add(l.ws_code)
    held = 0
    if not dry_run and flagged_ids:
        for i in range(0, len(flagged_ids), 500):
            ops = [UpdateOne({"_id": oid, "status": OrderStatus.ACTIVE.value},
                             {"$set": {"status": OrderStatus.HELD.value, "price_flag": flag,
                                       "updated_at": datetime.utcnow()}})
                   for oid, flag in flagged_ids[i:i + 500]]
            res = await col.bulk_write(ops, ordered=False)
            held += res.modified_count
        await ms.recompute_for_safe(sorted(touched))
    return {
        "dry_run": dry_run,
        "active_orders": total_active,
        "checked_ws_codes": len(codes),
        "flagged": len(flagged_ids),
        "flagged_share": round(len(flagged_ids) / total_active, 4) if total_active else 0.0,
        "by_cause": by_cause,
        "held": held,
    }
