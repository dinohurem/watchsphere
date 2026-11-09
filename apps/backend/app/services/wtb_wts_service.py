import asyncio
import re
import csv
import io
import json
import logging
from datetime import datetime
from typing import Optional
from app.models.watch import Watch
from app.services.vision_matching import (
    disambiguate_variant,
    extract_attachment_names,
    extract_missing_month_year,
    gather_limited,
    message_images,
    strip_attachment_markers,
)
from app.services import remark_rules
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

# Phone prefix to country code mapping
PHONE_PREFIX_TO_COUNTRY = {
    "1": "US",
    "7": "RU",
    "20": "EG",
    "27": "ZA",
    "30": "GR",
    "31": "NL",
    "32": "BE",
    "33": "FR",
    "34": "ES",
    "36": "HU",
    "39": "IT",
    "40": "RO",
    "41": "CH",
    "43": "AT",
    "44": "UK",
    "45": "DK",
    "46": "SE",
    "47": "NO",
    "48": "PL",
    "49": "DE",
    "51": "PE",
    "52": "MX",
    "53": "CU",
    "54": "AR",
    "55": "BR",
    "56": "CL",
    "57": "CO",
    "58": "VE",
    "60": "MY",
    "61": "AU",
    "62": "ID",
    "63": "PH",
    "64": "NZ",
    "65": "SG",
    "66": "TH",
    "81": "JP",
    "82": "KR",
    "84": "VN",
    "86": "CN",
    "90": "TR",
    "91": "IN",
    "92": "PK",
    "93": "AF",
    "94": "LK",
    "95": "MM",
    "98": "IR",
    "212": "MA",
    "213": "DZ",
    "216": "TN",
    "218": "LY",
    "220": "GM",
    "221": "SN",
    "234": "NG",
    "254": "KE",
    "255": "TZ",
    "256": "UG",
    "260": "ZM",
    "263": "ZW",
    "351": "PT",
    "352": "LU",
    "353": "IE",
    "354": "IS",
    "356": "MT",
    "358": "FI",
    "370": "LT",
    "371": "LV",
    "372": "EE",
    "380": "UA",
    "381": "RS",
    "385": "HR",
    "386": "SI",
    "420": "CZ",
    "421": "SK",
    "852": "HK",
    "853": "MO",
    "855": "KH",
    "856": "LA",
    "880": "BD",
    "886": "TW",
    "960": "MV",
    "961": "LB",
    "962": "JO",
    "963": "SY",
    "964": "IQ",
    "965": "KW",
    "966": "SA",
    "967": "YE",
    "968": "OM",
    "970": "PS",
    "971": "AE",
    "972": "IL",
    "973": "BH",
    "974": "QA",
    "975": "BT",
    "976": "MN",
    "977": "NP",
    "992": "TJ",
    "993": "TM",
    "994": "AZ",
    "995": "GE",
    "996": "KG",
    "998": "UZ",
}

HKD_DEFAULT_COUNTRIES = {"HK", "CN", "MO", "SG"}
EUR_DEFAULT_COUNTRIES = {
    # Eurozone
    "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "IE", "FI", "GR", "LU",
    "SK", "SI", "EE", "LV", "LT", "MT", "CY", "HR",
}
GBP_DEFAULT_COUNTRIES = {"UK", "GB"}
CHF_DEFAULT_COUNTRIES = {"CH"}


def _default_currency_for_country(sender_country: Optional[str]) -> str:
    """Pick the default currency for a bare price when sender country is known.
    Falls back to USD when country is unknown or not in any mapping."""
    if not sender_country:
        return "USD"
    c = sender_country.upper()
    if c in HKD_DEFAULT_COUNTRIES:
        return "HKD"
    if c in EUR_DEFAULT_COUNTRIES:
        return "EUR"
    if c in GBP_DEFAULT_COUNTRIES:
        return "GBP"
    if c in CHF_DEFAULT_COUNTRIES:
        return "CHF"
    return "USD"

COUNTRY_NAMES = {
    "US": "United States", "UK": "United Kingdom", "DE": "Germany", "IT": "Italy",
    "FR": "France", "CH": "Switzerland", "AE": "United Arab Emirates", "HK": "Hong Kong",
    "SG": "Singapore", "JP": "Japan", "AU": "Australia", "CA": "Canada",
    "NL": "Netherlands", "ES": "Spain", "AT": "Austria", "BE": "Belgium",
    "PT": "Portugal", "SE": "Sweden", "DK": "Denmark", "NO": "Norway",
    "PL": "Poland", "CZ": "Czech Republic", "TW": "Taiwan", "KR": "South Korea",
    "TH": "Thailand", "MY": "Malaysia", "PH": "Philippines", "IN": "India",
    "BR": "Brazil", "MX": "Mexico", "SA": "Saudi Arabia", "QA": "Qatar",
    "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman", "CN": "China",
    "MO": "Macau", "RU": "Russia", "TR": "Turkey", "EG": "Egypt",
    "ZA": "South Africa", "NZ": "New Zealand", "ID": "Indonesia",
    "VN": "Vietnam", "IE": "Ireland", "FI": "Finland", "HR": "Croatia",
    "RS": "Serbia", "UA": "Ukraine", "RO": "Romania", "HU": "Hungary",
    "GR": "Greece", "IL": "Israel", "JO": "Jordan", "LB": "Lebanon",
    "NG": "Nigeria", "KE": "Kenya", "GE": "Georgia", "LU": "Luxembourg",
    "MT": "Malta", "IS": "Iceland",
}

WTS_LOCATION_PATTERNS = {
    "HK": [r"\bin\s+hk\b", r"\bhk\s+deal\b", r"\bwatch\s+in\s+hk\b", r"\bhong\s+kong\b", r"\blocated?\s+(?:in\s+)?hk\b"],
    "US": [r"\bin\s+(?:us|usa)\b", r"\bwatch\s+in\s+(?:us|usa)\b", r"\blocated?\s+(?:in\s+)?(?:us|usa)\b", r"\bunited\s+states\b"],
    "UK": [r"\bin\s+uk\b", r"\bwatch\s+in\s+uk\b", r"\blocated?\s+(?:in\s+)?uk\b", r"\bengland\b", r"\bunited\s+kingdom\b"],
    "DE": [r"\bin\s+(?:de|germany)\b", r"\bwatch\s+in\s+(?:de|germany)\b", r"\blocated?\s+(?:in\s+)?(?:de|germany)\b", r"\bdeutschland\b"],
    "CH": [r"\bin\s+(?:ch|switzerland)\b", r"\bwatch\s+in\s+(?:ch|switzerland)\b", r"\bswiss\b"],
    "AE": [r"\bin\s+(?:uae|dubai)\b", r"\bwatch\s+in\s+(?:uae|dubai)\b", r"\bemirates\b", r"\babu\s+dhabi\b"],
    "SG": [r"\bin\s+(?:sg|singapore)\b", r"\bwatch\s+in\s+(?:sg|singapore)\b"],
    "JP": [r"\bin\s+(?:jp|japan)\b", r"\bwatch\s+in\s+(?:jp|japan)\b"],
    "NL": [r"\bin\s+(?:nl|netherlands|holland)\b"],
    "IT": [r"\bin\s+(?:it|italy)\b", r"\bitalia\b"],
    "FR": [r"\bin\s+(?:fr|france)\b"],
    "AU": [r"\bin\s+(?:au|australia)\b"],
    "CA": [r"\bin\s+(?:ca|canada)\b"],
}

WTS_CONDITIONS = {
    "brand new": "Unworn", "bnib": "Unworn", "b.n.i.b": "Unworn",
    "fresh": "Unworn", "unworn": "Unworn", "un-worn": "Unworn",
    "stickered": "Unworn", "sealed": "Unworn", "unsized": "Unworn",
    "new": "Unworn", "nos": "Unworn",
    "like new": "Used",
    "retail ready": "Retail Ready",
    "handling marks": "Handling Marks", "handling mark": "Handling Marks",
    "polished": "Polished",
    "used": "Used", "worn": "Used", "pre-owned": "Used", "preowned": "Used",
}

WTB_CONDITIONS = {
    "unworn": "Only Unworn", "new": "Only Unworn", "only unworn": "Only Unworn", "unworn only": "Only Unworn",
    "used": "Can be Used", "can be used": "Can be Used", "used ok": "Can be Used", "used fine": "Can be Used",
}

WTS_KEYWORDS = ["wts", "want to sell", "for sale", "selling", "fs", "stock list", "stocklist", "price list", "pricelist"]
WTB_KEYWORDS = ["wtb", "want to buy", "looking for", "lf"]

# Patterns that skip the ENTIRE message (structural markers — deleted, system).
SKIP_PATTERNS = [
    r'diese nachricht wurde gel[öo]scht',
    r'this message was deleted',
    r'you deleted this message',
]

# Media markers — only cause skip when they make up the ENTIRE message
# (i.e. a media-only message with no listing content). If these appear
# alongside watch data they should be stripped, not skipped.
MEDIA_MARKERS = [
    r'bild weggelassen',
    r'video weggelassen',
    r'<media omitted>',
    r'media omitted',
    r'sticker weggelassen',
    r'audio weggelassen',
    r'dokument weggelassen',
    r'gif weggelassen',
    r'kontaktkarte weggelassen',
    r'standort weggelassen',
    r'image omitted',
]
_MEDIA_RE = re.compile('|'.join(MEDIA_MARKERS), re.IGNORECASE)

# Whole-message SOLD markers: messages that are purely a SOLD notification.
# A single-line message ending with "SOLD" / "- SOLD" is a status change.
# But "SOLD" appearing on one line inside a stock list shouldn't skip the
# whole list — that line is handled separately in parse_stock_list.
_SOLD_ONLY_RE = re.compile(r'^\s*[\w/\-\s\u0080-\uffff\*🏷️]*\s*-?\s*sold\s*$', re.IGNORECASE)

# Compiled regex for structural skip detection (case-insensitive)
_SKIP_RE = re.compile('|'.join(SKIP_PATTERNS), re.IGNORECASE)

# Remarks (generator spec §6, appendix A). The editable source of truth is the
# RemarkRule collection (admin panel), loaded at every run; this map mirrors the
# built-in defaults for callers that only need the trigger → remark lookup.
REMARKS_MAP = {
    trigger: remark
    for remark, _category, _mode, triggers in remark_rules.DEFAULT_REMARK_RULES
    for trigger in triggers
}

# Config used by normalize_remarks during a run (set by process_generation from
# the database; None = built-in defaults).
_ACTIVE_REMARK_CONFIG: Optional["remark_rules.RemarkConfig"] = None


# Brand abbreviation/nickname mapping (lowercase -> canonical brand name)
BRAND_ALIASES = {
    "pp": "Patek Philippe",
    "patek": "Patek Philippe",
    "patek philippe": "Patek Philippe",
    "ap": "Audemars Piguet",
    "audemars piguet": "Audemars Piguet",
    "audemars": "Audemars Piguet",
    "rm": "Richard Mille",
    "richard mille": "Richard Mille",
    "richard miller": "Richard Mille",
    "fpj": "F.P. Journe",
    "f.p. journe": "F.P. Journe",
    "fp journe": "F.P. Journe",
    "rolex": "Rolex",
    "omega": "Omega",
    "cartier": "Cartier",
    "hublot": "Hublot",
    "jlc": "Jaeger-LeCoultre",
    "jaeger-lecoultre": "Jaeger-LeCoultre",
    "jaeger lecoultre": "Jaeger-LeCoultre",
    "vc": "Vacheron Constantin",
    "vacheron": "Vacheron Constantin",
    "vacheron constantin": "Vacheron Constantin",
    "iwc": "IWC",
    "breitling": "Breitling",
    "tudor": "Tudor",
    "panerai": "Panerai",
    "tag heuer": "Tag Heuer",
    "tag": "Tag Heuer",
    "lange": "A. Lange & Sohne",
    "a. lange": "A. Lange & Sohne",
    "a. lange & sohne": "A. Lange & Sohne",
    "chopard": "Chopard",
    "gp": "Girard-Perregaux",
    "girard-perregaux": "Girard-Perregaux",
    "zenith": "Zenith",
    "blancpain": "Blancpain",
    "bp": "Blancpain",
    "mb&f": "MB&F",
    "mbf": "MB&F",
    "moser": "H. Moser & Cie",
    "h. moser": "H. Moser & Cie",
    "breguet": "Breguet",
    "piaget": "Piaget",
    "franck muller": "Franck Muller",
    "fm": "Franck Muller",
}

# Common dealer abbreviations for watch descriptors
# Maps abbreviation -> canonical name used in ws_codes
WATCH_DESCRIPTOR_ALIASES = {
    "jub": "Jubilee",
    "jubilee": "Jubilee",
    "oys": "Oyster",
    "oyster": "Oyster",
    "wim": "Wimbledon",
    "wimbledon": "Wimbledon",
    "gnrn": "Green/Black",  # Sprite GMT
    "grnr": "Green/Black",  # Sprite GMT (alt spelling)
    "blnr": "Blue/Black",   # Batman GMT
    "blro": "Blue/Red",     # Pepsi GMT
    "vtnr": "Green/Black",  # Destro GMT
    "chnr": "Chocolate/Black",  # Root Beer GMT
    "rom": "Roman",
    "roma": "Roman",
    "roman": "Roman",
    "choc": "Chocolate",
    "choco": "Chocolate",
    "cho": "Chocolate",
    "chocolate": "Chocolate",
    "yml": "YML",            # Yellow dial
    "pn": "Paul Newman",
    "paul newman": "Paul Newman",
    "tbr": "Tiger",          # Tiger bracelet
    "sundust": "Sundust",
    "sun": "Sundust",
    "tiff": "Tiffany",
    "tiffany": "Tiffany",
    "sodalite": "Sodalite",
    "turqoise": "Turquoise",
    "turquoise": "Turquoise",
    "pistachio": "Pistachio",
    "ice blue": "Ice Blue",
    # Color abbreviations commonly used in stock lists
    "blk": "Black",
    "black": "Black",
    "wht": "White",
    "white": "White",
    "blu": "Blue",
    "blue": "Blue",
    "grn": "Green",
    "green": "Green",
    "grey": "Grey",
    "gray": "Grey",
    "red": "Red",
    "pink": "Pink",
    "purple": "Purple",
    "champ": "Champagne",
    "champagne": "Champagne",
    "gold": "Gold",
    "silver": "Silver",
    "slate": "Slate",
    "brown": "Brown",
    "lavender": "Lavender",
    "mete": "Meteorite",
    "meteorite": "Meteorite",
    "onyx": "Onyx",
    "pave": "Paved",
    "paved": "Paved",
    # Additional abbreviations found in dealer messages
    "bk": "Black",       # "228238a bk" = Black variant
    "wh": "White",
    "omb": "Ombre",
    "motif": "Fluted",   # dealer "motif" = catalog "fluted"
    "fluted": "Fluted",
    "ombre": "Ombre",    # "228239 ombré blue" — accent-stripped version
    "ombrè": "Ombre",
    "ombré": "Ombre",
    "bright": "Bright",
    "rainbow": "Rainbow",
    "ice": "Ice Blue",   # "228396A ice blue" — "ice" alone implies Ice Blue
    "mop": "MOP",        # Mother of Pearl
    "ruby": "Ruby",
    "sapphire": "Sapphire",
    # --- Multilingual color names -----------------------------------------
    # So "126334 Blau" (DE) or "126334 azul" (ES) match the same watch as
    # "126334 Blue" without requiring a per-locale alias in the catalog.
    # German
    "schwarz": "Black",
    "weiss": "White",
    "weiß": "White",
    "blau": "Blue",
    "grün": "Green",
    "gruen": "Green",
    "rot": "Red",
    "grau": "Grey",
    "braun": "Brown",
    "silber": "Silver",
    "römisch": "Roman",
    "roemisch": "Roman",
    # Spanish
    "negro": "Black",
    "blanco": "White",
    "azul": "Blue",
    "verde": "Green",  # also Italian
    "rojo": "Red",
    "gris": "Grey",  # also French
    "marron": "Brown",  # also French
    "marrón": "Brown",
    "plata": "Silver",
    "plateado": "Silver",
    "dorado": "Gold",
    "romano": "Roman",  # also Italian
    # French
    "noir": "Black",
    "blanc": "White",
    "bleu": "Blue",
    "vert": "Green",
    "rouge": "Red",
    "argent": "Silver",
    "romain": "Roman",
    # Italian
    "nero": "Black",
    "bianco": "White",
    # "blu" already mapped to Blue above
    # "verde" already mapped above
    "rosso": "Red",
    "grigio": "Grey",
    "marrone": "Brown",
    "argento": "Silver",
    # Bosnian / Croatian / Serbian
    "crna": "Black",
    "crno": "Black",
    "bijela": "White",
    "bijelo": "White",
    "bela": "White",
    "belo": "White",
    "plava": "Blue",
    "plavo": "Blue",
    "zelena": "Green",
    "zeleno": "Green",
    "crvena": "Red",
    "crveno": "Red",
    "siva": "Grey",
    "sivo": "Grey",
    "smeđa": "Brown",
    "smedja": "Brown",
    "srebrna": "Silver",
    "srebrno": "Silver",
    "zlatna": "Gold",
    "zlatno": "Gold",
    "roza": "Pink",
}

CSV_HEADERS = [
    "Nachrichten Art",
    "Marke",
    "WS-Code",
    "Monat/Jahr",
    "Standort",
    "Zustand",
    "Bemerkungen",
    "Preis",
    "Nummer",
    "Gruppe",
    "Nachricht gepostet am",
]

# Minimum price thresholds by brand (in USD equivalent).
# Prices below these values are likely parsing errors (ref or year captured as price).
BRAND_MIN_PRICES = {
    "Rolex": 3000,
    "Patek Philippe": 8000,
    "Audemars Piguet": 5000,
    "Richard Mille": 30000,
    "F.P. Journe": 15000,
    "A. Lange & Sohne": 8000,
    "Vacheron Constantin": 5000,
    "Omega": 1000,
    "Cartier": 1000,
    "Hublot": 2000,
    "Jaeger-LeCoultre": 2000,
    "IWC": 1500,
    "Breitling": 1000,
    "Tudor": 1000,
    "Panerai": 1500,
    "Tag Heuer": 500,
    "Chopard": 2000,
    "Girard-Perregaux": 2000,
    "Zenith": 1500,
    "Blancpain": 3000,
    "MB&F": 20000,
    "H. Moser & Cie": 5000,
    "Breguet": 3000,
    "Piaget": 2000,
    "Franck Muller": 2000,
}
DEFAULT_MIN_PRICE = 500  # Fallback for unknown brands


def validate_price(price_str: Optional[str], brand: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """Validate that a parsed price is reasonable for the brand.
    Returns (is_valid, reason) - if not valid, reason explains why."""
    if not price_str:
        return True, None
    try:
        numeric = float(price_str.replace(",", ""))
    except (ValueError, TypeError):
        return True, None

    if numeric <= 0:
        return False, "Price is zero or negative"

    # Check if price looks like a year (2017-2029)
    if 2010 <= numeric <= 2035:
        return False, f"Price {int(numeric)} looks like a year"

    # Check if price looks like a reference number (4-6 digit number matching common ref patterns)
    price_int = int(numeric)
    if 1000 <= price_int <= 999999 and brand:
        # Common reference number ranges for specific brands
        ref_ranges = {
            "Rolex": (100000, 300000),  # e.g., 126610, 228235
            "Patek Philippe": (3000, 8000),  # e.g., 5711, 5968
            "Audemars Piguet": (10000, 80000),  # e.g., 15500, 26240
        }
        if brand in ref_ranges:
            low, high = ref_ranges[brand]
            if low <= price_int <= high and numeric == price_int:
                # This could be a ref number being parsed as price
                # Only flag if there's no k/m suffix (raw integer)
                pass  # Will be caught by min price check below

    # Check against brand minimum
    min_price = BRAND_MIN_PRICES.get(brand, DEFAULT_MIN_PRICE) if brand else DEFAULT_MIN_PRICE
    if numeric < min_price:
        return False, f"Price {price_str} below minimum {min_price} for {brand or 'unknown brand'}"

    return True, None


def extract_phone_number(sender: str) -> Optional[str]:
    """Extract phone number from WhatsApp sender string.
    Handles formats like: '+852 5203 4944 WS', '+852 6547 2648', '+49 170 1234567'.
    Returns the full phone number with + prefix, or None if sender is a contact name."""
    sender = _normalize_hyphens(_INVISIBLE_CHARS_RE.sub('', (sender or '').replace('\xa0', ' ')))
    # First try to extract a phone pattern from the sender string
    # This handles cases like "+852 5203 4944 WS" where there's a suffix
    m = re.match(r'(\+[\d\s\-\(\)]{7,20})', sender.strip())
    if m:
        cleaned = re.sub(r'[\s\-\(\)]', '', m.group(1))
        if re.match(r'^\+\d{7,15}$', cleaned):
            return cleaned
    # Fallback: try cleaning the whole string
    cleaned = re.sub(r'[\s\-\(\)]', '', sender.strip())
    if re.match(r'^\+\d{7,15}$', cleaned):
        return cleaned
    return None


def get_country_from_phone(phone: str) -> Optional[str]:
    """Derive country code from phone number prefix.
    Tries longest prefix first for correct matching (e.g., +852 before +8)."""
    if not phone or not phone.startswith('+'):
        return None
    digits = phone[1:]
    for length in (3, 2, 1):
        prefix = digits[:length]
        if prefix in PHONE_PREFIX_TO_COUNTRY:
            return PHONE_PREFIX_TO_COUNTRY[prefix]
    return None


# Invisible Unicode characters WhatsApp exports sometimes prefix to lines
# (LRM, RLM, LTR/RTL embedding, zero-width joiners, BOM, etc.). These must
# be stripped before regex matching or lines get mis-classified as
# continuations and messages get merged together.
_INVISIBLE_CHARS_RE = re.compile(
    r'[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060-\u2064\ufeff\xa0]'
)


# Hyphen look-alikes (U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure
# dash, U+2013 en dash, U+2212 minus) — "+81 70‑9138‑7979" uses U+2011.
_HYPHENS_RE = re.compile(r'[\u2010\u2011\u2012\u2013\u2212\ufe63\uff0d]')


def _normalize_hyphens(s: str) -> str:
    return _HYPHENS_RE.sub('-', s)


def _strip_invisible(s: str) -> str:
    """Replace invisible Unicode marks with nothing (and \xa0 with space)."""
    # Replace non-breaking space with regular space, then strip other invisibles
    s = s.replace('\xa0', ' ').replace('\u202f', ' ')
    return _normalize_hyphens(_INVISIBLE_CHARS_RE.sub('', s))


def parse_whatsapp_txt(content: str) -> list[dict]:
    """Parse a WhatsApp .txt export into messages.
    Handles multi-line messages by joining continuation lines.
    Strips invisible Unicode marks (LRM/RLM/LTR/RTL embedding, BOM, \xa0)
    that WhatsApp iOS exports prepend to messages — otherwise the header
    regex fails and lines get merged into the previous message."""
    messages = []
    patterns = [
        r'\[(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)',
        r'(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)',
        r'(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)',
    ]

    current_msg = None

    for raw_line in content.split('\n'):
        line = _strip_invisible(raw_line).strip()
        if not line:
            continue

        matched = False
        for pattern in patterns:
            m = re.match(pattern, line)
            if m:
                if current_msg:
                    messages.append(current_msg)
                date_str, time_str, sender, msg_content = m.groups()
                timestamp = _parse_timestamp(date_str, time_str)
                current_msg = {
                    "timestamp": timestamp,
                    "sender": sender.strip(),
                    "content": msg_content.strip(),
                }
                matched = True
                break

        if not matched and current_msg:
            current_msg["content"] += "\n" + line

    if current_msg:
        messages.append(current_msg)

    # Record image attachments per message (used by the optional image-analysis
    # layer) and drop the attachment-only lines so they don't pollute parsing.
    for msg in messages:
        msg["attachments"] = extract_attachment_names(msg["content"])
        if msg["attachments"]:
            msg["content"] = strip_attachment_markers(msg["content"]).strip()

    return messages


def _parse_timestamp(date_str: str, time_str: str) -> datetime:
    """Parse date and time strings into datetime."""
    date_str = date_str.replace('/', '.')
    formats = [
        "%d.%m.%y %H:%M:%S",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%y %H:%M",
        "%d.%m.%Y %H:%M",
    ]
    combined = f"{date_str} {time_str}"
    for fmt in formats:
        try:
            return datetime.strptime(combined, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def _strip_media_markers(content: str) -> str:
    """Remove 'Bild weggelassen' / 'image omitted' markers from a message so the
    underlying watch listing text can still be parsed."""
    return _MEDIA_RE.sub('', content)


def should_skip_message(content: str) -> bool:
    """Check if a message should be skipped entirely.
    Skips: deleted messages, pure SOLD notifications, system messages, pure
    media-only messages. Messages that contain BOTH media markers and actual
    watch listing content are NOT skipped — the media markers are stripped
    during parsing so the listing survives."""
    # Structural skip: deleted messages
    if _SKIP_RE.search(content):
        return True
    # Pure emoji/decorative lines (no alphanumeric content)
    cleaned = _clean_text(content).strip()
    if not cleaned:
        return True
    # System messages (encryption notices, group changes)
    system_patterns = [
        r'end-to-end.*encrypted',
        r'ende-zu-ende.*verschl[üu]sselt',
        r'nachrichtendauer wurde',
        r'messages? and calls? are',
        r'die sicherheitsnummer',
        r'hat die gruppe',
        r'wurde hinzugef[üu]gt',
    ]
    for pattern in system_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            return True

    # Pure SOLD: a single-line message that is just a SOLD status update.
    # Multi-line messages with SOLD inside are handled at line level in parse_stock_list.
    lines = [l.strip() for l in content.split('\n') if l.strip()]
    if len(lines) == 1 and _SOLD_ONLY_RE.match(lines[0]):
        return True

    # Pure media-only: after stripping media markers, nothing remains
    without_media = _strip_media_markers(content)
    without_media_clean = _clean_text(without_media).strip()
    if not without_media_clean:
        return True

    return False


# Aliases of 2-3 letters that also occur in ordinary dealer text ("both tag",
# "AP" inside a sentence). They only count as a brand when directly followed by
# a reference-like token or when they make up the whole line (a header).
SHORT_BRAND_ALIASES = frozenset({"pp", "ap", "rm", "vc", "gp", "bp", "fm", "jlc", "fpj", "tag", "mbf", "mb&f"})


def detect_brand_from_content(content: str) -> Optional[str]:
    """Detect brand mentioned in a message for brand-scoped matching.
    Returns canonical brand name or None. Full brand names count anywhere;
    short aliases ('ap', 'pp', 'tag', …) only in front of a reference or alone
    on a line, so 'both tag' never means TAG Heuer."""
    content_lower = remark_rules.fold(content)
    for alias, brand in sorted(BRAND_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        a = re.escape(alias)
        if alias in SHORT_BRAND_ALIASES:
            pattern = (r'(?:^|(?<=\n))\s*\W*' + a + r'\W*\s*$'
                       r'|(?<![a-z0-9])' + a + r'\s*[:.\-]?\s*(?=[a-z]{0,5}\d{2,})')
            if alias == "tag":
                if re.search(r'(?:white|both)\s*tags?', content_lower):
                    continue
            if re.search(pattern, content_lower, re.MULTILINE):
                return brand
            continue
        pattern = r'(?<![a-zA-Z])' + a + r'(?![a-zA-Z])'
        if re.search(pattern, content_lower):
            return brand
    return None



def _find_keyword_pos(content_lower: str, keywords: list[str]) -> Optional[int]:
    """Find the earliest position of any keyword in content, using word-boundary
    matching so 'looking for' doesn't match inside 'looking forward'."""
    earliest = None
    for kw in keywords:
        # Word boundaries on both sides for multi-word keywords too
        pattern = r'(?<![a-zA-Z])' + re.escape(kw) + r'(?![a-zA-Z])'
        m = re.search(pattern, content_lower)
        if m:
            pos = m.start()
            if earliest is None or pos < earliest:
                earliest = pos
    return earliest


# A number tagged with a currency on either side: "€ 13.199", "69.000€", "46000€",
# "4m hkd", "hkd1.763 m", "S$ 20k", "350k dhs".
_CURRENCY_PRICE_RE = re.compile(
    r'(?:\$|€|£|¥|hk\$|s\$|hkd|usdt|usd|eur|gbp|chf|aed|sgd|cny|rmb|jpy)\s*[\d][\d,.]*'
    r'|\d[\d,.]*[ \t]?[kKmM]?[ \t]*(?:hkd|usdt|usd|eur|euro|gbp|chf|aed|dhs|sgd|cny|rmb|jpy|yen|€|£|¥|\$)(?![a-z])(?![ \t]*:?[ \t]*\d[\d,.]*(?:[ \t]?[kKmM])?(?![A-Za-z0-9]))',
    re.IGNORECASE,
)


def detect_post_type(content: str) -> Optional[str]:
    """Detect if a message is WTS, WTB, or neither. Returns 'WTS', 'WTB', or None.
    Returns None for SOLD, deleted, media, and system messages.

    Both WTS and WTB keywords are checked; if BOTH are present the first one
    found (by position) wins.  This prevents cross-contamination where a long
    stock list has e.g. a WTB sub-section inside a WTS post.

    Uses word-boundary matching so 'looking for' doesn't match inside 'looking
    forward' and 'fs' doesn't match inside 'ofs'."""
    # Skip SOLD, deleted, media, system messages entirely
    if should_skip_message(content):
        return None

    content = _normalize_price_text(content)
    content_lower = content.lower()

    wts_pos = _find_keyword_pos(content_lower, WTS_KEYWORDS)
    wtb_pos = _find_keyword_pos(content_lower, WTB_KEYWORDS)

    def _has_heavy_wts_signal(txt: str) -> bool:
        """A message with multiple currency-tagged prices is a WTS stock list
        regardless of how it starts. Catches messages like 'Looking for USDT
        pay HKD cash' followed by 40 lines of priced inventory."""
        price_hits = len(_CURRENCY_PRICE_RE.findall(txt))
        # 3+ priced lines → definitely a seller's stock list
        return price_hits >= 3

    # If both found, whichever appears first wins — UNLESS the WTB keyword is
    # just a header on an obvious WTS stock list. Only flip when WTB won AND
    # the rest of the message reads as a seller's priced inventory.
    if wts_pos is not None and wtb_pos is not None:
        winner = "WTS" if wts_pos <= wtb_pos else "WTB"
        if winner == "WTB" and _has_heavy_wts_signal(content):
            return "WTS"
        return winner
    if wts_pos is not None:
        return "WTS"
    if wtb_pos is not None:
        # Pure WTB header but body is priced inventory → reclassify as WTS.
        if _has_heavy_wts_signal(content):
            return "WTS"
        return "WTB"

    # Currency-tagged price → clear WTS signal
    has_currency_price = bool(_CURRENCY_PRICE_RE.search(content)) or bool(
        re.search(r'\d\s?k\b', content, re.IGNORECASE))
    if has_currency_price:
        return "WTS"

    # Stock-list style message: ref-shaped token + large number (no currency).
    # Watch dealers often omit currency in their stock lists because context
    # makes it obvious. "5167R N2 790,000" or "126518LN Black N1 397,000"
    # are clearly WTS even without HKD/USD tag.
    # Require: a ref-like token AND a 4+ digit number (typical watch price).
    # Ref pattern: optional letter prefix, 4-6 digits, optional letter/number suffix
    has_ref_like = bool(re.search(
        r'\b[A-Za-z]{0,4}\d{4,6}[A-Za-z]{0,6}(?:[/\-][A-Za-z0-9]+)?\b',
        content,
    ))
    has_big_number = bool(re.search(
        r'\d{3}[,.]\d{3}|\b\d{1,3}[kK]\b|\b\d\.\d+[mM]\b',
        content,
    ))
    if has_ref_like and has_big_number:
        return "WTS"

    return None


def ref_stem(ref: str) -> str:
    """Reference stem: lower case, no spaces, cut at the first '.' or '-'.
    Richard Mille keeps its dash part ('RM07-01' → 'rm07-01')."""
    s = re.sub(r'\s+', '', _normalize_hyphens(ref or '').lower())
    if not s:
        return ""
    m = re.match(r'^rm\d+(?:-\d+)?', s)
    if m:
        return m.group(0)
    return re.split(r'[.\-]', s, maxsplit=1)[0]


def digit_key(ref: str) -> str:
    """All digits of the reference stem: '5980/1A' → '59801', 'RM07-01' → '0701'."""
    return re.sub(r'\D', '', ref_stem(ref))


async def build_watch_index(jsonl_content: Optional[str] = None) -> dict:
    """Build a watch lookup index from database or JSONL.
    Returns dict with by_ws_code, by_oem_ref, by_alias, by_reference, and brands.
    All keys are stored in LOWER CASE for case-insensitive matching."""
    watches = []

    if jsonl_content:
        for line in jsonl_content.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                watches.append({
                    "ws_code": (data.get("ws_code") or "").strip(),
                    "brand": (data.get("brand") or "").strip(),
                    "model": (data.get("model") or "").strip(),
                    "reference": (data.get("reference") or "").strip(),
                    "oem_references": [r.strip() for r in (data.get("oem_references") or [])],
                    "aliases": [a.strip() for a in (data.get("aliases") or [])],
                    "dial": (data.get("dial") or "").strip(),
                    "bracelet": (data.get("bracelet") or "").strip(),
                    "index": (data.get("index") or data.get("indexes") or "").strip(),
                    "cover_image": (data.get("cover_image") or "").strip(),
                    "images": [i for i in (data.get("images") or []) if isinstance(i, str)],
                    "list_prices": data.get("list_prices") or {},
                    "status": (data.get("status") or "active"),
                })
            except json.JSONDecodeError:
                continue
    else:
        # Drafts are matched too (bulk spec §8.2): a watch added to the catalog as
        # a draft must not leave its listings in "not in database".
        db_watches = await Watch.find_all().to_list()

        for w in db_watches:
            watches.append({
                "ws_code": (w.ws_code or "").strip(),
                "brand": (w.brand or "").strip(),
                "model": (w.model or "").strip(),
                "reference": (w.reference or "").strip(),
                "oem_references": [r.strip() for r in (w.oem_references or [])],
                "aliases": [a.strip() for a in (w.aliases or [])],
                "dial": (w.dial or "").strip(),
                "bracelet": (w.bracelet or "").strip(),
                # Index type is not a first-class catalog field yet — fall back
                # to whatever the document carries so the vision layer can use
                # it once it exists.
                "index": (getattr(w, "index", None) or "").strip(),
                "cover_image": (w.cover_image or (w.images[0] if w.images else "") or "").strip(),
                "images": list(w.images or []),
                "list_prices": dict(getattr(w, "list_prices", None) or {}),
                "status": getattr(getattr(w, "status", None), "value", None) or str(getattr(w, "status", "") or ""),
            })

    by_ws_code = {}
    by_oem_ref = {}
    by_alias = {}
    by_reference = {}
    brands_set = set()
    # Map canonical brand name (lowercase) -> list of watches for that brand
    by_brand = {}

    for w in watches:
        brand = w["brand"]
        if brand:
            brands_set.add(brand)
            by_brand.setdefault(brand.lower(), []).append(w)

        ws = w["ws_code"].lower()
        if ws:
            by_ws_code[ws] = w

        ref = w["reference"].lower()
        if ref:
            by_reference.setdefault(ref, []).append(w)

        for oem in w["oem_references"]:
            key = oem.lower()
            if key:
                by_oem_ref.setdefault(key, []).append(w)

        for alias in w["aliases"]:
            key = alias.lower()
            if key:
                by_alias.setdefault(key, []).append(w)

    if not brands_set:
        brands_set = {
            "Rolex", "Patek Philippe", "Audemars Piguet", "Richard Mille",
            "Omega", "Cartier", "Hublot", "Jaeger-LeCoultre",
            "Vacheron Constantin", "IWC", "Breitling", "Tudor",
            "Panerai", "Tag Heuer", "A. Lange & Sohne",
            "Chopard", "Girard-Perregaux", "Zenith", "Blancpain",
        }

    # Reference stems (part before the first "." or "-") and digit keys, so
    # '15210OR' finds '15210OR.OO.A056KB.01' and fuzzy matching stays within the
    # same digit sequence.
    by_stem: dict[str, list[dict]] = {}
    by_digits: dict[str, list[dict]] = {}
    for w in watches:
        keys = [w["reference"]] + w["oem_references"]
        if w["ws_code"]:
            keys.append(w["ws_code"].split()[0])
        seen_keys: set[str] = set()
        for k in keys:
            st = ref_stem(k)
            if st and st not in seen_keys:
                seen_keys.add(st)
                lst = by_stem.setdefault(st, [])
                if w not in lst:
                    lst.append(w)
            dk = digit_key(k)
            if dk and len(dk) >= 3:
                lst = by_digits.setdefault(dk, [])
                if w not in lst:
                    lst.append(w)

    # Build flat list of (searchable_string, watch_dict) for fuzzy matching
    fuzzy_candidates = []
    for w in watches:
        for s in [w["ws_code"], w["reference"]] + w["oem_references"] + w["aliases"]:
            s = s.strip()
            if s:
                fuzzy_candidates.append((s.lower(), w))
    fuzzy_by_digits: dict[str, list[tuple[str, dict]]] = {}
    for s_, w in fuzzy_candidates:
        dk = digit_key(s_)
        if dk:
            fuzzy_by_digits.setdefault(dk, []).append((s_, w))
    fuzzy_by_prefix3: dict[str, list[tuple[str, dict]]] = {}
    for dk, lst in fuzzy_by_digits.items():
        if len(dk) >= 3:
            fuzzy_by_prefix3.setdefault(dk[:3], []).extend(lst)

    # Pre-compile combined regex patterns for fast match_watch() lookups.
    # Instead of iterating every key and running re.search() per key,
    # we build ONE alternation regex per dict that matches any key at word boundaries.
    def _build_combined_pattern(keys):
        """Build a single compiled regex that matches any of the given keys at word boundaries."""
        valid = [k for k in keys if k]
        if not valid:
            return None
        # Sort by length descending so longer keys match first (e.g., "126710blnr jub" before "126710blnr")
        valid.sort(key=len, reverse=True)
        alternation = "|".join(re.escape(k) for k in valid)
        return re.compile(r'(?<![a-zA-Z0-9])(?:' + alternation + r')(?![a-zA-Z0-9])')

    def _build_combined_pattern_ref(keys):
        """Like _build_combined_pattern but with /- allowed after match (for references)."""
        valid = [k for k in keys if k]
        if not valid:
            return None
        valid.sort(key=len, reverse=True)
        alternation = "|".join(re.escape(k) for k in valid)
        return re.compile(r'(?<![a-zA-Z0-9])(?:' + alternation + r')(?![a-zA-Z0-9/\-])')

    ws_code_pattern = _build_combined_pattern(by_ws_code.keys())
    reference_pattern = _build_combined_pattern_ref(by_reference.keys())
    oem_ref_pattern = _build_combined_pattern(by_oem_ref.keys())
    alias_pattern = _build_combined_pattern(by_alias.keys())

    return {
        "by_ws_code": by_ws_code,
        "by_oem_ref": by_oem_ref,
        "by_alias": by_alias,
        "by_reference": by_reference,
        "by_brand": by_brand,
        "by_stem": by_stem,
        "by_digits": by_digits,
        "brands": sorted(brands_set),
        "fuzzy_candidates": fuzzy_candidates,
        "fuzzy_by_digits": fuzzy_by_digits,
        "fuzzy_by_prefix3": fuzzy_by_prefix3,
        # Pre-compiled combined patterns for match_watch()
        "_ws_code_pattern": ws_code_pattern,
        "_reference_pattern": reference_pattern,
        "_oem_ref_pattern": oem_ref_pattern,
        "_alias_pattern": alias_pattern,
    }


# Dealer typos of currency codes → canonical code (generator spec §4).
_CURRENCY_TYPO_RE = re.compile(r'(?<![a-z])(?:hkld|khd|hkdd|hkkd|h\s+kd)(?![a-z])', re.IGNORECASE)
# "HKD//390k", "usdt : 35k" → "HKD 390k", "usdt 35k"
_CURRENCY_SEP_RE = re.compile(
    r'(?<![a-z])(hk\$|hkd|usdt|usd|eur|gbp|chf|aed|sgd|cny|rmb|jpy)\s*(?:/{1,3}|:)\s*(?=\d)', re.IGNORECASE)


def _normalize_price_text(text: str) -> str:
    """Fix currency spellings before any price/currency regex runs."""
    if not text:
        return text
    text = text.replace('💲', '$').replace('：', ':').replace('＄', '$')
    text = _CURRENCY_TYPO_RE.sub('hkd', text)
    text = _CURRENCY_SEP_RE.sub(lambda m: m.group(1) + ' ', text)
    return text


_EMOJI_RE = re.compile(
    r'[\U0001F300-\U0001FAFF'   # Misc Symbols, Emoticons, Dingbats, Transport, etc.
    r'\U00002702-\U000027B0'    # Dingbats
    r'\U0000FE00-\U0000FE0F'    # Variation selectors
    r'\U0000200D'               # Zero-width joiner
    r'\U0001F100-\U0001F1FF'    # Enclosed alphanumerics + regional indicators (🆕 = U+1F195)
    r'\U00002600-\U000026FF'    # Misc symbols
    r'\U00002300-\U000023FF'    # Misc technical
    r'\U0000200B-\U0000200F'    # Zero-width spaces
    r'\u2190-\u21FF'            # Arrows (→ ⇒ ➔ lists)
    r'\u25A0-\u25FF'            # Geometric shapes (▶ ▪ ●)
    r'\u2022\u2023\u2043\u00B7'  # Bullets (• ‣ ⁃ ·)
    r'\uFF5C\u2502\u2503'       # Full-width / box-drawing vertical bars (｜ │)
    r']+'
)

# LRU cache for _clean_text to avoid re-cleaning the same lines
_clean_text_cache: dict[str, str] = {}


def _clean_text(text: str) -> str:
    """Remove emoji and special decorative chars from text. Results are cached.
    Emoji are replaced with a space so adjacent tokens stay separated
    (e.g. '26240ce🖤2023' -> '26240ce 2023', not '26240ce2023')."""
    cached = _clean_text_cache.get(text)
    if cached is not None:
        return cached
    # 💲 is a dollar sign and ： a colon, not decoration — keep their meaning.
    cleaned = text.replace('💲', '$').replace('：', ':')
    cleaned = _EMOJI_RE.sub(' ', cleaned)
    # Collapse runs of whitespace created by emoji substitution
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Limit cache size to prevent memory issues
    if len(_clean_text_cache) < 50000:
        _clean_text_cache[text] = cleaned
    return cleaned


def detect_brand_header(line: str) -> Optional[str]:
    """Detect if a line is a brand section header.
    Returns the canonical brand name or None.
    Handles lines like: '🟥🟥Patek Philippe🟥🟥', 'Ap Used ✨✨', 'RM Used Fullset✨✨',
    '🟥 🟥 Rolex 🟥 🟥', 'Patek Used ✨ ✨', 'PP stock🍰🍰', 'Ap Stock 🍰',
    'RM stock🍰🍰', 'All Brand new', 'BRAND NEW Rolex'.
    A line that carries a reference after the brand ('AP 15407ST …', 'PP 7014/1G …',
    'Rolex 126610LN 150k') is a watch line, not a header."""
    cleaned = _clean_text(line).strip()
    if not cleaned:
        return None

    # Also strip asterisks (WhatsApp bold markers)
    cleaned = cleaned.replace('*', '').strip()
    cleaned_lower = cleaned.lower().strip()

    # Remove trailing condition/status words and "stock" to isolate brand
    # e.g. "Ap Used" -> "Ap", "PP stock" -> "PP", "RM Used Fullset" -> "RM"
    cleaned_lower = re.sub(
        r'\s+(used|new|unworn|fullset|full set|nos|stock|list|update|price)\b.*$',
        '', cleaned_lower, flags=re.IGNORECASE
    ).strip()

    # Remove leading "brand new" / "all brand new" / "all new" etc.
    cleaned_lower = re.sub(
        r'^(all\s+)?(brand\s+)?new\s+', '', cleaned_lower, flags=re.IGNORECASE
    ).strip()

    # Remove decorative dashes/underscores/asterisks
    cleaned_lower = re.sub(r'^[\-_=*\s]+|[\-_=*\s]+$', '', cleaned_lower)

    if not cleaned_lower:
        return None

    # Check against brand aliases
    if cleaned_lower in BRAND_ALIASES:
        return BRAND_ALIASES[cleaned_lower]

    for alias, brand in sorted(BRAND_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        if cleaned_lower == alias or cleaned_lower.startswith(alias + " "):
            rest = cleaned_lower[len(alias):]
            # A reference (or any long digit run that is not a year) after the
            # brand makes this a watch line.
            for tok in re.findall(r'[A-Za-z]{0,5}\d{3,}[A-Za-z0-9/\-.]*', rest):
                if not _is_non_ref_token(tok):
                    return None
            return brand

    return None



def _is_section_header(line: str) -> bool:
    """Check if a line is a section header (brand, condition group, or decorative separator).
    These lines should NOT be parsed as watch entries."""
    cleaned = _clean_text(line).strip().lower()
    if not cleaned:
        return True  # Empty/decorative-only lines are headers

    # Known section header patterns
    if detect_brand_header(line) is not None:
        return True

    # Lines that are just condition labels like "New Fullset", "Used Fullset✨✨", "Like"
    condition_only = re.match(
        r'^(new|used|unworn|nos|like new|like|all brand new|all new|all used)\s*(fullset|full set)?\s*$',
        cleaned, re.IGNORECASE
    )
    if condition_only:
        return True

    # Lines like "—no box—香港現貨" (special notes/headers)
    if cleaned.startswith('—') or cleaned.startswith('--'):
        return True

    return False


# Leading list decoration that survives _clean_text: "- ", "* ", "> ", ": ", "| ", "#1 " ...
_LEADING_SYMBOLS_RE = re.compile(r'^[\s*\-–—>|:;,.~=_+#!]+')
# "Ref 126333", "Ref. 126333", "ref: 126333", "Reference no. 5711/1A"
_REF_LABEL_RE = re.compile(r'(?<![a-z])ref(?:erence)?\.?\s*(?:no\.?|nr\.?|number|#)?\s*[:#.]?\s*', re.IGNORECASE)
# One complete reference token: '4300V/220G-H151', '228349rbr-0036', '15210OR.OO.A056KB.01'
_REF_TOKEN_RE = re.compile(r'[A-Za-z]{0,5}\d{2,6}[A-Za-z]{0,8}(?:[/\-.][A-Za-z0-9]+)*')
_CURRENCY_WORDS = r'(?:hkd|usdt|usd|eur|euro|gbp|chf|aed|sgd|jpy|cny|rmb|€|£|¥|\$)'
_CURRENCY_AFTER_RE = re.compile(r'^[ \t]*(?:[kKmM]\b[ \t]*)?' + _CURRENCY_WORDS + r'(?![a-z])(?![ \t]*:?[ \t]*\d[\d,.]*(?:[ \t]?[kKmM])?(?![A-Za-z0-9]))', re.IGNORECASE)
# Tokens that are dates, never references: 10-2026, 06/2026, 29/08/2026, N10/26, W10, 2025.
_DATE_TOKEN_RE = re.compile(
    r'^(?:\d{1,2}[/\-.]\d{2,4}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|[nNwW]\d{1,2}(?:[/\-.]\d{2,4})?y?'
    r'|(?:19|20)\d\d(?:[/\-.]\d{1,2})?(?:y|year|years)?|\d{2}y)$'
)
# Tokens that are prices: 13.950 / 1,265,000 / 150k / 1.2m
_PRICE_TOKEN_RE = re.compile(r'^(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?[kKmM])$')
# Brand words a line may start with before its reference ("AP 15407ST", "PP 7014/1G").
_LINE_BRAND_PREFIX_RE = None  # built lazily from BRAND_ALIASES


def _line_brand_prefix_re():
    global _LINE_BRAND_PREFIX_RE
    if _LINE_BRAND_PREFIX_RE is None:
        # 'RM' is part of Richard Mille references ('RM 11-03'), never stripped.
        aliases = sorted((a for a in BRAND_ALIASES if a != 'rm'), key=len, reverse=True)
        _LINE_BRAND_PREFIX_RE = re.compile(
            r'^(?:' + '|'.join(re.escape(a) for a in aliases) + r')\s+(?=[A-Za-z]{0,5}\d)', re.IGNORECASE)
    return _LINE_BRAND_PREFIX_RE


def _is_non_ref_token(token: str, following: str = "") -> bool:
    """Dates, years, prices and currency-tagged numbers are never references."""
    t = token.strip().rstrip('.-/')
    if not t:
        return True
    if _DATE_TOKEN_RE.match(t) or _PRICE_TOKEN_RE.match(t):
        return True
    if re.match(r'^20[1-3]\d[a-zA-Z]{0,8}$', t):
        suffix = re.sub(r'^20[1-3]\d', '', t).lower()
        if suffix in ('', 'y', 'year', 'years', 'used', 'new', 'unworn', 'full', 'brand', 'bnib',
                      'nos', 'mint', 'like', 'fresh', 'polished', 'worn'):
            return True
    # A bare number directly followed by a currency is a price ("35500 usdt").
    if re.match(r'^[\d.,]+$', t) and _CURRENCY_AFTER_RE.match(following or ""):
        return True
    return False


def _extract_ref_from_line(line: str) -> Optional[str]:
    """Extract the reference/model number from a watch line.
    Strips emoji, leading list symbols (→ ▶ • - * |) and condition/status words,
    a leading brand word ("AP 15407ST", "PP 7014/1G") and a "Ref"/"Ref."/"ref:" label.
    Keeps the whole reference token: '4300V/220G-H151', '228349rbr-0036',
    '15210OR.OO.A056KB.01', '5712/1A', '5139G-010', 'RM 11-03' → 'RM11-03'.
    Rejects dates, years and prices: '10-2026', 'N10/26', 'W10', '2025', '150k', '35500 usdt'.
    When the line does not start with a reference, a reference after "Ref" anywhere
    in the line is used."""
    cleaned = _normalize_hyphens(_clean_text(line)).strip()
    if not cleaned:
        return None
    cleaned = _LEADING_SYMBOLS_RE.sub('', cleaned)
    cleaned = re.sub(
        r'^(?:used|new|unworn|like\s*new|brand\s*new|bnib|nos|fresh|polished)\s+',
        '', cleaned, flags=re.IGNORECASE
    ).strip()
    cleaned = _line_brand_prefix_re().sub('', cleaned, count=1)
    cleaned = re.sub(r'^' + _REF_LABEL_RE.pattern, '', cleaned, flags=re.IGNORECASE)
    if not cleaned:
        return None

    def _ref_after_label() -> Optional[str]:
        for m in _REF_LABEL_RE.finditer(cleaned):
            tm = _REF_TOKEN_RE.match(cleaned, m.end())
            if tm:
                tok = tm.group(0).rstrip('.-/')
                if not _is_non_ref_token(tok, cleaned[tm.end():]):
                    return tok
        return None

    # Reject lines that start with a year-like token (e.g., "2022y HKD 570K" is a
    # continuation line from a stock list — no reference here).
    if re.match(
        r'^20[1-3]\d(?:y|year|used|new|unworn|full|brand|mint|like|fresh|polished)?\b',
        cleaned, re.IGNORECASE,
    ):
        return _ref_after_label()
    if re.match(r'^\d{2}y\b', cleaned, re.IGNORECASE):
        return _ref_after_label()

    # Richard Mille references with space: "RM 11-03", "RM 07-01"
    rm_match = re.match(r'^(RM\s*\d{2,4}(?:[/\-][A-Za-z0-9]+)*)\b', cleaned, re.IGNORECASE)
    if rm_match:
        return re.sub(r'^(RM)\s+', r'\1', rm_match.group(1), flags=re.IGNORECASE)

    # Currency-prefixed price tokens like "hkd910k", "usdt470k", "eur5000".
    if re.match(
        r'^(?:hkd|usdt|usd|eur|gbp|chf|aed|sgd|jpy|cny|rmb)\s*[\d.,]+\s*[kKmM]?\b',
        cleaned, re.IGNORECASE,
    ):
        return None

    m = _REF_TOKEN_RE.match(cleaned)
    if m:
        candidate = m.group(0).rstrip('.-/')
        rest = cleaned[m.end():]
        # The token must end on a word boundary ("126610LN," ok, "126610LNx" n/a).
        if candidate and not _is_non_ref_token(candidate, rest):
            return candidate
        return _ref_after_label()
    return _ref_after_label()



def _strip_diacritics(s: str) -> str:
    """Remove diacritics: 'ombré' -> 'ombre', 'grün' -> 'grun'."""
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _resolve_descriptor(token: str) -> list[str]:
    """Resolve a token to its canonical descriptor(s).
    Returns a list: [canonical_name] if the token is a known alias, else [token].
    E.g., 'blk' -> ['black'], 'jub' -> ['jubilee'], 'rom' -> ['roman'].
    Also strips diacritics so 'ombré' resolves via 'ombre'."""
    t = token.lower().strip('.,;:!()[]')
    canonical = WATCH_DESCRIPTOR_ALIASES.get(t)
    if canonical:
        return [t, canonical.lower()]
    # Try diacritics-stripped version: 'ombré' -> 'ombre'
    t_stripped = _strip_diacritics(t)
    if t_stripped != t:
        canonical = WATCH_DESCRIPTOR_ALIASES.get(t_stripped)
        if canonical:
            return [t, t_stripped, canonical.lower()]
    return [t]


# Case metals are not dial colours: "White gold", "Rose gold", "Everose" must not
# count as a white / rose dial.
_METAL_PHRASE_RE = re.compile(
    r'(?<![a-z])(?:(?:white|rose|yellow|pink|red|everose|sedna|king|honey|moonshine|beige)\s*-?\s*gold'
    r'|everose|rolesor|sedna|wg|rg|yg)(?![a-z])',
    re.IGNORECASE,
)


def _strip_metal_tokens(tokens: Optional[list[str]]) -> list[str]:
    if not tokens:
        return []
    joined = " ".join(str(t) for t in tokens)
    joined = _METAL_PHRASE_RE.sub(" ", joined)
    return joined.split()


def _fold(s: str) -> str:
    return remark_rules.fold(s or "")


def _disambiguate_matches(matches: list[dict], line_tokens: list[str]) -> list[dict]:
    """When multiple watch candidates match, use remaining tokens on the line
    to pick the right variant.

    E.g., line '126710blnr jub n1 145.5k' with candidates [126710BLNR Jub, 126710BLNR Oys]
    -> tokens ['jub', 'n1', '145.5k'] -> 'jub' appears in ws_code '126710BLNR Jub' -> pick that one.

    Resolves descriptor abbreviations: 'blk' matches 'Black', 'cho' matches 'Chocolate'.
    Checks tokens against: ws_code, aliases, model name.
    Also checks multi-word combinations like 'paul newman' -> 'Paul Newman'.
    """
    if len(matches) <= 1:
        return matches

    # Build resolved tokens: expand abbreviations to canonical names
    resolved_tokens = []
    for token in _strip_metal_tokens(line_tokens):
        t = _fold(token).strip('.,;:!()[]')
        if not t:
            continue
        # Skip month codes, prices, years
        if re.match(r'^[nN]\d', t):
            continue
        if re.match(r'^[\d,.]+[kKmM]?$', t):
            continue
        if re.match(r'^20[1-2]\d', t):
            continue
        if re.match(r'^\d{2}y$', t):
            continue
        if t in ('used', 'new', 'unworn', 'nos', 'like', 'fullset', 'full', 'set',
                 'hkd', 'usd', 'usdt', 'eur', 'gbp', 'chf', 'both', 'tag', 'sticker',
                 'brand', 'sell', 'buy'):
            continue
        resolved_tokens.append(_resolve_descriptor(t))

    # Build a single string of all remaining tokens (resolved) for multi-word matching
    all_resolved = []
    for variants in resolved_tokens:
        all_resolved.extend(variants)
    tokens_str = " ".join(all_resolved)

    scored = []
    for w in matches:
        score = 0
        ws_lower = _fold(w["ws_code"])
        model_lower = _fold(w.get("model", ""))
        dial_lower = _fold(w.get("dial", ""))
        bracelet_lower = _fold(w.get("bracelet", ""))
        aliases_lower = [_fold(a) for a in w.get("aliases", [])]

        # Check each resolved token against ws_code, dial, bracelet, model, aliases
        for variants in resolved_tokens:
            for t in variants:
                # Check if token appears in ws_code (e.g., 'jub' in '126710BLNR Jub')
                if t in ws_lower:
                    score += 10
                    break
                # Check dial field (e.g., 'blue' in 'Blue' for dial color variants)
                if dial_lower and t in dial_lower:
                    score += 10
                    break
                # Check bracelet field (e.g., 'jubilee' in 'Jubilee')
                if bracelet_lower and t in bracelet_lower:
                    score += 10
                    break
                # Check if token appears in model
                if t in model_lower:
                    score += 5
                    break
                # Check against aliases — but SKIP alias matching for discriminating
                # descriptors (blk/white/green/…). Those should score via dial/
                # bracelet fields only. Aliases like '126508g blk' would otherwise
                # give the 'g' variant free points on any 'blk' line and collide
                # with the dedicated '126508 Blk' variant.
                if t in _DISCRIMINATING_DESCRIPTORS:
                    continue
                for alias in aliases_lower:
                    if t in alias or alias in t:
                        score += 8
                        break

        # Multi-word check: does the combined tokens_str contain part of ws_code
        # that distinguishes this variant? E.g., 'paul newman' in ws_code
        ws_parts = ws_lower.split()
        for part in ws_parts:
            if part in tokens_str and part not in _fold(matches[0]["ws_code"]).split()[:1]:
                # Only count distinguishing parts (not the base reference)
                score += 3

        # Check full alias match in tokens string
        for alias in aliases_lower:
            if alias in tokens_str:
                score += 10

        scored.append((score, w))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Require confidence: top score must clear an absolute threshold AND
    # beat the runner-up by a safe margin. Otherwise return the close
    # candidates unchanged so the caller routes the row to needs_review.
    # Prevents silently picking the wrong variant on thin wins
    # (e.g. 126508g scored 18 vs 126508 Blk scored 16 was previously enough).
    MIN_CONFIDENT = 10
    MARGIN = 5

    if scored[0][0] >= MIN_CONFIDENT and (
        len(scored) == 1 or scored[0][0] - scored[1][0] >= MARGIN
    ):
        return [scored[0][1]]

    # Not confident enough — return all candidates within MARGIN of the top.
    if scored[0][0] > 0:
        cutoff = scored[0][0] - MARGIN
        close = [w for s, w in scored if s >= cutoff]
        if len(close) > 1:
            return close

    # No disambiguation possible
    return matches


# Cache for fuzzy match results to avoid redundant computation.
# Value is (matched_watches, best_score) so callers can make confidence decisions.
_fuzzy_match_cache: dict[tuple[str, Optional[str]], tuple[list[dict], Optional[int]]] = {}
# Counter for fuzzy matches in current run (reset per process_generation call)
_fuzzy_match_count = 0

# Minimum score to even consider a fuzzy candidate.
FUZZY_SCORE_THRESHOLD = 85
# Minimum score to auto-accept a fuzzy match as "confident". Matches in the
# [FUZZY_SCORE_THRESHOLD, FUZZY_CONFIDENT_THRESHOLD) band are surfaced as
# "similar reference — please verify" and routed to needs_review.
FUZZY_CONFIDENT_THRESHOLD = 95


def fuzzy_match_ref(
    ref: str, watch_index: dict, brand_hint: Optional[str] = None
) -> tuple[list[dict], Optional[int]]:
    """Fuzzy-match a reference string against the watch index using rapidfuzz.
    Called as a fallback when exact/substring matching fails.
    Returns (list of matched watches, best score) — both empty/None if no good match."""
    ref_lower = ref.lower().strip()
    if len(ref_lower) < 3:
        return [], None

    cache_key = (ref_lower, brand_hint.lower() if brand_hint else None)
    if cache_key in _fuzzy_match_cache:
        return _fuzzy_match_cache[cache_key]

    # Fuzzy only within the same digit sequence: RM0701 ≠ RM7201,
    # 5980/1A ≠ 5905/1A, 116613LN ≠ 126613LN. Letters may differ, digits may not.
    ref_dk = digit_key(ref_lower)
    if ref_dk:
        by_dk = watch_index.get("fuzzy_by_digits")
        if by_dk is None:
            candidates = [(s, w) for s, w in watch_index.get("fuzzy_candidates", []) if digit_key(s) == ref_dk]
        else:
            candidates = list(by_dk.get(ref_dk, []))
    else:
        candidates = watch_index.get("fuzzy_candidates", [])
    if not candidates:
        _fuzzy_match_cache[cache_key] = ([], None)
        return [], None

    # Filter candidates by brand if hint is available
    if brand_hint:
        brand_lower = brand_hint.lower()
        filtered = [(s, w) for s, w in candidates if w["brand"].lower() == brand_lower]
        if filtered:
            candidates = filtered

    # Extract just the searchable strings for rapidfuzz
    choices = [s for s, _ in candidates]

    results = process.extract(
        ref_lower,
        choices,
        scorer=fuzz.WRatio,
        limit=5,
    )

    if not results:
        _fuzzy_match_cache[cache_key] = ([], None)
        return [], None

    # Filter by threshold
    good_matches = [(match_str, score, idx) for match_str, score, idx in results if score >= FUZZY_SCORE_THRESHOLD]

    if not good_matches:
        _fuzzy_match_cache[cache_key] = ([], None)
        return [], None

    # Deduplicate by ws_code
    seen_ws = set()
    matched_watches = []
    best_score = 0
    for _, score, idx in good_matches:
        _, watch = candidates[idx]
        ws = watch["ws_code"].lower()
        if ws and ws not in seen_ws:
            matched_watches.append(watch)
            seen_ws.add(ws)
            if score > best_score:
                best_score = int(score)

    result = (matched_watches, best_score if matched_watches else None)

    # Limit cache size
    if len(_fuzzy_match_cache) < 10000:
        _fuzzy_match_cache[cache_key] = result

    return result


# --- OpenAI JSON-array calls -------------------------------------------------
# Both text passes ask for a bare JSON array. A reply that hits max_tokens is
# cut off mid-array, so a plain json.loads() used to drop every verdict in the
# batch. Batches are kept small enough that a full reply fits, truncated
# replies are salvaged element by element, and the items they left out are
# sent again.

AI_MAX_TOKENS = 16384
AI_REQUEST_TIMEOUT = 150.0  # seconds per request
AI_RETRY_DELAY = 2.0        # seconds before the single retry of a failed call
AI_BATCH_SIZE = 150         # ~60-80 output tokens per element keeps a reply under AI_MAX_TOKENS
AI_MAX_CONCURRENT = 8


def _strip_code_fence(content: str) -> str:
    content = (content or "").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
        if content.endswith("```"):
            content = content[:-3]
    return content.strip()


def _parse_json_array(content: str) -> list[dict]:
    """Parse a JSON array of objects. When the array is cut off, return the
    elements that are complete. Returns [] when nothing usable is found."""
    text = _strip_code_fence(content)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    if parsed is not None:
        return []

    start = text.find("[")
    if start == -1:
        return []
    decoder = json.JSONDecoder()
    items: list[dict] = []
    pos = start + 1
    while True:
        while pos < len(text) and text[pos] in " \t\r\n,":
            pos += 1
        if pos >= len(text) or text[pos] != "{":
            break
        try:
            obj, pos = decoder.raw_decode(text, pos)
        except json.JSONDecodeError:
            break  # the truncated tail
        if isinstance(obj, dict):
            items.append(obj)
    return items


async def _request_json_array(client, prompt: str, temperature: float, label: str) -> tuple[list[dict], bool]:
    """One chat completion that must answer with a JSON array, retried once
    when the call fails or the reply is not an array.
    Returns (elements, truncated)."""
    from app.core.config import settings

    for attempt in (1, 2):
        try:
            kwargs = {
                "model": settings.OPENAI_TEXT_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                # Reasoning models (gpt-5.x) reject max_tokens and a custom temperature.
                "max_completion_tokens": AI_MAX_TOKENS,
            }
            if not str(settings.OPENAI_TEXT_MODEL).lower().startswith(("gpt-5", "o1", "o3", "o4")):
                kwargs["temperature"] = temperature
            response = await client.chat.completions.create(**kwargs)
        except Exception as e:
            logger.warning(f"{label}: OpenAI call failed (attempt {attempt}): {type(e).__name__}: {e}")
            if attempt == 1:
                await asyncio.sleep(AI_RETRY_DELAY)
            continue

        choice = response.choices[0]
        truncated = choice.finish_reason == "length"
        items = _parse_json_array(choice.message.content or "")
        if truncated:
            logger.warning(f"{label}: reply hit max_tokens, salvaged {len(items)} elements")
        if items or truncated:
            return items, truncated
        logger.warning(f"{label}: reply was not a JSON array (attempt {attempt})")
    return [], False


async def _run_ai_batches(items: list[dict], request, label: str, timeout: Optional[float]) -> list[dict]:
    """Send `items` (each carrying a unique "index") through `request(batch)` in
    concurrent batches. Items a truncated reply left out are sent once more, in
    two halves. Batches still running at `timeout` are cancelled, but results of
    the batches that finished are kept."""
    semaphore = asyncio.Semaphore(AI_MAX_CONCURRENT)

    async def run(batch: list[dict], resend_missing: bool = True) -> list[dict]:
        async with semaphore:
            results, truncated = await request(batch)
        if truncated and resend_missing:
            answered = {r.get("index") for r in results}
            missing = [it for it in batch if it["index"] not in answered]
            if missing:
                logger.info(f"{label}: re-sending {len(missing)} items left out by a truncated reply")
                half = (len(missing) + 1) // 2
                for part in (missing[:half], missing[half:]):
                    if part:
                        results.extend(await run(part, resend_missing=False))
        return results

    batches = [items[i:i + AI_BATCH_SIZE] for i in range(0, len(items), AI_BATCH_SIZE)]
    if not batches:
        return []
    logger.info(f"{label}: {len(items)} items in {len(batches)} batches (max {AI_MAX_CONCURRENT} concurrent)")

    tasks = [asyncio.create_task(run(b)) for b in batches]
    done, pending = await asyncio.wait(tasks, timeout=timeout)
    for task in pending:
        task.cancel()
    if pending:
        logger.warning(f"{label}: {len(pending)}/{len(tasks)} batches unfinished after {timeout}s "
                       f"— keeping the {len(done)} that finished")

    results: list[dict] = []
    for task in done:
        if task.exception() is not None:
            logger.error(f"{label}: batch failed: {task.exception()}")
            continue
        results.extend(task.result())
    return results


async def batch_ai_match(
    unmatched_lines: list[dict],
    watch_index: dict,
    timeout: Optional[float] = None,
) -> list[dict]:
    """Use OpenAI GPT-5.2 to match unmatched lines against the watch catalog.
    Processes ALL unmatched lines in batches (no cap).

    Each item in unmatched_lines: {"index": int, "content": str, "brand_hint": str|None}
    Returns list of {"index": int, "ws_code": str, "watch": dict|None,
                      "ai_brand": str, "ai_model": str, "ai_ws_code": str,
                      "confidence": int, "in_catalog": bool}
    """
    from openai import AsyncOpenAI
    from app.core.config import settings
    import asyncio

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set, skipping AI matching")
        return []

    if not unmatched_lines:
        return []

    # Only 5–10 catalog candidates per line are sent (§4) — never the whole
    # catalog. Callers pass them as item["candidates"]; otherwise a shortlist is
    # built here.
    ws_code_to_watch = {w["ws_code"].lower(): w for w in watch_index["by_ws_code"].values()}
    allowed: dict[int, set[str]] = {}
    for item in unmatched_lines:
        cands = item.get("candidates")
        if cands is None:
            cands = [w["ws_code"] for w in shortlist_candidates(item.get("content", ""), watch_index,
                                                                item.get("brand_hint"), limit=10)]
        item["candidates"] = list(cands)[:10]
        allowed[item["index"]] = {c.lower() for c in item["candidates"]}

    def _cand_line(ws: str) -> str:
        w = ws_code_to_watch.get(ws.lower())
        if not w:
            return ""
        refs = [r for r in [w["reference"]] + w.get("oem_references", []) + w.get("aliases", []) if r]
        extra = " ".join(f"{k}={w.get(k)}" for k in ("dial", "bracelet") if w.get(k))
        return f"    - {w['ws_code']} | {w['brand']} {w.get('model', '')} | refs: {', '.join(refs[:8])} {extra}".rstrip()

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=AI_REQUEST_TIMEOUT)

    async def process_batch(batch_lines: list[dict]) -> tuple[list[dict], bool]:
        parts = []
        for item in batch_lines:
            cand_lines = [c for c in (_cand_line(ws) for ws in item.get("candidates", [])) if c]
            parts.append(
                f"[{item['index']}] {item['content'][:400]}\n  candidates:\n"
                + ("\n".join(cand_lines) if cand_lines else "    (none — identify by your knowledge, ws_code null)")
            )
        lines_text = "\n".join(parts)

        prompt = f"""You are an expert luxury watch dealer reference matcher. Match each WhatsApp dealer message line to the correct watch from the catalog.

Each line comes with its own short list of catalog candidates. ws_code MUST be one
of that line's candidates, or null when none of them is the watch.

REFERENCE FORMAT GUIDE:
Watch references follow brand-specific patterns:
- Rolex: 6-digit number + optional letter suffix (126334G, 126500LN, 228238A, 126710BLNR)
  Suffixes: G=Gold dial, LN=Lunette Noire, BLNR=Blue/Black, BLRO=Blue/Red, CHNR=Choco/Black, TBR=Tiger bracelet
- Patek Philippe: 4-5 digits + slash + variant (5711/1A, 7118/1200R, 5980/60G, 5167A)
  Letter suffix = case material: R=Rose Gold, G=White Gold, A=Steel, P=Platinum, J=Yellow Gold
- Audemars Piguet: 5-digit (15510ST, 26240OR, 26715ST) — sometimes with full OEM (26240ST.OO.1320ST.08)
  ST=Steel, OR=Rose Gold, CE=Ceramic, BC=White Gold, TI=Titanium
- Richard Mille: RM + 2-3 digit number + optional dash suffix (RM07-01, RM11-03, RM035, RM055)
  Watch out: "RM 11-03" (with space) = "RM11-03" — normalize by removing the space
- Omega: dot-separated (310.30.42.50.01.001) or simplified (310.30.42)
- Cartier: alphanumeric codes (WHSA0042, WGBB0035, W2020033)
- Hublot: 3 digits + dot + alphanumeric (441.NX.1171.RX, 645.QG.5217.RX)

DEALER ABBREVIATIONS (used in messages to describe watch variants):
Color/Dial: blk/bk=Black, wht/wh=White, blu=Blue, grn=Green, grey/gray=Grey, choc/cho=Chocolate,
  champ=Champagne, yml=Yellow, sun=Sundust, mete=Meteorite, tiff=Tiffany, pn=Paul Newman,
  ice=Ice Blue, mop=MOP (mother of pearl), ombre/ombré=Ombre, pave/paved=Paved
Bracelet: jub=Jubilee, oys=Oyster, rom/roma=Roman numeral
GMT bezels: blnr=Blue/Black (Batman), blro=Blue/Red (Pepsi), gnrn/grnr=Green/Black (Sprite),
  vtnr=Green/Black (Destro), chnr=Chocolate/Black (Root Beer)
Other: tbr=Tiger Eye bracelet, pistachio=Pistachio dial

BRAND ALIASES: pp=Patek Philippe, ap=Audemars Piguet, rm=Richard Mille, jlc=Jaeger-LeCoultre,
  vc=Vacheron Constantin, fpj=F.P. Journe, bp=Blancpain, gp=Girard-Perregaux, fm=Franck Muller

DATE CODES: N1-N12 = month codes (N1=Jan, N12=Dec), 19y=2019, 20y=2020, 25y=2025
Price suffixes: k=thousands (387k=387,000), m=millions (1.17m=1,170,000)
Currency: HKD (Hong Kong Dollar), USDT/USD, EUR, GBP, CHF — HKD is default for HK/CN/SG dealers

MATCHING RULES:
1. NEVER match across brands — a Tudor ref must stay Tudor, never become Rolex. A 5990 (Patek) must not match a 5905 (also Patek but different model).
2. Match the EXACT reference first. If the catalog has "126710BLNR Jub" and the line says "126710 blnr jub", that's a match.
3. If the catalog has the reference but with a different descriptor (e.g., "126500LN White" but line says "126500 blk"), match to the BLACK variant if it exists, otherwise flag the closest.
4. Common confusions to avoid: 5990 ≠ 5905, 7118 ≠ 7128, 5268 ≠ 5269, 228348 ≠ 228398, 128238 ≠ 228238
5. If no catalog match exists but you can confidently identify the watch, provide a suggested_ws_code.
6. A ws_code typically = reference + key descriptor (e.g., "126710BLNR Jub", "5711/1A White", "15500ST Blue")
7. Confidence: 0-100. >90 = certain match, 80-90 = likely match, <80 = uncertain. Set 0 for unidentifiable lines.
8. Multi-watch lines (comma/slash separated refs like "5167, 5711, 5712") — match the FIRST ref only.
9. Lines that are just years ("2022y HKD 570K") or conditions ("Unworn fullset") are NOT watches — confidence 0.

UNMATCHED LINES:
{lines_text}

Respond with ONLY a JSON array. Each element:
{{"index": <line_index>, "ws_code": "<catalog_ws_code_or_null>", "brand": "<brand>", "model": "<model_name>", "suggested_ws_code": "<your_best_ws_code>", "confidence": <0-100>, "in_catalog": <true_if_ws_code_matched>}}

JSON array:"""

        return await _request_json_array(client, prompt, 0.1, "AI matching")

    ai_results = await _run_ai_batches(unmatched_lines, process_batch, "AI matching", timeout)

    all_results = []
    for item in ai_results:
        ws_code = item.get("ws_code")
        idx = item.get("index")
        confidence = item.get("confidence", 0)
        if idx is None or not isinstance(confidence, (int, float)) or confidence < 1:
            continue

        # The model's in_catalog flag is not trusted: a ws_code counts as in the
        # catalog only when it actually resolves to a catalog watch.
        watch = ws_code_to_watch.get(ws_code.lower()) if isinstance(ws_code, str) and ws_code else None
        if watch is not None and allowed.get(idx) is not None and ws_code.lower() not in allowed[idx]:
            watch = None  # outside this line's candidates → not trusted
        all_results.append({
            "index": idx,
            "ws_code": ws_code,
            "watch": watch,
            "ai_brand": item.get("brand") or "",
            "ai_model": item.get("model") or "",
            "ai_ws_code": item.get("suggested_ws_code") or ws_code or "",
            "confidence": confidence,
            "in_catalog": watch is not None,
        })

    logger.info(f"AI matching: {len(all_results)}/{len(unmatched_lines)} lines answered")
    return all_results


async def batch_ai_verify(
    items: list[dict],
    watch_index: dict,
    mode: str,
    timeout: Optional[float] = None,
) -> list[dict]:
    """Use OpenAI GPT-5.2 to VERIFY deterministic matches and prices.

    Each input item: {
        "index": int,
        "original_text": str,
        "current_ws_code": str | None,      # what the deterministic pipeline chose (None if ambiguous/unmatched)
        "current_price": str | None,        # formatted price (e.g. '1,815,000')
        "current_currency": str | None,     # e.g. 'HKD'
        "candidates": list[str],            # short-list of ws_codes the deterministic pipeline considered
        "brand_hint": str | None,
    }

    Returns list of {
        "index": int,
        "action": "keep" | "flip" | "demote",   # keep=current is fine, flip=change ws_code, demote=send to needs_review
        "ws_code": str,                          # when flipping; else echoes current
        "price": str | None,
        "currency": str | None,
        "confidence": int,                       # 0-100
        "reason": str,
    }

    Decision rules (enforced in prompt):
    - Be DECISIVE. If text says 'black', pick the black variant; never return "both options".
    - A literal ws_code in the text is ground truth.
    - Color/descriptor mismatches are not-matches (5205R Green doesn't match 'blk').
    - Never merge variants (5167A ≠ 5167A Black).
    - Verify the price too: 17,5€ = 17,500 EUR; 'hkd 850k' = 850,000 HKD.
    - If confidence < 80, recommend demote; confidence ≥ 95 required to FLIP an existing match.
    """
    from openai import AsyncOpenAI
    from app.core.config import settings
    import asyncio

    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set, skipping AI verification")
        return []
    if not items:
        return []

    # Build a compact catalog lookup keyed by lower ws_code
    ws_to_watch = {}
    for ws_lower, watch in watch_index["by_ws_code"].items():
        ws_to_watch[ws_lower] = watch

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=AI_REQUEST_TIMEOUT)

    def _format_item(it: dict) -> str:
        cand_block = ""
        for ws in it.get("candidates", [])[:8]:
            w = ws_to_watch.get(ws.lower())
            if not w:
                continue
            dial = w.get("dial") or "-"
            brac = w.get("bracelet") or "-"
            aliases = ", ".join((w.get("aliases") or [])[:6]) or "-"
            cand_block += f"  - {w['ws_code']} | {w['brand']} {w.get('model','')} | dial={dial} bracelet={brac} aliases={aliases}\n"
        if not cand_block:
            cand_block = "  (no short-list provided)\n"
        return (
            f"[{it['index']}]\n"
            f"  text: {it['original_text'][:400]}\n"
            f"  current: ws_code={it.get('current_ws_code') or 'NONE'} price={it.get('current_price') or 'NONE'} "
            f"currency={it.get('current_currency') or 'NONE'}\n"
            f"  brand_hint: {it.get('brand_hint') or 'NONE'}\n"
            f"  candidates:\n{cand_block}"
        )

    async def process_batch(batch_items: list[dict]) -> tuple[list[dict], bool]:
        items_text = "\n".join(_format_item(it) for it in batch_items)

        prompt = f"""You are an expert luxury watch dealer verifying WhatsApp dealer messages against a catalog.
Your job: VERIFY each row's ws_code AND price. Be decisive. Never say "both options".

MATCHING RULES (enforce strictly):
1. A literal ws_code in the text is ground truth. If text says '126508g blk', the ws_code is '126508g' (the literal match wins over color).
2. Color words decide between variants: 'blk'/'black' -> the Black variant, NEVER the 'g' (Gold) variant if a Black variant exists in the short-list.
3. If the short-list has Black, White, Green and the text says 'black', pick Black — do NOT return Green just because Green is in the short-list.
4. Never merge variants: '5167A' is NOT the same as '5167A Black'. If the text gives plain '5167A' with no descriptor, pick the short-list entry whose ws_code is exactly '5167A' (no extra descriptor); if none exists, demote.
5. Never cross brands (Tudor ref stays Tudor, etc).
6. If no candidate fits the descriptors on the line, set action=demote (confidence 0-79).

PRICE VERIFICATION:
- Dealer shorthand: 'k' = thousands, 'm' = millions. '850k' = 850,000. '1.815m' = 1,815,000. '2.05m' = 2,050,000.
- A number written directly next to a currency is in thousands unless it is already a full amount: '17,5€' and '17.5€' = 17,500 EUR, '125€' and '125.00€' = 125,000 EUR, '435.000€' = 435,000 EUR. Integers of 4+ digits are full amounts: '10000€' = 10,000 EUR.
- Currency precedence for bare amounts (no currency symbol): HK/CN/MO/SG -> HKD; DE/FR/IT/ES/NL/BE/AT/PT/IE/FI/GR/LU/SK/SI/EE/LV/LT/MT/CY/HR -> EUR; UK/GB -> GBP; CH -> CHF; US/JP/AE/others -> USD.
- Symbol '$' means HKD for HK/CN/MO/SG senders, USD otherwise.
- USDT should be normalized to USD in the currency field.
- If the text quotes the same watch in several currencies (e.g. 'hkd1.815m usd235.5k'), each is correct: keep the current price and currency. Never flip only to switch to another currency the text also quotes.

DECISION:
- action='keep': current ws_code and price are correct. Set confidence 80-100.
- action='flip': current ws_code is wrong (or was NONE) and a candidate clearly fits. Only use this if confidence >= 95. Supply the corrected ws_code (must be from candidates or text-literal). Also include corrected price/currency.
- action='demote': ambiguous or no good match. Supply confidence 0-79 and a short reason. This sends the row to human review.

MODE: {mode}  (WTS = seller ad with price; WTB = buy-request, price may be absent)

ITEMS TO VERIFY:
{items_text}

Respond with ONLY a JSON array, one element per item:
{{"index": <int>, "action": "keep"|"flip"|"demote", "ws_code": "<ws_code>", "price": "<formatted or null>", "currency": "<ISO or null>", "confidence": <0-100>, "reason": "<short>"}}

JSON array:"""

        return await _request_json_array(client, prompt, 0.05, "AI verification")

    all_results = await _run_ai_batches(items, process_batch, "AI verification", timeout)
    logger.info(f"batch_ai_verify: returned {len(all_results)} verdicts")
    return all_results


# Tokens we consider distinguishing descriptors (color/dial/bracelet/style markers).
# If a line contains any of these and none of them matches the candidate's
# ws_code / dial / bracelet / aliases, we refuse to assign the candidate.
_DISCRIMINATING_DESCRIPTORS = frozenset({
    # Basic colors
    "blk", "black", "wht", "white", "blu", "blue", "grn", "green", "grey", "gray",
    "red", "pink", "purple", "violet", "champ", "champagne", "gold", "silver",
    "brown", "lavender", "slate", "navy", "olive", "khaki", "ivory", "cream",
    "beige", "taupe", "bronze", "rose", "salmon", "coral", "teal", "turquoise",
    "turqoise", "mint", "lime", "amber", "yellow", "orange", "magenta", "fuchsia",
    "indigo",
    # Premium / specialty dials
    "mete", "meteorite", "onyx", "pave", "paved", "ombre", "ombré",
    "chocolate", "choc", "choco", "coffee", "mop", "ruby", "sapphire", "emerald",
    "tiffany", "tiff", "pistachio", "sodalite", "rainbow", "wimbledon", "wim",
    "roman", "rom", "roma", "sundust", "sun", "yml", "pikachu", "nadal",
    "diamond", "diamonds", "dia", "baguette",
    # Bracelet / style markers
    "jubilee", "jub", "oyster", "oys", "leather", "fluted", "motif", "omb",
})


def _has_descriptor_conflict(candidate: dict, line_tokens: Optional[list[str]]) -> bool:
    """Return True when the line contains a discriminating descriptor that
    does NOT appear in the candidate's ws_code / dial / bracelet / aliases.
    Used to reject a sole candidate when the line clearly describes a
    different variant (e.g. line says 'blk' but only 'Green' exists in catalog).
    """
    if not line_tokens:
        return False
    ws_lower = _fold(candidate.get("ws_code") or "")
    dial_lower = _fold(candidate.get("dial") or "")
    bracelet_lower = _fold(candidate.get("bracelet") or "")
    aliases_lower = [_fold(a or "") for a in candidate.get("aliases", [])]
    haystack = " ".join([ws_lower, dial_lower, bracelet_lower] + aliases_lower)
    # Expand the haystack's own abbreviations ('126300 Jub' also means jubilee).
    expanded = []
    for word in re.findall(r'[a-z]+', haystack):
        canonical = WATCH_DESCRIPTOR_ALIASES.get(word)
        if canonical:
            expanded.append(canonical.lower())
    haystack = haystack + " " + " ".join(expanded)

    for raw in _strip_metal_tokens(line_tokens):
        t = _fold(raw).strip().strip('.,;:!()[]')
        if not t:
            continue
        # Skip month codes, prices, years, common non-descriptor words
        if re.match(r'^[nN]\d', t) or re.match(r'^[\d,.]+[kKmM]?$', t):
            continue
        if re.match(r'^20[1-2]\d', t) or re.match(r'^\d{2}y$', t):
            continue
        variants = _resolve_descriptor(t)
        for v in variants:
            if v in _DISCRIMINATING_DESCRIPTORS:
                if v not in haystack:
                    return True
                break
    return False


def _line_has_descriptor(tokens: Optional[list[str]]) -> bool:
    for t in _strip_metal_tokens(tokens):
        for v in _resolve_descriptor(_fold(str(t))):
            if v in _DISCRIMINATING_DESCRIPTORS:
                return True
    return False


def _unique_watches(candidates) -> list[dict]:
    result, seen = [], set()
    for w in candidates or []:
        ws = (w.get("ws_code") or "").lower()
        if ws not in seen:
            result.append(w)
            seen.add(ws)
    return result


def _soft_brand_filter(candidates: list[dict], brand_hint: Optional[str]) -> list[dict]:
    """The brand hint narrows candidates, but never empties the list — a wrong
    hint must not push a correct reference into "not in database"."""
    if brand_hint:
        filtered = [w for w in candidates if (w.get("brand") or "").lower() == brand_hint.lower()]
        if filtered:
            return filtered
    return candidates


def _set_diag(diag: Optional[dict], reason: str, candidates: list[dict]) -> None:
    if diag is not None:
        diag["unsure"] = True
        diag["reason"] = reason
        diag["candidates"] = list(candidates)


def _resolve_family(family: list[dict], tokens: Optional[list[str]], brand_hint: Optional[str],
                    diag: Optional[dict]) -> list[dict]:
    """Pick the variant of one reference family (same reference or same stem).

    Colour/bracelet words decide. No silent guessing: when the line has no
    descriptor and several variants exist, or the descriptors fit none of them,
    every variant is returned (→ needs review, no WS-Code pre-filled) and the
    generic catalog entry is never used as a fallback.
    """
    cands = _soft_brand_filter(_unique_watches(family), brand_hint)
    if not cands:
        return []
    has_desc = _line_has_descriptor(tokens)

    if len(cands) == 1:
        cand = cands[0]
        if has_desc and _has_descriptor_conflict(cand, tokens):
            return []  # line describes a variant the catalog does not have
        ws_lower = _fold(cand.get("ws_code") or "")
        ref_lower = _fold(cand.get("reference") or "")
        ws_has_descriptor = bool(ref_lower) and ws_lower.replace(ref_lower, "", 1).strip() != ""
        if ws_has_descriptor and not has_desc:
            # Only one (descriptor-qualified) variant is known, but the line does
            # not say which variant it is → unsure.
            _set_diag(diag, f"Variant not stated (only {cand.get('ws_code')} in catalog)", cands)
        return cands

    if not has_desc:
        _set_diag(diag, "Variant open: " + ", ".join(c["ws_code"] for c in cands if c.get("ws_code")), cands)
        return cands

    fitting = [c for c in cands if not _has_descriptor_conflict(c, tokens)]
    if len(fitting) == 1:
        return fitting
    if not fitting:
        _set_diag(diag, "No catalog variant fits the description: "
                  + ", ".join(c["ws_code"] for c in cands if c.get("ws_code")), cands)
        return cands
    picked = _disambiguate_matches(fitting, list(tokens or []))
    if len(picked) == 1:
        return picked
    _set_diag(diag, "Ambiguous variant: " + ", ".join(c["ws_code"] for c in picked if c.get("ws_code")), picked)
    return picked


def match_watch_by_ref(ref: str, watch_index: dict, brand_hint: Optional[str] = None,
                       line_tokens: Optional[list[str]] = None,
                       return_fuzzy_score: bool = False,
                       diag: Optional[dict] = None):
    """Match a reference string against the watch index.
    Uses brand_hint to narrow by brand (soft — never empties the result) and
    line_tokens to disambiguate variants. All comparisons are case-insensitive.

    Order: ws_code → alias → OEM reference → reference → alias/ws_code in the
    whole line → reference stem (part before the first '.'/'-') → fuzzy within the
    same digit sequence.

    `diag` (optional dict) receives {"unsure": True, "reason", "candidates"} when
    the variant cannot be decided; the caller must then route to needs review
    without pre-filling a WS-Code.

    If return_fuzzy_score=True, returns (matches, fuzzy_score) where fuzzy_score
    is the best fuzzy score (int) if the fuzzy path was used, else None.
    """
    ref_lower = _normalize_hyphens(ref).lower().strip()
    tokens = list(line_tokens or [])

    def _ret(m, score):
        if return_fuzzy_score:
            return m, score
        return m

    def _family_of(watches: list[dict]) -> list[dict]:
        fam: list[dict] = []
        for w in watches:
            r = (w.get("reference") or "").lower()
            fam.extend(watch_index["by_reference"].get(r, []) if r else [w])
        return _unique_watches(fam or watches)

    # 1. ws_code exact. A literal descriptor-qualified ws_code is ground truth;
    # a bare one equal to a reference shared with other variants is not — the
    # generic entry must not swallow '126300 Green Ombré Jubilee'.
    w = watch_index["by_ws_code"].get(ref_lower)
    if w:
        family = _family_of([w])
        if len(family) <= 1:
            return _ret([w], None)
        return _ret(_resolve_family(family, tokens, brand_hint, diag), None)

    # 2. Alias exact (an alias names one watch authoritatively).
    if ref_lower in watch_index["by_alias"]:
        matches = _soft_brand_filter(_unique_watches(watch_index["by_alias"][ref_lower]), brand_hint)
        if len(matches) > 1:
            matches = _resolve_family(matches, tokens, brand_hint, diag)
        return _ret(matches, None)

    # 3. OEM reference exact — specific enough, only the conflict guard.
    if ref_lower in watch_index["by_oem_ref"]:
        matches = _soft_brand_filter(_unique_watches(watch_index["by_oem_ref"][ref_lower]), brand_hint)
        if len(matches) > 1:
            return _ret(_resolve_family(matches, tokens, brand_hint, diag), None)
        if matches and _line_has_descriptor(tokens) and _has_descriptor_conflict(matches[0], tokens):
            return _ret([], None)
        return _ret(matches, None)

    # 4. Reference exact.
    if ref_lower in watch_index["by_reference"]:
        return _ret(_resolve_family(watch_index["by_reference"][ref_lower], tokens, brand_hint, diag), None)

    # 4b. Alias / ws_code literal in the reconstructed line ("228238a black").
    if tokens:
        reconstructed_lower = (ref + " " + " ".join(str(t) for t in tokens)).lower()
        alias_pat = watch_index.get("_alias_pattern")
        ws_pat = watch_index.get("_ws_code_pattern")
        hits: list[dict] = []
        if ws_pat:
            for m in ws_pat.finditer(reconstructed_lower):
                hw = watch_index["by_ws_code"].get(m.group(0))
                if hw:
                    hits.append(hw)
        if not hits and alias_pat:
            for m in alias_pat.finditer(reconstructed_lower):
                hits.extend(watch_index["by_alias"].get(m.group(0), []))
        hits = _soft_brand_filter(_unique_watches(hits), brand_hint)
        if hits:
            if len(hits) > 1:
                hits = _resolve_family(hits, tokens, brand_hint, diag)
            return _ret(hits, None)

    # 4c. Reference stem: '15210OR' → '15210OR.OO.A056KB.01', '228349rbr-0036' →
    # '228349RBR'. Several variants on one stem: colour word decides, else unsure.
    stem = ref_stem(ref_lower)
    by_stem = watch_index.get("by_stem") or {}
    if stem and stem in by_stem:
        return _ret(_resolve_family(by_stem[stem], tokens, brand_hint, diag), None)

    # 5. Fuzzy matching fallback — only within the same digit sequence.
    global _fuzzy_match_count
    fuzzy_results, fuzzy_score = fuzzy_match_ref(ref, watch_index, brand_hint)
    if fuzzy_results:
        if len(fuzzy_results) > 1:
            fuzzy_results = _resolve_family(fuzzy_results, tokens, brand_hint, diag)
        elif _line_has_descriptor(tokens) and _has_descriptor_conflict(fuzzy_results[0], tokens):
            fuzzy_results = []
        if len(fuzzy_results) == 1:
            _fuzzy_match_count += 1
        return _ret(fuzzy_results, fuzzy_score)

    return _ret([], None)



# Spans that are prices or dates, never references ("$126000", "35500 usdt",
# "10-2026", "29/08/2026"). Replaced by spaces before reference scans.
_PRICE_SPAN_RE = re.compile(
    r'(?:hk\$|us\$|s\$|\$|€|£|¥|(?<![a-z])(?:hkd|usdt|usd|eur|gbp|chf|aed|sgd|cny|rmb|jpy)(?![a-z]))'
    r'[ \t]*:?[ \t]*\d[\d,.]*(?:[ \t]?[kKmMwW](?![a-z]))?'
    r'|(?<![A-Za-z0-9/\-.])\d[\d,.]*[ \t]?[kKmM]?[ \t]*(?:hkd|usdt|usd|eur|euro|gbp|chf|aed|dhs|sgd|cny|rmb|jpy|€|£|¥|\$)(?![a-z])(?![ \t]*:?[ \t]*\d[\d,.]*(?:[ \t]?[kKmM])?(?![A-Za-z0-9]))'
    r'|(?<![A-Za-z0-9/\-.])\d+(?:[.,]\d+)?[ \t]?[kKmM](?![a-z0-9])',
    re.IGNORECASE,
)
_DATE_SPAN_RE = re.compile(
    r'(?<![A-Za-z0-9/\-.])(?:\d{1,2}[/\-.]\d{1,2}[/\-.](?:19|20)?\d{2}|\d{1,2}[/\-](?:20)?\d{2}'
    r'|[nNwW]\d{1,2}(?:[/\-](?:20)?\d{2})?y?)(?![A-Za-z0-9/\-])'
)


def _mask_prices_and_dates(text: str) -> str:
    def blank(m):
        return " " * (m.end() - m.start())
    text = _PRICE_SPAN_RE.sub(blank, text)
    return _DATE_SPAN_RE.sub(blank, text)


def match_watch(content: str, watch_index: dict, brand_hint: Optional[str] = None,
                diag: Optional[dict] = None) -> list[dict]:
    """Match a single-line or full message content against the watch index.
    Uses pre-compiled combined regex patterns. Prices and dates are masked first so
    '$126000' or '35500 usdt' are never read as references. The brand hint is soft:
    it narrows matches but never turns a real match into "not in database".
    Same-reference variants are resolved with the message's descriptor words;
    when the variant is open, all variants are returned (diag marks it unsure)."""
    masked = _mask_prices_and_dates(_normalize_hyphens(content))
    content_lower = masked.lower()
    tokens = _clean_text(masked).lower().split()

    def _collect(pattern, index_key, single=False) -> list[dict]:
        found: list[dict] = []
        if not pattern:
            return found
        for m in pattern.finditer(content_lower):
            hit = watch_index[index_key].get(m.group(0))
            if hit is None:
                continue
            if single:
                found.append(hit)
            else:
                found.extend(hit)
        return _soft_brand_filter(_unique_watches(found), brand_hint)

    def _by_family(matches: list[dict]) -> list[dict]:
        """Group by reference; a single family is resolved with the tokens."""
        refs = {(w.get("reference") or w.get("ws_code") or "").lower() for w in matches}
        if len(refs) == 1:
            r = next(iter(refs))
            family = _unique_watches(matches + watch_index["by_reference"].get(r, []))
            return _resolve_family(family, tokens, brand_hint, diag)
        return matches

    # ws_code literal (most specific). A descriptor-qualified ws_code is ground
    # truth; a bare one that is also a shared reference goes through the family.
    matches = _collect(watch_index.get("_ws_code_pattern"), "by_ws_code", single=True)
    if matches:
        qualified = [w for w in matches
                     if _fold(w.get("ws_code") or "") != _fold(w.get("reference") or "")]
        if qualified:
            return qualified
        return _by_family(matches)

    # Alias: authoritative.
    matches = _collect(watch_index.get("_alias_pattern"), "by_alias")
    if matches:
        return matches if len(matches) == 1 else _by_family(matches)

    # OEM reference: conflict guard only.
    matches = _collect(watch_index.get("_oem_ref_pattern"), "by_oem_ref")
    if matches:
        if len(matches) == 1:
            if _line_has_descriptor(tokens) and _has_descriptor_conflict(matches[0], tokens):
                return []
            return matches
        return _by_family(matches)

    # Reference.
    matches = _collect(watch_index.get("_reference_pattern"), "by_reference")
    if matches:
        return _by_family(matches)
    return []



def normalize_month_year(text: str, ref_month: int, ref_year: int, mode: str) -> str:
    """Normalize month/year strings to MM/YY format (+ suffix for WTB).
    When only a year is available (no month), returns the year as-is (e.g. '2025')
    instead of fabricating a month like '01/25'."""
    if not text:
        return ""

    text = text.strip().lower()
    suffix = "+" if mode == "WTB" else ""

    month_names = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4,
        "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    # Strip trailing 'y' suffix (common in dealer messages: N2/26y, N9/2025y)
    text_clean = re.sub(r'y$', '', text).strip()

    def _mm_yy(month: int, year: int) -> str:
        # Never a future card date (and never a month that does not exist).
        if not 1 <= month <= 12 or not 1990 <= year <= 2099:
            return ""
        if (year, month) > (ref_year, ref_month):
            return ""
        return f"{month:02d}/{year % 100:02d}{suffix}"

    # N-month / W-month only (W = wood card): n1, n12, w10
    m = re.match(r'^[nw](\d{1,2})$', text_clean)
    if m:
        month = int(m.group(1))
        year = ref_year if month <= ref_month else ref_year - 1
        return _mm_yy(month, year)

    # N-month/year: n2/26, n9/2025, w10/26, w9-2026
    m = re.match(r'^[nw](\d{1,2})[/\-](\d{2,4})$', text_clean)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return _mm_yy(month, year)

    # MM/YY or MM/YYYY: 09/25, 02/26, 02/2026
    m = re.match(r'^(\d{1,2})[/\-](\d{2,4})$', text_clean)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return _mm_yy(month, year)

    for name, num in month_names.items():
        if name in text_clean:
            month = num
            yr_match = re.search(r'(\d{2,4})', text_clean.replace(name, ''))
            if yr_match:
                yr = int(yr_match.group(1))
                year = yr if yr > 99 else 2000 + yr
            else:
                year = ref_year if month <= ref_month else ref_year - 1
            return _mm_yy(month, year)

    # Pure 4-digit year: 2024, 2025 — return as year only, not MM/YY
    m = re.match(r'^(\d{4})$', text_clean)
    if m:
        year = int(m.group(1))
        if year > ref_year:
            return ""
        return f"{year}{suffix}"

    # Pure 2-digit number: could be a year (19=2019, 25=2025)
    m = re.match(r'^(\d{2})$', text_clean)
    if m:
        year = 2000 + int(m.group(1))
        return f"{year}{suffix}"

    return text + suffix if suffix else text


def extract_month_year_from_text(content: str) -> Optional[str]:
    """Try to find month/year references in message text.
    Handles: N2/26y, N9/2025y, N3/2026, 09/25, 2024, 19y (=2019), 2025-6 (=06/2025).
    Scans ALL occurrences for each pattern before falling through to the next one."""
    # Prices never hold a date; refs glued to digits ('81010-11-3153') neither.
    content = _PRICE_SPAN_RE.sub(lambda m: " " * (m.end() - m.start()), _normalize_hyphens(content))
    content_lower = content.lower()

    # 1. N-month/year with 'y' suffix (most specific): N2/26y, N9/2025y, N3/2026y.
    # W-month (wood card: W10, W10/26, W9-2026) is read exactly like N.
    for m in re.finditer(r'\b[nNwW](\d{1,2})[/\-](\d{2,4})\s*y\b', content_lower):
        start = m.start()
        if start > 0 and content[start - 1] in ('$', '€', '£'):
            continue
        month = m.group(1)
        year = m.group(2)
        return f"n{month}/{year}"

    # 2. N-month/year without y: N2/26, N3/2026, W10/26, W9-2026
    for m in re.finditer(r'\b[nNwW](\d{1,2})[/\-](\d{2,4})\b', content_lower):
        start = m.start()
        if start > 0 and content[start - 1] in ('$', '€', '£'):
            continue
        month_val = int(m.group(1))
        year_str = m.group(2)
        # Validate: month 1-12, year looks like a year (not a model suffix like /1G)
        if 1 <= month_val <= 12 and len(year_str) >= 2:
            return f"n{m.group(1)}/{year_str}"

    # 3. N-month+year concatenated with y (N32026y, missing /): first 1-2 digits as month, rest as year
    m = re.search(r'\b[nN](\d{1,2})(\d{4})\s*y\b', content_lower)
    if m:
        month = m.group(1)
        year = m.group(2)
        return f"n{month}/{year}"

    # 3b. Full dates DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY: 29/08/2026 → 08/26
    for m in re.finditer(r'(?<![\w/\-.])(\d{1,2})[/.\-](\d{1,2})[/.\-]((?:19|20)\d{2})(?![\w/\-])', content_lower):
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= day <= 31 and 1 <= month <= 12:
            return f"{month:02d}/{year % 100:02d}"

    # 4. YYYY/MM or YYYY-MM format: 2025/11, 2025-6
    for m in re.finditer(r'(?<![\w/\-.])(\d{4})[/\-](\d{1,2})(?![\w/\-])', content_lower):
        year = int(m.group(1))
        month = int(m.group(2))
        # Verify it's a valid year (not a reference like 5980/60)
        if 2010 <= year <= 2035 and 1 <= month <= 12:
            yr_short = year % 100
            return f"{month:02d}/{yr_short:02d}"

    # 5. N-month only: N1, N2, N10, N12, W10 (check ALL occurrences, skip model suffixes)
    for m in re.finditer(r'\b[nNwW](\d{1,2})\b', content_lower):
        month_val = int(m.group(1))
        if 1 <= month_val <= 12:
            # Make sure this isn't part of a model ref (preceded by /)
            start = m.start()
            if start > 0 and content[start - 1] == '/':
                continue
            return m.group(0)

    # 6. MM/YY or MM/YYYY format: 09/25, 02/26
    for m in re.finditer(r'(?<![\w/\-.])(\d{1,2})[/\-](\d{2}|(?:19|20)\d{2})(?![\w/\-])', content_lower):
        start = m.start()
        if start > 0 and content[start - 1] in ('$', '€', '£'):
            continue
        month_val = int(m.group(1))
        if 1 <= month_val <= 12:
            return m.group(0)

    # 7. Month name with year: January 2024, Jan 2024
    m = re.search(
        r'\b((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s*\d{2,4})\b',
        content_lower,
    )
    if m:
        start = m.start()
        if not (start > 0 and content[start - 1] in ('$', '€', '£')):
            return m.group(0)

    return None


def extract_year_from_line(content: str) -> Optional[str]:
    """Extract a standalone year from a watch line.
    Handles: '2024', '2022year', '2025year', '19y' (=2019), '20y' (=2020), '21y' (=2021)."""
    # Full 4-digit year: 2024, 2022year
    m = re.search(r'\b(20[1-2]\d)\s*(?:year|y)?\b', content, re.IGNORECASE)
    if m:
        return m.group(1)
    # Short 2-digit year with 'y' suffix: 19y=2019, 20y=2020, 25y=2025
    # Must NOT be preceded by N (which is month code like N2/26y) or / (which is month/year)
    m = re.search(r'(?<![nN/\-])(?:^|\s)(\d{2})y\b', content, re.IGNORECASE)
    if m:
        yr = int(m.group(1))
        if 10 <= yr <= 35:  # 2010-2035 range
            return str(2000 + yr)
    return None


def _canonicalize_currency(cur: Optional[str]) -> Optional[str]:
    """Normalize currency labels per dealer convention:
    - USDT → USD (same asset, report as USD)
    - RMB → CNY (same currency, report as CNY)
    Leaves everything else unchanged."""
    if not cur:
        return cur
    u = cur.upper()
    if u == "USDT":
        return "USD"
    if u == "RMB":
        return "CNY"
    return u


# A price number: '850k', '110.5k', '1.763 m', '1,265,000', '13.950,-'
_PRICE_NUM = r'(\d[\d,.]*(?:[ \t]?[kKmM](?![a-zA-Z]))?)'


def extract_price(content: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price and currency from message text.
    Returns (formatted_price, currency) or (None, None).

    Price formats: 387k, 1.17m, 1.763 m, 435,000, 138,000, 162k, 1.265m
    Currency can follow (with/without space): 387k hkd, 435,000hkd, 300k usdt, 69.000€
    Currency can precede: HK$387k, $300k, €5,000, hkd850k, S$20k, CHF 12.5k
    Typos are fixed first: hkld/khd/hkdd/HKKD/h kd → HKD, 'HKD//390k', '💲 149k', 'usdt ：'.
    'hkd850k usd110.5k' = 850,000 HKD (the first quote wins; the USD that follows
    is a second price, not a suffix of the first).
    Chinese: '97w人民币' = 97 × 10,000 RMB = 970,000 CNY.
    If $ is used by HK/CN/MO/SG sender without USD/USDT qualifier -> HKD.
    """
    content = _normalize_price_text(content)
    # Remove serial code prefixes that can interfere with price parsing
    # SC = Serial Code, SN = Serial Number, Ref = Reference
    content = re.sub(r'\b(?:SC|SN|REF|ser\.?)\s*[\d,]+', '', content, flags=re.IGNORECASE)

    def _extract_chinese_price() -> tuple[Optional[str], Optional[str]]:
        m = re.search(
            r'(\d+(?:[.,]\d+)?)\s*w\s*(\d)?\s*(?:人民币|rmb|cny)',
            content, re.IGNORECASE
        )
        if not m:
            return None, None
        base = m.group(1).replace(',', '.')
        extra = m.group(2)  # "84w5" → base=84, extra=5 (meaning 84.5×10,000)
        try:
            value = float(base)
            if extra:
                value = value + float(extra) / 10
            total = round(value * 10000)
            if 0 < total <= 50_000_000:
                return f"{total:,}", "CNY"
        except ValueError:
            pass
        return None, None

    num = _PRICE_NUM
    _sep = r'[:\s]*'
    prefix_patterns = [
        (rf'hk\${_sep}{num}', "HKD"),
        (rf'(?:us\$|u\$){_sep}{num}', "USD"),
        (rf'(?:s\$|sg\$|sgd){_sep}{num}', "SGD"),
        (rf'(?<![a-z])hkd{_sep}{num}', "HKD"),
        (rf'(?<![a-z])usdt{_sep}{num}', "USDT"),
        (rf'(?<![a-z])usd{_sep}{num}', "USD"),
        (rf'(?<![a-z])(?:eur|euro){_sep}{num}', "EUR"),
        (rf'(?<![a-z])gbp{_sep}{num}', "GBP"),
        (rf'(?<![a-z])chf{_sep}{num}', "CHF"),
        (rf'(?<![a-z])(?:aed|dhs){_sep}{num}', "AED"),
        (rf'(?<![a-z])jpy{_sep}{num}', "JPY"),
        (rf'(?<![a-z])(?:rmb|cny){_sep}{num}', "CNY"),
        (rf'€{_sep}{num}', "EUR"),
        (rf'£{_sep}{num}', "GBP"),
        (rf'¥{_sep}{num}', "CNY"),
        (rf'\${_sep}{num}', None),  # $ — resolved by sender country
    ]
    suffix_re = re.compile(
        r'(?<![A-Za-z\d./\-])' + num
        + r'[ \t]*(hkd|usdt|usd|eur|euro|gbp|chf|aed|dhs|sgd|jpy|yen|cny|rmb|€|£|¥|\$)(?![a-z])(?![ \t]*:?[ \t]*\d[\d,.]*(?:[ \t]?[kKmM])?(?![A-Za-z0-9]))',
        re.IGNORECASE,
    )

    # Currency-prefixed forms first (in list order), then suffixed forms.
    best: Optional[tuple[int, str, Optional[str], str]] = None  # (pos, raw, currency, kind)
    for pattern, currency in prefix_patterns:
        m = re.search(pattern, content, re.IGNORECASE)
        if not m:
            continue
        raw = m.group(1).strip()
        if not _format_price(_normalize_adjacent_currency_price(raw)):
            continue
        # '$505,000 HKD': a trailing tag names the currency of a bare '$' — but
        # only when that tag is not itself the prefix of the next price
        # ('hkd850k usd110.5k' stays HKD).
        cur = currency
        tail = content[m.end():m.end() + 12]
        tm = re.match(r'\s*(usdt|hkd|usd|eur|gbp|chf|cny|rmb|sgd|aed|jpy)(?![a-z])(?!\s*:?\s*\d)',
                      tail, re.IGNORECASE)
        if tm and (cur is None or cur in ("USD",)):
            cur = tm.group(1)
        if cur is None:
            cur = _default_currency_for_country(sender_country)
        best = (m.start(), raw, cur, "prefix")
        break
    if best is None:
        for m in suffix_re.finditer(content):
            raw = m.group(1).strip()
            if not _format_price(_normalize_adjacent_currency_price(raw)):
                continue
            tag = m.group(2).lower()
            cur = {"€": "EUR", "£": "GBP", "¥": "CNY", "euro": "EUR", "dhs": "AED", "yen": "JPY"}.get(tag, tag.upper())
            if tag == "$":
                cur = _default_currency_for_country(sender_country)
            best = (m.start(), raw, cur, "suffix")
            break

    if best:
        formatted = _format_price(_normalize_adjacent_currency_price(best[1]))
        if formatted:
            return formatted, _canonicalize_currency(best[2])

    # Last-resort Chinese pattern (only fires when no standard currency found)
    cn_result = _extract_chinese_price()
    if cn_result[0]:
        return cn_result

    return None, None



def extract_wtb_price(content: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """WTB-specific price extractor. Buyers express a budget via phrases like
    'target: 105k HKD', 'budget: 105k', 'up to: 105k', 'can confirm: 105k',
    'max 105k hkd', 'offer 105k'. Peel off the prefix phrase (everything up to
    the colon or the keyword) and feed the remainder to the regular extractor,
    so existing currency logic (HKD/USDT/RMB/etc) continues to work.
    """
    # Ordered longest-first so "can confirm" matches before "confirm" would.
    # Covers every variant the user listed: target/budget/up to/can confirm/
    # can pay/pay max/willing to pay/offer/max/at. Each is allowed an optional
    # "[:\-]" separator before the price.
    prefixes = [
        r'can\s+confirm',
        r'willing\s+to\s+pay',
        r'pay\s+max',
        r'can\s+pay',
        r'up\s+to',
        r'target\s+price',
        r'price\s+target',
        r'any\s+year\s+target',
        r'any\s+year\s+budget',
        r'target',
        r'budget',
        r'offer',
        r'max',
        r'at',
    ]
    pattern = r'\b(?:' + '|'.join(prefixes) + r')\s*[:\-]?\s*(.+)$'
    m = re.search(pattern, content, re.IGNORECASE)
    if m:
        tail = m.group(1)
        p, c = extract_price(tail, sender_country)
        if p:
            return p, c
    # Fall back to the standard extractor
    return extract_price(content, sender_country)


def _apply_discount(price_val: float, discount_pct: float) -> str:
    """Apply a discount percentage to a price and return formatted string."""
    discounted = price_val * (1 - discount_pct / 100)
    return f"{int(discounted):,}"


# Retail-price markers (§7): "retail 93200", "rrp", "lp", "hkr 68500", "hkretail",
# "list price", "shop".
_RETAIL_MARKER = r'(?<![a-z])(?:hk\s?retail|hkr|retail|rrp|msrp|lp|list\s?price|shop(?:\s?price)?)(?![a-z])'
_CUR_OPT = r'(?:[ \t]*(?:hk\$|us\$|\$|€|£|hkd|usdt|usd|eur|gbp|chf|aed|sgd|cny|rmb|jpy)[ \t]*)?'
_MARKED_RETAIL_RE = re.compile(
    r'\(?[ \t]*' + _RETAIL_MARKER + r'[ \t]*[:\-]?' + _CUR_OPT + r'(\d[\d,.]*(?:[ \t]?[kKmM](?![a-z]))?)' + _CUR_OPT
    + r'(?:[ \t]*[-−][ \t]*(\d{1,2}(?:[.,]\d)?)[ \t]*%)?'
    + r'(?:[ \t]*=[ \t]*' + _CUR_OPT + r'(\d[\d,.]*(?:[ \t]?[kKmM](?![a-z]))?)' + _CUR_OPT + r')?[ \t]*\)?',
    re.IGNORECASE,
)
_UNMARKED_DISCOUNT_RE = re.compile(
    r'(hk\$|us\$|\$|€|£|hkd|usdt|usd|eur|gbp|chf)?[ \t]*(\d[\d,.]*(?:[ \t]?[kKmM](?![a-z]))?)[ \t]*'
    r'(hkd|usdt|usd|eur|gbp|chf|€|£)?[ \t]*[-−][ \t]*(\d{1,2}(?:[.,]\d)?)[ \t]*%'
    r'(?:[ \t]*=[ \t]*' + _CUR_OPT + r'(\d[\d,.]*(?:[ \t]?[kKmM](?![a-z]))?))?',
    re.IGNORECASE,
)


def _pct(raw: str) -> float:
    return float(raw.replace(',', '.'))


def _num(formatted: Optional[str]) -> Optional[float]:
    try:
        return float(formatted.replace(',', '')) if formatted else None
    except ValueError:
        return None


def price_info(text: str, sender_country: Optional[str] = None, line_level: bool = True) -> dict:
    """Price of a listing with the §7 retail / discount rules.

    1. Two numbers, one marked retail ('hkd 71764 (retail 93200 -23%)') → the
       unmarked number.
    2. Only a marked retail price with % ('hkr 68500 -15%') → calculated (58,225);
       a result written after '=' wins.
    3. Number + % without marker ('$32700 -9%') → calculated for now, but flagged
       (`needs_list_check`) so the caller compares it with the catalog list price.

    Returns {"price", "currency", "discount_pct", "base_price", "needs_list_check"}.
    """
    t = _normalize_price_text(text or "")
    info = {"price": None, "currency": None, "discount_pct": None, "base_price": None,
            "needs_list_check": False}

    def _base(s: str) -> tuple[Optional[str], Optional[str]]:
        if line_level:
            return _extract_price_from_line_basic(s, sender_country)
        p, c = extract_price(s, sender_country)
        if not p:
            p, c = _extract_price_from_line_basic(s, sender_country)
        return p, c

    marked = list(_MARKED_RETAIL_RE.finditer(t))
    if marked:
        remainder = t
        for m in reversed(marked):
            remainder = remainder[:m.start()] + " " + remainder[m.end():]
        p, c = _base(remainder)
        if p:
            info.update(price=p, currency=c)
            return info
        m = marked[0]
        base = _format_price(m.group(1))
        cur = _base(m.group(0))[1] or ("HKD" if re.search(r'hk', m.group(0), re.I) else
                                       _default_currency_for_country(sender_country))
        if m.group(3):
            info.update(price=_format_price(m.group(3)), currency=cur, base_price=base)
            return info
        if m.group(2) and base:
            pct = _pct(m.group(2))
            info.update(price=_apply_discount(_num(base), pct), currency=cur, discount_pct=pct, base_price=base)
            return info
        return info

    d = _UNMARKED_DISCOUNT_RE.search(t)
    if d:
        base = _format_price(d.group(2))
        if base:
            cur_tag = (d.group(1) or d.group(3) or "").lower()
            if cur_tag in ("$", ):
                cur = _default_currency_for_country(sender_country)
            elif cur_tag:
                cur = _canonicalize_currency({"€": "EUR", "£": "GBP", "hk$": "HKD", "us$": "USD"}.get(cur_tag, cur_tag))
            else:
                cur = _default_currency_for_country(sender_country)
            pct = _pct(d.group(4))
            if d.group(5):
                info.update(price=_format_price(d.group(5)), currency=cur, discount_pct=pct, base_price=base)
                return info
            info.update(price=_apply_discount(_num(base), pct), currency=cur, discount_pct=pct,
                        base_price=base, needs_list_check=True)
            return info

    p, c = _base(t)
    info.update(price=p, currency=c)
    return info


def apply_list_price_rule(info: dict, watch: Optional[dict], rates: Optional[dict] = None,
                          tolerance: float = 0.06) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Rule 3 of §7 for 'number −x%' without a retail marker.

    ≈ catalog list price → the number is the retail price → calculate.
    ≈ list price − discount → the number already is the dealer price → keep.
    Otherwise (or no list price) → review. Returns (price, currency, review_reason).
    """
    if not info.get("needs_list_check"):
        return info.get("price"), info.get("currency"), None
    base = _num(info.get("base_price"))
    pct = info.get("discount_pct") or 0
    cur = info.get("currency")
    list_prices = (watch or {}).get("list_prices") or {}
    if base is None:
        return info.get("price"), cur, "Discount without a readable base price"
    if list_prices:
        from app.core.market_constants import LIST_PRICE_CURRENCY
        from app.services import fx as fx_service
        rates = rates or fx_service.cached_rates()
        for country, lp in list_prices.items():
            if not lp:
                continue
            lp_cur = LIST_PRICE_CURRENCY.get((country or "").upper())
            if not lp_cur:
                continue
            base_in_lp = fx_service.convert(base, cur, lp_cur, rates)
            if base_in_lp is None:
                continue
            if abs(base_in_lp - lp) <= lp * tolerance:
                return info.get("price"), cur, None
            if abs(base_in_lp - lp * (1 - pct / 100)) <= lp * tolerance:
                return f"{int(round(base)):,}", cur, None
    reason = (f"Discount -{pct:g}% on {int(base):,} {cur or ''}: unclear whether "
              f"{int(base):,} is the list price").strip()
    return info.get("price"), cur, reason


def _extract_price_from_line_basic(line: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Currency-tagged price, else the most price-like bare number on the line.
    A bare number counts only with k/m or 4+ digits — '143k Datejust 28' is
    143,000, never 28 (a case size)."""
    line = _normalize_price_text(line)
    price, currency = extract_price(line, sender_country)
    if price:
        return price, currency

    tokens = _clean_text(line).strip().split()
    first_token = tokens[0].strip().rstrip('.').lower() if tokens else ""
    line_ref = (_extract_ref_from_line(line) or "").lower()
    best_suffixed = None
    best_plain = None
    for idx, token in enumerate(tokens):
        token_clean = token.strip().rstrip('.,;:)').lstrip('(')
        if re.match(r'^[nNwW]\d', token_clean):
            continue
        if re.match(r'^20[1-3]\d(?:year|y)?$', token_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d{2}y$', token_clean, re.IGNORECASE):
            continue
        if not re.match(r'^[\d,.]+[kKmM]?$', token_clean):
            # '1.2 m' — number followed by a lone k/m token
            if re.match(r'^[kKmM]$', token_clean) and idx > 0 and re.match(r'^[\d,.]+$', tokens[idx - 1]):
                cand = tokens[idx - 1] + token_clean
                if _format_price(cand) and best_suffixed is None:
                    best_suffixed = cand
            continue
        if idx == 0 and token_clean.lower() == first_token and not re.search(r'[kKmM]$', token_clean):
            continue  # likely the reference
        if re.search(r'[kKmM]$', token_clean):
            if best_suffixed is None:
                best_suffixed = token_clean
            continue
        digits = re.sub(r'\D', '', token_clean)
        if len(digits) < 4 or token_clean.lower() == line_ref:
            continue
        best_plain = token_clean  # last plain number wins (prices end the line)
    for cand in (best_suffixed, best_plain):
        if cand:
            formatted = _format_price(cand)
            if formatted:
                return formatted, _default_currency_for_country(sender_country)
    return None, None


def extract_price_from_line(line: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price from a single watch line.
    Handles stock list formats: '5968A N2 1.17m hkd', '126334G Black Jub N12 138,000'
    N1, N2, N10, N12, W10 are month codes — NOT prices.
    Retail/discount forms follow §7 (see price_info): '$565000-25%', 'hkr 68500 -15%',
    'hkd 71764 (retail 93200 -23%)'.
    """
    info = price_info(line, sender_country, line_level=True)
    return info["price"], info["currency"]



def extract_all_prices(content: str, sender_country: Optional[str] = None) -> list[tuple[str, str]]:
    """Extract all price+currency pairs from a message.
    Returns list of (formatted_price, currency) tuples, ordered by preference:
    USDT/USD > EUR/GBP/CHF > HKD > other."""
    prices = []

    # Find all currency-tagged prices (case-insensitive — mixed-case tokens
    # like "Hkd", "Usdt" appear in real data).
    all_patterns = [
        (r'usdt\s*([\d,.]+[kKmM]?)', "USDT"),
        (r'usd\s*([\d,.]+[kKmM]?)', "USD"),
        (r'([\d,.]+[kKmM]?)\s*usdt', "USDT"),
        (r'([\d,.]+[kKmM]?)\s*usd', "USD"),
        (r'hkd\s*([\d,.]+[kKmM]?)', "HKD"),
        (r'([\d,.]+[kKmM]?)\s*hkd', "HKD"),
        (r'(\d{3,9})\s*hkd', "HKD"),
        (r'(\d{3,9})\s*usdt', "USDT"),
        (r'(?:eur|€)\s*([\d,.]+[kKmM]?)', "EUR"),
        (r'(?:gbp|£)\s*([\d,.]+[kKmM]?)', "GBP"),
        (r'(?:rmb|cny|¥)\s*([\d,.]+[kKmM]?)', "CNY"),
        (r'([\d,.]+[kKmM]?)\s*(?:rmb|cny)', "CNY"),
    ]

    seen_positions = set()
    for pattern, currency in all_patterns:
        for m in re.finditer(pattern, content, re.IGNORECASE):
            pos = m.start()
            # Avoid double-counting overlapping matches
            if any(abs(pos - sp) < 5 for sp in seen_positions):
                continue
            raw = m.group(1).strip()
            formatted = _format_price(raw)
            if formatted:
                prices.append((formatted, _canonicalize_currency(currency)))
                seen_positions.add(pos)

    # Sort by currency preference
    currency_priority = {"USD": 0, "EUR": 2, "GBP": 3, "CHF": 4, "HKD": 5, "CNY": 6}
    prices.sort(key=lambda x: currency_priority.get(x[1], 99))

    return prices


def _normalize_adjacent_currency_price(raw: str) -> str:
    """When a price is written adjacent to a currency symbol/suffix, always
    treat it as thousands. Luxury watches are never priced in the single or
    low-hundreds range of any currency, so dealers writing `125€` mean 125k EUR.

    Examples:
        '17,5'   -> '17.5k'  -> 17,500
        '17.5'   -> '17.5k'
        '9,8'    -> '9.8k'
        '125'    -> '125k'   -> 125,000
        '125.00' -> '125k'   -> 125,000
        '435.000'-> '435k'   -> 435,000
        '1.815m' -> '1.815m' (k/m suffix preserved)
        '1,265,000' -> '1,265,000' (5+ digit integer already a full price)

    Rules:
    - Values already carrying a k or m suffix are left untouched.
    - Integers of 4+ digits are treated as already a full price (e.g.
      '10000€' stays 10,000 — user wrote the full amount).
    - Anything else (small integers, European decimals, 3-digit "thousands"
      separators) gets ×1000.
    """
    s = raw.strip()
    if not s:
        return s
    # Already has k/m suffix — leave for _format_price to expand.
    if re.match(r'^[\d.,]+[kKmM]$', s):
        return s

    # Classify: small decimal (`17,5` / `9.8` / `125.00`) vs 3-digit-decimal
    # (`435.000` = European thousands separator) vs full integer.
    # Rule: always treat as thousands for luxury-watch dealer messages.
    small_dec = re.match(r'^(\d{1,3})[,.](\d{1,2})$', s)
    if small_dec:
        return f"{small_dec.group(1)}.{small_dec.group(2)}k"

    # 3-digit decimal (thousands-sep): '435.000' means 435,000 — already whole.
    three_dec = re.match(r'^(\d{1,3})[,.](\d{3})$', s)
    if three_dec:
        # e.g. '435.000' -> '435000' already a full price, leave.
        return s

    # Mixed-separator (e.g. '1,265.5' or '1,265,000') — already a full price.
    if s.count(',') + s.count('.') >= 2:
        return s

    # Pure integer — treat as thousands. '125' -> '125k', '10000' -> leave.
    if re.match(r'^\d+$', s):
        if len(s) >= 4:
            return s  # '10000' is already a full amount
        return f"{s}k"

    return s


def _format_price(raw: str) -> Optional[str]:
    """Format a raw price string: expand k/m, add commas.
    Rejects values that look like years (2010-2035) unless they have k/m suffix."""
    raw = raw.strip().replace(' ', '')
    # A comma in a short k/m-suffixed value is the European decimal comma
    # ("1,16m" = 1.16 million, "1,5k" = 1,500). A comma in a longer value
    # (already comma-grouped thousands like "1,185,000") is the US separator.
    # Heuristic: if there is exactly one comma and at most one digit/no-digit
    # before it ends in k/m, treat the comma as a decimal point.
    _ksuf = re.match(r'^(\d{1,3}),(\d{1,3})\s*([kKmM])$', raw)
    if _ksuf:
        raw = f"{_ksuf.group(1)}.{_ksuf.group(2)}{_ksuf.group(3)}"
    else:
        raw = raw.replace(',', '')
    # Double dots like "144..5" are likely reference numbers, not prices
    if '..' in raw:
        return None

    # Sanity cap applied at the end of each path — no watch is priced above
    # 50M in any currency; anything higher is a parsing error.
    SANITY_CAP = 50_000_000

    m = re.match(r'^([\d.]+)\s*[mM]$', raw)
    if m:
        try:
            # Use round() to avoid float drift: 2.05 * 1_000_000 = 2_049_999.999...
            val = round(float(m.group(1)) * 1000000)
            if val > SANITY_CAP:
                return None
            return f"{val:,}"
        except ValueError:
            return None

    m = re.match(r'^([\d.]+)\s*[kK]$', raw)
    if m:
        try:
            val = round(float(m.group(1)) * 1000)
            if val > SANITY_CAP:
                return None
            return f"{val:,}"
        except ValueError:
            return None

    try:
        if '.' in raw and raw.count('.') > 1:
            # Multiple dots — all are thousands separators: 1.208.000 → 1208000
            raw = raw.replace('.', '')
        elif '.' in raw:
            parts = raw.split('.')
            if len(parts[1]) == 3:
                # Single dot with 3-digit decimal part.
                # European thousands separator: "62.000" → 62000, "1.208" → 1208
                # BUT NOT when the integer part is already large (1208000.000 is NOT 1,208,000,000)
                # A real European number uses dots for grouping: "1.208.000" (has 2 dots, handled above)
                # If integer part has >3 digits, this dot is a decimal point, not thousands separator
                if len(parts[0]) <= 3:
                    raw = raw.replace('.', '')
                # else: keep as decimal (e.g., "1208000.000" → float 1208000.0 → 1,208,000)

        val = float(raw)
        if val < 1:
            return None
        # Reject values that look like years (2010-2035)
        if 2010 <= val <= 2035 and val == int(val):
            return None
        # Sanity cap: no watch price exceeds 50M in any currency.
        # Values above this threshold are parsing errors (e.g., 1,208,000,000).
        if val > 50_000_000:
            return None
        return f"{int(val):,}"
    except ValueError:
        return None


# Remarks that contain the word "new" but describe a replaced part, not the
# watch's condition ("New Clasp" on a used watch). Removed before condition
# keywords are matched.
_NEW_PART_RE = re.compile(
    r'(?<![a-z0-9])new\s+(?:clasps?|buckles?|papers?|certificates?|cards?|calibers?|calibres?|straps?|bracelets?|bezels?|dials?|hands|crystals?|movements?)(?![a-z0-9])'
)


def _find_condition(text: str, conditions: dict[str, str]) -> Optional[str]:
    """Return the condition of the longest keyword found as a whole word.
    Word boundaries keep 'new' from firing inside 'renew' or 'news'."""
    text_lower = _NEW_PART_RE.sub(' ', text.lower())
    for keyword in sorted(conditions.keys(), key=len, reverse=True):
        if re.search(r'(?<![a-z0-9])' + re.escape(keyword) + r'(?![a-z0-9])', text_lower):
            return conditions[keyword]
    return None


def extract_condition(content: str, mode: str, month_year: Optional[str] = None, ref_month: int = 1, ref_year: int = 2026) -> Optional[str]:
    """Extract and normalize condition from message text.
    For WTS: defaults to 'Unworn' when no explicit condition keyword is found."""
    conditions = WTS_CONDITIONS if mode == "WTS" else WTB_CONDITIONS
    found = _find_condition(content, conditions)
    if found:
        return found

    # WTS posts default to Unworn when no explicit condition is stated
    if mode == "WTS":
        return "Unworn"

    return None


def extract_condition_from_line(line: str, section_condition: Optional[str] = None, mode: str = "WTS") -> Optional[str]:
    """Extract condition from a single watch line, falling back to section condition.
    section_condition comes from the brand header (e.g., 'Patek Used' -> 'Used').
    For WTS, defaults to 'Unworn' when no condition is found (stock list items are
    typically unworn). For WTB, condition vocabulary is different ('Only Unworn' /
    'Can be Used') and there is no per-line default — fall back to section_condition
    or None."""
    conditions = WTS_CONDITIONS if mode == "WTS" else WTB_CONDITIONS
    found = _find_condition(line, conditions)
    if found:
        return found

    if mode == "WTS":
        return section_condition or "Unworn"
    return section_condition


def extract_location(content: str, sender_country: Optional[str], mode: str) -> Optional[str]:
    """Extract location country code.
    WTS: phone prefix with text override. WTB: phone prefix only."""
    if mode == "WTS":
        content_lower = content.lower()
        for country_code, patterns in WTS_LOCATION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, content_lower):
                    return country_code

    return sender_country


_LOCATION_CODES = {
    "hk": "HK", "hong kong": "HK", "hongkong": "HK",
    "us": "US", "usa": "US", "united states": "US",
    "uk": "UK", "united kingdom": "UK", "england": "UK",
    "eu": "EU", "europe": "EU",
    "de": "DE", "germany": "DE", "deutschland": "DE",
    "fr": "FR", "france": "FR",
    "it": "IT", "italy": "IT", "italia": "IT",
    "ch": "CH", "switzerland": "CH", "swiss": "CH",
    "ae": "AE", "dxb": "AE", "dubai": "AE", "uae": "AE", "emirates": "AE",
    "sg": "SG", "singapore": "SG",
    "jp": "JP", "japan": "JP",
    "cn": "CN", "china": "CN",
    "nl": "NL", "netherlands": "NL", "holland": "NL",
    "au": "AU", "australia": "AU",
    "ca": "CA", "canada": "CA",
    "kr": "KR", "korea": "KR",
    "th": "TH", "thailand": "TH",
    "vn": "VN", "vietnam": "VN",
    "ph": "PH", "philippines": "PH",
    "worldwide": "Worldwide", "any country": "Worldwide", "any location": "Worldwide",
}
# Longest-first so "hong kong" matches before "hk" would consume "h".
_LOCATION_TOKENS_SORTED = sorted(_LOCATION_CODES.keys(), key=len, reverse=True)
_LOCATION_TOKEN_PATTERN = r'\b(?:' + '|'.join(re.escape(t) for t in _LOCATION_TOKENS_SORTED) + r')\b'


def extract_location_remarks(content: str, mode: str) -> Optional[str]:
    """Location remarks written out (§6): 'Watch in Dubai' (WTS), 'Need in Miami,
    New York' (WTB), 'Ready Stock' for 'ready in HK'. Places and cities come from
    the editable list."""
    found = remark_rules.location_remarks(content, mode, _ACTIVE_REMARK_CONFIG)
    return ", ".join(found) if found else None


# Backward-compatible WTB helper (kept for _build_row callers)
def extract_wtb_location_remarks(content: str) -> Optional[str]:
    return extract_location_remarks(content, "WTB")


def normalize_remarks(content: str, mode: Optional[str] = None) -> str:
    """Remarks for a listing text (appendix A rules from the admin panel plus the
    numeric remarks built in code). Location remarks are added separately by
    extract_location_remarks."""
    return remark_rules.normalize_remarks(content, mode, _ACTIVE_REMARK_CONFIG, include_locations=False)


def format_timestamp(ts: datetime) -> str:
    """Format timestamp for CSV output: DD.MM.YY HH:MM:SS"""
    return ts.strftime("%d.%m.%y %H:%M:%S")


def _detect_section_condition(line: str, mode: str = "WTS") -> Optional[str]:
    """Detect condition from a brand section header line.
    WTS vocabulary: 'Unworn' / 'Used'. WTB vocabulary: 'Only Unworn' / 'Can be Used'.
    E.g., 'Patek Used ✨✨' -> 'Used' (WTS) or 'Can be Used' (WTB)."""
    cleaned = _clean_text(line).lower().strip()
    is_wtb = mode == "WTB"
    used_label = "Can be Used" if is_wtb else "Used"
    unworn_label = "Only Unworn" if is_wtb else "Unworn"

    def has(*words: str) -> bool:
        return any(re.search(r'(?<![a-z0-9])' + re.escape(w) + r'(?![a-z0-9])', cleaned) for w in words)

    if has('like new'):
        return used_label
    if re.match(r'^like\s*$', cleaned):
        return used_label
    if has('unworn', 'brand new', 'bnib', 'nos', 'stickered', 'sealed', 'new'):
        return unworn_label
    if has('used', 'pre-owned', 'preowned'):
        return used_label
    return None


def _is_stock_list_message(content: str) -> bool:
    """Detect if a message is a structured stock list (multi-line with watch reference lines).
    A stock list has either: brand headers + ref lines, OR enough ref lines (5+) without headers.
    Uses early termination for performance on large messages."""
    lines = content.split('\n')
    if len(lines) < 3:
        return False

    # Sample first 40 non-empty lines for quick detection
    brand_header_count = 0
    ref_line_count = 0
    sampled = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        sampled += 1
        if detect_brand_header(stripped) is not None:
            brand_header_count += 1
        elif _extract_ref_from_line(stripped):
            ref_line_count += 1
        # Early success: brand header + refs
        if brand_header_count >= 1 and ref_line_count >= 3:
            return True
        # Early success: enough ref lines even without brand header (e.g. flat price lists)
        if ref_line_count >= 5:
            return True
        # Only check first 40 non-empty lines
        if sampled >= 40:
            break

    # With brand header: 3+ refs. Without: 5+ refs needed.
    if brand_header_count >= 1 and ref_line_count >= 3:
        return True
    if ref_line_count >= 5:
        return True
    return False


# --- Real references and message splitting (§3) ------------------------------

# Known brand reference formats — a token that is not in the catalog still counts
# as a reference when it has one of these shapes.
_BRAND_FORMAT_RES = [re.compile(p) for p in (
    r'^m?\d{5,6}[a-z]{1,6}(?:-\d{4})?$',                       # Rolex / Tudor: 126610ln, 228349rbr-0036, m79360n-0001
    r'^\d{4}(?:/\d{1,4})?[a-z]{1,3}(?:-\d{3})?$',              # Patek: 5711/1a-010, 5167a, 7118/1200r
    r'^\d{4}/\d{1,4}[a-z]{0,3}(?:-\d{3})?$',                   # Patek: 5980/60g, 3940/1
    r'^\d{5}[a-z]{2}(?:\.[a-z0-9]{2}\.[a-z0-9]{3,8}(?:\.\d{2})?)?$',  # AP: 15210or.oo.a056kb.01
    r'^rm\d{2,3}(?:-\d{2})?[a-z]{0,4}$',                       # Richard Mille
    r'^\d{4}v/\d{3}[a-z](?:-[a-z0-9]{4})?$',                   # Vacheron: 4300v/220g-h151
    r'^\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{3}$',             # Omega
    r'^w[a-z]{3}\d{4}$|^w\d{7}$|^cr[a-z]{2}\d{4}$',            # Cartier
    r'^\d{3}\.[a-z]{2}\.\d{4}\.[a-z]{2}$',                     # Hublot
)]
_RM_TOKEN_RE = re.compile(r'(?<![A-Za-z0-9])RM\s?\d{2,3}(?:-\d{2})?(?![0-9])', re.IGNORECASE)


def _token_is_known_ref(tok: str, watch_index: dict) -> bool:
    t = tok.lower()
    for key in ("by_ws_code", "by_reference", "by_oem_ref"):
        if t in watch_index.get(key, {}):
            return True
    if ref_stem(t) in (watch_index.get("by_stem") or {}):
        return True
    # Bare digits ('126334') only when that digit sequence is a catalog reference.
    if re.fullmatch(r'\d{4,6}', t) and t in (watch_index.get("by_digits") or {}):
        return True
    return any(rx.match(t) for rx in _BRAND_FORMAT_RES)


def find_references(line: str, watch_index: dict) -> list[str]:
    """Real references in one line, in order. Dates and numbers are never a
    reference (10-2026, 06/2026, 29/08/2026, N10/26, W10, 2025, prices); a token
    counts only when its stem is in the catalog or it matches a known brand
    format. References are found anywhere, also after 'Ref', 'Ref.', 'ref:'."""
    text = _normalize_hyphens(_clean_text(line))
    masked = _mask_prices_and_dates(text)
    refs: list[str] = []
    for m in _RM_TOKEN_RE.finditer(masked):
        tok = re.sub(r'\s+', '', m.group(0))
        if tok.lower() not in [r.lower() for r in refs]:
            refs.append(tok)
    for m in _REF_TOKEN_RE.finditer(masked):
        if m.start() > 0 and (masked[m.start() - 1].isalnum() or masked[m.start() - 1] in '/-.'):
            continue
        tok = m.group(0).rstrip('.-/')
        if not tok or len(re.sub(r'\D', '', tok)) < 3:
            continue
        if re.match(r'^rm', tok, re.IGNORECASE):
            continue  # handled above
        if _is_non_ref_token(tok, masked[m.end():]):
            continue
        if not _token_is_known_ref(tok, watch_index):
            continue
        if tok.lower() not in [r.lower() for r in refs]:
            refs.append(tok)
    return refs


def _line_has_price(line: str) -> bool:
    t = _normalize_price_text(line)
    if extract_price(t)[0]:
        return True
    return bool(re.search(r'(?<![\w.,/\-])\d+(?:[.,]\d+)?\s?[kKmM](?![a-z])', t))


def split_message_into_listings(content: str, watch_index: dict) -> tuple[str, list[str]]:
    """Decide how a message splits into listings (§3).

    Counts the real references first:
      * 0 or 1 reference → the whole message is one listing ("single").
      * several references, each with a price on its own line → line by line ("list").
      * several references, prices on separate lines → blocks: each new reference
        starts a new watch; lines after a block's price go to the next block
        ("blocks").
    Returns (kind, texts).
    """
    lines = [l for l in content.split('\n') if l.strip()]
    ref_lines: dict[int, list[str]] = {}
    distinct: list[str] = []
    for i, line in enumerate(lines):
        if detect_brand_header(line):
            continue
        refs = find_references(line, watch_index)
        if refs:
            ref_lines[i] = refs
            for r in refs:
                st = ref_stem(r)
                if st not in distinct:
                    distinct.append(st)
    if len(distinct) <= 1:
        return "single", [content]
    if all(_line_has_price(lines[i]) for i in ref_lines):
        return "list", [content]

    blocks: list[list[str]] = []
    cur: list[str] = []
    carry: list[str] = []
    cur_ref = cur_price = False
    for i, line in enumerate(lines):
        is_ref = i in ref_lines
        is_price = _line_has_price(line)
        if is_ref:
            if cur_ref:
                blocks.append(cur)
                cur, carry = carry, []
                cur_price = False
            else:
                cur += carry
                carry = []
            cur.append(line)
            cur_ref = True
            cur_price = cur_price or is_price
        elif cur_ref and cur_price:
            carry.append(line)
        else:
            cur.append(line)
            cur_price = cur_price or is_price
    if cur or carry:
        blocks.append(cur + carry)
    return "blocks", ["\n".join(b) for b in blocks if b]


# --- Discarded messages (§2 tab 5) --------------------------------------------

_TRIVIAL_QUERY_RE = re.compile(
    r'^\W*(?:wtb|wts|\?+|price\s*\?*|pm|pm\s+me|pls\s+pm|dm|dm\s+me|how\s+much\s*\?*|hm\s*\?*|interested\s*\?*)\W*$',
    re.IGNORECASE,
)
_NON_WATCH_RE = re.compile(
    r'(?<![a-z])(?:spare\s+parts?|parts?\s+only|bags?|handbags?|birkin|kelly\s+\d{2}|jewel(?:le)?ry|necklace|'
    r'earrings?|bracelet\s+only|bangle|pendant|cufflinks?|sunglasses|clasp\s+only|links?\s+only|'
    r'crown\s+only|bezel\s+only|dial\s+only|movement\s+only|winder)(?![a-z])',
    re.IGNORECASE,
)
_THANKS_RE = re.compile(r'(?<![a-z])(?:thanks?|thank\s+you|thx|tks|ty|danke|merci|grazie|cheers)(?![a-z])', re.I)
_FEEDBACK_RE = re.compile(
    r'(?<![a-z])(?:received|legit|recommend(?:ed)?|great\s+deal|smooth\s+deal|good\s+deal|feedback|'
    r'trusted|reliable|arrived)(?![a-z])', re.I)
_QUESTION_RE = re.compile(r'\?\s*$|^(?:who|what|where|when|why|how|anyone|any1|does|do|is|are|can|could)\b', re.I)


def discard_reason_for_chat(content: str) -> str:
    text = _clean_text(content).strip()
    if _THANKS_RE.search(text):
        return "Thanks"
    if _FEEDBACK_RE.search(text):
        return "Feedback"
    if _QUESTION_RE.search(text):
        return "Question"
    return "Chat"


# --- Unknown currencies (§8.4) ------------------------------------------------

_SUPPORTED_ISO = {"USD", "USDT", "HKD", "EUR", "GBP", "CHF", "AED", "SGD", "CNY", "JPY", "RMB"}
_OTHER_ISO = ("THB|MYR|INR|KRW|TWD|AUD|CAD|NZD|RUB|TRY|SAR|QAR|KWD|BHD|OMR|IDR|PHP|VND|BRL|MXN|ZAR|SEK|"
              "NOK|DKK|PLN|CZK|HUF|ILS|EGP|NGN|BTC|ETH")
_UNKNOWN_CURRENCY_RE = re.compile(
    r'\d[\d,.]*\s?[kKmM]?\s*(' + _OTHER_ISO + r')(?![a-z])|(?<![a-z])(' + _OTHER_ISO + r')\s*:?\s*\d',
    re.IGNORECASE,
)


def unknown_currency(text: str) -> Optional[str]:
    """A currency the generator does not support ('350k THB'), else None."""
    m = _UNKNOWN_CURRENCY_RE.search(_normalize_price_text(text or ""))
    if not m:
        return None
    code = (m.group(1) or m.group(2) or "").upper()
    return code if code and code not in _SUPPORTED_ISO else None


# --- Row building --------------------------------------------------------------

def _candidate_meta(watches: list[dict], reason: str = "", score: Optional[float] = None) -> list[dict]:
    out = []
    for w in watches or []:
        if not w or not w.get("ws_code"):
            continue
        out.append({
            "ws_code": w.get("ws_code") or "",
            "brand": w.get("brand") or "",
            "model": w.get("model") or "",
            "reference": w.get("reference") or "",
            "score": score,
            "reason": reason,
        })
    return out


def shortlist_candidates(text: str, watch_index: dict, brand_hint: Optional[str] = None,
                         limit: int = 10) -> list[dict]:
    """5–10 plausible catalog watches for a text: same reference stem / digit
    sequence first, then alias hits, then the closest strings."""
    found: list[dict] = []

    def add(ws):
        for w in ws:
            if w and not any(w is f for f in found):
                found.append(w)

    refs = find_references(text, watch_index) or ([_extract_ref_from_line(text)] if _extract_ref_from_line(text) else [])
    for r in refs:
        rl = r.lower()
        add(watch_index["by_reference"].get(rl, []))
        add(watch_index["by_oem_ref"].get(rl, []))
        add((watch_index.get("by_stem") or {}).get(ref_stem(rl), []))
        add((watch_index.get("by_digits") or {}).get(digit_key(rl), []))
    pat = watch_index.get("_alias_pattern")
    if pat:
        for m in pat.finditer(text.lower()):
            add(watch_index["by_alias"].get(m.group(0), []))
    if len(found) < limit and refs and watch_index.get("fuzzy_by_digits"):
        # Closest strings among references that share the first digits — keeps
        # the scan small on a large catalog.
        for r in refs[:2]:
            dk = digit_key(r)
            if len(dk) < 3:
                continue
            prefix_index = watch_index.get("fuzzy_by_prefix3")
            if prefix_index is not None:
                choices = list(prefix_index.get(dk[:3], []))
            else:
                choices = [c for key, lst in watch_index["fuzzy_by_digits"].items() if key[:3] == dk[:3] for c in lst]
            if brand_hint:
                bh = brand_hint.lower()
                choices = [c for c in choices if (c[1].get("brand") or "").lower() == bh] or choices
            if not choices:
                continue
            for _s, _score, idx in process.extract(r.lower(), [c[0] for c in choices], scorer=fuzz.WRatio, limit=15):
                if _score >= 70:
                    add([choices[idx][1]])
    if brand_hint:
        bh = brand_hint.lower()
        found.sort(key=lambda w: (w.get("brand") or "").lower() != bh)
    return found[:limit]


def _resolve_month_year(content: str, mode: str, ref_month: int, ref_year: int) -> tuple[Optional[str], str]:
    """Resolve month/year for a listing. Returns (raw_month_year, normalized).

    Never fabricates a warranty date from the message timestamp. W-month codes
    (wood card) count like N-month codes. Future dates are rejected.
    """
    raw_month_year = extract_month_year_from_text(content)
    if raw_month_year:
        normalized = normalize_month_year(raw_month_year, ref_month, ref_year, mode)
        if normalized:
            return raw_month_year, normalized

    year = extract_year_from_line(content)
    if year and int(year) <= ref_year:
        suffix = "+" if mode == "WTB" else ""
        return None, f"{year}{suffix}"
    return None, ""


def _ctx_base_row(ctx: dict, watch: Optional[dict], brand: str = "") -> dict:
    return {
        "Nachrichten Art": ctx["mode"],
        "Marke": (watch or {}).get("brand") or brand or "",
        "WS-Code": (watch or {}).get("ws_code") or "",
        "Monat/Jahr": "",
        "Standort": "",
        "Zustand": "",
        "Bemerkungen": "",
        "Preis": "",
        "Nummer": ctx["phone"] or ctx["sender"],
        "Gruppe": ctx["group_name"],
        "Nachricht gepostet am": format_timestamp(ctx["timestamp"]),
    }


def _fill_fields(row: dict, scope: str, ctx: dict, watch: Optional[dict], *, line_level: bool,
                 section_condition: Optional[str] = None, location_text: Optional[str] = None,
                 extra_remarks: str = "") -> list[str]:
    """Fill date, location, condition, remarks and price. Returns review reasons
    raised by the price (§7 rule 3, unknown currency, brand minimum)."""
    mode = ctx["mode"]
    reasons: list[str] = []
    _raw, month_year = _resolve_month_year(scope, mode, ctx["ref_month"], ctx["ref_year"])
    row["Monat/Jahr"] = month_year
    row["Standort"] = (extract_location(location_text or scope, ctx["sender_country"], mode)
                       if not line_level else (ctx["sender_country"] or "")) or ""
    if line_level:
        row["Zustand"] = extract_condition_from_line(scope, section_condition, mode) or ""
    else:
        row["Zustand"] = extract_condition(scope, mode) or ""

    remarks = normalize_remarks(scope, mode)
    loc = extract_location_remarks(location_text or scope, mode)
    parts = [p for p in (remarks, loc, extra_remarks) if p]
    row["Bemerkungen"] = "; ".join(parts)

    if mode == "WTB":
        info = {"price": None, "currency": None}
        p, c = extract_wtb_price(scope, ctx["sender_country"])
        if not p:
            info = price_info(scope, ctx["sender_country"], line_level=False)
            p, c = info["price"], info["currency"]
        price, currency, rule_reason = p, c, None
    else:
        info = price_info(scope, ctx["sender_country"], line_level=line_level)
        price, currency, rule_reason = apply_list_price_rule(info, watch, ctx.get("rates"))
    if rule_reason:
        reasons.append(rule_reason)

    unknown = unknown_currency(scope)
    row["_currency_unknown"] = bool(unknown)
    if unknown:
        reasons.append(f"Unknown currency {unknown}")
    if mode == "WTS" and not price and not unknown:
        reasons.append("No price found for WTS post")
    if price and watch:
        ok, why = validate_price(price, watch.get("brand"))
        if not ok:
            reasons.append(why)
    row["Preis"] = f"{price} {currency}" if price and currency else (price or "")
    return reasons


def _finish_row(row: dict, ctx: dict, scope: str, *, reason: str = "", candidates=None,
                extracted_ref: Optional[str] = None, discard_reason: Optional[str] = None) -> dict:
    row["Original Text"] = scope.strip()[:500]
    if reason:
        row["Review Reason"] = reason
        row["_review_reason"] = reason
    if extracted_ref:
        row["Extracted Ref"] = extracted_ref
    row["_original_content"] = scope.strip()
    row["_message_text"] = ctx["content"]
    row["_attachments"] = list(ctx.get("attachments") or [])
    row["_msg_index"] = ctx["msg_index"]
    row["_sender_phone"] = ctx["phone"]
    row["_timestamp"] = ctx["timestamp"].isoformat() if isinstance(ctx["timestamp"], datetime) else str(ctx["timestamp"])
    row["_group"] = ctx["group_name"]
    row["_candidates"] = list(candidates or [])
    row["_discard_reason"] = discard_reason
    row.setdefault("_currency_unknown", False)
    return row


def _discard_row(ctx: dict, text: str, reason: str) -> dict:
    row = _ctx_base_row(ctx, None)
    return _finish_row(row, ctx, text, reason=reason, discard_reason=reason)


def _route_listing(
    buckets: dict, ctx: dict, scope: str, matches: list[dict], diag: dict, *,
    line_level: bool, extracted_ref: Optional[str], brand_hint: Optional[str],
    section_condition: Optional[str] = None, fuzzy_score: Optional[int] = None,
    location_text: Optional[str] = None, extra_remarks: str = "",
) -> None:
    """Put one listing into its bucket: matched, needs_review, not_in_database,
    aftermarket or discarded."""
    mode = ctx["mode"]
    watch_index = ctx["watch_index"]
    review: list[str] = []
    if not ctx["phone"]:
        review.append("No phone number (contact name used)")

    # Aftermarket is never imported — even if only one part is aftermarket.
    am = remark_rules.is_aftermarket(scope, _ACTIVE_REMARK_CONFIG)
    if am:
        watch = matches[0] if len(matches) == 1 and not diag.get("unsure") else None
        row = _ctx_base_row(ctx, watch, brand_hint or "")
        _fill_fields(row, scope, ctx, watch, line_level=line_level, section_condition=section_condition,
                     location_text=location_text, extra_remarks=extra_remarks)
        buckets["aftermarket"].append(_finish_row(
            row, ctx, scope, reason=f"Aftermarket ({am})", extracted_ref=extracted_ref,
            candidates=_candidate_meta(matches[:3], "text match")))
        return

    if not matches:
        if mode == "WTB" and not extracted_ref:
            buckets["discarded"].append(_discard_row(ctx, scope, "WTB without reference or model"))
            return
        if _NON_WATCH_RE.search(scope):
            buckets["discarded"].append(_discard_row(ctx, scope, "Spare part, bag or jewellery"))
            return
        row = _ctx_base_row(ctx, None, brand_hint or "")
        _fill_fields(row, scope, ctx, None, line_level=line_level, section_condition=section_condition,
                     location_text=location_text, extra_remarks=extra_remarks)
        reason = "No matching watch found in database"
        if not ctx["phone"]:
            reason += "; no phone number (contact name used)"
        cands = _candidate_meta(shortlist_candidates(scope, watch_index, brand_hint, limit=3), "similar text")
        buckets["not_in_database"].append(_finish_row(
            row, ctx, scope, reason=reason, extracted_ref=extracted_ref, candidates=cands))
        return

    unsure = len(matches) > 1 or bool(diag.get("unsure"))
    watch = None if unsure else matches[0]
    if unsure:
        review.append(diag.get("reason") or "Ambiguous match: " + ", ".join(
            w["ws_code"] for w in matches if w.get("ws_code")))
        # Keep the classic marker the image pass and AI verify read.
        if "Ambiguous match:" not in review[-1]:
            review.append("Ambiguous match: " + ", ".join(w["ws_code"] for w in matches if w.get("ws_code")))
    if fuzzy_score is not None and fuzzy_score < FUZZY_CONFIDENT_THRESHOLD:
        review.append(
            f"Similar reference — please verify ({fuzzy_score}% match: "
            + ", ".join(w["ws_code"] for w in matches if w.get("ws_code")) + ")")

    brand = matches[0].get("brand") if len({(w.get("brand") or "") for w in matches}) == 1 else (brand_hint or "")
    row = _ctx_base_row(ctx, watch, brand or "")
    if watch is None and fuzzy_score is not None and len(matches) == 1:
        row["WS-Code"] = matches[0]["ws_code"]
        row["Marke"] = matches[0]["brand"]
    review += _fill_fields(row, scope, ctx, watch or (matches[0] if len(matches) == 1 else None),
                           line_level=line_level, section_condition=section_condition,
                           location_text=location_text, extra_remarks=extra_remarks)

    cands = _candidate_meta(matches[:4], diag.get("reason") or "text match",
                            score=float(fuzzy_score) if fuzzy_score is not None else None)
    if review:
        if len(cands) < 2:
            extra = [w for w in shortlist_candidates(scope, watch_index, brand_hint, limit=4)
                     if w.get("ws_code") not in {c["ws_code"] for c in cands}]
            cands += _candidate_meta(extra[: 3 - len(cands)], "similar reference")
        buckets["needs_review"].append(_finish_row(
            row, ctx, scope, reason="; ".join(review), extracted_ref=extracted_ref, candidates=cands[:4]))
    else:
        buckets["matched"].append(_finish_row(row, ctx, scope, extracted_ref=extracted_ref, candidates=cands[:1]))


def _match_listing_text(text: str, watch_index: dict, brand_hint: Optional[str]) -> tuple[list[dict], dict, Optional[int], Optional[str]]:
    """Match a single listing text (whole message or block).
    Returns (matches, diag, fuzzy_score, extracted_ref)."""
    diag: dict = {}
    refs = find_references(text, watch_index)
    extracted = refs[0] if refs else _extract_ref_from_line(text.split('\n')[0]) if text else None
    matches = match_watch(text, watch_index, brand_hint=brand_hint, diag=diag)
    fuzzy_score = None
    if not matches and refs:
        line = next((l for l in text.split('\n') if refs[0].lower() in _normalize_hyphens(l).lower()), text)
        cleaned = _normalize_hyphens(_clean_text(line))
        pos = cleaned.lower().find(refs[0].lower())
        tokens = (cleaned[pos + len(refs[0]):] if pos >= 0 else cleaned).split()
        # Descriptor words on other lines of the block count too.
        tokens += [t for l in text.split('\n') if l is not line for t in _clean_text(l).split()]
        diag = {}
        matches, fuzzy_score = match_watch_by_ref(refs[0], watch_index, brand_hint=brand_hint,
                                                  line_tokens=tokens, return_fuzzy_score=True, diag=diag)
    return matches, diag, fuzzy_score, extracted


def parse_stock_list(
    content: str,
    mode: str,
    watch_index: dict,
    sender: str,
    timestamp: datetime,
    group_name: str,
    ref_month: int,
    ref_year: int,
    phone: Optional[str],
    sender_country: Optional[str],
    ctx: Optional[dict] = None,
    buckets: Optional[dict] = None,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Parse a line-by-line stock list (one watch per line, price on the same line).
    Returns (matched_rows, needs_review_rows, not_in_database_rows); aftermarket and
    discarded rows go into `buckets` when given.

    A brand header ('Patek Used ✨✨') sets the brand for the following lines; a
    line that starts with a brand and a reference ('AP 15407ST …') is a watch line
    whose brand applies to that line only.
    """
    if ctx is None:
        ctx = {"mode": mode, "watch_index": watch_index, "sender": sender, "timestamp": timestamp,
               "group_name": group_name, "ref_month": ref_month, "ref_year": ref_year, "phone": phone,
               "sender_country": sender_country, "attachments": [], "msg_index": -1, "content": content,
               "rates": None}
    own_buckets = buckets is None
    if buckets is None:
        buckets = _new_buckets()
    start_counts = {k: len(v) for k, v in buckets.items()}

    current_brand = None
    section_condition = None
    msg_location_remarks = extract_location_remarks(content, mode) or ""

    # Merge split lines: reference on one line, price/year on the next 1-3 lines.
    raw_lines = content.split('\n')
    lines = []
    i = 0
    while i < len(raw_lines):
        stripped_cur = raw_lines[i].strip()
        if stripped_cur:
            ref_cur = _extract_ref_from_line(stripped_cur)
            price_cur, _ = extract_price_from_line(stripped_cur, sender_country) if ref_cur else (None, None)
            if ref_cur and not price_cur:
                merged = stripped_cur
                consumed = 0
                for look in range(1, 4):
                    if i + look >= len(raw_lines):
                        break
                    nxt = raw_lines[i + look].strip()
                    if not nxt:
                        continue
                    if _extract_ref_from_line(nxt) or detect_brand_header(nxt):
                        break
                    price_nxt, _ = extract_price_from_line(nxt, sender_country)
                    year_nxt = extract_year_from_line(nxt) or extract_month_year_from_text(nxt)
                    merged += " " + nxt
                    consumed = look
                    if price_nxt:
                        break
                    if not year_nxt and not re.search(r'\b(?:used|new|unworn|nos|bnib|full\s*set|brand\s*new)\b', nxt, re.IGNORECASE):
                        break
                if consumed > 0:
                    lines.append(merged)
                    i += consumed + 1
                    continue
        lines.append(raw_lines[i])
        i += 1

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        brand = detect_brand_header(stripped)
        if brand is not None:
            current_brand = brand
            section_condition = _detect_section_condition(stripped, mode)
            continue
        if _is_section_header(stripped):
            cond = _detect_section_condition(stripped, mode)
            if cond:
                section_condition = cond
            continue

        ref = _extract_ref_from_line(stripped)
        if re.search(r'\bsold\b', stripped, re.IGNORECASE):
            continue

        line_brand = detect_brand_from_content(stripped) or current_brand
        if not ref:
            # A nickname / alias line with a price still is a listing ("Pepsi jub N3 150k").
            if not _line_has_price(stripped):
                continue
            diag: dict = {}
            alias_hits = match_watch(stripped, watch_index, brand_hint=line_brand, diag=diag)
            if not alias_hits:
                continue
            _route_listing(buckets, ctx, stripped, alias_hits, diag, line_level=True, extracted_ref=None,
                           brand_hint=line_brand, section_condition=section_condition,
                           location_text=content, extra_remarks="")
            continue

        cleaned_line = _normalize_hyphens(_clean_text(stripped)).strip()
        ref_pos = cleaned_line.lower().find(ref.lower())
        remaining = cleaned_line[ref_pos + len(ref):].strip() if ref_pos >= 0 else cleaned_line[len(ref):].strip()
        line_tokens = remaining.split() if remaining else []

        diag = {}
        watch_matches, fuzzy_score = match_watch_by_ref(
            ref, watch_index, brand_hint=line_brand,
            line_tokens=line_tokens, return_fuzzy_score=True, diag=diag,
        )
        if not watch_matches:
            diag = {}
            watch_matches = match_watch(stripped, watch_index, brand_hint=line_brand, diag=diag)

        _route_listing(buckets, ctx, stripped, watch_matches, diag, line_level=True, extracted_ref=ref,
                       brand_hint=line_brand, section_condition=section_condition, fuzzy_score=fuzzy_score,
                       location_text=None,
                       extra_remarks=msg_location_remarks)

    if own_buckets:
        return buckets["matched"], buckets["needs_review"], buckets["not_in_database"]
    return (buckets["matched"][start_counts["matched"]:],
            buckets["needs_review"][start_counts["needs_review"]:],
            buckets["not_in_database"][start_counts["not_in_database"]:])


def _find_watch_line(content: str, watch: Optional[dict]) -> str:
    """Return the single line of `content` most likely to describe the matched watch.
    Falls back to the full content when no anchor is found."""
    if not watch or not content:
        return content
    anchors = []
    for key in ("ws_code", "reference"):
        val = watch.get(key) if isinstance(watch, dict) else None
        if val:
            anchors.append(str(val).lower())
    aliases = watch.get("aliases") if isinstance(watch, dict) else None
    if isinstance(aliases, (list, tuple)):
        anchors.extend(str(a).lower() for a in aliases if a)
    oem_refs = watch.get("oem_references") if isinstance(watch, dict) else None
    if isinstance(oem_refs, (list, tuple)):
        anchors.extend(str(o).lower() for o in oem_refs if o)

    if not anchors:
        return content

    lines = content.splitlines()
    if len(lines) <= 1:
        return content

    for line in lines:
        low = line.lower()
        for a in anchors:
            if a and a in low:
                return line.strip()
    return content


def _build_row(
    mode: str,
    content: str,
    sender: str,
    timestamp: datetime,
    group_name: str,
    ref_month: int,
    ref_year: int,
    sender_country: Optional[str],
    phone: Optional[str] = None,
    watch: Optional[dict] = None,
    reason: str = "",
    attachments: Optional[list[str]] = None,
) -> dict:
    """Build a CSV row dict for one listing text (kept for callers outside the main loop)."""
    ctx = {"mode": mode, "watch_index": {}, "sender": sender, "timestamp": timestamp,
           "group_name": group_name, "ref_month": ref_month, "ref_year": ref_year, "phone": phone,
           "sender_country": sender_country, "attachments": attachments or [], "msg_index": -1,
           "content": content, "rates": None}
    row = _ctx_base_row(ctx, watch)
    _fill_fields(row, content, ctx, watch, line_level=False)
    _finish_row(row, ctx, _find_watch_line(content, watch), reason=reason)
    row["Review Reason"] = reason
    row["_review_reason"] = reason
    row["_original_content"] = content
    return row


def _price_values_in_text(text: str) -> set[int]:
    """Every price the text actually states (currency-tagged, k/m, or a bare
    4+ digit number that is not part of a reference)."""
    t = _normalize_price_text(text or "")
    values: set[int] = set()
    for p, _c in extract_all_prices(t):
        v = _num(p)
        if v:
            values.add(int(round(v)))
    for fn in (extract_price, _extract_price_from_line_basic):
        for line in [t] + t.split("\n"):
            p, _c = fn(line)
            v = _num(p)
            if v:
                values.add(int(round(v)))
    info = price_info(t)
    for key in ("price", "base_price"):
        v = _num(info.get(key))
        if v:
            values.add(int(round(v)))
    masked_refs = t
    for line in t.split("\n"):
        r = _extract_ref_from_line(line)
        if r:
            masked_refs = masked_refs.replace(r, " ")
    for m in re.finditer(r'(?<![\w/\-.])(\d[\d,.]*(?:\s?[kKmM](?![a-z]))?)(?![\w/\-])', masked_refs):
        raw = m.group(1)
        if len(re.sub(r'\D', '', raw)) < 4 and not re.search(r'[kKmM]$', raw):
            continue
        v = _num(_format_price(raw))
        if v:
            values.add(int(round(v)))
    return values


def price_in_text(price: str, text: str) -> bool:
    """True when `price` (e.g. '177,000') is one of the prices written in `text`."""
    v = _num(_format_price(str(price)) or str(price))
    if not v:
        return False
    return int(round(v)) in _price_values_in_text(text)


def _rows_to_csv(rows: list[dict]) -> str:
    """Convert list of row dicts to CSV string (internal '_' fields are skipped)."""
    if not rows:
        return ""
    output = io.StringIO()
    all_keys = list(CSV_HEADERS)
    for row in rows:
        for key in row:
            if key not in all_keys and not key.startswith("_"):
                all_keys.append(key)
    writer = csv.DictWriter(output, fieldnames=all_keys, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def canonical_month_year(my: str) -> str:
    """'10/26' = 'N10/2026' = 'W10/26' = '10/2026' → '10/26' (for duplicate checks)."""
    t = (my or "").strip().lower()
    plus = t.endswith("+")
    t = t.rstrip("+").rstrip("y")
    m = re.match(r'^[nw]?(\d{1,2})[/\-.](\d{2}|\d{4})$', t)
    if m:
        out = f"{int(m.group(1)):02d}/{int(m.group(2)) % 100:02d}"
        return out + ("+" if plus else "")
    return (my or "").strip().lower()


def _make_dedup_key(ws_code: str, phone: str, price: str, currency: str, month_year: str) -> str:
    """Generate a dedup key from order fields.
    Key: ws_code|phone|price_numeric|currency|month_year (all normalized; dates
    are normalised first so 10/26, N10/2026 and W10 are one listing)."""
    ws = ws_code.strip().lower() if ws_code else ""
    ph = re.sub(r'[\s\-\(\)]', '', phone).strip() if phone else ""
    pr = re.sub(r'[^\d]', '', price.split()[0]) if price else ""
    cur = currency.strip().upper() if currency else ""
    my = canonical_month_year(month_year)
    return f"{ws}|{ph}|{pr}|{cur}|{my}"


BUCKETS = ("matched", "matched_via_image", "needs_review", "not_in_database", "discarded", "aftermarket")


def _new_buckets() -> dict[str, list[dict]]:
    return {k: [] for k in BUCKETS}


# Photos are attached to a text only when it is clear (§5): same sender, at most
# two minutes apart, nothing in between, and the text holds exactly one watch.
PHOTO_ATTACH_WINDOW_SECONDS = 120


def attach_photos(messages: list[dict]) -> list[dict]:
    """Move photo-only messages onto the neighbouring caption of the same sender.

    A photo-only message is attached to the next message (or, failing that, the
    previous one) only when it comes from the same sender within two minutes with
    nothing in between. Photo-only messages that were attached are flagged with
    `_photo_attached` so the main loop skips them.
    """
    def _is_photo_only(m):
        return bool(m.get("attachments")) and not _strip_media_markers(m.get("content") or "").strip()

    def _close(a, b):
        try:
            return abs((a["timestamp"] - b["timestamp"]).total_seconds()) <= PHOTO_ATTACH_WINDOW_SECONDS
        except Exception:
            return False

    for i, msg in enumerate(messages):
        if not _is_photo_only(msg) or msg.get("_photo_attached"):
            continue
        for j in (i + 1, i - 1):
            if not 0 <= j < len(messages):
                continue
            other = messages[j]
            if other.get("sender") != msg.get("sender") or not _close(msg, other):
                continue
            if _is_photo_only(other) or not (other.get("content") or "").strip():
                continue
            if other.get("attachments") and j == i - 1:
                continue  # previous text already has its own photo
            other["attachments"] = list(other.get("attachments") or []) + [
                a for a in msg["attachments"] if a not in (other.get("attachments") or [])]
            msg["_photo_attached"] = True
            break
    return messages


def _process_messages_sync(
    messages: list[dict],
    mode: str,
    watch_index: dict,
    group_name: str,
    ref_month: int,
    ref_year: int,
    progress_state: Optional[dict] = None,
    rates: Optional[dict] = None,
) -> dict:
    """CPU-bound main processing loop. Runs in a thread pool so it doesn't
    block the async event loop.

    Each message is split into listings (§3) and every listing lands in one
    bucket: matched, needs_review, not_in_database, aftermarket or discarded.
    """
    global _fuzzy_match_count

    buckets = _new_buckets()
    detected_posts = 0
    total_messages = len(messages)
    attach_photos(messages)

    for idx, msg in enumerate(messages):
        if progress_state is not None and total_messages > 0 and idx % 20 == 0:
            pct = 15 + int((idx / total_messages) * 60)
            progress_state["percent"] = pct
            progress_state["detail"] = f"Processing messages... {idx:,}/{total_messages:,}"
        if msg.get("_photo_attached"):
            continue
        content = _strip_media_markers(msg["content"]).strip()
        sender = msg["sender"]
        timestamp = msg["timestamp"]
        attachments = msg.get("attachments") or []
        phone = extract_phone_number(sender)
        sender_country = get_country_from_phone(phone) if phone else None
        ctx = {"mode": mode, "watch_index": watch_index, "sender": sender, "timestamp": timestamp,
               "group_name": group_name, "ref_month": ref_month, "ref_year": ref_year, "phone": phone,
               "sender_country": sender_country, "attachments": attachments, "msg_index": idx,
               "content": content, "rates": rates}

        if not content:
            if attachments:
                buckets["discarded"].append(_discard_row(ctx, "", "Photo only"))
            continue
        if _SKIP_RE.search(content):
            continue
        if attachments and _TRIVIAL_QUERY_RE.match(_clean_text(content)):
            buckets["discarded"].append(_discard_row(ctx, content, "Photo with only WTB / ? / price? / pm"))
            continue

        post_type = detect_post_type(content)
        if post_type is None:
            if not should_skip_message(content):
                buckets["discarded"].append(_discard_row(ctx, content, discard_reason_for_chat(content)))
            continue
        if post_type != mode:
            continue
        detected_posts += 1

        before = {k: len(v) for k, v in buckets.items()}
        kind, texts = split_message_into_listings(content, watch_index)
        if kind == "list" or (kind == "single" and _is_stock_list_message(content)
                              and len(find_references(content, watch_index)) > 1):
            parse_stock_list(content=content, mode=mode, watch_index=watch_index, sender=sender,
                             timestamp=timestamp, group_name=group_name, ref_month=ref_month,
                             ref_year=ref_year, phone=phone, sender_country=sender_country,
                             ctx=ctx, buckets=buckets)
        else:
            for text in texts:
                brand_hint = detect_brand_from_content(text) or detect_brand_from_content(content)
                matches, diag, fuzzy_score, extracted = _match_listing_text(text, watch_index, brand_hint)
                _route_listing(buckets, ctx, text, matches, diag, line_level=False, extracted_ref=extracted,
                               brand_hint=brand_hint, fuzzy_score=fuzzy_score,
                               location_text=content if len(texts) == 1 else text)

        # A photo belongs to a listing only when the message holds exactly one watch.
        new_rows = [r for k in ("matched", "needs_review", "not_in_database", "aftermarket")
                    for r in buckets[k][before[k]:]]
        if len(new_rows) != 1:
            for r in new_rows:
                r["_attachments"] = []
        for r in new_rows:
            r["_listing_count"] = len(new_rows)

    return {
        "matched_rows": buckets["matched"],
        "needs_review_rows": buckets["needs_review"],
        "not_in_database_rows": buckets["not_in_database"],
        "aftermarket_rows": buckets["aftermarket"],
        "discarded_rows": buckets["discarded"],
        "detected_posts": detected_posts,
        "fuzzy_match_count": _fuzzy_match_count,
    }


# Cap image analysis so a huge export can't run up an unbounded vision bill.
# In WDG groups ~80 % of listings are photo + caption, so 200 rows per run was
# too low; override with the IMAGE_ANALYSIS_CAP environment variable.
import os as _os
try:
    IMAGE_ANALYSIS_CAP = int(_os.environ.get("IMAGE_ANALYSIS_CAP", "1000"))
except ValueError:
    IMAGE_ANALYSIS_CAP = 1000


def _ambiguous_candidates(row: dict, watch_index: dict) -> list[dict]:
    """Catalog candidates of an unsure row: its `_candidates`, else the codes
    behind an 'Ambiguous match: A, B' review reason."""
    codes: list[str] = [c.get("ws_code") for c in row.get("_candidates") or [] if c.get("ws_code")]
    if not codes:
        reason = row.get("Review Reason") or row.get("_review_reason") or ""
        m = re.search(r'Ambiguous match:\s*([^;]+)', reason)
        if m:
            codes = [c.strip() for c in m.group(1).split(",")]
    candidates = []
    for code in codes:
        watch = watch_index["by_ws_code"].get(code.strip().lower())
        if watch and watch not in candidates:
            candidates.append(watch)
    return candidates


async def _image_analysis_pass(
    matched_rows: list[dict],
    needs_review_rows: list[dict],
    watch_index: dict,
    media_archive: Optional[dict],
    report,
) -> tuple[list[dict], int, int]:
    """Resolve same-reference variants (and missing dates) from listing photos.

    Mutates `matched_rows` (enriched dates) and `needs_review_rows` (rows that
    the image resolved are removed). Returns
    (matched_via_image_rows, analyzed_count, enriched_count).

    Rows the image cannot settle stay exactly where they were — an unclear photo
    never produces an automatic match.
    """
    if not media_archive:
        return [], 0, 0

    from app.services.vision_matching import create_client
    client = create_client()
    if client is None:
        logger.info("image analysis: skipped — no OPENAI_API_KEY configured")
        return [], 0, 0

    # --- 1. Ambiguous rows: which catalog variant is it? ---
    variant_targets: list[tuple[int, list[str], list[dict], dict]] = []
    skipped_cap = 0
    for idx, row in enumerate(needs_review_rows):
        attachments = row.get("_attachments") or []
        if not attachments:
            continue
        # Only variant questions: a missing price / phone is not for the photo.
        reason = row.get("Review Reason") or ""
        if re.search(r'No price|No phone|Unknown currency|Discount|outlier', reason, re.IGNORECASE):
            continue
        if len(variant_targets) >= IMAGE_ANALYSIS_CAP:
            skipped_cap += 1
            continue
        candidates = _ambiguous_candidates(row, watch_index)
        if len(candidates) < 2:
            continue
        images = message_images(attachments, media_archive)
        if not images:
            continue
        variant_targets.append((idx, images, candidates, row))

    # --- 2. Matched rows missing the warranty date the photo may show ---
    field_targets: list[tuple[int, list[str], dict]] = []
    for idx, row in enumerate(matched_rows):
        if (row.get("Monat/Jahr") or "").strip():
            continue
        attachments = row.get("_attachments") or []
        if not attachments:
            continue
        images = message_images(attachments, media_archive)
        if not images:
            continue
        field_targets.append((idx, images, row))
        if len(field_targets) >= IMAGE_ANALYSIS_CAP:
            break

    if skipped_cap:
        logger.warning(f"image analysis: IMAGE_ANALYSIS_CAP={IMAGE_ANALYSIS_CAP} reached, "
                       f"{skipped_cap} unsure rows with photos stay in needs review")
    analyzed = len(variant_targets) + len(field_targets)
    if not analyzed:
        logger.info("image analysis: no rows qualified for image analysis")
        return [], 0, 0

    await report(
        "image_analysis", 87,
        f"Analyzing images — {len(variant_targets):,} ambiguous variants, "
        f"{len(field_targets):,} missing dates",
    )
    logger.info(f"image analysis: {len(variant_targets)} variant rows, "
                f"{len(field_targets)} field rows")

    variant_results = await gather_limited([
        (lambda text=(r.get("Original Text") or r.get("_original_content") or ""),
                imgs=images, cands=candidates:
            disambiguate_variant(client, text, imgs, cands))
        for _, images, candidates, r in variant_targets
    ])

    field_results = await gather_limited([
        (lambda text=(r.get("Original Text") or r.get("_original_content") or ""),
                imgs=images, ws=(r.get("WS-Code") or ""):
            extract_missing_month_year(client, text, imgs, ws))
        for _, images, r in field_targets
    ])

    # Apply variant verdicts: a confident hit becomes a "Matched via Image" row.
    matched_via_image_rows: list[dict] = []
    resolved_indices: list[int] = []
    for (idx, _images, candidates, row), result in zip(variant_targets, variant_results):
        if not result:
            continue
        watch = next(
            (c for c in candidates
             if (c.get("ws_code") or "").lower() == result["ws_code"].lower()),
            None,
        )
        if not watch:
            continue
        observed = result.get("observed") or {}
        observed_str = ", ".join(
            f"{k}: {v}" for k, v in observed.items() if v
        )
        new_row = dict(row)
        for k in ("Review Reason", "_review_reason", "Extracted Ref"):
            new_row.pop(k, None)
        new_row.update({
            "Marke": watch.get("brand", ""),
            "WS-Code": watch.get("ws_code", ""),
            "Image Confidence": result["confidence"],
            "Image Evidence": observed_str or result.get("reason", ""),
            "_candidates": _candidate_meta([watch], "image match", float(result["confidence"])),
        })
        if not new_row.get("Monat/Jahr") and result.get("card_month_year"):
            new_row["Monat/Jahr"] = result["card_month_year"]
        matched_via_image_rows.append(new_row)
        resolved_indices.append(idx)

    for idx in sorted(set(resolved_indices), reverse=True):
        needs_review_rows.pop(idx)

    # Apply field verdicts: fill the date in place, the row was already matched.
    enriched = 0
    for (idx, _images, row), result in zip(field_targets, field_results):
        if not result:
            continue
        matched_rows[idx]["Monat/Jahr"] = result["month_year"]
        enriched += 1

    logger.info(f"image analysis: {len(matched_via_image_rows)} variants resolved, "
                f"{enriched} dates recovered, {analyzed} rows analyzed")
    return matched_via_image_rows, analyzed, enriched


async def process_generation(
    txt_content: str,
    mode: str,
    ref_month: int,
    ref_year: int,
    group_name: str,
    jsonl_content: Optional[str] = None,
    progress_callback=None,
    media_archive: Optional[dict] = None,
    run_id: Optional[str] = None,
) -> dict:
    """Main processing function. Returns matched_csv, needs_review_csv, and stats.
    progress_callback: optional async callable(stage, percent, detail) for progress updates.

    The CPU-heavy matching loop runs in a thread pool so the event loop stays
    responsive for progress polling, /auth/me, and other HTTP requests."""
    import time
    from concurrent.futures import ThreadPoolExecutor
    t_start = time.time()

    async def _report(stage: str, percent: int, detail: str = ""):
        if progress_callback:
            await progress_callback(stage, percent, detail)

    global _fuzzy_match_count, _ACTIVE_REMARK_CONFIG
    _fuzzy_match_count = 0
    _fuzzy_match_cache.clear()

    # Remark rules (admin panel) and exchange rates are loaded once per run and
    # handed to the sync worker.
    _ACTIVE_REMARK_CONFIG = await remark_rules.load_remark_config()
    from app.services import fx as fx_service
    try:
        rates = await fx_service.load_rates()
    except Exception as e:  # never fail a run on the rate table
        logger.warning(f"process_generation: fx rates unavailable ({e}), using seed table")
        rates = dict(fx_service.SEED_RATES)

    await _report("building_index", 5, "Building watch index...")
    logger.info("process_generation: building watch index...")
    watch_index = await build_watch_index(jsonl_content)
    logger.info(f"process_generation: watch index built ({len(watch_index.get('by_ws_code', {}))} ws_codes, "
                f"{len(watch_index.get('fuzzy_candidates', []))} fuzzy candidates) in {time.time()-t_start:.1f}s")

    await _report("parsing", 10, "Parsing messages...")
    messages = parse_whatsapp_txt(txt_content)
    total_messages = len(messages)
    logger.info(f"process_generation: parsed {total_messages} messages from txt")

    await _report("processing", 15, f"Processing {total_messages:,} messages...")

    # Shared dict for thread-safe progress updates from the sync worker.
    # The sync function writes to it; we poll it here on the event loop and
    # push updates to MongoDB so the frontend sees real-time progress.
    progress_state = {"percent": 15, "detail": "Starting..."}

    # Run CPU-bound matching in a thread pool so the event loop stays free
    loop = asyncio.get_event_loop()
    logger.info("process_generation: launching thread pool for message processing...")
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = loop.run_in_executor(
            pool,
            _process_messages_sync,
            messages, mode, watch_index, group_name, ref_month, ref_year,
            progress_state, rates,
        )

        # Poll the shared progress state while the thread works and push
        # updates to MongoDB so the frontend progress endpoint returns fresh data.
        last_reported_pct = 15
        poll_count = 0
        while not future.done():
            await asyncio.sleep(1.0)
            poll_count += 1
            pct = progress_state.get("percent", last_reported_pct)
            detail = progress_state.get("detail", "")
            if pct > last_reported_pct:
                last_reported_pct = pct
                logger.info(f"process_generation: thread progress {pct}% — {detail}")
                await _report("processing", pct, detail)

        logger.info(f"process_generation: thread finished after {poll_count} polls")
        sync_result = future.result()

    matched_rows = sync_result["matched_rows"]
    needs_review_rows = sync_result["needs_review_rows"]
    not_in_database_rows = sync_result["not_in_database_rows"]
    aftermarket_rows = sync_result.get("aftermarket_rows", [])
    discarded_rows = sync_result.get("discarded_rows", [])
    detected_posts = sync_result["detected_posts"]

    t_main_loop = time.time()
    logger.info(f"process_generation: main loop done in {t_main_loop-t_start:.1f}s — "
                f"{detected_posts} posts detected, {len(matched_rows)} matched, "
                f"{len(needs_review_rows)} needs_review, {len(not_in_database_rows)} not_in_database, "
                f"{sync_result['fuzzy_match_count']} fuzzy matches")

    await _report(
        "processing", 75,
        f"Main processing done — {len(matched_rows):,} matched, "
        f"{len(needs_review_rows):,} needs review, "
        f"{len(not_in_database_rows):,} not in database",
    )

    # --- AI matching pass: attempt to match remaining "not in database" items ---
    # Each row is sent with its own 5–10 catalog candidates instead of the whole
    # catalog (§4: the whole catalog was ~200k tokens per batch).
    AI_MATCHING_CAP = 3000
    AI_MATCHING_TIMEOUT = 180  # seconds

    ai_matched_count = 0
    ai_suggested_additions = []  # Watches not in catalog but identified by AI
    unmatched_for_ai = []
    unmatched_indices = []

    for i, row in enumerate(not_in_database_rows):
        content_i = row.get("_original_content", "")
        brand_i = row.get("Marke") or None
        unmatched_for_ai.append({
            "index": len(unmatched_for_ai),
            "content": content_i,
            "brand_hint": brand_i,
            "candidates": [w["ws_code"] for w in shortlist_candidates(content_i, watch_index, brand_i, limit=10)],
        })
        unmatched_indices.append(i)

    if unmatched_for_ai:
        total_unmatched = len(unmatched_for_ai)
        if total_unmatched > AI_MATCHING_CAP:
            logger.info(f"process_generation: capping AI matching from {total_unmatched} to {AI_MATCHING_CAP} items")
            unmatched_for_ai = unmatched_for_ai[:AI_MATCHING_CAP]
            unmatched_indices = unmatched_indices[:AI_MATCHING_CAP]

        ai_count = len(unmatched_for_ai)
        skipped = total_unmatched - ai_count
        skip_msg = f" ({skipped:,} skipped)" if skipped else ""
        await _report("ai_matching", 80, f"AI matching {ai_count:,} unmatched items...{skip_msg}")
        t_ai_start = time.time()
        ai_results = await batch_ai_match(unmatched_for_ai, watch_index, timeout=AI_MATCHING_TIMEOUT)
        logger.info(f"process_generation: AI matching done in {time.time()-t_ai_start:.1f}s — {len(ai_results)} results")
        if len(ai_results) < ai_count:
            await _report("ai_matching", 85,
                          f"AI answered {len(ai_results):,} of {ai_count:,} items — the rest keep their parsed result")

        ai_lookup = {r["index"]: r for r in ai_results}
        indices_to_remove = []
        indices_to_move_to_review = []
        for ai_idx, nid_idx in enumerate(unmatched_indices):
            if ai_idx not in ai_lookup:
                continue
            result = ai_lookup[ai_idx]
            confidence = result.get("confidence", 0)
            row = not_in_database_rows[nid_idx]
            original_content = row.get("_original_content", "")
            watch = result.get("watch")

            def _note(text: str) -> None:
                row["Review Reason"] = f"{row.get('Review Reason', '')}; {text}" if row.get("Review Reason") else text
                row["_review_reason"] = row["Review Reason"]

            if confidence < 80:
                _note(f"AI suggestion ({confidence}%): {result.get('ai_ws_code', '?')}")
                if watch:
                    row["_candidates"] = _candidate_meta([watch], "AI suggestion", float(confidence)) + [
                        c for c in row.get("_candidates", []) if c["ws_code"] != watch["ws_code"]][:2]
                indices_to_move_to_review.append(nid_idx)
                continue

            if watch is None:
                # Identified, but not a catalog watch: review it and offer it as a
                # catalog addition (the CSV import matches ws_codes strictly).
                ai_ws = result.get("ai_ws_code", "")
                _note(f"AI identified {ai_ws or '?'} ({confidence}%), not in catalog")
                indices_to_move_to_review.append(nid_idx)
                if ai_ws and result.get("ai_brand"):
                    ai_suggested_additions.append({
                        "brand": result.get("ai_brand", ""),
                        "suggested_ws_code": ai_ws,
                        "model": result.get("ai_model", ""),
                        "reference": ai_ws.split()[0],
                        "confidence": confidence,
                        "example_line": original_content[:200],
                    })
                continue

            row["WS-Code"] = watch["ws_code"]
            row["Marke"] = watch["brand"]
            row["_candidates"] = _candidate_meta([watch], "AI match", float(confidence))
            row["_ai_reason"] = f"AI match ({confidence}%)"
            row.pop("Review Reason", None)
            row.pop("_review_reason", None)
            row.pop("Extracted Ref", None)
            problems = []
            if mode == "WTS" and not row.get("Preis"):
                problems.append("No price found for WTS post")
            if row.get("Preis"):
                ok, why = validate_price(row["Preis"].split()[0], watch["brand"])
                if not ok:
                    problems.append(why)
            if problems:
                row["Review Reason"] = "; ".join(problems)
                indices_to_move_to_review.append(nid_idx)
                continue
            matched_rows.append(row)
            indices_to_remove.append(nid_idx)
            ai_matched_count += 1

        move_set = set(indices_to_move_to_review)
        remove_set = set(indices_to_remove)
        for idx in sorted(move_set | remove_set, reverse=True):
            row = not_in_database_rows[idx]
            if idx in move_set:
                needs_review_rows.append(row)
            not_in_database_rows.pop(idx)

    # ─── AI verification pass ───
    # Re-check every matched row and every needs_review row. AI may:
    #   - Keep (high confidence): leave untouched
    #   - Flip (confidence >= 95): correct the ws_code / price / currency
    #   - Demote (confidence < 80): move to needs_review with AI reason
    # Skipped if OPENAI_API_KEY is missing.
    try:
        from app.core.config import settings as _settings  # type: ignore
        _ai_enabled = bool(getattr(_settings, 'OPENAI_API_KEY', None))
    except Exception:
        _ai_enabled = False

    if _ai_enabled and (matched_rows or needs_review_rows):
        await _report("ai_verification", 86, "AI verifying matches and prices...")
        verify_items: list[dict] = []
        # Tag each source row so we can apply the verdict back. Tier markers:
        #   ("matched", row_index) or ("review", row_index)
        verify_sources: list[tuple[str, int]] = []
        for i, row in enumerate(matched_rows):
            price_parts = (row.get("Preis") or "").split()
            cur_price = price_parts[0] if price_parts else None
            cur_currency = price_parts[1] if len(price_parts) > 1 else None
            verify_items.append({
                "index": len(verify_items),
                "original_text": row.get("Original Text", "")[:400],
                "current_ws_code": row.get("WS-Code"),
                "current_price": cur_price,
                "current_currency": cur_currency,
                "candidates": [row.get("WS-Code")] if row.get("WS-Code") else [],
                "brand_hint": row.get("Marke"),
            })
            verify_sources.append(("matched", i))
        for i, row in enumerate(needs_review_rows):
            price_parts = (row.get("Preis") or "").split()
            cur_price = price_parts[0] if price_parts else None
            cur_currency = price_parts[1] if len(price_parts) > 1 else None
            # Try to harvest candidate ws_codes from the review reason
            reason = row.get("Review Reason", "") or ""
            candidates = []
            m = re.search(r'Ambiguous match:\s*([^;]+)', reason)
            if m:
                candidates = [c.strip() for c in m.group(1).split(",") if c.strip()]
            for c in row.get("_candidates") or []:
                if c.get("ws_code") and c["ws_code"] not in candidates:
                    candidates.append(c["ws_code"])
            if row.get("WS-Code") and row["WS-Code"] not in candidates:
                candidates.insert(0, row["WS-Code"])
            verify_items.append({
                "index": len(verify_items),
                "original_text": (row.get("Original Text") or row.get("_original_content") or "")[:400],
                "current_ws_code": row.get("WS-Code") or None,
                "current_price": cur_price,
                "current_currency": cur_currency,
                "candidates": candidates,
                "brand_hint": row.get("Marke"),
            })
            verify_sources.append(("review", i))

        verify_cap = min(len(verify_items), AI_MATCHING_CAP)
        if verify_cap < len(verify_items):
            logger.info(f"process_generation: capping AI verification from {len(verify_items)} to {verify_cap}")
            verify_items = verify_items[:verify_cap]
            verify_sources = verify_sources[:verify_cap]

        # Rows without a verdict (timeout, failed batch) keep their
        # deterministic result.
        verify_results = await batch_ai_verify(verify_items, watch_index, mode, timeout=AI_MATCHING_TIMEOUT)

        verdict_lookup = {v.get("index"): v for v in verify_results if v.get("index") is not None}

        # Apply verdicts. Collect indices to move so we don't mutate during iteration.
        matched_to_demote: list[int] = []
        for verdict_idx, (tier, row_idx) in enumerate(verify_sources):
            verdict = verdict_lookup.get(verdict_idx)
            if not verdict:
                continue
            action = verdict.get("action")
            conf = verdict.get("confidence", 0)
            new_ws = (verdict.get("ws_code") or "").strip()
            new_price = verdict.get("price")
            new_currency = verdict.get("currency")
            reason = verdict.get("reason") or ""

            # A ws_code the catalog does not know would leave the row
            # unimportable (the CSV import matches ws_codes strictly), so the AI
            # may only move a row to a catalog watch.
            cat_watch = watch_index["by_ws_code"].get(new_ws.lower()) if new_ws else None

            # Never accept a price that is not in the text (7118/1200R … 177000usdt
            # must not become 7,118 USD).
            src_text = (matched_rows[row_idx] if tier == "matched" else needs_review_rows[row_idx])
            src_text = src_text.get("_original_content") or src_text.get("Original Text") or ""
            if new_price and not price_in_text(str(new_price), src_text):
                if new_price:
                    logger.info(f"AI verify: ignoring price {new_price} not found in text")
                new_price = None
                new_currency = None

            if tier == "matched":
                row = matched_rows[row_idx]
                if action == "flip" and conf >= 95 and cat_watch:
                    row["WS-Code"] = cat_watch["ws_code"]
                    row["Marke"] = cat_watch["brand"]
                    row["_ai_reason"] = f"AI verify ({conf}%): {reason}"
                    if new_price and new_currency:
                        row["Preis"] = f"{_format_price(str(new_price)) or new_price} {_canonicalize_currency(str(new_currency))}"
                    elif new_price:
                        row["Preis"] = _format_price(str(new_price)) or str(new_price)
                elif action == "demote" and conf < 80:
                    row["Review Reason"] = (
                        f"AI demoted ({conf}%): {reason}" if not row.get("Review Reason")
                        else f"{row['Review Reason']}; AI demoted ({conf}%): {reason}"
                    )
                    matched_to_demote.append(row_idx)
                # 'keep' → do nothing; ignore flips below threshold (too risky)
            else:  # tier == "review"
                row = needs_review_rows[row_idx]
                if action in ("keep", "flip") and conf >= 80 and cat_watch:
                    # The AI pick is offered as the first suggestion; the WS-Code
                    # is not pre-filled while the variant is open.
                    cands = [c for c in row.get("_candidates") or [] if c.get("ws_code") != cat_watch["ws_code"]]
                    row["_candidates"] = _candidate_meta([cat_watch], f"AI: {reason}", float(conf)) + cands
                    row["Marke"] = row.get("Marke") or cat_watch["brand"]
                    if new_price and new_currency:
                        row["Preis"] = f"{_format_price(str(new_price)) or new_price} {_canonicalize_currency(str(new_currency))}"
                else:
                    # Append AI reason to existing review reason
                    ai_note = f"AI ({conf}%): {reason}"
                    row["Review Reason"] = (
                        ai_note if not row.get("Review Reason")
                        else f"{row['Review Reason']}; {ai_note}"
                    )

        # Move demoted matched rows to needs_review (process in reverse)
        for idx in sorted(set(matched_to_demote), reverse=True):
            needs_review_rows.append(matched_rows[idx])
            matched_rows.pop(idx)

        logger.info(f"AI verification applied: {len(verdict_lookup)} verdicts, {len(matched_to_demote)} demoted")

    # Generate suggested-additions CSV (watches identified by AI but not in catalog)
    suggested_csv = ""
    unique_suggestions = []
    if ai_suggested_additions:
        # Deduplicate suggestions by suggested_ws_code
        seen_suggestions = set()
        for s in ai_suggested_additions:
            key = s["suggested_ws_code"].lower()
            if key not in seen_suggestions:
                unique_suggestions.append(s)
                seen_suggestions.add(key)

        sug_output = io.StringIO()
        sug_headers = ["brand", "suggested_ws_code", "model", "reference", "confidence", "example_line"]
        sug_writer = csv.DictWriter(sug_output, fieldnames=sug_headers)
        sug_writer.writeheader()
        for s in sorted(unique_suggestions, key=lambda x: x["confidence"], reverse=True):
            sug_writer.writerow(s)
        suggested_csv = sug_output.getvalue()

    # --- Cross-currency normalization pass ---
    # Rationale: a bare "$550K" from a contact-name sender (no phone → country
    # unknown) gets labelled USD, while the identical listing from a phoned
    # sender gets HKD. When the same ws_code + numeric value appears in a group
    # under the group's dominant currency, flip the minority-currency row.
    def _parse_preis(preis: str) -> tuple[Optional[str], Optional[str]]:
        if not preis:
            return None, None
        parts = preis.split()
        if len(parts) >= 2:
            return parts[0], parts[1]
        return (parts[0] if parts else None), None

    # Build per-group currency tallies from matched rows (ground truth — these
    # had enough context to be confidently matched). Needs_review rows are
    # noisier and excluded from the tally.
    group_currency_counts: dict[str, dict[str, int]] = {}
    for row in matched_rows:
        grp = row.get("Gruppe") or ""
        _p, cur = _parse_preis(row.get("Preis") or "")
        if not cur:
            continue
        group_currency_counts.setdefault(grp, {})
        group_currency_counts[grp][cur] = group_currency_counts[grp].get(cur, 0) + 1

    # Index: (group, ws_code, numeric_value) → currencies present (from matched rows)
    value_index: dict[tuple[str, str, str], set[str]] = {}
    for row in matched_rows:
        grp = row.get("Gruppe") or ""
        ws = (row.get("WS-Code") or "").lower()
        num, cur = _parse_preis(row.get("Preis") or "")
        if not ws or not num or not cur:
            continue
        key = (grp, ws, num)
        value_index.setdefault(key, set()).add(cur)

    def _maybe_flip(row: dict) -> bool:
        grp = row.get("Gruppe") or ""
        ws = (row.get("WS-Code") or "").lower()
        num, cur = _parse_preis(row.get("Preis") or "")
        if not ws or not num or not cur:
            return False
        counts = group_currency_counts.get(grp, {})
        if not counts:
            return False
        dominant = max(counts.items(), key=lambda kv: kv[1])[0]
        if cur == dominant:
            return False
        cur_count = counts.get(cur, 0)
        dom_count = counts.get(dominant, 0)
        # Require dominant clearly wins: either 3x the minority OR minority is
        # exactly this row (cur_count <= 1 means no other row votes for cur).
        if dom_count < 3 or (cur_count > 1 and dom_count < cur_count * 3):
            return False
        peer_currencies = value_index.get((grp, ws, num), set())
        if dominant in peer_currencies:
            row["Preis"] = f"{num} {dominant}"
            return True
        return False

    flipped_count = 0
    for row in matched_rows:
        if _maybe_flip(row):
            flipped_count += 1
    for row in needs_review_rows:
        if _maybe_flip(row):
            flipped_count += 1

    if flipped_count:
        logger.info(f"process_generation: cross-currency normalized {flipped_count} matched rows")

    # Missing-year rows are kept in matched. Year is a quality signal but not
    # a blocker — a watch with price + condition + remarks is still a useful
    # listing even without a warranty date. The year-based price-outlier check
    # already handles the downstream "is this price sane" question.

    # --- Outlier price detection ---
    # Year-based check first (peers = same ws_code + same condition + same year),
    # with a global-median fallback for rows that have no year-based peers at all.
    # Catches: (a) currency misclassifications (USD 140k vs HKD 140k ≈ 8× drift),
    # (b) wildly-off dealer typos (260k for 5712/1R when 2018 market is ~1.8M+),
    # (c) single-row currency defaults that don't match the group consensus.
    # Central rate table (app.services.fx), loaded once at the start of the run.
    def _to_hkd(num: str, cur: str) -> Optional[float]:
        try:
            amount = float(num.replace(',', ''))
        except ValueError:
            return None
        return fx_service.convert(amount, (cur or "USD").upper(), "HKD", rates)

    def _extract_year(my: str) -> Optional[int]:
        """Extract 4-digit year from the Monat/Jahr field.
        Handles '02/26', 'N3/2026', '2025', '2025+', '11-2024', etc."""
        if not my:
            return None
        m = re.search(r'(20\d{2})', my)
        if m:
            return int(m.group(1))
        m = re.search(r'/(\d{2})(?:\+|$)', my)
        if m:
            return 2000 + int(m.group(1))
        m = re.match(r'^(\d{2})(?:/|\+|$)', my)
        if m:
            yy = int(m.group(1))
            if 10 <= yy <= 35:
                return 2000 + yy
        return None

    # Bucket by (ws_code, condition, year) for year-based peers,
    # and by ws_code alone for the global-median fallback.
    year_buckets: dict[tuple[str, str, int], list[float]] = {}
    peers_by_ws: dict[str, list[float]] = {}
    for row in matched_rows:
        ws = (row.get("WS-Code") or "").strip()
        cond = (row.get("Zustand") or "").strip().lower()
        num, _, cur = (row.get("Preis") or "").partition(' ')
        if not ws or not num or not cur:
            continue
        v = _to_hkd(num, cur)
        if v is None:
            continue
        peers_by_ws.setdefault(ws, []).append(v)
        year = _extract_year(row.get("Monat/Jahr") or "")
        if year is not None:
            year_buckets.setdefault((ws, cond, year), []).append(v)

    def _peers_for_year(ws: str, cond: str, year: int, self_hkd: float) -> tuple[Optional[list[float]], int]:
        """Return (peers list excluding one instance of self, year_used). Tries
        exact year first, then nearest higher, then nearest lower, requiring
        ≥3 peers in the chosen bucket (i.e. ≥2 after self is removed).
        Returns (None, 0) when no bucket qualifies."""
        def _without_self(bucket: list[float]) -> list[float]:
            # Remove one occurrence of self_hkd so the row doesn't self-anchor.
            out = list(bucket)
            try:
                out.remove(self_hkd)
            except ValueError:
                pass
            return out

        exact = year_buckets.get((ws, cond, year))
        if exact and len(exact) >= 3:
            return _without_self(exact), year
        # Nearest higher years (up to +10)
        for offset in range(1, 11):
            b = year_buckets.get((ws, cond, year + offset))
            if b and len(b) >= 3:
                return _without_self(b), year + offset
        # Nearest lower years (up to -10)
        for offset in range(1, 11):
            b = year_buckets.get((ws, cond, year - offset))
            if b and len(b) >= 3:
                return _without_self(b), year - offset
        return None, 0

    outlier_indices: list[int] = []
    for idx, row in enumerate(matched_rows):
        ws = (row.get("WS-Code") or "").strip()
        cond = (row.get("Zustand") or "").strip().lower()
        num, _, cur = (row.get("Preis") or "").partition(' ')
        if not ws or not num or not cur:
            continue
        v = _to_hkd(num, cur)
        if v is None:
            continue

        year = _extract_year(row.get("Monat/Jahr") or "")
        year_check_fired = False

        if year is not None:
            peers, year_used = _peers_for_year(ws, cond, year, v)
            if peers and len(peers) >= 2:
                year_check_fired = True
                # Median-based band. Median is robust to bucket contamination
                # by duplicated outliers (a bad price reposted N times doesn't
                # drag the median the way min/max or IQR does). The tolerance
                # widens around the median value.
                sp = sorted(peers)
                median = sp[len(sp) // 2]
                tolerance = 0.25 if year_used == year else 0.35
                lo_bound = median * (1 - tolerance)
                hi_bound = median * (1 + tolerance)
                if not (lo_bound <= v <= hi_bound):
                    year_tag = f"{year_used}" if year_used == year else f"{year_used} (nearest to {year})"
                    reason = (
                        f"Price outlier: {num} {cur} (~{int(v):,} HKD) outside "
                        f"{int(tolerance*100)}% of median {int(median):,} HKD "
                        f"for {ws} {cond or '?'} {year_tag}"
                    )
                    row["_review_reason"] = reason
                    row["Review Reason"] = reason
                    row["_original_content"] = row.get("Original Text", "")
                    outlier_indices.append(idx)

        # Fallback: global-median per ws_code — only when the year-based check
        # didn't fire (no year, or no qualifying peer bucket anywhere).
        if year_check_fired:
            continue
        peers = peers_by_ws.get(ws, [])
        if len(peers) < 3:
            continue
        sorted_peers = sorted(peers)
        median = sorted_peers[len(sorted_peers) // 2]
        if median <= 0:
            continue
        ratio = v / median
        if ratio < 0.33 or ratio > 3.0:
            reason = (
                f"Price outlier: {num} {cur} (~{int(v):,} HKD) vs market median "
                f"~{int(median):,} HKD for {ws}"
            )
            row["_review_reason"] = reason
            row["Review Reason"] = reason
            row["_original_content"] = row.get("Original Text", "")
            outlier_indices.append(idx)

    for idx in sorted(set(outlier_indices), reverse=True):
        needs_review_rows.append(matched_rows[idx])
        matched_rows.pop(idx)

    if outlier_indices:
        logger.info(f"process_generation: flagged {len(outlier_indices)} price outliers")

    # ─── Image-based variant disambiguation ───
    # Runs only when a media archive was uploaded, and only on the rows text
    # parsing could not settle on its own. Everything already matched from text
    # is left untouched.
    matched_via_image_rows, image_analyzed_count, image_enriched_count = await _image_analysis_pass(
        matched_rows=matched_rows,
        needs_review_rows=needs_review_rows,
        watch_index=watch_index,
        media_archive=media_archive,
        report=_report,
    )

    await _report("dedup", 88, "Deduplicating rows...")

    # --- Dedup matched rows: (ws_code, phone, price, currency, month_year) ---
    # Keep most recent per dedup key
    await _report("dedup", 90, "Deduplicating matched rows...")

    dedup_map = {}
    for row in matched_rows:
        price_parts = row["Preis"].split() if row["Preis"] else ["", ""]
        price_num = price_parts[0] if price_parts else ""
        currency = price_parts[1] if len(price_parts) > 1 else ""
        key = _make_dedup_key(
            row["WS-Code"],
            row["Nummer"],
            price_num,
            currency,
            row["Monat/Jahr"],
        )
        existing = dedup_map.get(key)
        if existing is None:
            dedup_map[key] = row
        else:
            # Keep the one with the later timestamp
            existing_ts = existing.get("Nachricht gepostet am", "")
            new_ts = row.get("Nachricht gepostet am", "")
            if new_ts > existing_ts:
                dedup_map[key] = row

    deduped_count = len(matched_rows) - len(dedup_map)
    matched_rows = list(dedup_map.values())
    if deduped_count > 0:
        logger.info(f"process_generation: deduped {deduped_count} matched rows")

    # Dedup needs-review rows similarly
    nr_dedup_map = {}
    for row in needs_review_rows:
        price_parts = row.get("Preis", "").split() if row.get("Preis") else ["", ""]
        price_num = price_parts[0] if price_parts else ""
        currency = price_parts[1] if len(price_parts) > 1 else ""
        key = _make_dedup_key(
            row.get("WS-Code", ""),
            row.get("Nummer", ""),
            price_num,
            currency,
            row.get("Monat/Jahr", ""),
        )
        # For needs-review, also include extracted ref in key to avoid merging different watches
        extracted_ref = row.get("Extracted Ref", "")
        if extracted_ref and not row.get("WS-Code"):
            key = f"{key}|{extracted_ref.lower()}"

        existing = nr_dedup_map.get(key)
        if existing is None:
            nr_dedup_map[key] = row
        else:
            existing_ts = existing.get("Nachricht gepostet am", "")
            new_ts = row.get("Nachricht gepostet am", "")
            if new_ts > existing_ts:
                nr_dedup_map[key] = row

    nr_deduped = len(needs_review_rows) - len(nr_dedup_map)
    needs_review_rows = list(nr_dedup_map.values())
    if nr_deduped > 0:
        logger.info(f"process_generation: deduped {nr_deduped} needs-review rows")

    # Dedup not_in_database rows using the same strategy as needs_review
    nid_dedup_map = {}
    for row in not_in_database_rows:
        price_parts = row.get("Preis", "").split() if row.get("Preis") else ["", ""]
        price_num = price_parts[0] if price_parts else ""
        currency = price_parts[1] if len(price_parts) > 1 else ""
        key = _make_dedup_key(
            row.get("WS-Code", ""),
            row.get("Nummer", ""),
            price_num,
            currency,
            row.get("Monat/Jahr", ""),
        )
        extracted_ref = row.get("Extracted Ref", "")
        if extracted_ref and not row.get("WS-Code"):
            key = f"{key}|{extracted_ref.lower()}"

        existing = nid_dedup_map.get(key)
        if existing is None:
            nid_dedup_map[key] = row
        else:
            existing_ts = existing.get("Nachricht gepostet am", "")
            new_ts = row.get("Nachricht gepostet am", "")
            if new_ts > existing_ts:
                nid_dedup_map[key] = row

    nid_deduped = len(not_in_database_rows) - len(nid_dedup_map)
    not_in_database_rows = list(nid_dedup_map.values())
    if nid_deduped > 0:
        logger.info(f"process_generation: deduped {nid_deduped} not-in-database rows")

    await _report("generating_csv", 95, "Generating CSV files...")

    structured_rows = {
        "matched": [_structured_row(r) for r in matched_rows],
        "matched_via_image": [_structured_row(r) for r in matched_via_image_rows],
        "needs_review": [_structured_row(r) for r in needs_review_rows],
        "not_in_database": [_structured_row(r) for r in not_in_database_rows],
        "discarded": [_structured_row(r) for r in discarded_rows],
        "aftermarket": [_structured_row(r) for r in aftermarket_rows],
    }

    matched_csv = _rows_to_csv(matched_rows)
    needs_review_csv = _rows_to_csv(needs_review_rows)
    not_in_database_csv = _rows_to_csv(not_in_database_rows)
    matched_via_image_csv = _rows_to_csv(matched_via_image_rows)
    aftermarket_csv = _rows_to_csv(aftermarket_rows)
    discarded_csv = _rows_to_csv([dict(r, **{"Discard Reason": r.get("_discard_reason") or ""})
                                  for r in discarded_rows])

    logger.info(f"process_generation: COMPLETE in {time.time()-t_start:.1f}s — "
                f"{len(matched_rows)} matched, {len(needs_review_rows)} needs_review, "
                f"{len(not_in_database_rows)} not_in_database, "
                f"{len(matched_via_image_rows)} matched_via_image, "
                f"{len(aftermarket_rows)} aftermarket, {len(discarded_rows)} discarded, "
                f"{_fuzzy_match_count} fuzzy, {ai_matched_count} AI")

    total_rows = (len(matched_rows) + len(needs_review_rows)
                  + len(not_in_database_rows) + len(matched_via_image_rows))

    if run_id:
        try:
            await store_run_rows(run_id, structured_rows)
        except Exception as e:
            logger.error(f"process_generation: could not store structured rows for run {run_id}: {e}")

    return {
        "matched_csv": matched_csv,
        "needs_review_csv": needs_review_csv,
        "not_in_database_csv": not_in_database_csv,
        "matched_via_image_csv": matched_via_image_csv,
        "aftermarket_csv": aftermarket_csv,
        "discarded_csv": discarded_csv,
        "suggested_additions_csv": suggested_csv,
        "rows": structured_rows,
        "matched_via_image_count": len(matched_via_image_rows),
        "image_analyzed_count": image_analyzed_count,
        "image_enriched_count": image_enriched_count,
        "total_messages": total_rows,
        "detected_posts": total_rows,
        "matched_count": len(matched_rows),
        "needs_review_count": len(needs_review_rows),
        "not_in_database_count": len(not_in_database_rows),
        "aftermarket_count": len(aftermarket_rows),
        "discarded_count": len(discarded_rows),
        "fuzzy_matched_count": _fuzzy_match_count,
        "ai_matched_count": ai_matched_count,
        "suggested_additions_count": len(unique_suggestions) if ai_suggested_additions else 0,
    }


# --- Structured output (generator → pipeline contract) -------------------------

def _structured_row(row: dict) -> dict:
    """CSV fields of a row plus `_meta` for the pipeline / approval page."""
    out = {k: v for k, v in row.items() if not k.startswith("_")}
    attachments = row.get("_attachments") or []
    out["_meta"] = {
        "source_text": row.get("_original_content") or row.get("Original Text") or "",
        "message_text": row.get("_message_text") or "",
        "sender_phone": row.get("_sender_phone"),
        "timestamp": row.get("_timestamp"),
        "group_name": row.get("_group") or row.get("Gruppe") or "",
        "image_file": attachments[0] if attachments else None,
        "image_files": list(attachments),
        "candidates": list(row.get("_candidates") or [])[:4],
        "discard_reason": row.get("_discard_reason"),
        "currency_unknown": bool(row.get("_currency_unknown")),
        "ai_reason": row.get("_ai_reason"),
        "review_reason": row.get("Review Reason") or row.get("_review_reason"),
    }
    return out


def _rows_gridfs_bucket():
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    from app.models.wtb_wts import WtbWtsRun
    db = WtbWtsRun.get_motor_collection().database
    return AsyncIOMotorGridFSBucket(db, bucket_name="wtb_wts_files")


async def _gridfs_put_text(content: str, filename: str) -> str:
    file_id = await _rows_gridfs_bucket().upload_from_stream(filename, content.encode("utf-8"))
    return str(file_id)


async def _gridfs_get_text(file_id: str) -> str:
    from bson import ObjectId
    stream = await _rows_gridfs_bucket().open_download_stream(ObjectId(file_id))
    return (await stream.read()).decode("utf-8")


async def store_run_rows(run_id, rows: dict[str, list[dict]]) -> str:
    """Store the per-run JSON rows in GridFS and link them on the run."""
    from beanie import PydanticObjectId
    from app.models.wtb_wts import WtbWtsRun
    payload = json.dumps({k: rows.get(k, []) for k in BUCKETS}, ensure_ascii=False, default=str)
    file_id = await _gridfs_put_text(payload, f"rows-{run_id}.json")
    await WtbWtsRun.find_one(WtbWtsRun.id == PydanticObjectId(str(run_id))).update(
        {"$set": {"rows_json_gridfs_id": file_id}})
    return file_id


async def load_run_rows(run_id) -> dict[str, list[dict]]:
    """Rows of a run by bucket: matched, matched_via_image, needs_review,
    not_in_database, discarded, aftermarket. Each row = CSV fields + `_meta`."""
    from beanie import PydanticObjectId
    from bson import ObjectId
    from app.models.wtb_wts import WtbWtsRun
    empty = {k: [] for k in BUCKETS}
    run = await WtbWtsRun.get(PydanticObjectId(str(run_id)))
    if not run or not run.rows_json_gridfs_id:
        return empty
    data = json.loads(await _gridfs_get_text(run.rows_json_gridfs_id))
    return {k: list(data.get(k) or []) for k in BUCKETS}


async def run_generator_on_export(
    chat_txt: str,
    media: Optional[dict[str, bytes]],
    group_name: str,
    mode: str,
    ref_month: int,
    ref_year: int,
    imported_by: str,
) -> str:
    """Run the generator on one exported chat and return the run id.

    Runs to completion (no background task): creates a WtbWtsRun, stores the CSVs
    and the structured rows, and marks the run completed (or failed, re-raising).
    `media` maps attachment file names to bytes (the <group>_Medien.zip content).
    """
    from app.models.wtb_wts import GenerationMode, RunStatus, WtbWtsRun

    gen_mode = GenerationMode(mode.lower())
    run = WtbWtsRun(
        filename=f"{group_name}.txt",
        group_name=group_name,
        mode=gen_mode,
        reference_month=ref_month,
        reference_year=ref_year,
        status=RunStatus.PROCESSING,
        imported_by=imported_by,
        imported_by_name="pipeline",
    )
    await run.insert()
    media_archive = {k.rsplit("/", 1)[-1].lower(): v for k, v in (media or {}).items()} or None
    try:
        result = await process_generation(
            txt_content=chat_txt, mode=gen_mode.value.upper(), ref_month=ref_month, ref_year=ref_year,
            group_name=group_name, media_archive=media_archive, run_id=str(run.id),
        )
        updates = {
            "status": RunStatus.COMPLETED,
            "completed_at": datetime.utcnow(),
            "progress_percent": 100, "progress_stage": "completed", "progress_detail": "Done",
        }
        for key in ("total_messages", "detected_posts", "matched_count", "needs_review_count",
                    "not_in_database_count", "fuzzy_matched_count", "ai_matched_count",
                    "suggested_additions_count", "matched_via_image_count", "image_analyzed_count",
                    "image_enriched_count", "aftermarket_count", "discarded_count"):
            updates[key] = result.get(key, 0)
        for key, field_name in (("matched_csv", "matched_csv_gridfs_id"),
                                ("needs_review_csv", "needs_review_csv_gridfs_id"),
                                ("not_in_database_csv", "not_in_database_csv_gridfs_id"),
                                ("matched_via_image_csv", "matched_via_image_csv_gridfs_id"),
                                ("suggested_additions_csv", "suggested_csv_gridfs_id")):
            if result.get(key):
                updates[field_name] = await _gridfs_put_text(result[key], f"{key}-{run.id}.csv")
        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": updates})
    except Exception as e:
        await WtbWtsRun.find_one(WtbWtsRun.id == run.id).update({"$set": {
            "status": RunStatus.FAILED, "error_message": str(e), "progress_stage": "failed"}})
        raise
    return str(run.id)
