"""Central exchange-rate table (generator spec §8).

One document per refresh is not needed — the table is a single row keyed by
``base`` ("USD") that is overwritten on every refresh. History is kept in
``FxRateHistory`` so a bad source day can be diagnosed afterwards.
"""
from datetime import datetime
from typing import Dict, Optional

from beanie import Document
from pydantic import Field


class FxRate(Document):
    base: str = "USD"
    # Units of currency per 1 USD (USD=1, USDT=1).
    rates: Dict[str, float] = Field(default_factory=dict)
    # "ecb" (frankfurter.app), "seed" (hard-coded fallback) ...
    source: str = "seed"
    # Date the source quotes the rates for (ECB publishes on working days).
    source_date: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "fx_rates"
        indexes = ["base"]


class FxRateHistory(Document):
    base: str = "USD"
    rates: Dict[str, float] = Field(default_factory=dict)
    source: str = "seed"
    source_date: Optional[str] = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "fx_rate_history"
        indexes = [[("fetched_at", -1)]]
