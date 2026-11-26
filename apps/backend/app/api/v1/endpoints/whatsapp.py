from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timedelta
from beanie import PydanticObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId
import logging
import re
import zipfile
import csv
import io

from app.core.countries import country_display_name
from app.core.deps import get_current_admin_user, get_current_user
from app.models.user import User
from app.models.watch import Watch, WatchStatus
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.whatsapp_import import (
    WhatsAppImport, WhatsAppMessage, ExtractedWatchListing, ImportStatus, OfferType
)
from app.services.wtb_wts_service import validate_price, BRAND_MIN_PRICES, DEFAULT_MIN_PRICE
from app.services.price_sanity import PriceRow, find_price_outliers, to_usd

logger = logging.getLogger(__name__)

FILES_TTL_MINUTES = 30


async def cleanup_expired_whatsapp_files() -> None:
    """Clean up expired GridFS files from WhatsApp imports."""
    now = datetime.utcnow()
    expired = await WhatsAppImport.find(
        WhatsAppImport.files_expire_at != None,  # noqa: E711
        WhatsAppImport.files_expire_at <= now,
    ).to_list()
    for imp in expired:
        try:
            if imp.unmatched_csv_gridfs_id:
                await _whatsapp_gridfs_delete(imp.unmatched_csv_gridfs_id)
            if imp.price_flagged_csv_gridfs_id:
                await _whatsapp_gridfs_delete(imp.price_flagged_csv_gridfs_id)
            await WhatsAppImport.find_one(WhatsAppImport.id == imp.id).update({"$set": {
                "unmatched_csv_gridfs_id": None,
                "price_flagged_csv_gridfs_id": None,
                "files_expire_at": None,
            }})
            logger.info(f"Cleaned up expired WhatsApp import files for {imp.id}")
        except Exception as e:
            logger.error(f"Failed to clean up WhatsApp import {imp.id}: {e}")


def _get_whatsapp_gridfs_bucket() -> AsyncIOMotorGridFSBucket:
    db = WhatsAppImport.get_motor_collection().database
    return AsyncIOMotorGridFSBucket(db, bucket_name="whatsapp_import_files")


async def _whatsapp_gridfs_put(content: str, filename: str) -> str:
    bucket = _get_whatsapp_gridfs_bucket()
    file_id = await bucket.upload_from_stream(filename, content.encode("utf-8"))
    return str(file_id)


async def _whatsapp_gridfs_get(file_id: str) -> str:
    bucket = _get_whatsapp_gridfs_bucket()
    stream = await bucket.open_download_stream(ObjectId(file_id))
    data = await stream.read()
    return data.decode("utf-8")


async def _whatsapp_gridfs_delete(file_id: str) -> None:
    bucket = _get_whatsapp_gridfs_bucket()
    try:
        await bucket.delete(ObjectId(file_id))
    except Exception:
        pass



router = APIRouter()


# Response Models
class ImportResponse(BaseModel):
    id: str
    filename: str
    group_name: str
    status: ImportStatus
    total_messages: int
    extracted_watches: int
    imported_by: str
    imported_by_name: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    # CSV import stats
    matched_orders: int = 0
    unmatched_rows: int = 0
    skipped_duplicates: int = 0
    has_unmatched_csv: bool = False
    # Rows held back by the cross-record price check
    price_flagged_rows: int = 0
    has_price_flagged_csv: bool = False


class ExtractedListingResponse(BaseModel):
    id: str
    import_id: str
    brand: Optional[str] = None
    reference: Optional[str] = None
    ws_code: Optional[str] = None
    model: Optional[str] = None
    price: Optional[float] = None
    currency: str
    condition: Optional[str] = None
    seller_name: Optional[str] = None
    raw_text: str
    month_year: Optional[str] = None
    message_timestamp: Optional[datetime] = None


# Watch brand patterns for extraction
WATCH_BRANDS = [
    "rolex", "patek philippe", "patek", "audemars piguet", "ap",
    "richard mille", "rm", "omega", "cartier", "hublot",
    "jaeger-lecoultre", "jlc", "vacheron constantin", "vc",
    "iwc", "breitling", "tudor", "panerai", "tag heuer"
]

# Reference patterns
REF_PATTERNS = [
    r'\b([A-Z]{0,3}\d{4,6}[A-Z0-9/-]*)\b',  # Standard refs like 126610LN, 5968G
    r'\bref\.?\s*([A-Z0-9/-]+)\b',  # "ref. 126610LN"
]

# Price patterns
PRICE_PATTERNS = [
    r'\$\s*([\d,]+)\s*(?:USD|usd)?',
    r'([\d,]+)\s*(?:USD|usd)',
    r'([\d,]+)\s*(?:HKD|hkd)',
    r'EUR\s*([\d,]+)',
    r'([\d,]+)\s*EUR',
]

# Condition patterns
CONDITIONS = ["new", "used", "unworn", "nos", "mint", "excellent", "good", "brand new"]

# Offer type patterns
WTS_PATTERNS = ["wts", "want to sell", "for sale", "selling", "fs", "sale"]
WTB_PATTERNS = ["wtb", "want to buy", "looking for", "buying", "wanted", "lf"]

# Country patterns (common country codes and names)
COUNTRY_PATTERNS = {
    "US": ["usa", "united states", "america", "us"],
    "UK": ["uk", "united kingdom", "england", "britain"],
    "DE": ["germany", "deutschland", "de"],
    "IT": ["italy", "italia", "it"],
    "FR": ["france", "fr"],
    "CH": ["switzerland", "swiss", "ch"],
    "AE": ["uae", "dubai", "emirates", "abu dhabi"],
    "HK": ["hong kong", "hk"],
    "SG": ["singapore", "sg"],
    "JP": ["japan", "jp"],
    "AU": ["australia", "au"],
    "CA": ["canada", "ca"],
    "NL": ["netherlands", "holland", "nl"],
    "ES": ["spain", "espana", "es"],
    "AT": ["austria", "at"],
    "BE": ["belgium", "be"],
}


def parse_whatsapp_message(line: str) -> Optional[dict]:
    """Parse a WhatsApp message line"""
    # Pattern: [DD.MM.YY, HH:MM:SS] Sender: Message
    pattern = r'\[(\d{2}\.\d{2}\.\d{2}),\s*(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.*)'
    match = re.match(pattern, line)

    if match:
        date_str, time_str, sender, content = match.groups()
        try:
            timestamp = datetime.strptime(f"{date_str} {time_str}", "%d.%m.%y %H:%M:%S")
        except ValueError:
            timestamp = datetime.utcnow()

        return {
            "timestamp": timestamp,
            "sender": sender.strip(),
            "content": content.strip(),
        }
    return None


def extract_watch_data(content: str) -> Optional[dict]:
    """Extract watch information from message content"""
    content_lower = content.lower()

    # Skip media messages
    if any(x in content_lower for x in ["bild weggelassen", "video weggelassen", "media omitted"]):
        return None

    # Find brand
    brand = None
    for b in WATCH_BRANDS:
        if b in content_lower:
            brand = b.title()
            break

    if not brand:
        return None  # Only extract if we find a brand

    # Find reference
    reference = None
    for pattern in REF_PATTERNS:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            reference = match.group(1).upper()
            break

    # Find price
    price = None
    currency = "USD"
    for pattern in PRICE_PATTERNS:
        match = re.search(pattern, content, re.IGNORECASE)
        if match:
            price_str = match.group(1).replace(",", "")
            try:
                price = float(price_str)
                if "hkd" in content_lower:
                    currency = "HKD"
                elif "eur" in content_lower:
                    currency = "EUR"
            except ValueError:
                pass
            break

    # Find condition
    condition = None
    for cond in CONDITIONS:
        if cond in content_lower:
            condition = cond
            break

    # Find offer type (WTS/WTB)
    offer_type = OfferType.UNKNOWN
    for pattern in WTS_PATTERNS:
        if pattern in content_lower:
            offer_type = OfferType.WTS
            break
    if offer_type == OfferType.UNKNOWN:
        for pattern in WTB_PATTERNS:
            if pattern in content_lower:
                offer_type = OfferType.WTB
                break

    # Find country
    country_code = None
    country_name = None
    for code, patterns in COUNTRY_PATTERNS.items():
        for pattern in patterns:
            if pattern in content_lower:
                country_code = code
                country_name = country_display_name(code) or code
                break
        if country_code:
            break

    return {
        "brand": brand,
        "reference": reference,
        "price": price,
        "currency": currency,
        "condition": condition,
        "offer_type": offer_type,
        "country_code": country_code,
        "country_name": country_name,
        "raw_text": content,
    }



def parse_csv_price(price_str: str) -> tuple[Optional[float], Optional[str]]:
    """Parse price string like '62.000 HKD' → (62000.0, 'HKD'). No price → (None, None): a row without a
    price (a buy request without a target) has no currency either, never a default one."""
    if not price_str or not price_str.strip():
        return None, None
    price_str = price_str.strip()
    # Extract currency (last word if it's letters)
    parts = price_str.split()
    currency = "EUR"
    numeric_part = price_str
    if len(parts) >= 2 and parts[-1].isalpha():
        currency = parts[-1].upper()
        numeric_part = " ".join(parts[:-1])
    numeric_part = numeric_part.strip()
    if re.match(r'^[\d.]+$', numeric_part):
        # All dots are thousands separators (e.g., 62.000 or 1.234.567)
        numeric_part = numeric_part.replace('.', '')
    elif ',' in numeric_part:
        # Check if comma is thousands separator (e.g., "481,000") or decimal (e.g., "62.500,50")
        # Comma followed by exactly 3 digits at end = thousands separator
        if re.match(r'^[\d,]+$', numeric_part) and re.search(r',\d{3}$', numeric_part):
            # All commas are thousands separators (e.g., 481,000 or 1,234,567)
            numeric_part = numeric_part.replace(',', '')
        else:
            # Comma is decimal separator (European format)
            numeric_part = numeric_part.replace('.', '').replace(',', '.')
    try:
        return float(numeric_part), currency
    except ValueError:
        return None, currency


def extract_reference_from_ws_code(ws_code: str) -> str:
    """Extract the core reference from a WS-Code like '126334g Jub' → '126334g'
    or '124200 Pistachio' → '124200' or '228235 Slate Ombre' → '228235'"""
    if not ws_code:
        return ""
    # The reference is typically the first token (alphanumeric, may include letters like 'g')
    # Pattern: digits followed by optional letters, then space + description
    match = re.match(r'^(\d+[A-Za-z]*(?:[-/]\d*[A-Za-z]*)*)', ws_code.strip())
    if match:
        return match.group(1).upper()
    return ws_code.strip().split()[0].upper() if ws_code.strip() else ""


async def dispatch_new_listings_safe(order_ids: list[str], orders: Optional[list] = None) -> int:
    """Alerts/push for really new listings (UI §11) via app.services.alert_dispatch.
    Never raises."""
    if not order_ids:
        return 0
    from app.services.alert_dispatch import dispatch_new_listings

    try:
        return await dispatch_new_listings(order_ids)
    except Exception as exc:
        logger.exception("alert dispatch failed for %d order(s): %s", len(order_ids), exc)
        return 0


async def process_csv_import(
    csv_content: str,
    import_record: WhatsAppImport,
    admin: User,
    *,
    guard: bool = False,
) -> dict:
    """Process CSV import. Returns stats dict."""
    # Remove BOM if present
    if csv_content.startswith('\ufeff'):
        csv_content = csv_content[1:]

    reader = csv.DictReader(io.StringIO(csv_content))
    # Preserve headers for unmatched CSV output
    fieldnames = list(reader.fieldnames or [])
    return await import_order_rows(list(reader), fieldnames, import_record, admin, guard=guard)


def parse_month_year(month_year: str) -> tuple[Optional[int], Optional[int], Optional[str]]:
    """Generator "Monat/Jahr" text ("09/25", "2024", "2022+", "2022-2024") -> (year, month, year_raw).
    Shared by the import and the offer re-read so both read a date the same way."""
    watch_year = None
    watch_month = None
    year_raw = None
    # Non-standard formats like "2022+" keep the raw text for display
    if month_year and ('+' in month_year or not month_year.replace('/', '').replace(' ', '').isdigit()):
        year_raw = month_year
    if month_year:
        clean_my = month_year.replace('+', '').strip()
        if '/' in clean_my:
            try:
                parts = clean_my.split('/')
                watch_month = int(parts[0])
                yr_part = parts[1]
                watch_year = 2000 + int(yr_part) if len(yr_part) == 2 else int(yr_part)
            except (ValueError, IndexError):
                pass
        else:
            try:
                watch_year = int(clean_my)
            except ValueError:
                pass
    return watch_year, watch_month, year_raw


def _row_import_meta(row: dict) -> dict:
    """Per-row extras set by the pipeline (match method, source text, ...)."""
    meta = row.get("_import")
    return meta if isinstance(meta, dict) else {}


def _row_texts(row: dict) -> tuple[str, str]:
    """(dealer's line(s) the row was built from, whole message) for the offer guard."""
    imp = _row_import_meta(row)
    meta = row.get("_meta") if isinstance(row.get("_meta"), dict) else {}
    line = (
        imp.get("source_text") or meta.get("source_text") or row.get("Original Text")
        or row.get("_original_content") or ""
    )
    message = meta.get("message_text") or row.get("_message_text") or ""
    return str(line), str(message)


def _apply_reading(order: Order, reading: dict, side: str, now: datetime) -> None:
    """Overwrite an offer with a new reading of the dealer's line: price, currency, year, month,
    condition, remarks, source text and times, all of it. ``reading["posted"]`` is the message time."""
    from app.core.countries import country_display_name as _cdn
    from app.services import offer_lifecycle as lifecycle

    posted = reading["posted"]
    for key, value in reading.items():
        if key in ("posted", "country_code", "country_name"):
            continue
        setattr(order, key, value)
    if reading.get("country_code"):
        order.country_code = reading["country_code"]
        order.country_name = _cdn(reading["country_code"]) or reading.get("country_name")
    order.created_at = posted
    order.updated_at = now
    order.last_seen_at = now
    order.expires_at = lifecycle.expires_at(side, posted)
    if not order.first_seen_at:
        order.first_seen_at = posted


async def import_order_rows(
    reader: list[dict],
    fieldnames: list[str],
    import_record: WhatsAppImport,
    admin: User,
    *,
    require_phone: bool = False,
    dispatch_alerts: bool = True,
    guard: bool = False,
) -> dict:
    """Turn generator/CSV rows into orders. Shared by the manual CSV import, the
    bridge daily-ingest and the automatic pipeline (generator spec §1).

    Each row is a dict with the generator's German CSV headers. A row may carry an
    ``_import`` dict with ``match_method``, ``ai_reason``, ``source_text``,
    ``source_image``, ``source_group`` and ``source_run_id``.

    One offer per dealer LINE: dealer + side + WS code + the dealer's source line. The
    same line again (any message or group) is the same offer and its new reading
    overwrites the old one completely (price, year, month, condition, remarks, source
    text, times); a changed price goes to ``price_history``. A new line for a watch the
    dealer offers from an earlier message, which no line of this message claims, is the
    new reading of that offer. Different lines of one message stay separate offers.
    A repost is not new and triggers no alert; it reactivates an expired offer.
    Every offer expires 10 days (WTS) / 14 days (WTB) after its last post.

    With ``guard`` every row is checked against the dealer's own text before it
    is published (``offer_lifecycle.check_row``): rows without evidence come back
    in ``guard_held_row_list``, references-as-prices, adverts and the like in
    ``guard_rejected_row_list``. Returns stats plus ``new_order_ids``,
    ``refreshed_order_ids``, ``unmatched_row_list`` and ``quarantined_row_list``.
    """
    from app.services import fx as fx_service
    from app.services import offer_lifecycle as lifecycle

    fx_rates = await fx_service.load_rates()
    fieldnames = [f for f in (fieldnames or []) if not str(f).startswith("_")]
    now = datetime.utcnow()
    refreshed_ids: list[str] = []
    no_phone_rows: list[dict] = []

    # Build cache for strict ws_code matching.
    all_watches = await Watch.find(Watch.status == "active").to_list()
    watch_by_ws_code: dict[str, Watch] = {}
    for w in all_watches:
        if w.ws_code:
            watch_by_ws_code[w.ws_code.strip().upper()] = w

    import_id = str(import_record.id)
    admin_id = str(admin.id)
    listing_docs = []
    order_docs = []
    unmatched_raw_rows: list[dict] = []
    total_rows = 0
    matched_count = 0
    unmatched_count = 0
    skipped_duplicates = 0
    flagged_price_count = 0
    # Raw CSV row behind each entry of order_docs, so a row quarantined by the
    # cross-record price check can be written back out for an admin to review.
    order_source_rows: list[dict] = []
    group_name = None

    refreshed_count = 0
    guard_held_rows: list[dict] = []
    guard_rejected_rows: list[dict] = []
    guard_fixed_count = 0
    # Existing offers whose price a newer message changes. Applied after the
    # cross-record price check, so a new price that looks wrong is held back
    # and the offer keeps its old price.
    price_updates: list[tuple[Order, dict, dict]] = []  # (order, new fields, source row)

    # Existing offers by offer key (no price in it). Expired ones from the last
    # weeks are included so a repost brings the same offer back.
    existing_orders = await Order.find(
        Order.status == OrderStatus.ACTIVE,
    ).to_list()
    revivable = await Order.find(
        Order.status == OrderStatus.EXPIRED,
        Order.created_at >= now - timedelta(days=lifecycle.REVIVE_WINDOW_DAYS),
    ).to_list()
    # Held offers (suspicious price, waiting on the Approval page): a repost refreshes them,
    # it must not create a second copy. They are no peers of anything (not in existing_orders).
    held_orders = await Order.find(Order.status == OrderStatus.HELD).to_list()
    # Offers by dealer slot (side, WS code, phone), oldest first, active ones last. Offers an
    # earlier clean-up superseded are never matched. Pending (new, not yet inserted) offers of this
    # import join their slot, so a line twice in one import is one offer.
    existing_by_slot: dict[tuple, list] = {}
    pending_row_index: dict[int, int] = {}  # id(pending Order) -> index in order_docs
    # id(offer) -> (phone, post time) of the message of this import that last wrote it
    touched_this_import: dict[int, tuple] = {}
    for eo in sorted(revivable + held_orders, key=lambda o: o.created_at or now) + sorted(
        existing_orders, key=lambda o: o.created_at or now
    ):
        if eo.superseded_by:
            continue
        eo_ws = (eo.ws_code or "").strip().upper()
        eo_phone = (eo.whatsapp_phone or eo.user_name or "").strip()
        if eo_ws and eo_phone:
            existing_by_slot.setdefault((eo.order_type.value, eo_ws, eo_phone), []).append(eo)

    # The dealer lines of each message of this import, per watch: an old offer whose line is
    # written again in the same message belongs to that line and is not up for another one.
    claimed_lines: dict[tuple, dict] = {}  # (side, WS code, phone, post time) -> {line key: rows}
    for r in reader:
        t = (r.get("Nachrichten Art") or r.get("nachrichten art") or "").strip().upper()
        side = "sell" if t == "WTS" else "buy" if t == "WTB" else None
        lk = lifecycle.line_key(_row_texts(r)[0])
        if side and lk:
            per_msg = claimed_lines.setdefault((
                side, (r.get("WS-Code") or r.get("ws-code") or r.get("WS-code") or "").strip().upper(),
                (r.get("Nummer") or r.get("nummer") or "").strip(),
                (r.get("Nachricht gepostet am") or r.get("nachricht gepostet am") or "").strip(),
            ), {})
            per_msg[lk] = per_msg.get(lk, 0) + 1

    use_guard = guard and lifecycle.guard_enabled()
    reference_prices = lifecycle.reference_prices(existing_orders) if use_guard else {}
    if use_guard:
        lifecycle.set_fx(fx_rates)

    for row in reader:
        total_rows += 1
        # Map German headers (handle potential variations)
        offer_type_str = (row.get("Nachrichten Art") or row.get("nachrichten art") or "").strip().upper()
        brand = (row.get("Marke") or row.get("marke") or "").strip()
        ws_code = (row.get("WS-Code") or row.get("ws-code") or row.get("WS-code") or "").strip()
        month_year = (row.get("Monat/Jahr") or row.get("monat/jahr") or "").strip()
        location = (row.get("Standort") or row.get("standort") or "").strip().upper()
        condition_str = (row.get("Zustand") or row.get("zustand") or "").strip()
        # CSV uses German header "Bemerkungen" — keep English variants as fallback.
        remarks = (
            row.get("Bemerkungen")
            or row.get("bemerkungen")
            or row.get("Remarks")
            or row.get("remarks")
            or ""
        ).strip()
        price_str = (row.get("Preis") or row.get("preis") or "").strip()
        phone = (row.get("Nummer") or row.get("nummer") or "").strip()
        group = (row.get("Gruppe") or row.get("gruppe") or "").strip()
        posted_at_str = (row.get("Nachricht gepostet am") or row.get("nachricht gepostet am") or "").strip()
        # Buy requests: the buyer already has a customer ("sold order", "confirm order", "strong call")
        firm_order = (row.get("Sold Order") or row.get("sold order") or "").strip().lower() in ("yes", "true", "1", "y", "ja")

        if not group_name and group:
            group_name = group

        # Parse offer type
        offer_type = OfferType.UNKNOWN
        if offer_type_str in ("WTS",):
            offer_type = OfferType.WTS
        elif offer_type_str in ("WTB",):
            offer_type = OfferType.WTB

        # Parse price
        price, currency = parse_csv_price(price_str)

        # Parse month/year (e.g., "09/25", "02/26", "2024", "2022+")
        watch_year, watch_month, year_raw = parse_month_year(month_year)

        # Parse posted timestamp
        message_timestamp = None
        if posted_at_str:
            try:
                message_timestamp = datetime.strptime(posted_at_str, "%d.%m.%y %H:%M:%S")
            except ValueError:
                try:
                    message_timestamp = datetime.strptime(posted_at_str, "%d.%m.%Y %H:%M:%S")
                except ValueError:
                    pass

        # Extract reference from WS-Code
        reference = extract_reference_from_ws_code(ws_code)

        # Strict ws_code match only. No reference fallback — that would collapse
        # distinct variants (e.g. "5167A" vs "5167A Black") into one Order.
        # Rows that don't resolve to an exact catalog ws_code are left unmatched.
        matched_watch = None
        if ws_code:
            matched_watch = watch_by_ws_code.get(ws_code.strip().upper())

        if not matched_watch:
            # No match found — skip this row (count as unmatched)
            unmatched_count += 1
            unmatched_raw_rows.append(row)
            continue

        # Generator spec §1.8: no listing without a phone number goes into the app.
        if require_phone and not phone:
            no_phone_rows.append(row)
            continue
        row_meta = _row_import_meta(row)

        # Resolve country
        country_code = location if location else None
        country_name = (country_display_name(country_code) or country_code) if country_code else None

        # Resolve condition — store raw text for non-standard conditions
        condition = None
        condition_raw = None
        cond_lower = condition_str.lower().strip()
        # Check for Unworn indicators first (more specific matches first)
        unworn_keywords = (
            "unworn", "new", "brand new", "nos", "bnib", "fresh",
            "stickered", "sealed", "unsized", "un-worn",
            "retail ready",
        )
        used_keywords = ("used", "pre-owned", "preowned", "worn", "polished")
        if "like new" in cond_lower:
            # The generator classes "like new" as Used; checked first because
            # it also contains the unworn keyword "new".
            condition = "Used"
            condition_raw = condition_str
        elif any(kw in cond_lower for kw in unworn_keywords):
            condition = "Unworn"
            if cond_lower not in ("unworn", "new", "brand new", "nos", "bnib"):
                condition_raw = condition_str
        elif any(kw in cond_lower for kw in used_keywords):
            condition = "Used"
        elif condition_str:
            # Non-standard condition text — default to Unworn, store raw
            condition = "Unworn"
            condition_raw = condition_str

        # Build raw text for social search
        raw_text = f"{offer_type_str} {brand} {ws_code} {price_str}".strip()
        if remarks:
            raw_text += f" - {remarks}"

        # Offer guard: is the dealer's own text evidence for this offer?
        if use_guard and offer_type in (OfferType.WTS, OfferType.WTB):
            line_text, message_text = _row_texts(row)
            verdict = lifecycle.check_row(
                order_type="sell" if offer_type == OfferType.WTS else "buy",
                ws_code=matched_watch.ws_code or ws_code, price=price, currency=currency,
                source_line=line_text, message=message_text, watch=matched_watch,
                reference=reference_prices.get((matched_watch.ws_code or ws_code).strip().upper()),
            )
            if verdict.decision in ("hold", "reject"):
                flagged = dict(row)
                flagged["Guard"] = lifecycle.describe(verdict.reasons)
                flagged["_guard_reasons"] = verdict.reasons
                (guard_held_rows if verdict.decision == "hold" else guard_rejected_rows).append(flagged)
                continue
            if verdict.decision == "fix" and verdict.currency:
                currency = verdict.currency
                guard_fixed_count += 1

        # Use matched watch data (always present — we skip unmatched above)
        watch_brand = matched_watch.brand
        watch_model = matched_watch.model
        watch_reference = matched_watch.reference

        # 1. Create ExtractedWatchListing (social search)
        listing_docs.append(ExtractedWatchListing(
            import_id=import_id,
            brand=watch_brand,
            reference=watch_reference,
            ws_code=ws_code or None,
            model=watch_model,
            price=price,
            currency=currency or "",
            condition=condition,
            seller_name=phone,
            seller_phone=phone,
            raw_text=raw_text,
            offer_type=offer_type,
            country_code=country_code,
            country_name=country_name,
            month_year=month_year or None,
            message_timestamp=message_timestamp,
        ))

        # 2. Create Order (order book)
        # WTS requires a price; WTB orders are allowed without a price (buyers often
        # don't publish budgets). Also allow orders when offer_type is UNKNOWN only
        # if we have a price — otherwise we can't classify reliably.
        create_order = False
        if offer_type == OfferType.WTS and price:
            create_order = True
        elif offer_type == OfferType.WTB:
            create_order = True  # WTB works without price

        if create_order:
            order_type = OrderType.SELL if offer_type == OfferType.WTS else OrderType.BUY
            # No condition stated: none, not "Used" (test chats Nov 2026)
            order_condition = (OrderCondition.UNWORN if condition == "Unworn"
                               else OrderCondition.USED if condition == "Used" else None)
            order_reference = watch_reference or ws_code

            # WTB orders must display only WTB-vocabulary conditions ("Only Unworn" / "Can be Used"),
            # and a request that states no condition has none (empty, not "Can be Used").
            if offer_type == OfferType.WTB:
                condition_raw = ("Only Unworn" if condition == "Unworn" else "Can be Used") if condition else None
                if not condition:
                    order_condition = None

            # Identity: the dealer's LINE. Same dealer + side + watch + same line = same offer, whatever
            # group or message it came in; a new reading of it overwrites the old one completely.
            dup_ws = (matched_watch.ws_code or ws_code or "").strip().upper()
            dup_phone = phone.strip() if phone else ""
            dup_month_year = ""
            if watch_month and watch_year:
                dup_month_year = f"{watch_month:02d}/{watch_year % 100:02d}"
            elif year_raw:
                dup_month_year = year_raw.strip().lower()
            elif watch_year:
                dup_month_year = str(watch_year)
            my_key = lifecycle.offer_key(
                order_type.value, dup_ws, dup_phone, dup_month_year,
                order_condition.value if order_condition else "",
            )
            posted = message_timestamp or now
            line_text, _msg = _row_texts(row)
            lk = lifecycle.line_key(line_text)
            slot = (order_type.value, dup_ws, dup_phone)

            if price:
                price_valid, price_reason = validate_price(str(int(price)), watch_brand)
                if not price_valid:
                    remarks = f"{remarks} | PRICE FLAG: {price_reason}" if remarks else f"PRICE FLAG: {price_reason}"
            usd_price = None
            if price:
                usd_value = fx_service.convert(price, currency, "USD", fx_rates)
                usd_price = round(usd_value, 2) if usd_value is not None else None
            # Everything one reading of the line says; overwrites an older reading as a whole.
            reading = {
                "price": price, "currency": currency, "usd_price": usd_price,
                "condition": order_condition, "condition_raw": condition_raw,
                "year": watch_year, "watch_month": watch_month, "year_raw": year_raw,
                "remarks": remarks or None,
                "notes": f"Imported from {group or 'CSV'}. {remarks}".strip() if remarks else f"Imported from {group or 'CSV'}",
                "firm_order": firm_order and offer_type == OfferType.WTB,
                "source_text": row_meta.get("source_text"),
                "source_image": row_meta.get("source_image"),
                "source_group": row_meta.get("source_group") or group or None,
                "source_run_id": row_meta.get("source_run_id"),
                "match_method": row_meta.get("match_method"),
                "ai_reason": row_meta.get("ai_reason"),
                "description": ws_code if ws_code != order_reference else None,
                "country_code": country_code, "country_name": country_name if country_code else None,
            }
            claimed = claimed_lines.get((slot[0], dup_ws, dup_phone, posted_at_str), {})

            def _key_of(o) -> tuple:
                my = ""
                if o.watch_month and o.year:
                    my = f"{o.watch_month:02d}/{o.year % 100:02d}"
                elif o.year_raw:
                    my = o.year_raw.strip().lower()
                elif o.year:
                    my = str(o.year)
                return lifecycle.offer_key(o.order_type.value, dup_ws, dup_phone, my,
                                           o.condition.value if o.condition else "")

            def _same_price(o) -> bool:
                return bool(price) and round(price) == round(o.price or 0) and \
                    (currency or "").upper() == (o.currency or "").upper()

            existing_order = None
            cands = existing_by_slot.get(slot, [])
            if lk:
                same_line = [o for o in cands if lifecycle.line_key(o.source_text) == lk]
                # The source text can be a whole message several offers came from (a year per
                # offer): then the line alone does not tell them apart, the reading does.
                shared = claimed.get(lk, 1) > 1 or len(same_line) > 1
                rank = lambda o: (o.status == OrderStatus.ACTIVE, o.created_at or datetime.min)
                untouched = [o for o in same_line if touched_this_import.get(id(o)) != (dup_phone, posted)]
                if untouched and not shared:
                    existing_order = max(untouched, key=rank)
                elif untouched:
                    exact = [o for o in untouched if _same_price(o) and _key_of(o) == my_key]
                    same_p = [o for o in untouched if _same_price(o)]
                    same_k = [o for o in untouched if _key_of(o) == my_key]
                    for group in (exact, same_p, same_k):
                        if group:
                            existing_order = max(group, key=rank)
                            break
                    if existing_order is None and claimed.get(lk, 1) <= 1:
                        existing_order = max(untouched, key=rank)  # old copies of one line
                if existing_order is None:
                    # The same line and reading again in this message (another group): one offer.
                    dup_of = [o for o in same_line if touched_this_import.get(id(o)) == (dup_phone, posted)
                              and _same_price(o) and _key_of(o) == my_key]
                    if dup_of:
                        existing_order = dup_of[0]
            if existing_order is None:
                # A new reading of a line we have not seen: it replaces the one offer this dealer
                # has for the watch from an EARLIER message that no line of this message claims.
                # Lines of one message never overwrite each other.
                free = [o for o in cands
                        if touched_this_import.get(id(o)) != (dup_phone, posted)
                        and (not lk or not o.source_text or lifecycle.line_key(o.source_text) not in claimed)]
                free = [o for o in free if o.status != OrderStatus.EXPIRED] or free
                if not lk:
                    # A row without the dealer's text (hand-made CSV): same card date + condition.
                    same_key = [o for o in free if _key_of(o) == my_key]
                    existing_order = next((o for o in same_key if _same_price(o)), None) or \
                        (same_key[-1] if same_key else None)
                elif len(free) == 1:
                    existing_order = free[0]
                elif len(free) > 1:
                    existing_order = next((o for o in free if _same_price(o)), None) or \
                        next((o for o in free if _key_of(o) == my_key), None)

            if existing_order is not None:
                if existing_order.created_at and posted < existing_order.created_at:
                    # An older export processed late must not overwrite a newer post.
                    skipped_duplicates += 1
                    continue
                if touched_this_import.get(id(existing_order)) == (dup_phone, posted) and lk and \
                        lifecycle.line_key(existing_order.source_text) == lk:
                    skipped_duplicates += 1  # the same line again in another group of the same message
                    continue
                touched_this_import[id(existing_order)] = (dup_phone, posted)
                reading_now = dict(reading, posted=posted)
                if existing_order.id is None:
                    # Pending offer of this import: the newer reading wins as a whole.
                    _apply_reading(existing_order, reading_now, order_type.value, now)
                    idx = pending_row_index.get(id(existing_order))
                    if idx is not None:
                        order_source_rows[idx] = row
                    skipped_duplicates += 1
                    continue
                price_changed = bool(price) and (
                    round(price) != round(existing_order.price or 0)
                    or (currency or "").upper() != (existing_order.currency or "").upper()
                )
                if price_changed:
                    # Applied after the cross-record price check; an outlier keeps the old offer.
                    price_updates.append((existing_order, {
                        "price": price, "currency": currency, "usd_price": usd_price,
                        "posted": posted, "reading": reading_now,
                    }, row))
                    continue
                # Same offer reposted: not new, no alert (spec §1.11). Overwrite it with this reading
                # and bring an expired offer back.
                _apply_reading(existing_order, reading_now, order_type.value, now)
                if existing_order.status != OrderStatus.HELD:  # a held offer waits for its decision
                    existing_order.status = OrderStatus.ACTIVE
                if not existing_order.first_seen_at:
                    existing_order.first_seen_at = existing_order.created_at
                await existing_order.save()
                refreshed_count += 1
                refreshed_ids.append(str(existing_order.id))
                continue

            if "PRICE FLAG" in (remarks or ""):
                flagged_price_count += 1
            matched_count += 1

            order_source_rows.append(row)
            order_docs.append(Order(
                order_type=order_type,
                brand=watch_brand,
                model=watch_model,
                reference=order_reference,
                watch_id=str(matched_watch.id),
                price=price,
                currency=currency,
                usd_price=usd_price,
                condition=order_condition,
                country_code=country_code or "CH",
                country_name=country_name if country_code else country_display_name("CH"),
                user_id=admin_id,
                user_name=phone,
                whatsapp_phone=phone,
                ws_code=matched_watch.ws_code or (ws_code or None),
                aliases=matched_watch.aliases or [],
                year=watch_year,
                watch_month=watch_month,
                year_raw=year_raw,
                condition_raw=condition_raw,
                firm_order=firm_order and offer_type == OfferType.WTB,
                remarks=remarks or None,
                notes=f"Imported from {group or 'CSV'}. {remarks}".strip() if remarks else f"Imported from {group or 'CSV'}",
                description=ws_code if ws_code != order_reference else None,
                status=OrderStatus.ACTIVE,
                created_at=message_timestamp or now,
                first_seen_at=now,
                last_seen_at=now,
                expires_at=lifecycle.expires_at(order_type.value, message_timestamp or now),
                match_method=row_meta.get("match_method"),
                ai_reason=row_meta.get("ai_reason"),
                source_text=row_meta.get("source_text"),
                source_image=row_meta.get("source_image"),
                source_group=row_meta.get("source_group") or group or None,
                source_run_id=row_meta.get("source_run_id"),
            ))
            if dup_ws and dup_phone:
                new_doc = order_docs[-1]
                existing_by_slot.setdefault(slot, []).append(new_doc)
                pending_row_index[id(new_doc)] = len(order_docs) - 1
                touched_this_import[id(new_doc)] = (dup_phone, posted)

    # Cross-record price sanity. validate_price above only knows brand minimums,
    # so a row like "HKD 103.000" among "HKD 942.000" peers, or an HKD amount
    # mislabelled USD, sails through it. Compare every priced row against the
    # other rows for the same ws_code plus the orders already published, and
    # hold back whatever cannot be reconciled - a wrong price in the order book
    # is worse than a missing one.
    # Grouped per (book, ws_code): a WTB target is legitimately below a WTS ask,
    # so the two must never be averaged into one median.
    peer_usd_prices: dict[str, list[float]] = {}
    for eo in existing_orders:
        eo_ws = (eo.ws_code or "").strip().upper()
        if not eo_ws or eo.price is None:
            continue
        eo_usd = eo.usd_price or to_usd(eo.price, eo.currency)
        if eo_usd and eo_usd > 0:
            peer_usd_prices.setdefault(f"{eo.order_type.value}:{eo_ws}", []).append(eo_usd)

    n_new = len(order_docs)
    outliers = find_price_outliers(
        [
            PriceRow(
                index=i,
                ws_code=f"{o.order_type.value}:{(o.ws_code or o.reference or '').strip().upper()}",
                label=(o.ws_code or o.reference or "").strip().upper(),
                price=o.price,
                currency=o.currency,
            )
            for i, o in enumerate(order_docs)
        ] + [
            PriceRow(
                index=n_new + j,
                ws_code=f"{o.order_type.value}:{(o.ws_code or o.reference or '').strip().upper()}",
                label=(o.ws_code or o.reference or "").strip().upper(),
                price=upd["price"],
                currency=upd["currency"],
            )
            for j, (o, upd, _r) in enumerate(price_updates)
        ],
        peer_usd_prices,
    )

    quarantined_rows: list[dict] = []
    quarantined_indexes: dict[int, str] = {o.index: o.reason for o in outliers} if outliers else {}
    # Price changes of existing offers: an outlier keeps the old price.
    price_updated_ids: list[str] = []
    for j, (eo, upd, src_row) in enumerate(price_updates):
        if n_new + j in quarantined_indexes:
            flagged_row = dict(src_row)
            flagged_row["Preis-Flag"] = quarantined_indexes[n_new + j]
            quarantined_rows.append(flagged_row)
            flagged_price_count += 1
            continue
        posted = upd["posted"]
        if eo.created_at and posted < eo.created_at:
            continue  # a newer post of this offer was applied above
        eo.price_history = list(eo.price_history or []) + [
            {"price": eo.price, "currency": eo.currency, "until": posted}
        ]
        _apply_reading(eo, upd["reading"], eo.order_type.value, now)
        was_held = eo.status == OrderStatus.HELD
        if not was_held:
            eo.status = OrderStatus.ACTIVE
        eo.price_approved = False  # an approved price was approved for the old amount
        if not eo.first_seen_at:
            eo.first_seen_at = posted
        if was_held:
            # New price on a held offer: check again, fine now -> visible, else new flag.
            from app.services import price_flags

            await price_flags.recheck_held(eo, fx_rates)
        await eo.save()
        refreshed_count += 1
        refreshed_ids.append(str(eo.id))
        price_updated_ids.append(str(eo.id))
    quarantined_indexes = {i: r for i, r in quarantined_indexes.items() if i < n_new}
    if quarantined_indexes:
        for i, reason in quarantined_indexes.items():
            flagged_row = dict(order_source_rows[i]) if i < len(order_source_rows) else {}
            flagged_row["Preis-Flag"] = reason
            quarantined_rows.append(flagged_row)
        order_docs = [o for i, o in enumerate(order_docs) if i not in quarantined_indexes]
        order_source_rows = [r for i, r in enumerate(order_source_rows) if i not in quarantined_indexes]
        matched_count -= len(quarantined_indexes)
        flagged_price_count += len(quarantined_indexes)
        logger.warning(
            "Import %s quarantined %d order row(s) on price sanity: %s",
            str(import_record.id),
            len(quarantined_indexes),
            "; ".join(o.reason for o in outliers[:5]),
        )

    # Hold back suspicious prices: a new offer far from the other offers of the same WS code, year
    # and condition is created with status HELD and shows up on the Approval page (tab
    # "Suspicious prices") instead of in the order book. Alerts skip it (they only send active offers).
    from app.services import price_flags

    held_new = await price_flags.check_new_orders(order_docs, fx_rates) if order_docs else []

    # Bulk insert
    BATCH_SIZE = 500
    if listing_docs:
        for i in range(0, len(listing_docs), BATCH_SIZE):
            await ExtractedWatchListing.insert_many(listing_docs[i:i + BATCH_SIZE])

    new_order_ids: list[str] = []
    if order_docs:
        for i in range(0, len(order_docs), BATCH_SIZE):
            batch = order_docs[i:i + BATCH_SIZE]
            result = await Order.insert_many(batch)
            inserted = list(getattr(result, "inserted_ids", []) or [])
            for doc, oid in zip(batch, inserted):
                if doc.id is None:
                    doc.id = oid
            new_order_ids.extend(str(oid) for oid in inserted)

        # Update order counts on matched watches
        ref_counts: dict[str, int] = {}
        for o in order_docs:
            ref_counts[o.reference] = ref_counts.get(o.reference, 0) + 1
        for ref, count in ref_counts.items():
            await Watch.find(Watch.reference == ref).update_many({"$inc": {"order_count": count}})

        if dispatch_alerts:
            await dispatch_new_listings_safe(new_order_ids, order_docs)

    # Build unmatched CSV and store in GridFS (expires after 30 min)
    unmatched_gridfs_id = None
    flagged_gridfs_id = None
    files_expire_at = None
    if unmatched_raw_rows and fieldnames:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for urow in unmatched_raw_rows:
            writer.writerow(urow)
        unmatched_csv_str = output.getvalue()
        unmatched_gridfs_id = await _whatsapp_gridfs_put(
            unmatched_csv_str, f"unmatched-{import_record.filename}"
        )
        files_expire_at = datetime.utcnow() + timedelta(minutes=FILES_TTL_MINUTES)

    # Quarantined rows go out as their own CSV with the reason appended, so the
    # admin can correct the currency or the amount and re-import just those.
    if quarantined_rows:
        flagged_fieldnames = list(fieldnames) + ["Preis-Flag"] if fieldnames else list(quarantined_rows[0].keys())
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=flagged_fieldnames, extrasaction="ignore")
        writer.writeheader()
        for frow in quarantined_rows:
            writer.writerow(frow)
        flagged_gridfs_id = await _whatsapp_gridfs_put(
            output.getvalue(), f"price-flagged-{import_record.filename}"
        )
        files_expire_at = datetime.utcnow() + timedelta(minutes=FILES_TTL_MINUTES)

    # Medians / counts for every touched watch (generator spec §9).
    touched_ws = {o.ws_code for o in order_docs if o.ws_code}
    if refreshed_ids:
        refreshed_set = set(refreshed_ids)
        touched_ws.update(
            (eo.ws_code for eo in existing_orders + revivable + held_orders
             if str(eo.id) in refreshed_set and eo.ws_code)
        )
    if touched_ws:
        from app.services.market_stats import recompute_for_safe

        await recompute_for_safe(sorted(touched_ws))

    # Update import record
    import_record.group_name = group_name or "CSV Import"
    import_record.status = ImportStatus.COMPLETED
    import_record.total_messages = total_rows
    import_record.extracted_watches = len(listing_docs)
    import_record.matched_orders = matched_count
    import_record.unmatched_rows = unmatched_count
    import_record.skipped_duplicates = skipped_duplicates
    import_record.unmatched_csv_gridfs_id = unmatched_gridfs_id
    import_record.price_flagged_rows = len(quarantined_rows)
    import_record.price_flagged_csv_gridfs_id = flagged_gridfs_id
    import_record.files_expire_at = files_expire_at
    import_record.completed_at = datetime.utcnow()
    await import_record.save()

    return {
        "total_rows": total_rows,
        "extracted_listings": len(listing_docs),
        "matched_orders": matched_count,
        "unmatched_rows": unmatched_count,
        "skipped_duplicates": skipped_duplicates,
        "refreshed_orders": refreshed_count,
        "flagged_prices": flagged_price_count,
        "price_quarantined_rows": len(quarantined_rows),
        "price_quarantine_reasons": [o.reason for o in outliers[:20]],
        "no_phone_rows": len(no_phone_rows),
        "price_updated_orders": len(price_updated_ids),
        "held_prices": len(held_new),
        "guard_held": len(guard_held_rows),
        "guard_rejected": len(guard_rejected_rows),
        "guard_fixed_currency": guard_fixed_count,
        "guard_held_row_list": guard_held_rows,
        "guard_rejected_row_list": guard_rejected_rows,
        "new_order_ids": new_order_ids,
        "refreshed_order_ids": refreshed_ids,
        "unmatched_row_list": unmatched_raw_rows,
        "quarantined_row_list": quarantined_rows,
        "no_phone_row_list": no_phone_rows,
    }


@router.post("/admin/whatsapp/import", response_model=ImportResponse)
async def admin_import_whatsapp(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Import WhatsApp chat from .zip or .csv file (Admin only)"""

    if not file.filename.endswith('.zip') and not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .zip or .csv file"
        )

    # Create import record
    import_record = WhatsAppImport(
        filename=file.filename,
        group_name="Processing...",
        imported_by=str(current_admin.id),
        imported_by_name=current_admin.name,
        status=ImportStatus.PROCESSING,
    )
    await import_record.insert()

    try:
        content = await file.read()

        # CSV branch
        if file.filename.endswith('.csv'):
            csv_content = content.decode('utf-8-sig')
            await process_csv_import(csv_content, import_record, current_admin)
            return {
                "id": str(import_record.id),
                "filename": import_record.filename,
                "group_name": import_record.group_name,
                "status": import_record.status,
                "total_messages": import_record.total_messages,
                "extracted_watches": import_record.extracted_watches,
                "imported_by": import_record.imported_by,
                "imported_by_name": import_record.imported_by_name,
                "created_at": import_record.created_at,
                "completed_at": import_record.completed_at,
                "matched_orders": import_record.matched_orders,
                "unmatched_rows": import_record.unmatched_rows,
                "skipped_duplicates": import_record.skipped_duplicates,
                "has_unmatched_csv": import_record.unmatched_csv_gridfs_id is not None,
                "price_flagged_rows": import_record.price_flagged_rows,
                "has_price_flagged_csv": import_record.price_flagged_csv_gridfs_id is not None,
            }

        # ZIP branch
        zip_buffer = io.BytesIO(content)

        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
            # Find _chat.txt file
            chat_file = None
            for name in zip_ref.namelist():
                if name.endswith('_chat.txt') or name == 'chat.txt':
                    chat_file = name
                    break

            if not chat_file:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No chat file found in zip"
                )

            # Read and decode chat file
            with zip_ref.open(chat_file) as f:
                chat_content = f.read().decode('utf-8', errors='ignore')

        # Parse messages
        lines = chat_content.split('\n')
        messages = []
        extracted_watches = []

        for line in lines:
            parsed = parse_whatsapp_message(line)
            if parsed:
                messages.append(parsed)

                # Try to extract watch data
                watch_data = extract_watch_data(parsed["content"])
                if watch_data:
                    watch_data["message_timestamp"] = parsed["timestamp"]
                    watch_data["seller_name"] = parsed["sender"]
                    extracted_watches.append(watch_data)

        # Extract group name from filename or first system message
        group_name = file.filename.replace('.zip', '').replace('_', ' ')

        # Bulk insert messages in batches for performance
        BATCH_SIZE = 500
        import_id_str = str(import_record.id)

        message_docs = [
            WhatsAppMessage(
                import_id=import_id_str,
                timestamp=msg["timestamp"],
                sender=msg["sender"],
                content=msg["content"],
            )
            for msg in messages
        ]
        for i in range(0, len(message_docs), BATCH_SIZE):
            batch = message_docs[i:i + BATCH_SIZE]
            await WhatsAppMessage.insert_many(batch)

        # Bulk insert extracted listings in batches
        listing_docs = [
            ExtractedWatchListing(
                import_id=import_id_str,
                brand=watch.get("brand"),
                reference=watch.get("reference"),
                price=watch.get("price"),
                currency=watch.get("currency", "USD"),
                condition=watch.get("condition"),
                seller_name=watch.get("seller_name"),
                raw_text=watch["raw_text"],
                offer_type=watch.get("offer_type", OfferType.UNKNOWN),
                country_code=watch.get("country_code"),
                country_name=watch.get("country_name"),
                message_timestamp=watch.get("message_timestamp"),
            )
            for watch in extracted_watches
        ]
        for i in range(0, len(listing_docs), BATCH_SIZE):
            batch = listing_docs[i:i + BATCH_SIZE]
            await ExtractedWatchListing.insert_many(batch)

        # Update import record
        import_record.group_name = group_name
        import_record.status = ImportStatus.COMPLETED
        import_record.total_messages = len(messages)
        import_record.extracted_watches = len(extracted_watches)
        import_record.completed_at = datetime.utcnow()
        await import_record.save()

        return {
            "id": str(import_record.id),
            "filename": import_record.filename,
            "group_name": import_record.group_name,
            "status": import_record.status,
            "total_messages": import_record.total_messages,
            "extracted_watches": import_record.extracted_watches,
            "imported_by": import_record.imported_by,
            "imported_by_name": import_record.imported_by_name,
            "created_at": import_record.created_at,
            "completed_at": import_record.completed_at,
            "matched_orders": 0,
            "unmatched_rows": 0,
            "skipped_duplicates": 0,
            "has_unmatched_csv": False,
            "price_flagged_rows": 0,
            "has_price_flagged_csv": False,
        }

    except Exception as e:
        import_record.status = ImportStatus.FAILED
        import_record.error_message = str(e)
        await import_record.save()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


@router.get("/admin/whatsapp/imports", response_model=List[ImportResponse])
async def admin_list_imports(
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """List all WhatsApp imports (Admin only)"""

    imports = await WhatsAppImport.find_all().sort([("created_at", -1)]).skip(skip).limit(limit).to_list()

    return [
        {
            "id": str(imp.id),
            "filename": imp.filename,
            "group_name": imp.group_name,
            "status": imp.status,
            "total_messages": imp.total_messages,
            "extracted_watches": imp.extracted_watches,
            "imported_by": imp.imported_by,
            "imported_by_name": imp.imported_by_name,
            "created_at": imp.created_at,
            "completed_at": imp.completed_at,
            "matched_orders": imp.matched_orders,
            "unmatched_rows": imp.unmatched_rows,
            "skipped_duplicates": imp.skipped_duplicates,
            "has_unmatched_csv": imp.unmatched_csv_gridfs_id is not None,
        "price_flagged_rows": imp.price_flagged_rows,
        "has_price_flagged_csv": imp.price_flagged_csv_gridfs_id is not None,
            "price_flagged_rows": imp.price_flagged_rows,
            "has_price_flagged_csv": imp.price_flagged_csv_gridfs_id is not None,
        }
        for imp in imports
    ]


@router.get("/admin/whatsapp/imports/{import_id}")
async def admin_get_import(
    import_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Get import details (Admin only)"""

    imp = await WhatsAppImport.get(PydanticObjectId(import_id))

    if not imp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found"
        )

    return {
        "id": str(imp.id),
        "filename": imp.filename,
        "group_name": imp.group_name,
        "status": imp.status,
        "total_messages": imp.total_messages,
        "extracted_watches": imp.extracted_watches,
        "imported_by": imp.imported_by,
        "imported_by_name": imp.imported_by_name,
        "created_at": imp.created_at,
        "completed_at": imp.completed_at,
        "error_message": imp.error_message,
        "matched_orders": imp.matched_orders,
        "unmatched_rows": imp.unmatched_rows,
        "skipped_duplicates": imp.skipped_duplicates,
        "has_unmatched_csv": imp.unmatched_csv_gridfs_id is not None,
        "price_flagged_rows": imp.price_flagged_rows,
        "has_price_flagged_csv": imp.price_flagged_csv_gridfs_id is not None,
    }


@router.get("/admin/whatsapp/imports/{import_id}/unmatched-csv")
async def admin_download_unmatched_csv(
    import_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download CSV of unmatched rows from an import (Admin only)"""
    from fastapi.responses import Response

    imp = await WhatsAppImport.get(PydanticObjectId(import_id))
    if not imp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found"
        )

    if not imp.unmatched_csv_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after import."
        )

    try:
        content = await _whatsapp_gridfs_get(imp.unmatched_csv_gridfs_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after import."
        )

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="unmatched-{imp.filename}"'
        },
    )


@router.get("/admin/whatsapp/imports/{import_id}/price-flagged-csv")
async def admin_download_price_flagged_csv(
    import_id: str,
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Download the rows held back by the price sanity check (Admin only).

    Each row carries a ``Preis-Flag`` column explaining why it was not
    published, so it can be corrected and re-imported on its own.
    """
    from fastapi.responses import Response

    imp = await WhatsAppImport.get(PydanticObjectId(import_id))
    if not imp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import not found"
        )

    if not imp.price_flagged_csv_gridfs_id:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after import."
        )

    try:
        content = await _whatsapp_gridfs_get(imp.price_flagged_csv_gridfs_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="File expired or not available. Files are available for 30 minutes after import."
        )

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="price-flagged-{imp.filename}"'
        },
    )


@router.get("/admin/whatsapp/imports/{import_id}/listings")
async def admin_get_import_listings(
    import_id: str,
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
) -> Any:
    """Get extracted watch listings from an import (Admin only)"""

    query_conditions = [ExtractedWatchListing.import_id == import_id]

    if search and search.strip():
        s = search.strip()
        query_conditions.append({
            "$or": [
                {"brand": {"$regex": s, "$options": "i"}},
                {"reference": {"$regex": s, "$options": "i"}},
                {"ws_code": {"$regex": s, "$options": "i"}},
                {"model": {"$regex": s, "$options": "i"}},
                {"seller_name": {"$regex": s, "$options": "i"}},
                {"raw_text": {"$regex": s, "$options": "i"}},
            ]
        })

    total = await ExtractedWatchListing.find(*query_conditions).count()

    listings = await ExtractedWatchListing.find(
        *query_conditions
    ).sort([("message_timestamp", -1)]).skip(skip).limit(limit).to_list()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": [
            {
                "id": str(lst.id),
                "import_id": lst.import_id,
                "brand": lst.brand,
                "reference": lst.reference,
                "ws_code": lst.ws_code,
                "model": lst.model,
                "price": lst.price,
                "currency": lst.currency,
                "condition": lst.condition,
                "seller_name": lst.seller_name,
                "raw_text": lst.raw_text,
                "month_year": lst.month_year,
                "message_timestamp": lst.message_timestamp,
            }
            for lst in listings
        ],
    }


@router.get("/admin/whatsapp/search")
async def admin_search_whatsapp(
    current_admin: User = Depends(get_current_admin_user),
    brand: Optional[str] = None,
    reference: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """Search extracted watch listings (Admin only)"""

    query_conditions = []

    if brand:
        query_conditions.append({"brand": {"$regex": brand, "$options": "i"}})
    if reference:
        query_conditions.append({"reference": {"$regex": reference, "$options": "i"}})
    if min_price is not None:
        query_conditions.append(ExtractedWatchListing.price >= min_price)
    if max_price is not None:
        query_conditions.append(ExtractedWatchListing.price <= max_price)

    if query_conditions:
        listings = await ExtractedWatchListing.find(*query_conditions).sort([("message_timestamp", -1)]).skip(skip).limit(limit).to_list()
    else:
        listings = await ExtractedWatchListing.find_all().sort([("message_timestamp", -1)]).skip(skip).limit(limit).to_list()

    return {
        "total": len(listings),
        "results": [
            {
                "id": str(lst.id),
                "import_id": lst.import_id,
                "brand": lst.brand,
                "reference": lst.reference,
                "ws_code": lst.ws_code,
                "price": lst.price,
                "currency": lst.currency,
                "condition": lst.condition,
                "seller_name": lst.seller_name,
                "raw_text": lst.raw_text,
                "month_year": lst.month_year,
                "message_timestamp": lst.message_timestamp,
            }
            for lst in listings
        ]
    }


# ============== USER-FACING SOCIAL SEARCH ENDPOINTS ==============

class SocialSearchResponse(BaseModel):
    id: str
    brand: Optional[str] = None
    reference: Optional[str] = None
    price: Optional[float] = None
    currency: str
    condition: Optional[str] = None
    seller_name: str
    seller_phone: Optional[str] = None
    raw_text: str
    offer_type: str
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    message_timestamp: Optional[datetime] = None


class SocialSearchFilters(BaseModel):
    offer_type: Optional[str] = None  # "wts", "wtb", or None for all
    reference: Optional[str] = None
    country_code: Optional[str] = None
    brand: Optional[str] = None


@router.get("/social/search", response_model=dict)
async def social_search(
    current_user: User = Depends(get_current_user),
    offer_type: Optional[str] = None,
    reference: Optional[str] = None,
    country_code: Optional[str] = None,
    brand: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    Search social media (WhatsApp) imported messages.
    Filter by offer type (WTS/WTB), reference number, and country.
    """
    query_conditions = []

    # Filter by offer type
    if offer_type:
        if offer_type.lower() == "wts":
            query_conditions.append(ExtractedWatchListing.offer_type == OfferType.WTS)
        elif offer_type.lower() == "wtb":
            query_conditions.append(ExtractedWatchListing.offer_type == OfferType.WTB)

    # Filter by reference number (partial match)
    if reference:
        query_conditions.append({"reference": {"$regex": reference, "$options": "i"}})

    # Filter by country
    if country_code:
        query_conditions.append(ExtractedWatchListing.country_code == country_code.upper())

    # Filter by brand (partial match)
    if brand:
        query_conditions.append({"brand": {"$regex": brand, "$options": "i"}})

    # Execute query
    if query_conditions:
        listings = await ExtractedWatchListing.find(
            *query_conditions
        ).sort([("message_timestamp", -1)]).skip(skip).limit(limit).to_list()

        # Get total count
        total = await ExtractedWatchListing.find(*query_conditions).count()
    else:
        listings = await ExtractedWatchListing.find_all().sort(
            [("message_timestamp", -1)]
        ).skip(skip).limit(limit).to_list()

        total = await ExtractedWatchListing.find_all().count()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "results": [
            {
                "id": str(lst.id),
                "brand": lst.brand,
                "reference": lst.reference,
                "price": lst.price,
                "currency": lst.currency,
                "condition": lst.condition,
                "seller_name": lst.seller_name,
                "seller_phone": lst.seller_phone,
                "raw_text": lst.raw_text,
                "offer_type": lst.offer_type.value if lst.offer_type else "unknown",
                "country_code": lst.country_code,
                "country_name": lst.country_name,
                "month_year": lst.month_year,
                "message_timestamp": lst.message_timestamp,
            }
            for lst in listings
        ]
    }


@router.get("/social/countries")
async def get_available_countries(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get list of countries available in the social search data"""
    # Get distinct country codes from the database
    pipeline = [
        {"$match": {"country_code": {"$ne": None}}},
        {"$group": {"_id": {"code": "$country_code", "name": "$country_name"}}},
        {"$sort": {"_id.name": 1}}
    ]

    results = await ExtractedWatchListing.aggregate(pipeline).to_list()

    countries = [
        {"code": r["_id"]["code"], "name": r["_id"]["name"]}
        for r in results if r["_id"]["code"]
    ]

    return {"countries": countries}
