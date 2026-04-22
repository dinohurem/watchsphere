import asyncio
import re
import csv
import io
import json
import logging
from datetime import datetime
from typing import Optional
from app.models.watch import Watch
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

REMARKS_MAP = {
    # only watch (variants) — longer phrases first so they win substring checks
    "single watch": "only watch",
    "watch only": "only watch",
    "only watch": "only watch",
    "no paper": "only watch",
    "no papers": "only watch",
    "naked": "only watch",

    # white tag (both tag is an alias)
    "white tag": "white tag",
    "both tag": "white tag",
    "both tags": "white tag",

    # full sticker
    "full sticker": "full sticker",
    "fullsticker": "full sticker",
    "fs": "full sticker",  # short, matched with word boundary below

    # fullset
    "full set": "fullset",
    "fullset": "fullset",
    "complete set": "fullset",

    # NFC card
    "nfc card": "NFC Card",
    "nfc": "NFC Card",

    # net price (ex-vat, intracom, netto)
    "intracommunity": "net price",
    "intracom": "net price",
    "intra": "net price",
    "ex-vat": "net price",
    "ex vat": "net price",
    "excluding vat": "net price",
    "net price": "net price",
    "netto": "net price",
    "net": "net price",

    # only export
    "need export": "only export",
    "only export": "only export",
    "export only": "only export",
    "export": "only export",

    # misc single-word / phrase remarks
    "margin scheme": "margin scheme",
    "dial change": "dial change",
    "retail ready": "retail ready",
    "polished": "polished",

    # legacy entries retained to avoid losing coverage from older chats
    "card only": "Card Only",
    "box only": "Box Only",
    "no box": "No Box",

    # "Can be Used" — per-user rule: applies to BOTH WTS and WTB so dealers who
    # tag a listing as "used ok" / "used fine" / "worn" map to one canonical label.
    "can be used": "Can be Used",
    "used ok": "Can be Used",
    "used okay": "Can be Used",
    "used fine": "Can be Used",

    # WTB-only "any year" sentinel — surfaces the buyer's "any year" intent in
    # the remarks column so reviewers can see it at a glance.
    "any year": "Any Year",
}

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


def _strip_invisible(s: str) -> str:
    """Replace invisible Unicode marks with nothing (and \xa0 with space)."""
    # Replace non-breaking space with regular space, then strip other invisibles
    s = s.replace('\xa0', ' ')
    return _INVISIBLE_CHARS_RE.sub('', s)


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


def detect_brand_from_content(content: str) -> Optional[str]:
    """Detect brand mentioned in a message for brand-scoped matching.
    Returns canonical brand name or None."""
    content_lower = content.lower()
    # Check for brand names/aliases in the content
    # Sort by length (longest first) to match "patek philippe" before "patek"
    for alias, brand in sorted(BRAND_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        # Word boundary check to avoid partial matches
        pattern = r'(?<![a-zA-Z])' + re.escape(alias) + r'(?![a-zA-Z])'
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

    content_lower = content.lower()

    wts_pos = _find_keyword_pos(content_lower, WTS_KEYWORDS)
    wtb_pos = _find_keyword_pos(content_lower, WTB_KEYWORDS)

    def _has_heavy_wts_signal(txt: str) -> bool:
        """A message with multiple currency-tagged prices is a WTS stock list
        regardless of how it starts. Catches messages like 'Looking for USDT
        pay HKD cash' followed by 40 lines of priced inventory."""
        price_hits = len(re.findall(
            r'(?:\$|€|£|HKD|USD|EUR|GBP|CHF|USDT|HK\$)\s*[\d,.]+'
            r'|[\d,.]+\s*(?:HKD|USD|EUR|GBP|CHF|AED|USDT)\b',
            txt, re.IGNORECASE,
        ))
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
    has_currency_price = bool(re.search(
        r'(?:\$|€|£|HKD|USD|EUR|GBP|CHF|AED|USDT)\s*[\d,.]+|[\d,.]+\s*(?:HKD|USD|EUR|GBP|CHF|AED|USDT|k\b)',
        content, re.IGNORECASE
    ))
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
                })
            except json.JSONDecodeError:
                continue
    else:
        db_watches = await Watch.find(Watch.status == "active").to_list()
        if not db_watches:
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

    # Build flat list of (searchable_string, watch_dict) for fuzzy matching
    fuzzy_candidates = []
    for w in watches:
        for s in [w["ws_code"], w["reference"]] + w["oem_references"] + w["aliases"]:
            s = s.strip()
            if s:
                fuzzy_candidates.append((s.lower(), w))

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
        "brands": sorted(brands_set),
        "fuzzy_candidates": fuzzy_candidates,
        # Pre-compiled combined patterns for match_watch()
        "_ws_code_pattern": ws_code_pattern,
        "_reference_pattern": reference_pattern,
        "_oem_ref_pattern": oem_ref_pattern,
        "_alias_pattern": alias_pattern,
    }


_EMOJI_RE = re.compile(
    r'[\U0001F300-\U0001FAFF'   # Misc Symbols, Emoticons, Dingbats, Transport, etc.
    r'\U00002702-\U000027B0'    # Dingbats
    r'\U0000FE00-\U0000FE0F'    # Variation selectors
    r'\U0000200D'               # Zero-width joiner
    r'\U0001F100-\U0001F1FF'    # Enclosed alphanumerics + regional indicators (🆕 = U+1F195)
    r'\U00002600-\U000026FF'    # Misc symbols
    r'\U00002300-\U000023FF'    # Misc technical
    r'\U0000200B-\U0000200F'    # Zero-width spaces
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
    cleaned = _EMOJI_RE.sub(' ', text)
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
    'RM stock🍰🍰', 'All Brand new', 'BRAND NEW Rolex'"""
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

    # Also try: "PP stock" -> after stripping "stock", "pp" matches
    # Already handled above. Check partial starts for cases like "rolex watches"
    for alias, brand in sorted(BRAND_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        if cleaned_lower == alias or cleaned_lower.startswith(alias + " "):
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


def _extract_ref_from_line(line: str) -> Optional[str]:
    """Extract the reference/model number from a watch line.
    Strips emoji and leading condition/status words first.
    Handles formats like: '5968A', 'RM037RG', '126334G', 'Used 5167A-001',
    'New 124200 Pistachio', '5712/1A', '5139G-010', '7118/1200A',
    'RM 11-03', 'RM07-01', 'V41 FR 2'.
    Rejects year-only tokens like '2022y', '2019year', '2025'."""
    cleaned = _clean_text(line).strip()
    if not cleaned:
        return None
    # Strip leading condition/status words and asterisks
    cleaned = re.sub(r'^[*\s]*', '', cleaned)
    cleaned = re.sub(
        r'^(?:used|new|unworn|like\s*new|brand\s*new|bnib|nos|fresh|polished)\s+',
        '', cleaned, flags=re.IGNORECASE
    ).strip()
    if not cleaned:
        return None

    # Reject lines that start with a year-like token (e.g., "2022y HKD 570K" is a
    # continuation line from a stock list — no reference here). Also handles
    # condition words concatenated directly to the year: "2025used 180K",
    # "2022new fullset", "2019full set", "2024year", "19y HKD 100k".
    if re.match(
        r'^20[1-3]\d(?:y|year|used|new|unworn|full|brand|mint|like|fresh|polished)?\b',
        cleaned, re.IGNORECASE,
    ):
        return None
    if re.match(r'^\d{2}y\b', cleaned, re.IGNORECASE):
        return None

    # Special handling for RM (Richard Mille) references with space: "RM 11-03", "RM 07-01"
    rm_match = re.match(r'^(RM\s*\d{2,4}(?:[/\-][A-Za-z0-9]+)*)\b', cleaned, re.IGNORECASE)
    if rm_match:
        # Normalize: "RM 11-03" -> "RM11-03" (remove space for consistent matching)
        ref = rm_match.group(1)
        ref = re.sub(r'^(RM)\s+', r'\1', ref, flags=re.IGNORECASE)
        return ref

    # Reject currency-prefixed price tokens like "hkd910k", "usd122k", "usdt470k",
    # "eur5000". These are price lines that follow a ref line in stock lists, not refs.
    if re.match(
        r'^(?:hkd|usdt|usd|eur|gbp|chf|aed|sgd|jpy)\s*[\d.,]+\s*[kKmM]?\b',
        cleaned, re.IGNORECASE,
    ):
        return None

    # Match reference patterns at start: alphanumeric with optional /- separators
    m = re.match(r'^([A-Za-z]{0,4}\d{2,6}(?:[/\-][A-Za-z0-9]+)*[A-Za-z]{0,4})\b', cleaned)
    if m:
        candidate = m.group(1)
        # Reject year-shaped candidates: 2022, 2022y, 2025used, 2019full, etc.
        if re.match(r'^20[1-3]\d[a-zA-Z]{0,8}$', candidate):
            suffix = re.sub(r'^20[1-3]\d', '', candidate).lower()
            if suffix in ('', 'y', 'year', 'years', 'used', 'new', 'unworn',
                          'full', 'brand', 'bnib', 'nos', 'mint', 'like',
                          'fresh', 'polished', 'worn'):
                return None
        return candidate
    return None


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
    t = token.lower()
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
    for token in line_tokens:
        t = token.lower()
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
        ws_lower = w["ws_code"].lower()
        model_lower = w.get("model", "").lower()
        dial_lower = w.get("dial", "").lower()
        bracelet_lower = w.get("bracelet", "").lower()
        aliases_lower = [a.lower() for a in w.get("aliases", [])]

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
            if part in tokens_str and part not in matches[0]["ws_code"].lower().split()[:1]:
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


async def batch_ai_match(
    unmatched_lines: list[dict],
    watch_index: dict,
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

    # Build compact catalog for the prompt
    catalog_entries = []
    ws_code_to_watch = {}
    for ws_code, watch in watch_index["by_ws_code"].items():
        refs = [watch["reference"]] + watch.get("oem_references", []) + watch.get("aliases", [])
        refs = [r for r in refs if r]
        entry = f"{watch['ws_code']} | {watch['brand']} {watch['model']} | refs: {', '.join(refs)}"
        catalog_entries.append(entry)
        ws_code_to_watch[watch["ws_code"].lower()] = watch

    catalog_text = "\n".join(catalog_entries) if catalog_entries else "CATALOG IS EMPTY - identify watches by your knowledge"

    # Process in batches
    BATCH_SIZE = 1500
    MAX_CONCURRENT = 5
    all_results = []

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=120.0)

    async def process_batch(batch_lines: list[dict]) -> list[dict]:
        lines_text = "\n".join(
            f"[{item['index']}] {item['content'][:400]}"
            for item in batch_lines
        )

        prompt = f"""You are an expert luxury watch dealer reference matcher. Match each WhatsApp dealer message line to the correct watch from the catalog.

WATCH CATALOG (match against these if possible):
{catalog_text}

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

        try:
            response = await client.chat.completions.create(
                model="gpt-5.2",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=16384,
            )

            content = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            ai_results = json.loads(content)
            batch_matched = []

            for item in ai_results:
                ws_code = item.get("ws_code")
                idx = item.get("index")
                confidence = item.get("confidence", 0)
                ai_brand = item.get("brand", "")
                ai_model = item.get("model", "")
                suggested_ws_code = item.get("suggested_ws_code", "")
                in_catalog = item.get("in_catalog", False)

                if idx is None or confidence < 1:
                    continue

                watch = None
                if ws_code:
                    ws_lower = ws_code.lower()
                    watch = ws_code_to_watch.get(ws_lower)
                    if watch:
                        in_catalog = True

                batch_matched.append({
                    "index": idx,
                    "ws_code": ws_code,
                    "watch": watch,
                    "ai_brand": ai_brand,
                    "ai_model": ai_model,
                    "ai_ws_code": suggested_ws_code or ws_code or "",
                    "confidence": confidence,
                    "in_catalog": in_catalog,
                })

            return batch_matched

        except Exception as e:
            logger.error(f"AI matching batch failed: {e}")
            return []

    # Split into batches and process with concurrency limit
    batches = []
    for i in range(0, len(unmatched_lines), BATCH_SIZE):
        batches.append(unmatched_lines[i:i + BATCH_SIZE])

    logger.info(f"batch_ai_match: processing {len(unmatched_lines)} lines in {len(batches)} batches "
                f"(max {MAX_CONCURRENT} concurrent)")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def limited_batch(batch):
        async with semaphore:
            return await process_batch(batch)

    batch_results = await asyncio.gather(*[limited_batch(b) for b in batches])
    for result in batch_results:
        all_results.extend(result)

    logger.info(f"AI matching: {len(all_results)}/{len(unmatched_lines)} lines matched")
    return all_results


async def batch_ai_verify(
    items: list[dict],
    watch_index: dict,
    mode: str,
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

    BATCH_SIZE = 800
    MAX_CONCURRENT = 5
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=120.0)
    all_results: list[dict] = []

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

    async def process_batch(batch_items: list[dict]) -> list[dict]:
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
- European notation '17,5€' or '17.5€' (1-2 digits before AND after the decimal) means 17,500 EUR. But '125€' (integer) means 125 EUR, and '125.00€' (3-digit decimal) is 125 EUR.
- Currency precedence for bare amounts (no currency symbol): HK/CN/MO/SG -> HKD; DE/FR/IT/ES/NL/BE/AT/PT/IE/FI/GR/LU/SK/SI/EE/LV/LT/MT/CY/HR -> EUR; UK/GB -> GBP; CH -> CHF; US/JP/AE/others -> USD.
- Symbol '$' means HKD for HK/CN/MO/SG senders, USD otherwise.
- USDT should be normalized to USD in the currency field.
- If the text contains multiple prices (e.g. 'hkd1.815m usd235.5k'), prefer USDT > USD > EUR > GBP > CHF > HKD.

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

        try:
            response = await client.chat.completions.create(
                model="gpt-5.2",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.05,
                max_tokens=16384,
            )
            content = response.choices[0].message.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
            return json.loads(content)
        except Exception as e:
            logger.error(f"AI verification batch failed: {e}")
            return []

    batches = [items[i:i + BATCH_SIZE] for i in range(0, len(items), BATCH_SIZE)]
    logger.info(f"batch_ai_verify: verifying {len(items)} rows in {len(batches)} batches")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def limited(b):
        async with semaphore:
            return await process_batch(b)

    batch_results = await asyncio.gather(*[limited(b) for b in batches])
    for r in batch_results:
        all_results.extend(r)
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
    "jubilee", "jub", "oyster", "oys", "leather",
})


def _has_descriptor_conflict(candidate: dict, line_tokens: Optional[list[str]]) -> bool:
    """Return True when the line contains a discriminating descriptor that
    does NOT appear in the candidate's ws_code / dial / bracelet / aliases.
    Used to reject a sole candidate when the line clearly describes a
    different variant (e.g. line says 'blk' but only 'Green' exists in catalog).
    """
    if not line_tokens:
        return False
    ws_lower = (candidate.get("ws_code") or "").lower()
    dial_lower = (candidate.get("dial") or "").lower()
    bracelet_lower = (candidate.get("bracelet") or "").lower()
    aliases_lower = [(a or "").lower() for a in candidate.get("aliases", [])]
    haystack = " ".join([ws_lower, dial_lower, bracelet_lower] + aliases_lower)

    for raw in line_tokens:
        t = raw.lower().strip()
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


def match_watch_by_ref(ref: str, watch_index: dict, brand_hint: Optional[str] = None,
                       line_tokens: Optional[list[str]] = None,
                       return_fuzzy_score: bool = False):
    """Match a reference string against the watch index.
    Uses brand_hint to filter by brand and line_tokens to disambiguate variants.
    All comparisons are case-insensitive.

    If return_fuzzy_score=True, returns (matches, fuzzy_score) where fuzzy_score
    is the best fuzzy score (int) if the fuzzy path was used, else None. This lets
    callers downgrade low-confidence fuzzy hits to needs_review.
    Otherwise returns just the matches list (backward compatible).
    """
    ref_lower = ref.lower()
    matches = []

    def _collect(candidates):
        result = []
        s = set()
        for w in candidates:
            ws = w["ws_code"].lower()
            if ws not in s:
                result.append(w)
                s.add(ws)
        return result

    def _brand_filter(candidates):
        if brand_hint:
            filtered = [w for w in candidates if w["brand"].lower() == brand_hint.lower()]
            if filtered:
                return filtered
        return candidates

    def _ret(m, score):
        if return_fuzzy_score:
            return m, score
        return m

    def _apply_simple_conflict_guard(m):
        """For oem_ref/alias paths — only descriptor conflict check. These hits
        are specific enough that a missing descriptor on the line is acceptable."""
        if len(m) == 1 and _has_descriptor_conflict(m[0], line_tokens):
            return []
        return m

    def _apply_ref_only_guard(m):
        """For reference-only paths — both descriptor conflict AND
        descriptor-required check. If the catalog ws_code is descriptor-qualified
        but the line has no descriptor, refuse the match."""
        if len(m) != 1:
            return m
        cand = m[0]
        if _has_descriptor_conflict(cand, line_tokens):
            return []
        ws_lower = (cand.get("ws_code") or "").lower()
        ref_lower_cand = (cand.get("reference") or "").lower()
        ws_has_descriptor = bool(ref_lower_cand) and ws_lower.replace(ref_lower_cand, "", 1).strip() != ""
        if ws_has_descriptor and line_tokens:
            line_has_descriptor = any(
                v in _DISCRIMINATING_DESCRIPTORS
                for t in line_tokens for v in _resolve_descriptor(str(t).lower())
            )
            if not line_has_descriptor:
                return []
        return m

    # 1. Try ws_code exact match (most specific — ground truth, no guard).
    if ref_lower in watch_index["by_ws_code"]:
        return _ret([watch_index["by_ws_code"][ref_lower]], None)

    # 2. Try aliases exact match (full alias hit = authoritative match per rule).
    if ref_lower in watch_index["by_alias"]:
        candidates = _brand_filter(watch_index["by_alias"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            return _ret(matches, None)

    # 3. Try oem_references exact match — apply only conflict guard.
    if ref_lower in watch_index["by_oem_ref"]:
        candidates = _brand_filter(watch_index["by_oem_ref"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            matches = _apply_simple_conflict_guard(matches)
            return _ret(matches, None)

    # 4. Try reference exact match — apply BOTH guards (descriptor conflict AND
    # required-descriptor-when-catalog-has-one).
    if ref_lower in watch_index["by_reference"]:
        candidates = _brand_filter(watch_index["by_reference"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            matches = _apply_ref_only_guard(matches)
            return _ret(matches, None)

    # 4b. Before fuzzy: try alias/ws_code pattern match against the reconstructed
    # line (ref + remaining tokens). Multi-word aliases like "228238a black",
    # "228238 onyx" only hit here — _extract_ref_from_line strips them to just
    # "228238a" which is not a key in any dict. A full alias match is
    # authoritative and should beat a fuzzy score.
    if line_tokens:
        reconstructed = ref + " " + " ".join(str(t) for t in line_tokens)
        reconstructed_lower = reconstructed.lower()
        alias_pat = watch_index.get("_alias_pattern")
        ws_pat = watch_index.get("_ws_code_pattern")
        alias_hits: list[dict] = []
        seen_ws: set[str] = set()
        # ws_code literal wins outright — check it first
        if ws_pat:
            for m in ws_pat.finditer(reconstructed_lower):
                w = watch_index["by_ws_code"].get(m.group(0))
                if w and w["ws_code"].lower() not in seen_ws:
                    alias_hits.append(w)
                    seen_ws.add(w["ws_code"].lower())
        if not alias_hits and alias_pat:
            for m in alias_pat.finditer(reconstructed_lower):
                for w in watch_index["by_alias"].get(m.group(0), []):
                    if w["ws_code"].lower() not in seen_ws:
                        alias_hits.append(w)
                        seen_ws.add(w["ws_code"].lower())
        if alias_hits:
            alias_hits = _brand_filter(alias_hits)
            if len(alias_hits) > 1:
                alias_hits = _disambiguate_matches(alias_hits, line_tokens)
            return _ret(alias_hits, None)

    # 5. Fuzzy matching fallback (brand-filtered only)
    # (Substring matching removed — it causes cross-brand contamination)
    global _fuzzy_match_count
    fuzzy_results, fuzzy_score = fuzzy_match_ref(ref, watch_index, brand_hint)
    if fuzzy_results:
        if len(fuzzy_results) > 1 and line_tokens:
            fuzzy_results = _disambiguate_matches(fuzzy_results, line_tokens)
        fuzzy_results = _apply_simple_conflict_guard(fuzzy_results)
        if len(fuzzy_results) == 1:
            _fuzzy_match_count += 1
        return _ret(fuzzy_results, fuzzy_score)

    return _ret([], None)


def match_watch(content: str, watch_index: dict, brand_hint: Optional[str] = None) -> list[dict]:
    """Match a single-line or full message content against the watch index.
    Uses pre-compiled combined regex patterns for fast matching instead of
    iterating every key individually. brand_hint restricts matching to a specific brand."""
    content_lower = content.lower()
    matches = []
    seen_ws_codes = set()
    brand_hint_lower = brand_hint.lower() if brand_hint else None

    def _add_match(watch: dict):
        ws = watch["ws_code"].lower()
        if ws not in seen_ws_codes:
            if brand_hint_lower and watch["brand"].lower() != brand_hint_lower:
                return
            matches.append(watch)
            seen_ws_codes.add(ws)

    def _apply_ref_only_guard(m: list) -> list:
        """Guard for reference-pattern matches (no ws_code/alias/oem hit).
        Two checks:
        (1) Reject sole candidate when the message contains a discriminating
            descriptor that doesn't fit ('5205R white' vs catalog '5205R Green').
        (2) Reject sole candidate when the catalog ws_code is descriptor-qualified
            (e.g. '7010R Purple') but the message contains NO descriptor at all
            ('7010R 2024used 480K'). Forces such cases to needs_review/AI rather
            than guessing the wrong colour variant.
        """
        if len(m) != 1:
            return m
        cand = m[0]
        tokens = _clean_text(content).lower().split()
        # Check 1: descriptor conflict
        if _has_descriptor_conflict(cand, tokens):
            return []
        # Check 2: catalog ws_code has descriptor, line has none
        ws_lower = (cand.get("ws_code") or "").lower()
        ref_lower = (cand.get("reference") or "").lower()
        # Treat ws_code as "descriptor-qualified" if it's longer than just the reference
        # (e.g. '7010R Purple' vs reference '7010R'). Also catches embedded suffixes
        # like '5205R Green' vs '5205R'.
        ws_has_descriptor = bool(ref_lower) and ws_lower.replace(ref_lower, "", 1).strip() != ""
        if ws_has_descriptor:
            line_has_descriptor = any(
                v in _DISCRIMINATING_DESCRIPTORS
                for t in tokens for v in _resolve_descriptor(t.lower())
            )
            if not line_has_descriptor:
                return []
        return m

    def _apply_simple_conflict_guard(m: list) -> list:
        """Guard for OEM-ref matches: only descriptor-conflict check (no
        no-descriptor-on-line refusal). OEM refs are specific enough to keep
        the match even without colour qualifiers on the line."""
        if len(m) == 1:
            tokens = _clean_text(content).lower().split()
            if _has_descriptor_conflict(m[0], tokens):
                return []
        return m

    # Try ws_code word-boundary match (most specific). Skip guards here —
    # a literal ws_code match is ground truth.
    pattern = watch_index.get("_ws_code_pattern")
    if pattern:
        for m in pattern.finditer(content_lower):
            matched_key = m.group(0)
            watch = watch_index["by_ws_code"].get(matched_key)
            if watch:
                _add_match(watch)

    if matches:
        return matches

    # Try alias exact token match BEFORE reference. Per matching rule: a full
    # alias match is as authoritative as a ws_code match — return immediately
    # without any descriptor-conflict guard.
    pattern = watch_index.get("_alias_pattern")
    if pattern:
        for m in pattern.finditer(content_lower):
            matched_key = m.group(0)
            watch_list = watch_index["by_alias"].get(matched_key, [])
            for w in watch_list:
                _add_match(w)

    if matches:
        return matches

    # Try OEM reference exact token match — apply only conflict guard.
    pattern = watch_index.get("_oem_ref_pattern")
    if pattern:
        for m in pattern.finditer(content_lower):
            matched_key = m.group(0)
            watch_list = watch_index["by_oem_ref"].get(matched_key, [])
            for w in watch_list:
                _add_match(w)

    if matches:
        return _apply_simple_conflict_guard(matches)

    # Try reference exact token match — apply BOTH guards (descriptor conflict
    # AND no-descriptor-on-line-when-catalog-has-one).
    pattern = watch_index.get("_reference_pattern")
    if pattern:
        for m in pattern.finditer(content_lower):
            matched_key = m.group(0)
            watch_list = watch_index["by_reference"].get(matched_key, [])
            for w in watch_list:
                _add_match(w)

    return _apply_ref_only_guard(matches)


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

    # N-month only: n1, n2, n12
    m = re.match(r'^n(\d{1,2})$', text_clean)
    if m:
        month = int(m.group(1))
        year = ref_year if month <= ref_month else ref_year - 1
        return f"{month:02d}/{year % 100:02d}{suffix}"

    # N-month/year: n2/26, n9/2025
    m = re.match(r'^n(\d{1,2})[/\-](\d{2,4})$', text_clean)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return f"{month:02d}/{year % 100:02d}{suffix}"

    # MM/YY or MM/YYYY: 09/25, 02/26, 02/2026
    m = re.match(r'^(\d{1,2})[/\-](\d{2,4})$', text_clean)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return f"{month:02d}/{year % 100:02d}{suffix}"

    for name, num in month_names.items():
        if name in text_clean:
            month = num
            yr_match = re.search(r'(\d{2,4})', text_clean.replace(name, ''))
            if yr_match:
                yr = int(yr_match.group(1))
                year = yr if yr > 99 else 2000 + yr
            else:
                year = ref_year if month <= ref_month else ref_year - 1
            return f"{month:02d}/{year % 100:02d}{suffix}"

    # Pure 4-digit year: 2024, 2025 — return as year only, not MM/YY
    m = re.match(r'^(\d{4})$', text_clean)
    if m:
        year = int(m.group(1))
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
    content_lower = content.lower()

    # 1. N-month/year with 'y' suffix (most specific): N2/26y, N9/2025y, N3/2026y
    for m in re.finditer(r'\b[nN](\d{1,2})[/\-](\d{2,4})\s*y\b', content_lower):
        start = m.start()
        if start > 0 and content[start - 1] in ('$', '€', '£'):
            continue
        month = m.group(1)
        year = m.group(2)
        return f"n{month}/{year}"

    # 2. N-month/year without y: N2/26, N3/2026
    for m in re.finditer(r'\b[nN](\d{1,2})[/\-](\d{2,4})\b', content_lower):
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

    # 4. YYYY/MM or YYYY-MM format: 2025/11, 2025-6
    for m in re.finditer(r'\b(\d{4})[/\-](\d{1,2})\b', content_lower):
        year = int(m.group(1))
        month = int(m.group(2))
        # Verify it's a valid year (not a reference like 5980/60)
        if 2010 <= year <= 2035 and 1 <= month <= 12:
            yr_short = year % 100
            return f"{month:02d}/{yr_short:02d}"

    # 5. N-month only: N1, N2, N10, N12 (check ALL occurrences, skip model suffixes)
    for m in re.finditer(r'\b[nN](\d{1,2})\b', content_lower):
        month_val = int(m.group(1))
        if 1 <= month_val <= 12:
            # Make sure this isn't part of a model ref (preceded by /)
            start = m.start()
            if start > 0 and content[start - 1] == '/':
                continue
            return m.group(0)

    # 6. MM/YY or MM/YYYY format: 09/25, 02/26
    for m in re.finditer(r'\b(\d{1,2})[/\-](\d{2,4})\b', content_lower):
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


def extract_price(content: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price and currency from message text.
    Returns (formatted_price, currency) or (None, None).

    Price formats: 387k, 1.17m, 435,000, 138,000, 162k, 1.265m
    Currency can follow (with/without space): 387k hkd, 435,000hkd, 300k usdt
    Currency can precede: HK$387k, $300k, €5,000
    Chinese: '97w人民币' = 97 × 10,000 RMB = 970,000 CNY.
    If $ is used by HK/CN/MO/SG sender without USD/USDT qualifier -> HKD.
    """
    # Remove serial code prefixes that can interfere with price parsing
    # SC = Serial Code, SN = Serial Number, Ref = Reference
    content = re.sub(r'\b(?:SC|SN|REF|ser\.?)\s*[\d,]+', '', content, flags=re.IGNORECASE)

    # Chinese-numeric pattern used in Chinese dealer messages. Fires only as a
    # last resort (after HKD/USDT/etc prefix and suffix patterns) so messages
    # that list HKD first ("678.000HKD / 86.500 USDT / 60w5人民币") pick HKD.
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

    # Currency-prefixed patterns (HK$, HKD, $, €, £, RMB)
    # Allow [:;\s] separators (dealers use "HKD:950000", "HKD 300k", "hkd563k")
    # Case-insensitive so mixed-case tokens like "Hkd", "HkD" also match — otherwise
    # the suffix pattern below wins on stray digits before the currency tag (e.g.
    # "4/26 Hkd 968k" would grab "26" instead of "968k").
    _sep = r'[:\s]*'
    prefix_patterns = [
        (rf'hk\${_sep}([\d,.]+[kKmM]?)', "HKD"),
        (rf'hkd{_sep}([\d,.]+[kKmM]?)', "HKD"),  # hkd563k, HKD 300k, HKD:950000
        (rf'usdt{_sep}([\d,.]+[kKmM]?)', "USDT"),
        (rf'usd{_sep}([\d,.]+[kKmM]?)', "USD"),
        (rf'(?:rmb|cny){_sep}([\d,.]+[kKmM]?)', "CNY"),
        (rf'€{_sep}([\d,.]+[kKmM]?)', "EUR"),
        (rf'£{_sep}([\d,.]+[kKmM]?)', "GBP"),
        (rf'¥{_sep}([\d,.]+[kKmM]?)', "CNY"),
        (rf'\${_sep}([\d,.]+[kKmM]?)', None),  # $ — resolved by sender country
    ]

    for pattern, currency in prefix_patterns:
        m = re.search(pattern, content, re.IGNORECASE)
        if m:
            raw_price = _normalize_adjacent_currency_price(m.group(1).strip())
            formatted = _format_price(raw_price)
            if formatted:
                # If an explicit currency tag immediately follows the matched
                # number (e.g. "$505,000 HKD" or "$880,000 HKD Bild weggelassen"),
                # prefer the trailing tag over the symbol's default. Dealers who
                # write both $ and HKD mean HKD — the $ is decorative.
                tail = content[m.end():m.end() + 10].lstrip().lower()
                suffix_cur = None
                for tag in ("usdt", "hkd", "usd", "eur", "gbp", "chf", "cny", "rmb"):
                    if tail.startswith(tag):
                        suffix_cur = _canonicalize_currency(tag)
                        break
                if suffix_cur:
                    return formatted, suffix_cur
                if currency is None:
                    currency = _default_currency_for_country(sender_country)
                return formatted, _canonicalize_currency(currency)

    # Number followed by currency suffix: 387k hkd, 435,000hkd, 1.265m hkd, 300k usdt
    # Also handles symbol suffixes: 17,5€, 9.8€, 125£, 450k rmb
    # The number+k/m is always together (no space between digits and k/m).
    # The leading lookbehind `(?<![A-Za-z])` prevents month-code bleed-through:
    # without it, "N4,1.475M hkd" would match starting at "4,1.475M" and parse
    # as 41,475,000 — the N4 month code joining the price via the comma.
    # Trailing bare "$" accepted as suffix (dealers write "260000$" meaning USD/HKD
    # depending on sender country).
    currency_suffix = r'(?:\s*(?:hkd|usd|usdt|eur|gbp|chf|aed|sgd|jpy|cny|rmb|€|£|¥|\$))'
    m = re.search(r'(?<![A-Za-z])([\d,.]+[kKmM]?)' + currency_suffix, content, re.IGNORECASE)
    if m:
        raw_price = _normalize_adjacent_currency_price(m.group(1).strip())
        formatted = _format_price(raw_price)
        if formatted:
            full = m.group(0).upper()
            for cur in ["USDT", "HKD", "USD", "EUR", "GBP", "CHF", "AED", "SGD", "JPY", "CNY", "RMB"]:
                if cur in full:
                    return formatted, _canonicalize_currency(cur)
            if '€' in m.group(0):
                return formatted, "EUR"
            if '£' in m.group(0):
                return formatted, "GBP"
            if '¥' in m.group(0):
                return formatted, "CNY"
            if '$' in m.group(0):
                # trailing bare $ — resolve by sender country, same rule as prefix $
                return formatted, _default_currency_for_country(sender_country)
            return formatted, "USD"

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


def extract_price_from_line(line: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price from a single watch line.
    Handles stock list formats: '5968A N2 1.17m hkd', '126334G Black Jub N12 138,000'
    N1, N2, N10, N12 etc. are month codes — NOT prices. Price is the numeric token
    (optionally with k/m suffix) that is NOT preceded by N.
    Also handles discount formats: '$565000-25%', '134000-35%'.
    """
    # Handle discount formats: $565000-25%, 134000-35%, $83000-35%
    discount_match = re.search(
        r'(?:[\$€£]|HK\$)?\s*([\d,.]+[kKmM]?)\s*-\s*(\d{1,2})%',
        line, re.IGNORECASE
    )
    if discount_match:
        raw_price = discount_match.group(1).strip()
        discount_pct = float(discount_match.group(2))
        formatted = _format_price(raw_price)
        if formatted:
            price_val = float(formatted.replace(',', ''))
            discounted = _apply_discount(price_val, discount_pct)
            # Determine currency from prefix or context
            prefix = line[:discount_match.start()].strip()
            if '$' in line[:discount_match.end()] or 'hk$' in line[:discount_match.end()].lower():
                cur = "HKD" if sender_country in HKD_DEFAULT_COUNTRIES else "USD"
            elif '€' in prefix:
                cur = "EUR"
            elif '£' in prefix:
                cur = "GBP"
            else:
                cur = _default_currency_for_country(sender_country)
            return discounted, cur

    # Try standard extraction first (handles currency prefix/suffix)
    price, currency = extract_price(line, sender_country)
    if price:
        return price, currency

    # Try concatenated format: 345000hkd, 142000hkd, 450000hkd, 125€, 17,5€
    concat_pattern = r'([\d,.]+[kKmM]?)\s*(hkd|usd|usdt|eur|gbp|chf|aed|sgd|jpy|€|£)'
    m = re.search(concat_pattern, line, re.IGNORECASE)
    if m:
        raw_price = _normalize_adjacent_currency_price(m.group(1))
        cur_raw = m.group(2)
        if cur_raw == '€':
            currency = "EUR"
        elif cur_raw == '£':
            currency = "GBP"
        else:
            currency = cur_raw.upper()
            if currency == "USDT":
                currency = "USD"  # Treat USDT as USD
        formatted = _format_price(raw_price)
        if formatted:
            return formatted, currency

    # Try bare price at end of line (no currency specified)
    tokens = line.strip().split()
    first_token = tokens[0].strip().rstrip('.').lower() if tokens else ""
    for token in reversed(tokens):
        token_clean = token.strip().rstrip('.')
        # Skip month codes: N1, N2, N10, N12, n2/2026, etc.
        if re.match(r'^[nN]\d', token_clean):
            continue
        # Skip year tokens like 2024, 2022year, 19y, 20y
        if re.match(r'^20[1-2]\d(?:year|y)?$', token_clean, re.IGNORECASE):
            continue
        if re.match(r'^\d{2}y$', token_clean, re.IGNORECASE):
            continue
        # Skip non-numeric tokens
        if not re.match(r'^[\d,.]+[kKmM]?$', token_clean):
            continue
        # Skip if this token matches the first token (likely a reference number)
        if token_clean.lower() == first_token:
            continue
        # Skip if this looks like a reference number (e.g., pure digits 4-6 chars matching first token pattern)
        if re.match(r'^\d{4,6}$', token_clean) and token == tokens[0]:
            continue
        formatted = _format_price(token_clean)
        if formatted:
            return formatted, _default_currency_for_country(sender_country)

    return None, None


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


def extract_condition(content: str, mode: str, month_year: Optional[str] = None, ref_month: int = 1, ref_year: int = 2026) -> Optional[str]:
    """Extract and normalize condition from message text.
    For WTS: defaults to 'Unworn' when no explicit condition keyword is found."""
    content_lower = content.lower()
    conditions = WTS_CONDITIONS if mode == "WTS" else WTB_CONDITIONS

    for keyword in sorted(conditions.keys(), key=len, reverse=True):
        if keyword in content_lower:
            return conditions[keyword]

    # WTS posts default to Unworn when no explicit condition is stated
    if mode == "WTS":
        return "Unworn"

    return None


def extract_condition_from_line(line: str, section_condition: Optional[str] = None) -> Optional[str]:
    """Extract condition from a single watch line, falling back to section condition.
    section_condition comes from the brand header (e.g., 'Patek Used' -> 'Used').
    Defaults to 'Unworn' when no condition is found (stock list items are typically unworn)."""
    line_lower = line.lower()

    for keyword in sorted(WTS_CONDITIONS.keys(), key=len, reverse=True):
        if keyword in line_lower:
            return WTS_CONDITIONS[keyword]

    # Fall back to section condition, then default to Unworn
    return section_condition or "Unworn"


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
    """Extract location-preference remarks for BOTH WTS and WTB.

    Matches the dealer phrases described by the user:
      - "watch in HK"  / "watch in EU"            (WTS seller's location)
      - "need in HK"   / "need in EU"             (WTB buyer's requested location)
      - "worldwide", "can be worldwide"
      - multi-country: "need in HK, US or DXB" → "Need in HK, US, AE"

    Returns a normalized string like "Watch in HK" or "Need in HK, US, AE",
    or None if no location preference is present.
    """
    cl = content.lower()

    # Match the prefix verb ("watch in", "need in", "located in") and capture
    # the tail up to end-of-line or a terminator. Split the tail on commas,
    # slashes, "or", "and" and canonicalize each candidate to a code.
    prefix_match = re.search(
        r'\b(watch|need|looking|located|available)\s+(?:is\s+)?(?:in|at)\s+([^\n.;]+)',
        cl,
    )
    verb_label = "Watch in"
    tail = None
    if prefix_match:
        verb = prefix_match.group(1)
        tail = prefix_match.group(2)
        verb_label = {
            "watch": "Watch in",
            "located": "Watch in",
            "available": "Watch in",
            "need": "Need in",
            "looking": "Need in",
        }.get(verb, "Watch in")

    # Worldwide shortcut
    if re.search(r'\b(?:worldwide|any\s+country|any\s+location)\b', cl):
        return "Worldwide" if mode == "WTB" else "Watch Worldwide"

    if not tail:
        return None

    # Tokenize the tail on commas/slashes/or/and
    parts = re.split(r'[,/]|\bor\b|\band\b', tail)
    codes: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # Try to match any location token inside this part
        m = re.search(_LOCATION_TOKEN_PATTERN, p)
        if m:
            code = _LOCATION_CODES.get(m.group(0))
            if code and code not in codes:
                codes.append(code)
    if not codes:
        return None
    return f"{verb_label} " + ", ".join(codes)


# Backward-compatible WTB helper (kept for _build_row callers)
def extract_wtb_location_remarks(content: str) -> Optional[str]:
    return extract_location_remarks(content, "WTB")


def normalize_remarks(content: str) -> str:
    """Extract and normalize remarks from message text.

    Keywords are matched with word boundaries to avoid false positives like
    'net' matching inside 'internet'. Keys are scanned longest-first so a
    longer phrase (e.g. 'nfc card') claims its span before a shorter
    substring (e.g. 'nfc') would otherwise fire on the same text.
    """
    content_lower = content.lower()
    consumed = [False] * len(content_lower)
    found_remarks: list[str] = []

    keys = sorted(REMARKS_MAP.keys(), key=len, reverse=True)
    for keyword in keys:
        normalized = REMARKS_MAP[keyword]
        # Build a word-boundary regex for this keyword. Hyphens and spaces
        # inside the keyword are matched literally; \b is used on each side.
        pattern = r'(?<![a-z0-9])' + re.escape(keyword) + r'(?![a-z0-9])'
        for m in re.finditer(pattern, content_lower):
            # Skip if this span overlaps an already-consumed region (a
            # longer phrase claimed it first).
            if any(consumed[m.start():m.end()]):
                continue
            for i in range(m.start(), m.end()):
                consumed[i] = True
            if normalized not in found_remarks:
                found_remarks.append(normalized)
    return ", ".join(found_remarks)


def format_timestamp(ts: datetime) -> str:
    """Format timestamp for CSV output: DD.MM.YY HH:MM:SS"""
    return ts.strftime("%d.%m.%y %H:%M:%S")


def _detect_section_condition(line: str) -> Optional[str]:
    """Detect condition from a brand section header line.
    E.g., 'Patek Used ✨✨' -> 'Used', 'RM Used Fullset' -> 'Used',
    'New Fullset' -> 'Unworn', 'Like' -> 'Used' (short for Like New).
    Check more specific terms first (like new, unworn, brand new) before generic ones."""
    cleaned = _clean_text(line).lower().strip()
    # Check specific unworn indicators first
    if 'like new' in cleaned:
        return "Used"  # Like New is closer to Used than Unworn
    # Bare "like" (short for "like new") — common in stock lists
    if re.match(r'^like\s*$', cleaned):
        return "Used"
    if 'unworn' in cleaned or 'brand new' in cleaned or 'bnib' in cleaned:
        return "Unworn"
    if 'nos' in cleaned or 'stickered' in cleaned or 'sealed' in cleaned:
        return "Unworn"
    # Check "new" but not as part of "like new" (already handled above)
    if re.search(r'\bnew\b', cleaned):
        return "Unworn"
    if 'used' in cleaned or 'pre-owned' in cleaned or 'preowned' in cleaned:
        return "Used"
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
) -> tuple[list[dict], list[dict], list[dict]]:
    """Parse a structured stock list message into individual watch rows.
    Returns (matched_rows, needs_review_rows, not_in_database_rows).

    - matched_rows: confident matches with all required info.
    - needs_review_rows: rows that have a likely/ambiguous match but need a human
      to confirm (ambiguous between variants, low-confidence fuzzy, missing info).
    - not_in_database_rows: rows where no matching watch was found at all —
      typically candidates for catalog additions.
    """
    matched_rows = []
    needs_review_rows = []
    not_in_database_rows = []

    current_brand = None
    section_condition = None

    # Message-level location remarks apply to every row in the stock list
    # (dealers usually write "Watch in HK" once at the top, not per line).
    msg_location_remarks = extract_location_remarks(content, mode) or ""

    # Pre-process: merge split lines where reference is on one line and price/year
    # on the next (common in AP/PP stock lists). Pattern: line with ref but no price,
    # followed by 1-2 lines with price/year but no ref.
    raw_lines = content.split('\n')
    lines = []
    i = 0
    while i < len(raw_lines):
        stripped_cur = raw_lines[i].strip()
        if stripped_cur:
            ref_cur = _extract_ref_from_line(stripped_cur)
            price_cur, _ = extract_price_from_line(stripped_cur, sender_country) if ref_cur else (None, None)

            if ref_cur and not price_cur:
                # Look ahead up to 3 lines for price/year continuation
                merged = stripped_cur
                consumed = 0
                for look in range(1, 4):
                    if i + look >= len(raw_lines):
                        break
                    nxt = raw_lines[i + look].strip()
                    if not nxt:
                        continue
                    # Stop if next line has its own ref or is a brand header
                    if _extract_ref_from_line(nxt) or detect_brand_header(nxt):
                        break
                    price_nxt, _ = extract_price_from_line(nxt, sender_country)
                    year_nxt = extract_year_from_line(nxt)
                    merged += " " + nxt
                    consumed = look
                    # Stop once we've gathered a price (no need to pull in more)
                    if price_nxt:
                        break
                    # Gather continuation lines with only year/condition info
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

        # Check for brand header
        brand = detect_brand_header(stripped)
        if brand is not None:
            current_brand = brand
            section_condition = _detect_section_condition(stripped)
            continue

        # Check if it's a section header (condition group, separator, etc.)
        if _is_section_header(stripped):
            # Could be a condition sub-header like "New Fullset" or "Used Fullset"
            cond = _detect_section_condition(stripped)
            if cond:
                section_condition = cond
            continue

        # Try to extract a reference from this line
        ref = _extract_ref_from_line(stripped)
        if not ref:
            continue

        # Skip SOLD lines within stock lists
        if re.search(r'\bsold\b', stripped, re.IGNORECASE):
            continue

        # This is a watch line — try to match it
        review_reasons = []
        if not phone:
            review_reasons.append("No phone number (contact name used)")

        # Get remaining tokens after the reference for disambiguation
        # Use cleaned line (emoji-free) for token extraction
        cleaned_line = _clean_text(stripped).strip()
        ref_pos = cleaned_line.lower().find(ref.lower())
        if ref_pos >= 0:
            remaining = cleaned_line[ref_pos + len(ref):].strip()
        else:
            remaining = cleaned_line[len(ref):].strip()
        line_tokens = remaining.split() if remaining else []

        watch_matches, fuzzy_score = match_watch_by_ref(
            ref, watch_index, brand_hint=current_brand,
            line_tokens=line_tokens, return_fuzzy_score=True,
        )

        if len(watch_matches) == 0:
            # Also try full-line matching (no fuzzy — this only exact-matches via
            # pre-compiled patterns, so no fuzzy score to worry about here).
            watch_matches = match_watch(stripped, watch_index, brand_hint=current_brand)
            if len(watch_matches) > 1 and line_tokens:
                watch_matches = _disambiguate_matches(watch_matches, line_tokens)
                # After disambiguation, if a single survivor was picked, re-apply
                # the descriptor-conflict guard. Disambiguation may resolve to one
                # variant whose descriptor doesn't match the line's tokens.
                if len(watch_matches) == 1 and _has_descriptor_conflict(watch_matches[0], line_tokens):
                    watch_matches = []

        if len(watch_matches) == 0:
            # No match at all — goes to not_in_database, not needs_review.
            # Build partial row. When no date tokens are present on the line,
            # leave Monat/Jahr empty rather than fabricating it from the
            # message timestamp (matches the WTB parsing rule: never hallucinate
            # a warranty date the dealer did not write).
            line_condition = extract_condition_from_line(stripped, section_condition)
            raw_month_year = extract_month_year_from_text(stripped)
            year_str = extract_year_from_line(stripped)
            if raw_month_year:
                month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode)
            elif year_str:
                month_year = year_str
            else:
                month_year = ""

            price, currency = extract_price_from_line(stripped, sender_country)
            remarks = normalize_remarks(stripped)
            if msg_location_remarks:
                remarks = f"{remarks}; {msg_location_remarks}" if remarks else msg_location_remarks
            price_str = f"{price} {currency}" if price and currency else (price or "")

            nid_reason = "No matching watch found in database"
            if not phone:
                nid_reason = f"{nid_reason}; no phone number (contact name used)"
            row = {
                "Nachrichten Art": mode,
                "Marke": current_brand or "",
                "WS-Code": "",
                "Monat/Jahr": month_year,
                "Standort": sender_country or "",
                "Zustand": line_condition or "",
                "Bemerkungen": remarks,
                "Preis": price_str,
                "Nummer": phone or sender,
                "Gruppe": group_name,
                "Nachricht gepostet am": format_timestamp(timestamp),
                "Review Reason": nid_reason,
                "Original Text": stripped[:500],
                "Extracted Ref": ref,
                "_review_reason": nid_reason,
                "_original_content": stripped,
            }
            not_in_database_rows.append(row)
            continue

        # Low-confidence fuzzy hit — we found a *similar* reference but aren't
        # sure it's the right one. Route to needs_review with an explanation.
        if fuzzy_score is not None and fuzzy_score < FUZZY_CONFIDENT_THRESHOLD:
            ws_codes = ", ".join(w["ws_code"] for w in watch_matches if w["ws_code"])
            review_reasons.append(
                f"Similar reference — please verify ({fuzzy_score}% match: {ws_codes})"
            )

        if len(watch_matches) > 1:
            ws_codes = ", ".join(w["ws_code"] for w in watch_matches if w["ws_code"])
            review_reasons.append(f"Ambiguous match: {ws_codes}")

        watch = watch_matches[0]

        line_condition = extract_condition_from_line(stripped, section_condition)
        raw_month_year = extract_month_year_from_text(stripped)
        year_str = extract_year_from_line(stripped)
        if raw_month_year:
            month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode)
        elif year_str:
            month_year = year_str
        else:
            # No date on the line — don't fabricate one from the message timestamp.
            month_year = ""

        price, currency = extract_price_from_line(stripped, sender_country)
        remarks = normalize_remarks(stripped)
        if msg_location_remarks:
            remarks = f"{remarks}; {msg_location_remarks}" if remarks else msg_location_remarks

        if mode == "WTS" and not price:
            review_reasons.append("No price found for WTS post")

        # Validate price against brand minimums
        if price:
            price_valid, price_reason = validate_price(price, watch["brand"])
            if not price_valid:
                review_reasons.append(price_reason)

        price_str = f"{price} {currency}" if price and currency else (price or "")

        if review_reasons:
            row = {
                "Nachrichten Art": mode,
                "Marke": watch["brand"],
                "WS-Code": watch["ws_code"],
                "Monat/Jahr": month_year,
                "Standort": sender_country or "",
                "Zustand": line_condition or "",
                "Bemerkungen": remarks,
                "Preis": price_str,
                "Nummer": phone or sender,
                "Gruppe": group_name,
                "Nachricht gepostet am": format_timestamp(timestamp),
                "Review Reason": "; ".join(review_reasons),
                "Original Text": stripped[:500],
                "Extracted Ref": ref,
            }
            needs_review_rows.append(row)
        else:
            matched_rows.append({
                "Nachrichten Art": mode,
                "Marke": watch["brand"],
                "WS-Code": watch["ws_code"],
                "Monat/Jahr": month_year,
                "Standort": sender_country or "",
                "Zustand": line_condition or "",
                "Bemerkungen": remarks,
                "Preis": price_str,
                "Nummer": phone or sender,
                "Gruppe": group_name,
                "Nachricht gepostet am": format_timestamp(timestamp),
                "Original Text": stripped[:500],
            })

    return matched_rows, needs_review_rows, not_in_database_rows


def _resolve_month_year(content: str, mode: str, ref_month: int, ref_year: int) -> tuple[Optional[str], str]:
    """Resolve month/year for a message.
    Returns (raw_month_year, normalized_month_year).

    Neither WTS nor WTB fabricates a warranty date from the message timestamp —
    that would stamp every dateless listing with the export month. If no
    month/year token is present, try a bare-year fallback (WTB adds `+`), else
    return empty.
    """
    raw_month_year = extract_month_year_from_text(content)
    if raw_month_year:
        return raw_month_year, normalize_month_year(raw_month_year, ref_month, ref_year, mode)

    year = extract_year_from_line(content)
    if year:
        suffix = "+" if mode == "WTB" else ""
        return None, f"{year}{suffix}"
    return None, ""


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
) -> dict:
    """Build a CSV row dict (used for needs_review entries)."""
    raw_month_year, month_year = _resolve_month_year(content, mode, ref_month, ref_year)
    location = extract_location(content, sender_country, mode)
    condition = extract_condition(content, mode, raw_month_year, ref_month, ref_year)
    if mode == "WTB":
        price, currency = extract_wtb_price(content, sender_country)
    else:
        price, currency = extract_price(content, sender_country)
    remarks = normalize_remarks(content)
    # Location-preference remarks apply to BOTH WTS and WTB per user rules.
    location_remarks = extract_location_remarks(content, mode)
    if location_remarks:
        remarks = f"{remarks}; {location_remarks}" if remarks else location_remarks

    price_str = f"{price} {currency}" if price and currency else (price or "")

    row = {
        "Nachrichten Art": mode,
        "Marke": watch["brand"] if watch else "",
        "WS-Code": watch["ws_code"] if watch else "",
        "Monat/Jahr": month_year,
        "Standort": location or "",
        "Zustand": condition or "",
        "Bemerkungen": remarks,
        "Preis": price_str,
        "Nummer": phone or sender,
        "Gruppe": group_name,
        "Nachricht gepostet am": format_timestamp(timestamp),
    }
    row["Review Reason"] = reason
    row["Original Text"] = _find_watch_line(content, watch)[:500]
    # Internal fields for AI matching pass (removed before CSV output)
    row["_review_reason"] = reason
    row["_original_content"] = content
    return row


def _rows_to_csv(rows: list[dict]) -> str:
    """Convert list of row dicts to CSV string."""
    if not rows:
        return ""
    output = io.StringIO()
    all_keys = list(CSV_HEADERS)
    for row in rows:
        for key in row:
            if key not in all_keys:
                all_keys.append(key)
    writer = csv.DictWriter(output, fieldnames=all_keys)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def _make_dedup_key(ws_code: str, phone: str, price: str, currency: str, month_year: str) -> str:
    """Generate a dedup key from order fields.
    Key: ws_code|phone|price_numeric|currency|month_year (all normalized)."""
    ws = ws_code.strip().lower() if ws_code else ""
    ph = re.sub(r'[\s\-\(\)]', '', phone).strip() if phone else ""
    # Extract numeric price only
    pr = re.sub(r'[^\d]', '', price.split()[0]) if price else ""
    cur = currency.strip().upper() if currency else ""
    my = month_year.strip().lower() if month_year else ""
    return f"{ws}|{ph}|{pr}|{cur}|{my}"


def _process_messages_sync(
    messages: list[dict],
    mode: str,
    watch_index: dict,
    group_name: str,
    ref_month: int,
    ref_year: int,
    progress_state: Optional[dict] = None,
) -> dict:
    """CPU-bound main processing loop. Runs in a thread pool so it doesn't
    block the async event loop (which serves progress polling, /auth/me, etc.).

    progress_state: optional shared dict for thread-safe progress reporting.
    The async caller reads this dict periodically to push updates to MongoDB.

    Returns dict with matched_rows, needs_review_rows, not_in_database_rows,
    detected_posts, fuzzy_match_count."""
    global _fuzzy_match_count

    matched_rows = []
    needs_review_rows = []
    not_in_database_rows = []
    detected_posts = 0
    total_messages = len(messages)

    for idx, msg in enumerate(messages):
        # Update shared progress state (read by async poller on the event loop)
        if progress_state is not None and total_messages > 0 and idx % 20 == 0:
            pct = 15 + int((idx / total_messages) * 60)  # 15% to 75%
            progress_state["percent"] = pct
            progress_state["detail"] = f"Processing messages... {idx:,}/{total_messages:,}"
        content = msg["content"]
        # Strip media markers like "Bild weggelassen" / "image omitted" that are
        # injected by WhatsApp exports alongside the actual listing content.
        content = _strip_media_markers(content).strip()
        sender = msg["sender"]
        timestamp = msg["timestamp"]

        post_type = detect_post_type(content)
        if post_type is None:
            continue
        if post_type != mode:
            continue

        detected_posts += 1

        phone = extract_phone_number(sender)
        sender_country = get_country_from_phone(phone) if phone else None

        # Check if this is a structured stock list
        if _is_stock_list_message(content):
            m_rows, nr_rows, nid_rows = parse_stock_list(
                content=content,
                mode=mode,
                watch_index=watch_index,
                sender=sender,
                timestamp=timestamp,
                group_name=group_name,
                ref_month=ref_month,
                ref_year=ref_year,
                phone=phone,
                sender_country=sender_country,
            )
            matched_rows.extend(m_rows)
            needs_review_rows.extend(nr_rows)
            not_in_database_rows.extend(nid_rows)
            continue

        # Non-stock-list: single post processing
        review_reasons = []
        if not phone:
            review_reasons.append("No phone number (contact name used)")

        msg_brand_hint = detect_brand_from_content(content)
        watch_matches = match_watch(content, watch_index, brand_hint=msg_brand_hint)

        if len(watch_matches) == 0:
            # No watch found at all — route to not_in_database, not needs_review.
            nid_reason = "No matching watch found in database"
            if not phone:
                nid_reason = f"{nid_reason}; no phone number (contact name used)"
            not_in_database_rows.append(_build_row(
                mode=mode, content=content, sender=sender, timestamp=timestamp,
                group_name=group_name, ref_month=ref_month, ref_year=ref_year,
                sender_country=sender_country, phone=phone, watch=None,
                reason=nid_reason,
            ))
            continue

        if len(watch_matches) > 1:
            ws_codes = ", ".join(w["ws_code"] for w in watch_matches if w["ws_code"])
            review_reasons.append(f"Ambiguous match: {ws_codes}")
            needs_review_rows.append(_build_row(
                mode=mode, content=content, sender=sender, timestamp=timestamp,
                group_name=group_name, ref_month=ref_month, ref_year=ref_year,
                sender_country=sender_country, phone=phone, watch=None,
                reason="; ".join(review_reasons),
            ))
            continue

        watch = watch_matches[0]

        # When the message contains multiple watches on different lines with
        # different years, resolve date/condition/price against the ONE line
        # that names this watch — not the full content. Otherwise every match
        # inherits the first year/price/etc in the message.
        watch_line = _find_watch_line(content, watch) or content

        raw_month_year, month_year = _resolve_month_year(watch_line, mode, ref_month, ref_year)

        location = extract_location(content, sender_country, mode)
        condition = extract_condition(watch_line, mode, raw_month_year, ref_month, ref_year)
        if mode == "WTB":
            price, currency = extract_wtb_price(watch_line, sender_country)
        else:
            price, currency = extract_price(watch_line, sender_country)

        if mode == "WTS" and not price:
            review_reasons.append("No price found for WTS post")

        # Validate price against brand minimums
        if price:
            price_valid, price_reason = validate_price(price, watch["brand"])
            if not price_valid:
                review_reasons.append(price_reason)

        if review_reasons:
            needs_review_rows.append(_build_row(
                mode=mode, content=content, sender=sender, timestamp=timestamp,
                group_name=group_name, ref_month=ref_month, ref_year=ref_year,
                sender_country=sender_country, phone=phone, watch=watch,
                reason="; ".join(review_reasons),
            ))
            continue

        remarks = normalize_remarks(content)
        location_remarks = extract_location_remarks(content, mode)
        if location_remarks:
            remarks = f"{remarks}; {location_remarks}" if remarks else location_remarks

        price_str = f"{price} {currency}" if price and currency else (price or "")

        matched_rows.append({
            "Nachrichten Art": mode,
            "Marke": watch["brand"],
            "WS-Code": watch["ws_code"],
            "Monat/Jahr": month_year,
            "Standort": location or "",
            "Zustand": condition or "",
            "Bemerkungen": remarks,
            "Preis": price_str,
            "Nummer": phone or sender,
            "Gruppe": group_name,
            "Nachricht gepostet am": format_timestamp(timestamp),
            "Original Text": _find_watch_line(content, watch)[:500],
        })

    return {
        "matched_rows": matched_rows,
        "needs_review_rows": needs_review_rows,
        "not_in_database_rows": not_in_database_rows,
        "detected_posts": detected_posts,
        "fuzzy_match_count": _fuzzy_match_count,
    }


async def process_generation(
    txt_content: str,
    mode: str,
    ref_month: int,
    ref_year: int,
    group_name: str,
    jsonl_content: Optional[str] = None,
    progress_callback=None,
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

    global _fuzzy_match_count
    _fuzzy_match_count = 0
    _fuzzy_match_cache.clear()

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
            progress_state,
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
    # Cap at 3000 items to avoid excessive OpenAI costs and timeouts.
    # 3000 items = 2 batches × 1500 ≈ 2 API calls, ~$0.10-0.20 total.
    AI_MATCHING_CAP = 3000
    AI_MATCHING_TIMEOUT = 180  # seconds

    ai_matched_count = 0
    ai_suggested_additions = []  # Watches not in catalog but identified by AI
    unmatched_for_ai = []
    unmatched_indices = []

    # AI pass now operates on the not_in_database bucket — these are the rows
    # where automatic matching found nothing and we want AI to take a second look.
    for i, row in enumerate(not_in_database_rows):
        unmatched_for_ai.append({
            "index": len(unmatched_for_ai),
            "content": row.get("_original_content", ""),
            "brand_hint": row.get("Marke", None),
        })
        unmatched_indices.append(i)

    if unmatched_for_ai:
        total_unmatched = len(unmatched_for_ai)
        if total_unmatched > AI_MATCHING_CAP:
            logger.info(f"process_generation: capping AI matching from {total_unmatched} to {AI_MATCHING_CAP} items")
            # Keep the first N items (most recent messages first in the processing order)
            unmatched_for_ai = unmatched_for_ai[:AI_MATCHING_CAP]
            unmatched_indices = unmatched_indices[:AI_MATCHING_CAP]

        ai_count = len(unmatched_for_ai)
        skipped = total_unmatched - ai_count
        skip_msg = f" ({total_unmatched - ai_count:,} skipped)" if skipped else ""
        await _report("ai_matching", 80, f"AI matching {ai_count:,} unmatched items with GPT-5.2...{skip_msg}")
        logger.info(f"process_generation: starting AI matching for {ai_count} lines (timeout={AI_MATCHING_TIMEOUT}s)...")
        t_ai_start = time.time()
        try:
            ai_results = await asyncio.wait_for(
                batch_ai_match(unmatched_for_ai, watch_index),
                timeout=AI_MATCHING_TIMEOUT,
            )
        except asyncio.TimeoutError:
            ai_results = []
            logger.warning(f"process_generation: AI matching timed out after {AI_MATCHING_TIMEOUT}s — skipping")
            await _report("ai_matching", 85, f"AI matching timed out after {AI_MATCHING_TIMEOUT}s — continuing without AI results")
        logger.info(f"process_generation: AI matching done in {time.time()-t_ai_start:.1f}s — {len(ai_results)} results")

        # Build lookup: ai line index -> match result
        ai_lookup = {r["index"]: r for r in ai_results}

        # Track which not_in_database rows were matched (remove) or upgraded to
        # needs_review (move). We process in reverse order for safe removal.
        indices_to_remove = []
        indices_to_move_to_review = []
        for ai_idx, nid_idx in enumerate(unmatched_indices):
            if ai_idx in ai_lookup:
                result = ai_lookup[ai_idx]
                confidence = result.get("confidence", 0)

                if confidence < 80:
                    # Low confidence — AI found *something* similar, so promote
                    # this row from not_in_database to needs_review with the AI
                    # suggestion attached. The human can confirm or reject.
                    row = not_in_database_rows[nid_idx]
                    ai_info = f"AI suggestion ({confidence}%): {result.get('ai_ws_code', '?')}"
                    row["Review Reason"] = (
                        f"{row.get('Review Reason', '')}; {ai_info}"
                        if row.get("Review Reason") else ai_info
                    )
                    indices_to_move_to_review.append(nid_idx)
                    continue

                watch = result.get("watch")
                in_catalog = result.get("in_catalog", False)
                row = not_in_database_rows[nid_idx]
                original_content = row.get("_original_content", "")

                # Re-extract fields for the matched row
                raw_month_year, month_year_val = _resolve_month_year(original_content, mode, ref_month, ref_year)
                phone_val = row.get("Nummer", "")
                sender_country_val = get_country_from_phone(phone_val) if phone_val.startswith("+") else None
                location_val = extract_location(original_content, sender_country_val, mode)
                condition_val = extract_condition(original_content, mode, raw_month_year, ref_month, ref_year)
                price_val, currency_val = extract_price(original_content, sender_country_val)
                if not price_val:
                    price_val, currency_val = extract_price_from_line(original_content, sender_country_val)
                remarks_val = normalize_remarks(original_content)
                loc_remarks = extract_location_remarks(original_content, mode)
                if loc_remarks:
                    remarks_val = f"{remarks_val}; {loc_remarks}" if remarks_val else loc_remarks
                price_str_val = f"{price_val} {currency_val}" if price_val and currency_val else (price_val or "")

                # Use catalog watch data if available, otherwise AI-determined data
                ws_code_val = watch["ws_code"] if watch else result.get("ai_ws_code", "")
                brand_val = watch["brand"] if watch else result.get("ai_brand", "")

                matched_rows.append({
                    "Nachrichten Art": mode,
                    "Marke": brand_val,
                    "WS-Code": ws_code_val,
                    "Monat/Jahr": month_year_val,
                    "Standort": location_val or "",
                    "Zustand": condition_val or "",
                    "Bemerkungen": remarks_val,
                    "Preis": price_str_val,
                    "Nummer": phone_val,
                    "Gruppe": group_name,
                    "Nachricht gepostet am": row.get("Nachricht gepostet am", ""),
                    "Original Text": _find_watch_line(original_content, watch)[:500],
                })
                indices_to_remove.append(nid_idx)
                ai_matched_count += 1

                # Track suggested catalog additions (watches not in catalog)
                if not in_catalog and ws_code_val and brand_val:
                    ai_suggested_additions.append({
                        "brand": brand_val,
                        "suggested_ws_code": ws_code_val,
                        "model": result.get("ai_model", ""),
                        "reference": result.get("ai_ws_code", "").split()[0] if result.get("ai_ws_code") else "",
                        "confidence": confidence,
                        "example_line": original_content[:200],
                    })

        # Apply moves/removals to not_in_database_rows. Process in reverse index
        # order so earlier indices stay valid while we splice.
        move_set = set(indices_to_move_to_review)
        remove_set = set(indices_to_remove)
        all_touched = sorted(move_set | remove_set, reverse=True)
        for idx in all_touched:
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

        try:
            verify_results = await asyncio.wait_for(
                batch_ai_verify(verify_items, watch_index, mode),
                timeout=AI_MATCHING_TIMEOUT,
            )
        except asyncio.TimeoutError:
            verify_results = []
            logger.warning("process_generation: AI verification timed out — keeping deterministic results")

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

            if tier == "matched":
                row = matched_rows[row_idx]
                if action == "flip" and conf >= 95 and new_ws:
                    # Look up catalog watch for the new ws_code
                    cat_watch = watch_index["by_ws_code"].get(new_ws.lower())
                    if cat_watch:
                        row["WS-Code"] = cat_watch["ws_code"]
                        row["Marke"] = cat_watch["brand"]
                    else:
                        row["WS-Code"] = new_ws
                    if new_price and new_currency:
                        row["Preis"] = f"{new_price} {new_currency}"
                    elif new_price:
                        row["Preis"] = new_price
                elif action == "demote" and conf < 80:
                    row["Review Reason"] = (
                        f"AI demoted ({conf}%): {reason}" if not row.get("Review Reason")
                        else f"{row['Review Reason']}; AI demoted ({conf}%): {reason}"
                    )
                    matched_to_demote.append(row_idx)
                # 'keep' → do nothing; ignore flips below threshold (too risky)
            else:  # tier == "review"
                row = needs_review_rows[row_idx]
                if action in ("keep", "flip") and conf >= 80 and new_ws:
                    cat_watch = watch_index["by_ws_code"].get(new_ws.lower())
                    if cat_watch:
                        row["WS-Code"] = cat_watch["ws_code"]
                        row["Marke"] = cat_watch["brand"]
                    else:
                        row["WS-Code"] = new_ws
                    if new_price and new_currency:
                        row["Preis"] = f"{new_price} {new_currency}"
                    # Leave it in needs_review unless action asks for promote — keep conservative
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

    # --- Require Monat/Jahr on matched rows (unless 'only watch' in remarks) ---
    # Matched rows without a year are ambiguous for buyers — we can't tell a 2018
    # from a 2025 listing. The only legitimate exception is 'only watch' (bare
    # watch with no papers/box), where the dealer often omits the year because
    # there's no warranty card anyway.
    missing_year_indices: list[int] = []
    for idx, row in enumerate(matched_rows):
        if row.get("Monat/Jahr", "").strip():
            continue
        remarks_l = (row.get("Bemerkungen") or "").lower()
        if "only watch" in remarks_l:
            continue
        reason = "Matched watch has no year and remarks do not contain 'only watch'"
        row["_review_reason"] = reason
        row["Review Reason"] = reason
        row["_original_content"] = row.get("Original Text", "")
        missing_year_indices.append(idx)

    for idx in sorted(set(missing_year_indices), reverse=True):
        needs_review_rows.append(matched_rows[idx])
        matched_rows.pop(idx)

    if missing_year_indices:
        logger.info(f"process_generation: moved {len(missing_year_indices)} rows to needs_review (no year, not only-watch)")

    # --- Outlier price detection ---
    # Year-based check first (peers = same ws_code + same condition + same year),
    # with a global-median fallback for rows that have no year-based peers at all.
    # Catches: (a) currency misclassifications (USD 140k vs HKD 140k ≈ 8× drift),
    # (b) wildly-off dealer typos (260k for 5712/1R when 2018 market is ~1.8M+),
    # (c) single-row currency defaults that don't match the group consensus.
    FX_TO_HKD = {
        "HKD": 1.0, "USD": 7.8, "USDT": 7.8, "CNY": 1.1, "RMB": 1.1,
        "EUR": 8.4, "GBP": 9.8, "CHF": 8.8, "JPY": 0.05, "AED": 2.1, "SGD": 5.8,
    }
    def _to_hkd(num: str, cur: str) -> Optional[float]:
        try:
            return float(num.replace(',', '')) * FX_TO_HKD.get((cur or '').upper(), 1.0)
        except ValueError:
            return None

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

    # Clean internal fields before CSV generation
    for row in needs_review_rows:
        row.pop("_review_reason", None)
        row.pop("_original_content", None)
    for row in not_in_database_rows:
        row.pop("_review_reason", None)
        row.pop("_original_content", None)

    matched_csv = _rows_to_csv(matched_rows)
    needs_review_csv = _rows_to_csv(needs_review_rows)
    not_in_database_csv = _rows_to_csv(not_in_database_rows)

    logger.info(f"process_generation: COMPLETE in {time.time()-t_start:.1f}s — "
                f"{len(matched_rows)} matched, {len(needs_review_rows)} needs_review, "
                f"{len(not_in_database_rows)} not_in_database, "
                f"{_fuzzy_match_count} fuzzy, {ai_matched_count} AI")

    total_rows = len(matched_rows) + len(needs_review_rows) + len(not_in_database_rows)

    return {
        "matched_csv": matched_csv,
        "needs_review_csv": needs_review_csv,
        "not_in_database_csv": not_in_database_csv,
        "suggested_additions_csv": suggested_csv,
        "total_messages": total_rows,
        "detected_posts": total_rows,
        "matched_count": len(matched_rows),
        "needs_review_count": len(needs_review_rows),
        "not_in_database_count": len(not_in_database_rows),
        "fuzzy_matched_count": _fuzzy_match_count,
        "ai_matched_count": ai_matched_count,
        "suggested_additions_count": len(unique_suggestions) if ai_suggested_additions else 0,
    }
