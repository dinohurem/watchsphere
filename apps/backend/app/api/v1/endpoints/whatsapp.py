from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from datetime import datetime
from beanie import PydanticObjectId
import re
import zipfile
import io

from app.core.deps import get_current_admin_user, get_current_user
from app.models.user import User
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


class ExtractedListingResponse(BaseModel):
    id: str
    import_id: str
    brand: Optional[str] = None
    reference: Optional[str] = None
    model: Optional[str] = None
    price: Optional[float] = None
    currency: str
    condition: Optional[str] = None
    seller_name: Optional[str] = None
    raw_text: str
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


@router.post("/admin/whatsapp/import", response_model=ImportResponse)
async def admin_import_whatsapp(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin_user),
) -> Any:
    """Import WhatsApp chat from .zip file (Admin only)"""

    if not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .zip file"
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
        # Read zip file
        content = await file.read()
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

        # Save messages
        for msg in messages:
            message = WhatsAppMessage(
                import_id=str(import_record.id),
                timestamp=msg["timestamp"],
                sender=msg["sender"],
                content=msg["content"],
            )
            await message.insert()

        # Save extracted listings
        for watch in extracted_watches:
            listing = ExtractedWatchListing(
                import_id=str(import_record.id),
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
            await listing.insert()

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
    }


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
            "model": lst.model,
            "price": lst.price,
            "currency": lst.currency,
            "condition": lst.condition,
            "seller_name": lst.seller_name,
            "raw_text": lst.raw_text,
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
                "price": lst.price,
                "currency": lst.currency,
                "condition": lst.condition,
                "seller_name": lst.seller_name,
                "raw_text": lst.raw_text,
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
