from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import asyncio
import re
import zipfile
import csv
import io

from app.core.deps import get_current_admin_user, get_current_user
from app.models.user import User
from app.models.watch import Watch, WatchStatus
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.whatsapp_import import (
    WhatsAppImport, WhatsAppMessage, ExtractedWatchListing, ImportStatus, OfferType
)

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
                country_name = patterns[0].title() if patterns else code
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


COUNTRY_NAMES = {
    "US": "United States", "UK": "United Kingdom", "DE": "Germany", "IT": "Italy",
    "FR": "France", "CH": "Switzerland", "AE": "United Arab Emirates", "HK": "Hong Kong",
    "SG": "Singapore", "JP": "Japan", "AU": "Australia", "CA": "Canada",
    "NL": "Netherlands", "ES": "Spain", "AT": "Austria", "BE": "Belgium",
    "PT": "Portugal", "SE": "Sweden", "DK": "Denmark", "NO": "Norway",
    "PL": "Poland", "CZ": "Czech Republic", "TW": "Taiwan", "KR": "South Korea",
    "TH": "Thailand", "MY": "Malaysia", "PH": "Philippines", "IN": "India",
    "BR": "Brazil", "MX": "Mexico", "SA": "Saudi Arabia", "QA": "Qatar",
    "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman",
}


def parse_csv_price(price_str: str) -> tuple[Optional[float], str]:
    """Parse price string like '62.000 HKD' → (62000.0, 'HKD')"""
    if not price_str or not price_str.strip():
        return None, "EUR"
    price_str = price_str.strip()
    # Extract currency (last word if it's letters)
    parts = price_str.split()
    currency = "EUR"
    numeric_part = price_str
    if len(parts) >= 2 and parts[-1].isalpha():
        currency = parts[-1].upper()
        numeric_part = " ".join(parts[:-1])
    # Handle European number format: 62.000 = 62000, 62.500,50 etc.
    # If there's a dot followed by exactly 3 digits and no comma → thousands separator
    numeric_part = numeric_part.strip()
    if re.match(r'^[\d.]+$', numeric_part):
        # All dots are thousands separators (e.g., 62.000 or 1.234.567)
        numeric_part = numeric_part.replace('.', '')
    elif ',' in numeric_part:
        # Comma is decimal separator
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


async def _trigger_alerts_for_imported_orders(orders: list):
    """Trigger watch alerts for bulk-imported orders"""
    try:
        from app.models.watch_alert import WatchAlert
        from app.services.notifications import send_push_to_user
        from app.models.notification import Notification, NotificationType as NotifType

        orders_by_ws_code: dict[str, list] = {}
        for order in orders:
            ws_code = getattr(order, 'ws_code', None)
            if ws_code:
                orders_by_ws_code.setdefault(ws_code, []).append(order)

        if not orders_by_ws_code:
            return

        ws_codes = list(orders_by_ws_code.keys())
        alerts = await WatchAlert.find(
            {"ws_code": {"$in": ws_codes}, "is_active": True}
        ).to_list()

        for alert in alerts:
            matching_orders = orders_by_ws_code.get(alert.ws_code, [])
            for order in matching_orders:
                order_type_str = "WTS" if order.order_type == OrderType.SELL else "WTB"

                if order.order_type == OrderType.SELL and not alert.notify_wts:
                    continue
                if order.order_type == OrderType.BUY and not alert.notify_wtb:
                    continue
                if alert.target_year:
                    order_year = getattr(order, 'year', None)
                    if order_year is None:
                        continue
                    year_dir = getattr(alert, 'year_direction', 'exactly')
                    if year_dir == "exactly" and order_year != alert.target_year:
                        continue
                    if year_dir == "newer" and order_year < alert.target_year:
                        continue
                    if year_dir == "older" and order_year > alert.target_year:
                        continue
                if alert.price_threshold and order.price:
                    if alert.price_direction == "below" and order.price > alert.price_threshold:
                        continue
                    if alert.price_direction == "above" and order.price < alert.price_threshold:
                        continue

                user = await User.get(PydanticObjectId(alert.user_id))
                if not user:
                    continue

                title = f"New {order_type_str} for {alert.ws_code}"
                body = f"{order.price} {order.currency}" if order.price else f"New {order_type_str} order"

                notification = Notification(
                    user_id=alert.user_id,
                    type=NotifType.WATCHLIST_ALERT,
                    title=title,
                    body=body,
                    reference=order.reference,
                    order_id=str(order.id),
                    price=order.price,
                    currency=order.currency or "EUR",
                )
                await notification.insert()

                await send_push_to_user(user, title=title, body=body, data={
                    "type": "watch_alert",
                    "ws_code": alert.ws_code,
                    "reference": order.reference or "",
                })
                break

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error triggering alerts for imported orders: {e}", exc_info=True)


async def process_csv_import(
    csv_content: str,
    import_record: WhatsAppImport,
    admin: User,
) -> dict:
    """Process CSV import. Returns stats dict."""
    # Remove BOM if present
    if csv_content.startswith('\ufeff'):
        csv_content = csv_content[1:]

    reader = csv.DictReader(io.StringIO(csv_content))
    # Preserve headers for unmatched CSV output
    fieldnames = reader.fieldnames or []

    # Build a cache of watches by ws_code (strict match only)
    all_watches = await Watch.find(Watch.status == "active").to_list()
    watch_by_ws_code: dict[str, Watch] = {}
    for w in all_watches:
        if w.ws_code:
            watch_by_ws_code[w.ws_code.strip().upper()] = w

    # Build a set of existing orders for deduplication
    # Key: (reference_upper, phone, price, order_type)
    existing_orders = await Order.find(Order.status == OrderStatus.ACTIVE).to_list()
    existing_order_keys: set[tuple] = set()
    for o in existing_orders:
        key = (
            o.reference.upper() if o.reference else "",
            o.whatsapp_phone or o.user_name or "",
            o.price,
            o.order_type.value,
        )
        existing_order_keys.add(key)

    import_id = str(import_record.id)
    admin_id = str(admin.id)
    listing_docs = []
    order_docs = []
    unmatched_raw_rows: list[dict] = []
    total_rows = 0
    matched_count = 0
    unmatched_count = 0
    skipped_dupes = 0
    group_name = None

    for row in reader:
        total_rows += 1
        # Map German headers (handle potential variations)
        offer_type_str = (row.get("Nachrichten Art") or row.get("nachrichten art") or "").strip().upper()
        brand = (row.get("Marke") or row.get("marke") or "").strip()
        ws_code = (row.get("WS-Code") or row.get("ws-code") or row.get("WS-code") or "").strip()
        month_year = (row.get("Monat/Jahr") or row.get("monat/jahr") or "").strip()
        location = (row.get("Standort") or row.get("standort") or "").strip().upper()
        condition_str = (row.get("Zustand") or row.get("zustand") or "").strip()
        remarks = (row.get("Remarks") or row.get("remarks") or "").strip()
        price_str = (row.get("Preis") or row.get("preis") or "").strip()
        phone = (row.get("Nummer") or row.get("nummer") or "").strip()
        group = (row.get("Gruppe") or row.get("gruppe") or "").strip()
        posted_at_str = (row.get("Nachricht gepostet am") or row.get("nachricht gepostet am") or "").strip()

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
        watch_year = None
        watch_month = None
        year_raw = None
        # Check for non-standard year formats like "2022+" before parsing
        if month_year and ('+' in month_year or not month_year.replace('/', '').replace(' ', '').isdigit()):
            year_raw = month_year  # Store raw text for display
        if month_year:
            # Still try to parse numeric year even if year_raw is set
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

        # Match strictly by ws_code only — skip if no ws_code match
        matched_watch = None
        if ws_code:
            matched_watch = watch_by_ws_code.get(ws_code.strip().upper())

        if not matched_watch:
            # No ws_code match found — skip this row (count as unmatched)
            unmatched_count += 1
            unmatched_raw_rows.append(row)
            continue

        # Resolve country
        country_code = location if location else None
        country_name = COUNTRY_NAMES.get(country_code, country_code) if country_code else None

        # Resolve condition — store raw text for non-standard conditions
        condition = None
        condition_raw = None
        if condition_str.lower() in ("unworn", "new", "brand new", "nos"):
            condition = "Unworn"
        elif condition_str.lower() in ("used", "good", "excellent", "mint"):
            condition = "Used"
        elif condition_str:
            # Non-standard condition text (e.g., "Unworn only") — default to Unworn, store raw
            condition = "Unworn"
            condition_raw = condition_str

        # Build raw text for social search
        raw_text = f"{offer_type_str} {brand} {ws_code} {price_str}".strip()
        if remarks:
            raw_text += f" - {remarks}"

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
            currency=currency,
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

        # 2. Create Order (order book) — if we have price and offer type
        if price and offer_type != OfferType.UNKNOWN:
            order_type = OrderType.SELL if offer_type == OfferType.WTS else OrderType.BUY
            order_condition = OrderCondition.UNWORN if condition == "Unworn" else OrderCondition.USED
            order_reference = watch_reference or ws_code

            # Deduplication check
            dedup_key = (
                (order_reference or "").upper(),
                phone,
                price,
                order_type.value,
            )
            if dedup_key in existing_order_keys:
                skipped_dupes += 1
                continue

            # Mark as existing so future rows in this import also dedupe
            existing_order_keys.add(dedup_key)
            matched_count += 1

            order_docs.append(Order(
                order_type=order_type,
                brand=watch_brand,
                model=watch_model,
                reference=order_reference,
                watch_id=str(matched_watch.id),
                price=price,
                currency=currency,
                condition=order_condition,
                country_code=country_code or "CH",
                country_name=country_name,
                user_id=admin_id,
                user_name=phone,
                whatsapp_phone=phone,
                ws_code=matched_watch.ws_code or (ws_code or None),
                aliases=matched_watch.aliases or [],
                year=watch_year,
                watch_month=watch_month,
                year_raw=year_raw,
                condition_raw=condition_raw,
                remarks=remarks or None,
                notes=f"Imported from {group or 'CSV'}. {remarks}".strip() if remarks else f"Imported from {group or 'CSV'}",
                description=ws_code if ws_code != order_reference else None,
                status=OrderStatus.ACTIVE,
                created_at=message_timestamp or datetime.utcnow(),
            ))

    # Bulk insert
    BATCH_SIZE = 500
    if listing_docs:
        for i in range(0, len(listing_docs), BATCH_SIZE):
            await ExtractedWatchListing.insert_many(listing_docs[i:i + BATCH_SIZE])

    if order_docs:
        for i in range(0, len(order_docs), BATCH_SIZE):
            await Order.insert_many(order_docs[i:i + BATCH_SIZE])

        # Update order counts on matched watches
        ref_counts: dict[str, int] = {}
        for o in order_docs:
            ref_counts[o.reference] = ref_counts.get(o.reference, 0) + 1
        for ref, count in ref_counts.items():
            await Watch.find(Watch.reference == ref).update_many({"$inc": {"order_count": count}})

        asyncio.create_task(_trigger_alerts_for_imported_orders(order_docs))

    # Build unmatched CSV content for download
    unmatched_csv_str = None
    if unmatched_raw_rows and fieldnames:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for urow in unmatched_raw_rows:
            writer.writerow(urow)
        unmatched_csv_str = output.getvalue()

    # Update import record
    import_record.group_name = group_name or "CSV Import"
    import_record.status = ImportStatus.COMPLETED
    import_record.total_messages = total_rows
    import_record.extracted_watches = len(listing_docs)
    import_record.matched_orders = matched_count
    import_record.unmatched_rows = unmatched_count
    import_record.skipped_duplicates = skipped_dupes
    import_record.unmatched_csv = unmatched_csv_str
    import_record.completed_at = datetime.utcnow()
    await import_record.save()

    return {
        "total_rows": total_rows,
        "extracted_listings": len(listing_docs),
        "matched_orders": matched_count,
        "unmatched_rows": unmatched_count,
        "skipped_duplicates": skipped_dupes,
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
                "has_unmatched_csv": import_record.unmatched_csv is not None,
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
            "has_unmatched_csv": imp.unmatched_csv is not None,
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
        "has_unmatched_csv": imp.unmatched_csv is not None,
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

    if not imp.unmatched_csv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No unmatched rows for this import"
        )

    return Response(
        content=imp.unmatched_csv,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="unmatched-{imp.filename}"'
        },
    )


@router.get("/admin/whatsapp/imports/{import_id}/listings", response_model=List[ExtractedListingResponse])
async def admin_get_import_listings(
    import_id: str,
    current_admin: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Get extracted watch listings from an import (Admin only)"""

    listings = await ExtractedWatchListing.find(
        ExtractedWatchListing.import_id == import_id
    ).sort([("message_timestamp", -1)]).skip(skip).limit(limit).to_list()

    return [
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
    ]


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
