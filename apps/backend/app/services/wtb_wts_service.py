import re
import csv
import io
import json
from datetime import datetime
from typing import Optional
from app.models.watch import Watch


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
    "fresh": "Unworn", "new": "Unworn", "unworn": "Unworn", "brand new": "Unworn", "bnib": "Unworn",
    "nos": "Unworn",
    "used": "Used", "worn": "Used",
    "like new": "Like New",
    "polished": "Polished",
    "retail ready": "Retail Ready",
    "handling marks": "Handling Marks", "handling mark": "Handling Marks",
}

WTB_CONDITIONS = {
    "unworn": "Only Unworn", "new": "Only Unworn", "only unworn": "Only Unworn", "unworn only": "Only Unworn",
    "used": "Can be Used", "can be used": "Can be Used", "used ok": "Can be Used", "used fine": "Can be Used",
}

WTS_KEYWORDS = ["wts", "want to sell", "for sale", "selling", "fs", "stock list", "stocklist", "price list", "pricelist"]
WTB_KEYWORDS = ["wtb", "want to buy", "looking for", "looking", "need", "lf"]

REMARKS_MAP = {
    "both tag": "Both Tag",
    "export only": "Export only",
    "full set": "Full Set", "fullset": "Full Set",
    "card only": "Card Only",
    "box only": "Box Only",
    "no box": "No Box",
    "no papers": "No Papers",
    "complete set": "Complete Set",
    "watch only": "Watch Only",
    "single watch": "Watch Only",
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


def parse_whatsapp_txt(content: str) -> list[dict]:
    """Parse a WhatsApp .txt export into messages.
    Handles multi-line messages by joining continuation lines."""
    messages = []
    patterns = [
        r'\[(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)',
        r'(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)',
        r'(\d{1,2}\.\d{1,2}\.\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)',
    ]

    current_msg = None

    for line in content.split('\n'):
        line = line.strip()
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


def detect_post_type(content: str) -> Optional[str]:
    """Detect if a message is WTS, WTB, or neither. Returns 'WTS', 'WTB', or None."""
    content_lower = content.lower()

    if any(x in content_lower for x in ["bild weggelassen", "video weggelassen", "media omitted", "<media omitted>"]):
        return None

    for kw in WTS_KEYWORDS:
        if kw in content_lower:
            return "WTS"

    for kw in WTB_KEYWORDS:
        if kw in content_lower:
            return "WTB"

    has_price = bool(re.search(r'(?:\$|€|£|HKD|USD|EUR|GBP|CHF|AED|USDT)\s*[\d,]+|[\d,]+\s*(?:HKD|USD|EUR|GBP|CHF|AED|USDT|k\b)', content, re.IGNORECASE))
    if has_price:
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

    return {
        "by_ws_code": by_ws_code,
        "by_oem_ref": by_oem_ref,
        "by_alias": by_alias,
        "by_reference": by_reference,
        "by_brand": by_brand,
        "brands": sorted(brands_set),
    }


def _clean_text(text: str) -> str:
    """Remove emoji and special decorative chars from text."""
    # Remove broad unicode emoji/symbol ranges
    cleaned = re.sub(
        r'[\U0001F300-\U0001FAFF'   # Misc Symbols, Emoticons, Dingbats, Transport, etc.
        r'\U00002702-\U000027B0'    # Dingbats
        r'\U0000FE00-\U0000FE0F'    # Variation selectors
        r'\U0000200D'               # Zero-width joiner
        r'\U0001F1E0-\U0001F1FF'    # Regional indicator (flags)
        r'\U00002600-\U000026FF'    # Misc symbols
        r'\U00002300-\U000023FF'    # Misc technical
        r'\U0000200B-\U0000200F'    # Zero-width spaces
        r'\U0000FE0F'               # Variation selector-16
        r']+', '', text)
    return cleaned.strip()


def detect_brand_header(line: str) -> Optional[str]:
    """Detect if a line is a brand section header.
    Returns the canonical brand name or None.
    Handles lines like: '🟥🟥Patek Philippe🟥🟥', 'Ap Used ✨✨', 'RM Used Fullset✨✨',
    '🟥 🟥 Rolex 🟥 🟥', 'Patek Used ✨ ✨'"""
    cleaned = _clean_text(line).strip()
    if not cleaned:
        return None

    cleaned_lower = cleaned.lower().strip()

    # Remove trailing condition/status words to isolate brand
    # e.g. "Ap Used" -> "Ap", "RM Used Fullset" -> "RM", "Patek Used" -> "Patek"
    cleaned_lower = re.sub(r'\s+(used|new|unworn|fullset|full set|nos)\b.*$', '', cleaned_lower, flags=re.IGNORECASE).strip()

    # Remove decorative dashes/underscores
    cleaned_lower = re.sub(r'^[\-_=*\s]+|[\-_=*\s]+$', '', cleaned_lower)

    if not cleaned_lower:
        return None

    # Check against brand aliases
    if cleaned_lower in BRAND_ALIASES:
        return BRAND_ALIASES[cleaned_lower]

    # Check partial matches for multi-word brands
    for alias, brand in sorted(BRAND_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
        if cleaned_lower == alias:
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

    # Lines that are just condition labels like "New Fullset", "Used Fullset✨✨"
    condition_only = re.match(
        r'^(new|used|unworn|nos|like new)\s*(fullset|full set)?\s*$',
        cleaned, re.IGNORECASE
    )
    if condition_only:
        return True

    # Lines like "—no box—香港現貨" (special notes/headers)
    if cleaned.startswith('—') or cleaned.startswith('--'):
        return True

    return False


def _extract_ref_from_line(line: str) -> Optional[str]:
    """Extract the reference/model number from the start of a watch line.
    Strips emoji first. Handles formats like: '5968A', 'RM037RG', '126334G',
    '5712/1A', '5139G-010', '7118/1200A', '5160/500R', '278273VI', '15720ST'"""
    cleaned = _clean_text(line).strip()
    if not cleaned:
        return None
    # Match reference patterns at start: alphanumeric with optional /- separators
    m = re.match(r'^([A-Za-z]{0,4}\d{2,6}(?:[/\-][A-Za-z0-9]+)*[A-Za-z]{0,4})\b', cleaned)
    if m:
        return m.group(1)
    return None


def _disambiguate_matches(matches: list[dict], line_tokens: list[str]) -> list[dict]:
    """When multiple watch candidates match, use remaining tokens on the line
    to pick the right variant.

    E.g., line '126710blnr jub n1 145.5k' with candidates [126710BLNR Jub, 126710BLNR Oys]
    -> tokens ['jub', 'n1', '145.5k'] -> 'jub' appears in ws_code '126710BLNR Jub' -> pick that one.

    Checks tokens against: ws_code, aliases, model name.
    Also checks multi-word combinations like 'paul newman' -> 'Paul Newman'.
    """
    if len(matches) <= 1:
        return matches

    # Build a single string of all remaining tokens for multi-word matching
    tokens_str = " ".join(line_tokens).lower()

    scored = []
    for w in matches:
        score = 0
        ws_lower = w["ws_code"].lower()
        model_lower = w.get("model", "").lower()
        aliases_lower = [a.lower() for a in w.get("aliases", [])]

        # Check each token against ws_code
        for token in line_tokens:
            t = token.lower()
            # Skip month codes, prices, years
            if re.match(r'^[nN]\d', t):
                continue
            if re.match(r'^[\d,.]+[kKmM]?$', t):
                continue
            if re.match(r'^20[1-2]\d', t):
                continue
            if t in ('used', 'new', 'unworn', 'nos', 'like', 'fullset', 'full', 'set'):
                continue

            # Check if token appears in ws_code (e.g., 'jub' in '126710BLNR Jub')
            if t in ws_lower:
                score += 10
            # Check if token appears in model
            if t in model_lower:
                score += 5
            # Check against aliases
            for alias in aliases_lower:
                if t in alias or alias in t:
                    score += 8

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

    # If top score is clearly better, return just that one
    if scored[0][0] > 0 and (len(scored) == 1 or scored[0][0] > scored[1][0]):
        return [scored[0][1]]

    # If multiple have the same top score > 0, return those
    if scored[0][0] > 0:
        top_score = scored[0][0]
        return [w for s, w in scored if s == top_score]

    # No disambiguation possible
    return matches


def match_watch_by_ref(ref: str, watch_index: dict, brand_hint: Optional[str] = None,
                       line_tokens: Optional[list[str]] = None) -> list[dict]:
    """Match a reference string against the watch index.
    Uses brand_hint to filter by brand and line_tokens to disambiguate variants.
    All comparisons are case-insensitive."""
    ref_lower = ref.lower()
    matches = []
    seen_ws = set()

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

    # 1. Try ws_code exact match
    if ref_lower in watch_index["by_ws_code"]:
        return [watch_index["by_ws_code"][ref_lower]]

    # 2. Try reference exact match
    if ref_lower in watch_index["by_reference"]:
        candidates = _brand_filter(watch_index["by_reference"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            return matches

    # 3. Try oem_references exact match
    if ref_lower in watch_index["by_oem_ref"]:
        candidates = _brand_filter(watch_index["by_oem_ref"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            return matches

    # 4. Try aliases exact match
    if ref_lower in watch_index["by_alias"]:
        candidates = _brand_filter(watch_index["by_alias"][ref_lower])
        matches = _collect(candidates)
        if matches:
            if len(matches) > 1 and line_tokens:
                matches = _disambiguate_matches(matches, line_tokens)
            return matches

    # 5. Substring search: check if ref appears in any oem_reference or alias
    for key, watch_list in watch_index["by_oem_ref"].items():
        if ref_lower in key or key in ref_lower:
            for w in watch_list:
                if brand_hint and w["brand"].lower() != brand_hint.lower():
                    continue
                ws = w["ws_code"].lower()
                if ws not in seen_ws:
                    matches.append(w)
                    seen_ws.add(ws)

    if matches:
        if len(matches) > 1 and line_tokens:
            matches = _disambiguate_matches(matches, line_tokens)
        return matches

    for key, watch_list in watch_index["by_alias"].items():
        if ref_lower in key or key in ref_lower:
            for w in watch_list:
                if brand_hint and w["brand"].lower() != brand_hint.lower():
                    continue
                ws = w["ws_code"].lower()
                if ws not in seen_ws:
                    matches.append(w)
                    seen_ws.add(ws)

    if len(matches) > 1 and line_tokens:
        matches = _disambiguate_matches(matches, line_tokens)

    return matches


def match_watch(content: str, watch_index: dict) -> list[dict]:
    """Match a single-line or full message content against the watch index.
    Tries reference extraction first, then falls back to substring search.
    All comparisons are case-insensitive."""
    content_lower = content.lower()
    matches = []
    seen_ws_codes = set()

    # Try ws_code substring match
    for ws_code, watch in watch_index["by_ws_code"].items():
        if ws_code and ws_code in content_lower:
            if ws_code not in seen_ws_codes:
                matches.append(watch)
                seen_ws_codes.add(ws_code)

    if matches:
        return matches

    # Try oem_ref substring match
    for oem_ref, watch_list in watch_index["by_oem_ref"].items():
        if oem_ref and oem_ref in content_lower:
            for w in watch_list:
                ws = w["ws_code"].lower()
                if ws not in seen_ws_codes:
                    matches.append(w)
                    seen_ws_codes.add(ws)

    if matches:
        return matches

    # Try reference substring match
    for ref, watch_list in watch_index["by_reference"].items():
        if ref and ref in content_lower:
            for w in watch_list:
                ws = w["ws_code"].lower()
                if ws not in seen_ws_codes:
                    matches.append(w)
                    seen_ws_codes.add(ws)

    if matches:
        return matches

    # Try alias substring match
    for alias, watch_list in watch_index["by_alias"].items():
        if alias and alias in content_lower:
            for w in watch_list:
                ws = w["ws_code"].lower()
                if ws not in seen_ws_codes:
                    matches.append(w)
                    seen_ws_codes.add(ws)

    return matches


def normalize_month_year(text: str, ref_month: int, ref_year: int, mode: str) -> str:
    """Normalize month/year strings to MM/YY format (+ suffix for WTB)."""
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

    m = re.match(r'^n(\d{1,2})$', text)
    if m:
        month = int(m.group(1))
        year = ref_year if month <= ref_month else ref_year - 1
        return f"{month:02d}/{year % 100:02d}{suffix}"

    m = re.match(r'^n(\d{1,2})[/\-](\d{2,4})$', text)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return f"{month:02d}/{year % 100:02d}{suffix}"

    m = re.match(r'^(\d{1,2})[/\-](\d{2,4})$', text)
    if m:
        month = int(m.group(1))
        yr = int(m.group(2))
        year = yr if yr > 99 else 2000 + yr
        return f"{month:02d}/{year % 100:02d}{suffix}"

    for name, num in month_names.items():
        if name in text:
            month = num
            yr_match = re.search(r'(\d{2,4})', text.replace(name, ''))
            if yr_match:
                yr = int(yr_match.group(1))
                year = yr if yr > 99 else 2000 + yr
            else:
                year = ref_year if month <= ref_month else ref_year - 1
            return f"{month:02d}/{year % 100:02d}{suffix}"

    m = re.match(r'^(\d{4})$', text)
    if m:
        year = int(m.group(1))
        return f"{year}{suffix}"

    m = re.match(r'^(\d{2})$', text)
    if m:
        year = 2000 + int(m.group(1))
        return f"{year}{suffix}"

    return text + suffix if suffix else text


def extract_month_year_from_text(content: str) -> Optional[str]:
    """Try to find month/year references in message text."""
    patterns = [
        r'\b[nN](\d{1,2}(?:[/\-]\d{2,4})?)\b',
        r'\b(\d{1,2}[/\-]\d{2,4})\b',
        r'\b((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s*\d{2,4})\b',
    ]
    content_lower = content.lower()

    for pattern in patterns:
        m = re.search(pattern, content_lower)
        if m:
            result = m.group(0)
            start = m.start()
            if start > 0 and content[start - 1] in ('$', '€', '£'):
                continue
            return result

    return None


def extract_year_from_line(content: str) -> Optional[str]:
    """Extract a standalone year (2017-2029) from a watch line.
    Distinct from month/year — catches '2024', '2022year', '2025year'."""
    m = re.search(r'\b(20[1-2]\d)\s*(?:year)?\b', content, re.IGNORECASE)
    if m:
        return m.group(1)
    return None


def extract_price(content: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price and currency from message text.
    Returns (formatted_price, currency) or (None, None).

    Price formats: 387k, 1.17m, 435,000, 138,000, 162k, 1.265m
    Currency can follow (with/without space): 387k hkd, 435,000hkd, 300k usdt
    Currency can precede: HK$387k, $300k, €5,000
    If $ is used by HK/CN/MO/SG sender without USD/USDT qualifier -> HKD.
    """
    # Currency-prefixed patterns (HK$, HKD, $, €, £)
    prefix_patterns = [
        (r'(?:HK\$|hk\$)\s*([\d,.]+[kKmM]?)', "HKD"),
        (r'(?:HKD|hkd)\s*([\d,.]+[kKmM]?)', "HKD"),  # hkd563k, HKD 300k
        (r'(?:USDT|usdt)\s*([\d,.]+[kKmM]?)', "USDT"),
        (r'(?:USD|usd)\s*([\d,.]+[kKmM]?)', "USD"),
        (r'€\s*([\d,.]+[kKmM]?)', "EUR"),
        (r'£\s*([\d,.]+[kKmM]?)', "GBP"),
        (r'\$\s*([\d,.]+[kKmM]?)', None),  # $ — resolved by sender country
    ]

    for pattern, currency in prefix_patterns:
        m = re.search(pattern, content)
        if m:
            raw_price = m.group(1).strip()
            formatted = _format_price(raw_price)
            if formatted:
                if currency is None:
                    if sender_country in HKD_DEFAULT_COUNTRIES:
                        currency = "HKD"
                    else:
                        currency = "USD"
                return formatted, currency

    # Number followed by currency suffix: 387k hkd, 435,000hkd, 1.265m hkd, 300k usdt
    # The number+k/m is always together (no space between digits and k/m)
    currency_suffix = r'(?:\s*(?:HKD|USD|USDT|EUR|GBP|CHF|AED|SGD|JPY|hkd|usd|usdt|eur|gbp|chf|aed|sgd|jpy))'
    m = re.search(r'([\d,.]+[kKmM]?)' + currency_suffix, content)
    if m:
        raw_price = m.group(1).strip()
        formatted = _format_price(raw_price)
        if formatted:
            # Extract the actual currency from the match
            full = m.group(0).upper()
            for cur in ["USDT", "HKD", "USD", "EUR", "GBP", "CHF", "AED", "SGD", "JPY"]:
                if cur in full:
                    return formatted, cur
            return formatted, "USD"

    return None, None


def extract_price_from_line(line: str, sender_country: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Extract price from a single watch line.
    Handles stock list formats: '5968A N2 1.17m hkd', '126334G Black Jub N12 138,000'
    N1, N2, N10, N12 etc. are month codes — NOT prices. Price is the numeric token
    (optionally with k/m suffix) that is NOT preceded by N.
    """
    # Try standard extraction first (handles currency prefix/suffix)
    price, currency = extract_price(line, sender_country)
    if price:
        return price, currency

    # Try bare price at end of line (no currency specified)
    # Match a number+k/m that is NOT preceded by 'n' (which would be a month code like N12)
    # Look for the last numeric token on the line
    # Pattern: a number (with optional commas/dots) optionally followed by k/m, at end of line or before whitespace
    tokens = line.strip().split()
    for token in reversed(tokens):
        token_clean = token.strip().rstrip('.')
        # Skip month codes: N1, N2, N10, N12, n2/2026, etc.
        if re.match(r'^[nN]\d', token_clean):
            continue
        # Skip year tokens like 2024, 2022year
        if re.match(r'^20[1-2]\d(?:year)?$', token_clean, re.IGNORECASE):
            continue
        # Skip non-numeric tokens
        if not re.match(r'^[\d,.]+[kKmM]?$', token_clean):
            continue
        formatted = _format_price(token_clean)
        if formatted:
            if sender_country in HKD_DEFAULT_COUNTRIES:
                return formatted, "HKD"
            return formatted, "USD"

    return None, None


def _format_price(raw: str) -> Optional[str]:
    """Format a raw price string: expand k/m, add commas."""
    raw = raw.strip().replace(' ', '').replace(',', '')

    m = re.match(r'^([\d.]+)\s*[mM]$', raw)
    if m:
        val = float(m.group(1)) * 1000000
        return f"{int(val):,}"

    m = re.match(r'^([\d.]+)\s*[kK]$', raw)
    if m:
        val = float(m.group(1)) * 1000
        return f"{int(val):,}"

    try:
        if '.' in raw and raw.count('.') > 1:
            raw = raw.replace('.', '')
        elif '.' in raw:
            parts = raw.split('.')
            if len(parts[1]) == 3:
                raw = raw.replace('.', '')

        val = float(raw)
        if val < 1:
            return None
        return f"{int(val):,}"
    except ValueError:
        return None


def extract_condition(content: str, mode: str, month_year: Optional[str] = None, ref_month: int = 1, ref_year: int = 2026) -> Optional[str]:
    """Extract and normalize condition from message text."""
    content_lower = content.lower()
    conditions = WTS_CONDITIONS if mode == "WTS" else WTB_CONDITIONS

    for keyword in sorted(conditions.keys(), key=len, reverse=True):
        if keyword in content_lower:
            return conditions[keyword]

    if mode == "WTS" and month_year:
        try:
            normalized = normalize_month_year(month_year, ref_month, ref_year, mode)
            if '/' in normalized:
                parts = normalized.replace('+', '').split('/')
                watch_month = int(parts[0])
                watch_year = 2000 + int(parts[1]) if int(parts[1]) < 100 else int(parts[1])
                months_diff = (ref_year * 12 + ref_month) - (watch_year * 12 + watch_month)
                if 0 <= months_diff < 4:
                    return "Unworn"
        except (ValueError, IndexError):
            pass

    return None


def extract_condition_from_line(line: str, section_condition: Optional[str] = None) -> Optional[str]:
    """Extract condition from a single watch line, falling back to section condition.
    section_condition comes from the brand header (e.g., 'Patek Used' -> 'Used')."""
    line_lower = line.lower()

    for keyword in sorted(WTS_CONDITIONS.keys(), key=len, reverse=True):
        if keyword in line_lower:
            return WTS_CONDITIONS[keyword]

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


def extract_wtb_location_remarks(content: str) -> Optional[str]:
    """For WTB: extract location preferences from text to add to remarks."""
    patterns = [
        r'(?:only\s+in\s+\w+)',
        r'(?:\w+\s+only)',
        r'(?:\w+\s+deals?\s+only)',
        r'(?:\w+\s+sellers?\s+preferred)',
        r'(?:eu\s+(?:only|deals?))',
        r'(?:europe\s+(?:only|deals?))',
    ]
    content_lower = content.lower()
    remarks = []
    for pattern in patterns:
        m = re.search(pattern, content_lower)
        if m:
            remarks.append(m.group(0).strip().title())
    return "; ".join(remarks) if remarks else None


def normalize_remarks(content: str) -> str:
    """Extract and normalize remarks from message text."""
    content_lower = content.lower()
    found_remarks = []
    for keyword, normalized in REMARKS_MAP.items():
        if keyword in content_lower:
            if normalized not in found_remarks:
                found_remarks.append(normalized)
    return ", ".join(found_remarks)


def format_timestamp(ts: datetime) -> str:
    """Format timestamp for CSV output: DD.MM.YY HH:MM:SS"""
    return ts.strftime("%d.%m.%y %H:%M:%S")


def _detect_section_condition(line: str) -> Optional[str]:
    """Detect condition from a brand section header line.
    E.g., 'Patek Used ✨✨' -> 'Used', 'RM Used Fullset' -> 'Used',
    'New Fullset' -> 'Unworn'."""
    cleaned = _clean_text(line).lower().strip()
    if 'used' in cleaned:
        return "Used"
    if 'new' in cleaned or 'unworn' in cleaned:
        return "Unworn"
    if 'nos' in cleaned:
        return "Unworn"
    if 'like new' in cleaned:
        return "Like New"
    return None


def _is_stock_list_message(content: str) -> bool:
    """Detect if a message is a structured stock list (multi-line with brand sections).
    Stock lists have brand headers followed by watch reference lines."""
    lines = content.split('\n')
    if len(lines) < 3:
        return False

    # Look for brand headers
    brand_header_count = 0
    ref_line_count = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if detect_brand_header(stripped) is not None:
            brand_header_count += 1
        elif _extract_ref_from_line(stripped):
            ref_line_count += 1

    # A stock list has at least 1 brand header and several ref lines
    return brand_header_count >= 1 and ref_line_count >= 3


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
) -> tuple[list[dict], list[dict]]:
    """Parse a structured stock list message into individual watch rows.
    Returns (matched_rows, needs_review_rows)."""
    matched_rows = []
    needs_review_rows = []

    current_brand = None
    section_condition = None

    lines = content.split('\n')
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

        watch_matches = match_watch_by_ref(ref, watch_index, brand_hint=current_brand,
                                           line_tokens=line_tokens)

        if len(watch_matches) == 0:
            # Also try full-line matching
            watch_matches = match_watch(stripped, watch_index)
            if len(watch_matches) > 1 and line_tokens:
                watch_matches = _disambiguate_matches(watch_matches, line_tokens)

        if len(watch_matches) == 0:
            review_reasons.append("No matching watch found in database")
            # Build partial row
            line_condition = extract_condition_from_line(stripped, section_condition)
            raw_month_year = extract_month_year_from_text(stripped)
            year_str = extract_year_from_line(stripped)
            month_year = ""
            if raw_month_year:
                month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode)
            elif year_str:
                month_year = year_str

            price, currency = extract_price_from_line(stripped, sender_country)
            remarks = normalize_remarks(stripped)
            price_str = f"{price} {currency}" if price and currency else (price or "")

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
                "Review Reason": "; ".join(review_reasons),
                "Original Text": stripped[:500],
                "Extracted Ref": ref,
            }
            needs_review_rows.append(row)
            continue

        if len(watch_matches) > 1:
            ws_codes = ", ".join(w["ws_code"] for w in watch_matches if w["ws_code"])
            review_reasons.append(f"Ambiguous match: {ws_codes}")

        watch = watch_matches[0]

        line_condition = extract_condition_from_line(stripped, section_condition)
        raw_month_year = extract_month_year_from_text(stripped)
        year_str = extract_year_from_line(stripped)
        month_year = ""
        if raw_month_year:
            month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode)
        elif year_str:
            month_year = year_str

        price, currency = extract_price_from_line(stripped, sender_country)
        remarks = normalize_remarks(stripped)

        if mode == "WTS" and not price:
            review_reasons.append("No price found for WTS post")

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
            })

    return matched_rows, needs_review_rows


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
    raw_month_year = extract_month_year_from_text(content)
    month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode) if raw_month_year else ""
    location = extract_location(content, sender_country, mode)
    condition = extract_condition(content, mode, raw_month_year, ref_month, ref_year)
    price, currency = extract_price(content, sender_country)
    remarks = normalize_remarks(content)
    if mode == "WTB":
        location_remarks = extract_wtb_location_remarks(content)
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
    row["Original Text"] = content[:500]
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


async def process_generation(
    txt_content: str,
    mode: str,
    ref_month: int,
    ref_year: int,
    group_name: str,
    jsonl_content: Optional[str] = None,
) -> dict:
    """Main processing function. Returns matched_csv, needs_review_csv, and stats."""
    watch_index = await build_watch_index(jsonl_content)
    messages = parse_whatsapp_txt(txt_content)
    total_messages = len(messages)

    matched_rows = []
    needs_review_rows = []
    detected_posts = 0

    for msg in messages:
        content = msg["content"]
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
            m_rows, nr_rows = parse_stock_list(
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
            continue

        # Non-stock-list: single post processing (original logic)
        review_reasons = []
        if not phone:
            review_reasons.append("No phone number (contact name used)")

        watch_matches = match_watch(content, watch_index)

        if len(watch_matches) == 0:
            review_reasons.append("No matching watch found in database")
            needs_review_rows.append(_build_row(
                mode=mode, content=content, sender=sender, timestamp=timestamp,
                group_name=group_name, ref_month=ref_month, ref_year=ref_year,
                sender_country=sender_country, phone=phone, watch=None,
                reason="; ".join(review_reasons),
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

        raw_month_year = extract_month_year_from_text(content)
        month_year = normalize_month_year(raw_month_year, ref_month, ref_year, mode) if raw_month_year else ""

        location = extract_location(content, sender_country, mode)
        condition = extract_condition(content, mode, raw_month_year, ref_month, ref_year)
        price, currency = extract_price(content, sender_country)

        if mode == "WTS" and not price:
            review_reasons.append("No price found for WTS post")

        if review_reasons:
            needs_review_rows.append(_build_row(
                mode=mode, content=content, sender=sender, timestamp=timestamp,
                group_name=group_name, ref_month=ref_month, ref_year=ref_year,
                sender_country=sender_country, phone=phone, watch=watch,
                reason="; ".join(review_reasons),
            ))
            continue

        remarks = normalize_remarks(content)
        if mode == "WTB":
            location_remarks = extract_wtb_location_remarks(content)
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
        })

    matched_csv = _rows_to_csv(matched_rows)
    needs_review_csv = _rows_to_csv(needs_review_rows)

    return {
        "matched_csv": matched_csv,
        "needs_review_csv": needs_review_csv,
        "total_messages": total_messages,
        "detected_posts": detected_posts,
        "matched_count": len(matched_rows),
        "needs_review_count": len(needs_review_rows),
    }
