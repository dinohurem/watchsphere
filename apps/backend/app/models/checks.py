"""Checks feature (spec: Checks addendum, section 2).

Three collections with plain text fields and no link to the watch catalogue. The app matches
on the ``*_normalized`` fields (see ``app.services.checks_normalize``).
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from beanie import Document
from pydantic import Field


class CheckStatus(str, Enum):
    DRAFT = "draft"  # user report waiting for review
    PUBLISHED = "published"  # visible in the app
    REJECTED = "rejected"  # hidden, kept for the log


class SerialReportType(str, Enum):
    STOLEN = "stolen"
    COUNTERFEIT = "counterfeit"
    FRANKENSTEIN = "frankenstein"
    FAKE_PAPERS = "fake_papers"


class HowStolen(str, Enum):
    BURGLARY = "burglary"
    ROBBERY = "robbery"
    ARMED_ROBBERY = "armed_robbery"
    HOME_INVASION = "home_invasion"
    SNATCH_PICKPOCKET = "snatch_pickpocket"
    SCAM_PAID_NEVER_DELIVERED = "scam_paid_never_delivered"
    SCAM_DELIVERED_NEVER_PAID = "scam_delivered_never_paid"
    SCAM_FAKE_MONEY = "scam_fake_money"
    SCAM_FAKE_CRYPTO = "scam_fake_crypto"
    CONSIGNMENT_NOT_RETURNED = "consignment_not_returned"
    STOLEN_IN_TRANSIT = "stolen_in_transit"
    SWITCHED_WATCH = "switched_watch"
    OTHER = "other"


HOW_STOLEN_LABELS = {
    "burglary": "Burglary",
    "robbery": "Robbery",
    "armed_robbery": "Armed robbery",
    "home_invasion": "Home invasion",
    "snatch_pickpocket": "Snatch / pickpocket",
    "scam_paid_never_delivered": "Scam – paid, never delivered",
    "scam_delivered_never_paid": "Scam – delivered, never paid",
    "scam_fake_money": "Scam – paid with fake money",
    "scam_fake_crypto": "Scam – paid with fake crypto",
    "consignment_not_returned": "Consignment not returned",
    "stolen_in_transit": "Stolen in transit",
    "switched_watch": "Switched watch",
    "other": "Other",
}


class DealerNumberType(str, Enum):
    VERIFIED = "verified"
    SCAMMER = "scammer"


class SerialReport(Document):
    type: SerialReportType
    serial: str  # as typed
    serial_normalized: str = Field(..., index=True)
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: str  # free text, any reference
    reference_normalized: str = Field(..., index=True)
    how_stolen: Optional[HowStolen] = None  # stolen only
    date_of_incident: Optional[str] = None  # YYYY-MM-DD
    location: Optional[str] = None
    who_offered: Optional[str] = None  # internal, counterfeit only
    details: Optional[str] = None

    # Internal only, never shown to other users
    photos: List[str] = Field(default_factory=list)
    photo_thumbnails: List[str] = Field(default_factory=list)

    status: CheckStatus = CheckStatus.PUBLISHED
    reporter_id: Optional[str] = Field(None, index=True)  # set for reports sent from the app
    views: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "serial_reports"
        indexes = [
            "serial_normalized",
            "reference_normalized",
            "status",
            "type",
            "reporter_id",
            [("serial_normalized", 1), ("status", 1)],
        ]


class DealerNumber(Document):
    type: DealerNumberType
    country_code: str  # "+852"
    phone: str  # as typed
    e164: str = Field(..., index=True)  # "+85261234567"
    name: Optional[str] = None  # internal only
    country: Optional[str] = None  # shown on CK3b
    details: Optional[str] = None  # scammer only

    photos: List[str] = Field(default_factory=list)  # internal only
    photo_thumbnails: List[str] = Field(default_factory=list)

    status: CheckStatus = CheckStatus.PUBLISHED
    reporter_id: Optional[str] = Field(None, index=True)
    views: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "dealer_numbers"
        indexes = [
            "e164",
            "status",
            "type",
            "reporter_id",
            [("e164", 1), ("status", 1)],
        ]


class Bracelet(Document):
    brand: Optional[str] = None
    model: Optional[str] = None
    reference: str  # free text
    reference_normalized: str = Field(..., index=True)
    bracelet: str  # "Oyster", "Jubilee", ...
    full_links: int
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    photo_thumb_url: Optional[str] = None
    sort_order: int = 0

    status: CheckStatus = CheckStatus.PUBLISHED  # draft | published
    views: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "bracelets"
        indexes = [
            "reference_normalized",
            "status",
            [("reference_normalized", 1), ("status", 1), ("sort_order", 1)],
        ]


class CheckImportPreview(Document):
    """Parsed import rows kept between ``import/preview`` and ``import/commit``."""
    collection: str
    rows: List[dict] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "check_import_previews"
        indexes = ["created_at"]
