"""Precomputed market data per WS code (generator spec §9).

Written by ``app.services.market_stats`` after every import, price-check change
and FX refresh. All prices are stored in USD and converted to the requested
currency at read time with the current central rate (conversion is linear, so
the median of converted prices equals the converted median).
"""
from datetime import datetime
from typing import Any, Dict, Optional

from beanie import Document
from pydantic import Field


class WatchMarketStats(Document):
    ws_code: str
    brand: Optional[str] = None

    # All-time *active* listing counts (UI §0.4).
    wts_count: int = 0
    wtb_count: int = 0

    # 1M WTS median change — the % chip on cards / detail page.
    change_1m_pct: Optional[float] = None
    # Average market-vs-retail % over countries with a list price.
    retail_pct: Optional[float] = None
    retail_status: str = "no_data"  # ok | discontinued | no_data
    fresh_median_usd: Optional[float] = None  # worldwide fresh median (retail sheet)

    # "Top movers" / "Most requested" inputs (last 30 days vs the 30 days before).
    listings_1m: int = 0
    listings_prev_1m: int = 0
    activity_change_pct: Optional[float] = None
    wtb_1m: int = 0

    # Per period ("1W", "1M", "3M", "1Y", "ALL"):
    # {"enough_data", "wts_change_pct",
    #  "fresh": {"median_usd", "change_pct", "count", "series": [{"date", "median_usd"}]},
    #  "used": {...}}
    periods: Dict[str, Any] = Field(default_factory=dict)

    computed_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "watch_market_stats"
        indexes = [
            "ws_code",
            "brand",
            "change_1m_pct",
            "retail_pct",
            "activity_change_pct",
            "wtb_1m",
        ]
