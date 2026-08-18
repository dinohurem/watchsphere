"""Outbound WhatsApp delivery for one-time verification codes.

The transport is chosen by ``settings.WHATSAPP_OTP_DRIVER`` so authentication is
never hard-wired to one vendor:

    log     - development default. The code is logged and nothing is sent.
    whapi   - whapi.cloud REST gateway.
    twilio  - Twilio WhatsApp Business API.

Deliberately not routed through apps/whatsapp-bridge: that bridge is inbound
only, and it pairs an unofficial WhatsApp session that can be banned. Putting
login behind it would turn a ban into a total authentication outage.
"""

import logging
import re
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_OTP_TEMPLATE = (
    "{code} is your WatchSphere verification code. "
    "It expires in {minutes} minutes. Never share this code with anyone."
)


class WhatsAppDeliveryError(Exception):
    """Raised when the code could not be handed to the transport."""


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


async def _send_via_whapi(phone: str, body: str) -> None:
    if not settings.WHAPI_TOKEN:
        raise WhatsAppDeliveryError("WHAPI_TOKEN is not configured")
    url = f"{settings.WHAPI_BASE_URL.rstrip('/')}/messages/text"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {settings.WHAPI_TOKEN}"},
            json={"to": phone.lstrip("+"), "body": body},
        )
    if resp.status_code >= 300:
        raise WhatsAppDeliveryError(f"whapi returned {resp.status_code}: {resp.text[:200]}")


async def _send_via_twilio(phone: str, body: str) -> None:
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_FROM):
        raise WhatsAppDeliveryError("Twilio credentials are not configured")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            url,
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            data={
                "From": f"whatsapp:{settings.TWILIO_WHATSAPP_FROM}",
                "To": f"whatsapp:{phone}",
                "Body": body,
            },
        )
    if resp.status_code >= 300:
        raise WhatsAppDeliveryError(f"twilio returned {resp.status_code}: {resp.text[:200]}")


async def send_verification_code(phone: str, code: str) -> bool:
    """Deliver a verification code over WhatsApp.

    Returns True when the transport accepted it. Never raises to the caller on
    a delivery failure - the endpoint decides what to tell the user, and must
    not leak whether a number is registered.
    """
    body = _OTP_TEMPLATE.format(code=code, minutes=settings.WHATSAPP_OTP_EXPIRY_MINUTES)
    driver = (settings.WHATSAPP_OTP_DRIVER or "log").strip().lower()

    try:
        if driver == "whapi":
            await _send_via_whapi(phone, body)
        elif driver == "twilio":
            await _send_via_twilio(phone, body)
        elif driver == "log":
            # Never log the code outside development.
            logger.warning("[whatsapp-otp:log] would send to %s: %s", phone, body)
        else:
            raise WhatsAppDeliveryError(f"Unknown WHATSAPP_OTP_DRIVER {driver!r}")
        return True
    except WhatsAppDeliveryError as exc:
        logger.error("WhatsApp OTP delivery failed for %s: %s", phone, exc)
        return False
    except Exception as exc:  # transport/network faults must not 500 the endpoint
        logger.exception("Unexpected WhatsApp OTP failure for %s: %s", phone, exc)
        return False
