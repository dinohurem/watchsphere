"""Phone number normalization.

The WhatsApp number is mandatory at signup and identifies the account for
passwordless login, but it is never a delivery channel — verification codes go
to the user's email. This module is what is left of the old whatsapp_otp
service once every outbound driver was removed.
"""

import re
from typing import Optional


def normalize_phone(raw: str) -> Optional[str]:
    """Normalize a phone number to E.164 digits with a leading '+'.

    Returns None when the input cannot be a valid international number, so
    callers can reject it rather than storing something unreachable.
    """
    if not raw:
        return None
    cleaned = re.sub(r"[^\d+]", "", raw.strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    digits = cleaned[1:]
    # E.164 allows at most 15 digits; require enough to include a country code.
    if not digits.isdigit() or not (8 <= len(digits) <= 15):
        return None
    return "+" + digits
