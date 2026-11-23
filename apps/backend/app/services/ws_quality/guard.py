"""Offer guard - the plausibility alarm that runs on every offer BEFORE it goes live.

It does not parse anything itself. It takes what the pipeline decided (watch, price, currency) plus the
dealer's original line and answers one question: is there evidence for this offer?

decision  "accept"  evidence complete, price plausible            -> publish
          "fix"     publish with the suggested correction          (e.g. currency USD instead of HKD)
          "hold"    do not publish, show in the review tab with the reasons and the original line
          "reject"  never publish (price is a reference number, accessory, sold, advert)

The checks are independent of how the watch was matched (regex, fuzzy, AI). That is the point:
an AI or fuzzy match that maps "5712R" to "5712/1R" has no literal evidence and is held.
"""
import re
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Iterable
from .evidence import watch_forms, names_watch, reference_tokens, price_readings, currencies_in, norm
from .classify import is_part_or_accessory, is_advert
from . import variants

# USD value of one unit; replace with the live table the backend already uses for usd_price
FX_USD = {"USD": 1.0, "HKD": 0.1276, "EUR": 1.16, "GBP": 1.31, "CHF": 1.24, "AED": 0.2723, "CNY": 0.1405, "SGD": 0.77, "JPY": 0.0065}

LOW, HIGH = 0.60, 1.70          # accepted range around the reference price (see evaluation in the report)
MIN_REFERENCE_OFFERS = 5        # below this there is no reliable reference price


@dataclass
class Verdict:
    decision: str
    reasons: List[str] = field(default_factory=list)
    suggestion: Dict[str, Any] = field(default_factory=dict)
    headline_eligible: bool = False     # may this offer be shown as "lowest price" of the watch?

    def __bool__(self):
        return self.decision in ("accept", "fix")


def check_offer(
    *,
    side: str,                          # "WTS" | "WTB"
    ws_code: str,
    price: Optional[float],
    currency: Optional[str],
    source_line: str,                   # the line (or merged ref+price lines) the offer was built from
    catalog: Dict[str, Any],            # {"reference", "oem_references", "aliases", "dial", "bracelet"}
    reference_price_usd: Optional[float] = None,   # median of verified live offers for this WS code
    reference_count: int = 0,
    message: str = "",                  # whole message (optional, for single-watch posts)
    price_how: str = "",                # "shorthand" from prices.parse_price if the price was expanded x1000
) -> Verdict:
    reasons: List[str] = []
    suggestion: Dict[str, Any] = {}
    line = source_line or ""
    P = round(price) if price else None

    if is_advert(message or line):
        return Verdict("reject", ["advert"])
    if is_part_or_accessory(line):
        return Verdict("reject", ["part_or_accessory"])
    if re.search(r"(?<![a-z])(?:sold|verkauft|reserved|on\s+hold)(?![a-z])", line, re.I) and side == "WTS":
        return Verdict("reject", ["sold_or_reserved"])

    forms, short = watch_forms(ws_code, catalog.get("reference") or "", catalog.get("oem_references") or (), catalog.get("aliases") or ())
    named_line = names_watch(line, forms, short)
    refs_on_line = reference_tokens(line)
    single_watch_msg = bool(message) and len({norm(r) for r in reference_tokens(message)}) <= 1
    named = named_line or (single_watch_msg and names_watch(message, forms, short))

    # 1. the watch must be named literally
    if not named:
        other = [r for r in refs_on_line if not (P and norm(r).isdigit() and int(norm(r)) == P)]
        reasons.append("different_reference_in_text:" + other[0] if other else "reference_not_in_text")

    # 2. the price must stand with this watch and must not be a reference number
    if side == "WTS" and not P:
        reasons.append("no_price")
    if P:
        # digits of this watch's own reference, and of any token on the line that is clearly a reference (letters or separators)
        digits = {re.sub(r"\D", "", f) for f in forms if re.fullmatch(r"[A-Z]{0,2}\d{4,6}[A-Z]{0,6}", f)}
        digits |= {re.sub(r"\D", "", norm(r)) for r in refs_on_line if not norm(r).isdigit() and re.fullmatch(r"[A-Za-z]{0,2}\d{4,6}[A-Za-z]{1,6}", r)}
        if str(P) in {d for d in digits if len(d) >= 4}:
            return Verdict("reject", ["price_equals_reference"])
        readings = price_readings(line) | (price_readings(message) if single_watch_msg else set())
        if P not in readings:
            reasons.append("price_not_on_watch_line")
        # 3. currency written next to the price
        cur_text = currencies_in(line)
        if currency and cur_text and currency not in cur_text:
            if len(cur_text) == 1:
                suggestion["currency"] = next(iter(cur_text))
                reasons.append(f"currency_in_text_{suggestion['currency']}_stored_{currency}")
            else:
                reasons.append("currency_ambiguous_in_text")

    # 4. dial / bracelet must not contradict the WS code
    if named:
        v = variants.check(line, ws_code, catalog)
        if v.startswith("conflict"):
            reasons.append("variant_" + v)

    # 5. price band (with the currency the text states, if it states one)
    band_ok = None
    have_ref = bool(reference_price_usd) and reference_count >= MIN_REFERENCE_OFFERS
    if P and currency and have_ref:
        eff = suggestion.get("currency") or currency
        ratio = P * FX_USD.get(eff, 0) / reference_price_usd
        band_ok = LOW <= ratio <= HIGH
        if not band_ok and "currency" not in suggestion and not currencies_in(line):
            # no currency written at all: the default was a guess - see whether another one makes the price plausible
            alt = [c for c in ("HKD", "USD", "EUR") if c != currency and LOW <= P * FX_USD[c] / reference_price_usd <= HIGH]
            if alt:
                suggestion["currency"] = alt[0]
                reasons.append(f"price_fits_only_as_{alt[0]}")
                band_ok = True
        if not band_ok:
            reasons.append("price_below_band" if ratio < LOW else "price_above_band")
    if price_how == "shorthand" and band_ok is not True:
        reasons.append("price_expanded_x1000_unverified")

    hard = [r for r in reasons if r.startswith(("different_reference", "reference_not_in_text", "price_not_on", "variant_conflict", "price_below", "price_above", "no_price", "price_expanded", "currency_ambiguous"))]
    if hard:
        return Verdict("hold", reasons, suggestion)
    if suggestion.get("currency"):
        return Verdict("fix", reasons, suggestion, headline_eligible=(band_ok is True))
    return Verdict("accept", reasons, {}, headline_eligible=(band_ok is True))
