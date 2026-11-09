"""Shared constants for list prices, currencies and market periods.

Single source of truth for the 13 list-price countries (bulk/edit spec §6, redesign spec §3)
and the 9 app currencies (redesign spec §0.2).
"""
from typing import Optional, TypedDict


class ListPriceCountry(TypedDict):
    code: str
    name: str
    currency: str
    tax_label: str
    vat_pct: Optional[float]


# Fixed order used by the retail sheet (redesign spec §3).
LIST_PRICE_COUNTRIES: list[ListPriceCountry] = [
    {"code": "HK", "name": "Hong Kong", "currency": "HKD", "tax_label": "no VAT", "vat_pct": 0.0},
    {"code": "DE", "name": "Germany", "currency": "EUR", "tax_label": "incl. 19% VAT", "vat_pct": 19.0},
    {"code": "AE", "name": "UAE", "currency": "AED", "tax_label": "incl. 5% VAT", "vat_pct": 5.0},
    {"code": "US", "name": "United States", "currency": "USD", "tax_label": "excl. sales tax", "vat_pct": None},
    {"code": "GB", "name": "United Kingdom", "currency": "GBP", "tax_label": "incl. 20% VAT", "vat_pct": 20.0},
    {"code": "CN", "name": "China", "currency": "CNY", "tax_label": "incl. 13% VAT", "vat_pct": 13.0},
    {"code": "CH", "name": "Switzerland", "currency": "CHF", "tax_label": "incl. 8.1% VAT", "vat_pct": 8.1},
    {"code": "IT", "name": "Italy", "currency": "EUR", "tax_label": "incl. 22% VAT", "vat_pct": 22.0},
    {"code": "ES", "name": "Spain", "currency": "EUR", "tax_label": "incl. 21% VAT", "vat_pct": 21.0},
    {"code": "AT", "name": "Austria", "currency": "EUR", "tax_label": "incl. 20% VAT", "vat_pct": 20.0},
    {"code": "FR", "name": "France", "currency": "EUR", "tax_label": "incl. 20% VAT", "vat_pct": 20.0},
    {"code": "JP", "name": "Japan", "currency": "JPY", "tax_label": "incl. 10% VAT", "vat_pct": 10.0},
    {"code": "SG", "name": "Singapore", "currency": "SGD", "tax_label": "incl. 9% GST", "vat_pct": 9.0},
]

LIST_PRICE_COUNTRY_CODES: list[str] = [c["code"] for c in LIST_PRICE_COUNTRIES]
LIST_PRICE_CURRENCY: dict[str, str] = {c["code"]: c["currency"] for c in LIST_PRICE_COUNTRIES}

# Aliases accepted on import (edit import / bulk import / form) → canonical code.
LIST_PRICE_COUNTRY_ALIASES: dict[str, str] = {
    "UK": "GB",
    "UAE": "AE",
    "USA": "US",
}


def normalize_list_price_country(code: str) -> Optional[str]:
    c = (code or "").strip().upper()
    c = LIST_PRICE_COUNTRY_ALIASES.get(c, c)
    return c if c in LIST_PRICE_CURRENCY else None


# The 9 currencies offered in the app (redesign spec §0.2).
APP_CURRENCIES: list[str] = ["EUR", "HKD", "AED", "GBP", "CHF", "USD", "CNY", "JPY", "SGD"]

# Every currency the generator/import understands (generator spec §8.4). USDT == USD.
SUPPORTED_CURRENCIES: list[str] = APP_CURRENCIES + ["USDT"]

# Periods used by the detail page, trend sheet and medians (redesign spec §1.1).
PERIOD_DAYS: dict[str, Optional[int]] = {"1W": 7, "1M": 30, "3M": 90, "1Y": 365, "ALL": None}
