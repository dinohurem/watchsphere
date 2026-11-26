from beanie import Document
from pydantic import Field, model_validator
from datetime import datetime
from enum import Enum
from typing import List, Optional


class OrderType(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderCondition(str, Enum):
    UNWORN = "Unworn"
    USED = "Used"


class OrderStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    # Imported dealer offer nobody reposted within its TTL; a repost reactivates it.
    EXPIRED = "expired"
    # Created with a suspicious price (far from the other offers of the same watch, year and
    # condition). Invisible everywhere (app, order book, lowest price, medians, counts) until an
    # admin decides on the Approval page; the reason is in ``Order.price_flag``.
    HELD = "held"


class Order(Document):
    """
    Order model for buy/sell orders in the order book.
    Each order represents a user's intent to buy or sell a specific watch model.
    """
    # Order info
    order_type: OrderType  # buy or sell

    # Watch reference (by model/reference, not specific watch)
    brand: str = Field(..., index=True)
    model: str
    reference: str = Field(..., index=True)  # Reference number (e.g., 126610LN)

    # Optional link to specific watch listing (for sell orders)
    watch_id: Optional[str] = None

    # Order details
    price: Optional[float] = None  # User's asking/offering price (optional for WTB)
    # No default currency: a buy request without a target has price = None and currency = None.
    # Order-creating endpoints set their own default (OrderCreate.currency = "EUR").
    currency: Optional[str] = None
    # None = the dealer stated no condition (a third state for buy requests; the API schemas
    # for user-created orders still default to Unworn explicitly).
    condition: Optional[OrderCondition] = None

    # Location/Market
    country_code: str = Field(..., index=True)  # ISO country code (e.g., "US", "IT", "UAE")
    country_name: Optional[str] = None  # Full country name

    # User info
    user_id: str = Field(..., index=True)
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    # Status
    status: OrderStatus = OrderStatus.ACTIVE

    # Catalog fields (from parent watch or entered directly)
    collection: Optional[str] = None
    oem_references: List[str] = Field(default_factory=list)
    bracelet: Optional[str] = None
    ws_code: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    description: Optional[str] = None

    # Contact (WhatsApp phone for order book)
    whatsapp_phone: Optional[str] = None

    # Optional details
    notes: Optional[str] = None
    remarks: Optional[str] = None  # Raw remarks from CSV import
    year_raw: Optional[str] = None  # Raw year text (e.g., "2022+") for non-standard formats
    condition_raw: Optional[str] = None  # Raw condition text (e.g., "Unworn only")
    has_box: bool = False
    has_papers: bool = False
    # Buy requests only: the buyer already has a customer ("sold order", "confirm order", "strong call").
    # Shown as a "Sold order" remark on the request.
    firm_order: bool = False

    # Images (for sell orders)
    images: list[str] = Field(default_factory=list)

    # Extended watch details (for sell listings)
    year: Optional[int] = None
    watch_month: Optional[int] = None  # Month from "Monat/Jahr" CSV field
    size: Optional[str] = None
    movement: Optional[str] = None
    case_material: Optional[str] = None
    bracelet_material: Optional[str] = None
    availability: Optional[str] = None
    gender: Optional[str] = None

    # Caliber information
    movement_type: Optional[str] = None
    caliber: Optional[str] = None
    base_caliber: Optional[str] = None
    power_reserve: Optional[str] = None
    number_of_jewels: Optional[int] = None

    # Case information
    case_diameter: Optional[str] = None
    water_resistance: Optional[str] = None
    bezel_material: Optional[str] = None
    crystal: Optional[str] = None
    dial: Optional[str] = None
    dial_numerals: Optional[str] = None

    # Bracelet/strap information
    bracelet_color: Optional[str] = None
    clasp_type: Optional[str] = None
    clasp_material: Optional[str] = None

    # USD equivalent price (for cross-currency sorting). Recomputed from the central FX table
    # (app.services.fx) after every rate update; `price` + `currency` stay the dealer's original.
    usd_price: Optional[float] = None

    # --- Generator pipeline / market data (generator spec §1, §2, §9) ---
    # How the listing was matched to the catalog: exact | image | ai | manual
    match_method: Optional[str] = None
    # Short AI reason when match_method == "ai" (shown on the approval page)
    ai_reason: Optional[str] = None
    # Original WhatsApp text and photo the listing came from
    source_text: Optional[str] = None
    source_image: Optional[str] = None
    source_group: Optional[str] = None
    source_run_id: Optional[str] = None
    # First time this dealer+watch+price was seen; a repost in another group only bumps
    # last_seen_at and never triggers a push (spec §1.11).
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    # Admin price check: listing stays in the app but is ignored for medians.
    excluded_from_median: bool = False
    # An admin looked at the price and said it is right: never flagged as suspicious again.
    price_approved: bool = False
    # Why the order is held (status HELD): {"cause", "deviation_pct", "median_usd", "offer_count",
    # "basis_year", "tolerance_pct", "suggested_currency", "suggested_price", "peers_currency",
    # "flagged_at", "price", "currency"}. See app/services/price_flags.py.
    price_flag: Optional[dict] = None

    # Set by the duplicate clean-up: this offer is an older reading of the same dealer line; the
    # offer with this id replaced it. Never matched by an import again.
    superseded_by: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    # Earlier prices of this offer, newest last: [{"price", "currency", "until"}]
    price_history: List[dict] = Field(default_factory=list)

    @model_validator(mode="after")
    def _canonical_country_name(self):
        """Every order carries the full country name (UAE/UK short forms), never the code.

        Applies to every creation path (import, admin, user); an unknown code keeps what was given."""
        from app.core.countries import country_display_name

        name = country_display_name(self.country_code)
        if name and self.country_name != name:
            self.__dict__["country_name"] = name
        return self

    class Settings:
        name = "orders"
        indexes = [
            "brand",
            "reference",
            "country_code",
            "user_id",
            "order_type",
            "status",
            "ws_code",
            [("status", 1), ("order_type", 1)],
            [("reference", 1), ("order_type", 1), ("status", 1)],
            [("ws_code", 1), ("status", 1)],
            [("status", 1), ("order_type", 1), ("price", 1)],
            [("ws_code", 1), ("order_type", 1), ("created_at", -1)],
            "whatsapp_phone",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "order_type": "sell",
                "brand": "Rolex",
                "model": "Submariner Date",
                "reference": "126610LN",
                "price": 104500,
                "currency": "EUR",
                "condition": "Unworn",
                "country_code": "US",
                "country_name": "United States",
                "user_id": "user123",
                "status": "active"
            }
        }
