"""Offer life cycle: one live offer per dealer and watch, expiry, and which offer may set the displayed price.

Today every repost with a new price creates another offer and nothing ever expires. Result: more than half of the
live offers are repeats of the same dealer+watch, old prices stay next to new ones, and imports from
August/September are still shown as the cheapest offer of a watch.
"""
from datetime import datetime, timedelta
from statistics import median
from typing import Optional, Iterable, Dict, Any, List

OFFER_TTL_DAYS = 10          # a WTS offer nobody reposted for 10 days is gone (dealers repost live stock daily)
WTB_TTL_DAYS = 14
HEADLINE_MAX_AGE_DAYS = 7
HEADLINE_MIN_DEALERS = 2     # or one guard-verified offer inside the price band


def offer_key(dealer_phone: str, ws_code: str, year: Optional[int], month: Optional[int], condition: Optional[str], side: str = "WTS") -> str:
    """Identity of an offer. Price is NOT part of it: a new price for the same piece replaces the old price.
    Two pieces of the same watch differ in card date or condition, so they keep separate keys."""
    return "|".join([side, (dealer_phone or "").replace(" ", ""), (ws_code or "").strip().lower(), str(year or ""), str(month or ""), (condition or "").lower()])


def upsert(existing: Optional[Dict[str, Any]], incoming: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Merge a newly parsed offer into the stored one with the same offer_key.
    - newest message wins for price/currency/remarks
    - first_seen_at is kept, last_seen_at and expires_at move forward
    - the previous price is kept in price_history so a price change stays visible"""
    ttl = WTB_TTL_DAYS if incoming.get("side") == "WTB" else OFFER_TTL_DAYS
    if existing is None:
        return {**incoming, "first_seen_at": now, "last_seen_at": incoming["message_at"], "expires_at": incoming["message_at"] + timedelta(days=ttl), "price_history": []}
    if incoming["message_at"] < existing["last_seen_at"]:
        return existing                                   # an older export processed late must not overwrite a newer price
    out = {**existing}
    if incoming.get("price") and incoming.get("price") != existing.get("price"):
        out["price_history"] = (existing.get("price_history") or []) + [{"price": existing.get("price"), "currency": existing.get("currency"), "until": incoming["message_at"]}]
    for k in ("price", "currency", "remarks", "source_line", "has_box", "has_papers", "condition_raw"):
        if incoming.get(k) is not None:
            out[k] = incoming[k]
    out["last_seen_at"] = incoming["message_at"]
    out["expires_at"] = incoming["message_at"] + timedelta(days=ttl)
    return out


def is_live(offer: Dict[str, Any], now: datetime) -> bool:
    exp = offer.get("expires_at")
    return bool(exp and exp > now and not offer.get("sold"))


def headline_price_usd(offers: Iterable[Dict[str, Any]], now: datetime) -> Optional[Dict[str, Any]]:
    """The price shown for a watch in lists. Never simply min(price):
       lowest live offer that (a) passed the guard inside the price band or (b) is backed by a second dealer within 5 %.
       If nothing qualifies: median of live offers, marked as indicative."""
    live = [o for o in offers if is_live(o, now) and o.get("usd_price") and (now - o["last_seen_at"]).days <= HEADLINE_MAX_AGE_DAYS]
    if not live:
        return None
    live.sort(key=lambda o: o["usd_price"])
    for o in live:
        if o.get("headline_eligible"):
            return {"usd_price": o["usd_price"], "offer_id": o.get("id"), "basis": "verified_offer"}
        backers = {x.get("dealer") for x in live if x is not o and abs(x["usd_price"] - o["usd_price"]) <= 0.05 * o["usd_price"]} - {o.get("dealer")}
        if len(backers) >= HEADLINE_MIN_DEALERS - 1:
            return {"usd_price": o["usd_price"], "offer_id": o.get("id"), "basis": "two_dealers"}
    return {"usd_price": median(o["usd_price"] for o in live), "offer_id": None, "basis": "median_indicative"}


def reference_price(verified_usd_prices: List[float]) -> Optional[Dict[str, float]]:
    """Reference price for the guard's price band: median of guard-verified live offers, one price per dealer."""
    if len(verified_usd_prices) < 5:
        return None
    return {"median": median(verified_usd_prices), "n": len(verified_usd_prices)}
