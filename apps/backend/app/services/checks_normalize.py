"""Normalisation for the Checks feature (spec 2.5).

One module, used for admin-entered values and for what users type in the app, so
"3y0r 9842" and "3Y0R9842" meet. Matching is always an exact comparison on the
normalised value, never a substring match.
"""
import re
from typing import Optional

# Leading serial prefixes. Word prefixes (NO, CASE, SN) only count when a separator
# follows ("No. 123", "SN: 123", "Case 123"); glued to the serial they are kept, because
# real serials can start with those letters and stripping them would make "NOA123" match
# "A123" - a false "reported" result. "S/N" and "#" are never part of a serial.
_SERIAL_PREFIX_RE = re.compile(r"^(?:(?:NO|CASE|SN)(?=[\s.:\-#/])|S/N|#)", re.IGNORECASE)
_SERIAL_JUNK_RE = re.compile(r"[\s\-.]+")
_REF_PREFIX_RE = re.compile(r"^(?:REF\.|REF)", re.IGNORECASE)
_REF_KEEP_RE = re.compile(r"[^A-Z0-9/]")


def normalize_serial(raw: Optional[str]) -> str:
    """Upper-case, drop leading prefixes (NO., NO, CASE, S/N, SN, #), spaces, hyphens, dots.

    Prefixes may be stacked ("Case No. 123") and are only removed at the start, and only
    when something follows, so a serial that is just "SN" stays "SN". Word prefixes need a
    separator after them, so "NOA123" and "SN123" are left as they are.
    """
    s = (raw or "").strip().upper()
    while True:
        m = _SERIAL_PREFIX_RE.match(s)
        if not m or not s[m.end():].strip(" -.:"):
            break
        s = s[m.end():].lstrip(" -.:")
    return _SERIAL_JUNK_RE.sub("", s)


def normalize_reference(raw: Optional[str]) -> str:
    """Upper-case, drop "REF."/"REF" and spaces, keep letters, digits and "/"."""
    s = (raw or "").strip().upper()
    m = _REF_PREFIX_RE.match(s)
    if m and s[m.end():].strip(" .:"):
        s = s[m.end():]
    return _REF_KEEP_RE.sub("", s)


def build_e164(country_code: Optional[str], number: Optional[str]) -> Optional[str]:
    """Country code (``+852``) + typed digits -> E.164 (``+85261234567``).

    Strips spaces, brackets, hyphens and the leading 00/0 of the national part. Returns None
    when either part has no digits or the result is longer than 15 digits. It does not
    check that the number exists; see :func:`validate_e164`.
    """
    cc = re.sub(r"\D", "", country_code or "")
    if not cc:
        return None
    raw = (number or "").strip()
    national = re.sub(r"\D", "", raw)
    # A user may type the whole international number ("+852 6123 4567" / "00852 ...").
    if raw.startswith("+") and national.startswith(cc):
        national = national[len(cc):]
    elif national.startswith("00"):
        national = national[2:]
        if national.startswith(cc):
            national = national[len(cc):]
    national = national.lstrip("0")
    if not national:
        return None
    e164 = f"+{cc}{national}"
    return e164 if len(e164) - 1 <= 15 else None


def validate_e164(e164: Optional[str]) -> bool:
    """True when the number is a valid phone number for its country code."""
    if not e164:
        return False
    try:
        import phonenumbers

        return phonenumbers.is_valid_number(phonenumbers.parse(e164, None))
    except Exception:
        return False


def normalize_country_code(raw: Optional[str]) -> Optional[str]:
    """``852``, ``+852``, ``00852`` -> ``+852``. None when there are no digits."""
    digits = re.sub(r"\D", "", raw or "")
    if (raw or "").strip().startswith("00"):
        digits = digits[2:]
    return f"+{digits}" if digits else None
