"""Cross-record price sanity checks for imported order rows.

The per-row check in ``validate_price`` only knows about brand minimums, so it
happily accepts a row like "HKD 103.000" sitting between peers priced at
"HKD 942.000" for the same watch, or a row tagged "USD 105.000" whose amount is
plainly an HKD figure. Those two slips look fine in isolation and only become
obvious next to the other listings for the same ws_code.

This module compares each row against its peers - the other rows in the same
import plus the active orders already in the book for that ws_code - and reports
the ones that cannot be reconciled. The importer quarantines what is reported
here instead of publishing it.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Iterable, Optional

# Approximate units of foreign currency per 1 USD. These only need to be right
# to within a few percent: the checks below use ratio bands that are far wider
# than any realistic FX drift.
FX_PER_USD: dict[str, float] = {
    "USD": 1.0,
    "USDT": 1.0,
    "HKD": 7.8,
    "EUR": 0.92,
    "GBP": 0.79,
    "CHF": 0.88,
    "CNY": 7.2,
    "RMB": 7.2,
    "SGD": 1.34,
    "AED": 3.67,
    "JPY": 155.0,
}

# A row must be this far from the peer median to be called an outlier. The band
# is deliberately generous - condition, year and full-set all move real prices,
# and a currency mix-up is off by 7.8x (HKD) at the smallest.
HIGH_RATIO = 2.5
LOW_RATIO = 0.4

# A row is only judged against peers once there are at least this many of them.
# Below that the "median" is one or two rows that could themselves be the slip.
MIN_PEERS = 3

# When re-reading the amount under a different currency lands this close to the
# peer median, the currency label is the likelier culprit than the amount.
PLAUSIBLE_LOW = 0.6
PLAUSIBLE_HIGH = 1.7


def to_usd(price: Optional[float], currency: Optional[str]) -> Optional[float]:
    """Convert an amount to USD. Unknown currencies are assumed to be USD."""
    if price is None:
        return None
    rate = FX_PER_USD.get((currency or "USD").strip().upper(), 1.0)
    if not rate:
        return None
    return price / rate


@dataclass
class PriceRow:
    """One candidate row, identified by its position in the import.

    ``ws_code`` is the grouping key. Callers that hold more than one price book
    (WTS asks and WTB targets never belong in the same comparison) fold the book
    into this key and pass the bare code as ``label`` for the message.
    """

    index: int
    ws_code: str
    price: Optional[float]
    currency: Optional[str]
    label: Optional[str] = None


@dataclass
class PriceOutlier:
    index: int
    reason: str


# Candidates are tried in this order when several would fit the peers equally
# well numerically. A dealer mislabels HKD as USD constantly; nobody quotes a
# Hong Kong listing in CHF because the arithmetic happens to work out.
_SUGGESTION_FALLBACK = ("USD", "HKD", "EUR", "GBP", "CNY", "CHF", "SGD", "AED", "JPY")


def _currency_suggestion(
    price: float,
    currency: Optional[str],
    peer_median: float,
    peer_currencies: Optional[list[str]] = None,
) -> Optional[str]:
    """Name the currency that would make this amount fit its peers, if any.

    Currencies the peers actually use are preferred over any other that merely
    happens to divide out to the right number.
    """
    current = (currency or "USD").strip().upper()
    order: list[str] = []
    for candidate in list(peer_currencies or []) + list(_SUGGESTION_FALLBACK):
        candidate = candidate.strip().upper()
        if candidate in ("USDT",) or candidate == current or candidate in order:
            continue
        if candidate in FX_PER_USD:
            order.append(candidate)

    for candidate in order:
        usd = to_usd(price, candidate)
        if usd is None or not peer_median:
            continue
        if PLAUSIBLE_LOW <= usd / peer_median <= PLAUSIBLE_HIGH:
            return candidate
    return None


def find_price_outliers(
    rows: Iterable[PriceRow],
    peer_usd_prices: Optional[dict[str, list[float]]] = None,
) -> list[PriceOutlier]:
    """Report rows whose price cannot be reconciled with their ws_code peers.

    ``peer_usd_prices`` supplies already-published USD prices per ws_code so a
    single new row can still be judged against the existing book. Rows without a
    price (normal for WTB) and ws_codes with too few peers are left alone.
    """
    rows = list(rows)
    groups: dict[str, list[PriceRow]] = {}
    for row in rows:
        if row.price is None or not row.ws_code:
            continue
        groups.setdefault(row.ws_code, []).append(row)

    outliers: list[PriceOutlier] = []
    for ws_code, group in groups.items():
        usd_by_index: dict[int, float] = {}
        for row in group:
            usd = to_usd(row.price, row.currency)
            if usd and usd > 0:
                usd_by_index[row.index] = usd

        sample = list(usd_by_index.values()) + list((peer_usd_prices or {}).get(ws_code, []))
        if len(sample) < MIN_PEERS:
            continue
        peer_median = median(sample)
        if not peer_median:
            continue

        # Currencies the peers quote in, most common first.
        counts: dict[str, int] = {}
        for row in group:
            cur = (row.currency or "USD").strip().upper()
            counts[cur] = counts.get(cur, 0) + 1
        peer_currencies = sorted(counts, key=lambda c: counts[c], reverse=True)

        for row in group:
            usd = usd_by_index.get(row.index)
            if usd is None:
                continue
            ratio = usd / peer_median
            if LOW_RATIO <= ratio <= HIGH_RATIO:
                continue
            reason = (
                f"{(row.currency or 'USD').upper()} {row.price:,.0f} is "
                f"{ratio:.2f}x the median of {len(sample)} listings for "
                f"{row.label or ws_code} "
                f"(~USD {peer_median:,.0f})"
            )
            suggestion = _currency_suggestion(
                row.price, row.currency, peer_median, peer_currencies
            )
            if suggestion:
                reason += f"; reads correctly as {suggestion}"
            outliers.append(PriceOutlier(index=row.index, reason=reason))

    outliers.sort(key=lambda o: o.index)
    return outliers
