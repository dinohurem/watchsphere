"""Outbound WhatsApp delivery for one-time verification codes.

The transport is chosen by ``settings.WHATSAPP_OTP_DRIVER`` so authentication is
never hard-wired to one vendor:

    log            - development default. The code is logged, nothing is sent.
    whapi          - whapi.cloud REST gateway.
    twilio         - Twilio WhatsApp Business API (we own the code).
    twilio_verify  - Twilio Verify. Twilio generates, delivers AND checks the
                     code, so no local VerificationCode is authoritative. Use
                     uses_remote_verification() to branch.

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


# --- Twilio Verify -------------------------------------------------------
# Verify owns the whole code lifecycle, so these two calls replace both our
# code generation and our comparison.

def uses_remote_verification() -> bool:
    """True when the provider validates the code instead of us."""
    return (settings.WHATSAPP_OTP_DRIVER or "").strip().lower() == "twilio_verify"


def _verify_base_url() -> str:
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN
            and settings.TWILIO_VERIFY_SERVICE_SID):
        raise WhatsAppDeliveryError(
            "Twilio Verify needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and "
            "TWILIO_VERIFY_SERVICE_SID"
        )
    return f"https://verify.twilio.com/v2/Services/{settings.TWILIO_VERIFY_SERVICE_SID}"


async def start_remote_verification(phone: str) -> bool:
    """Ask Twilio to generate and send a code over WhatsApp."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{_verify_base_url()}/Verifications",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={"To": phone, "Channel": "whatsapp"},
            )
        if resp.status_code >= 300:
            logger.error("Twilio Verify start failed for %s: %s %s",
                         phone, resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as exc:
        logger.exception("Twilio Verify start error for %s: %s", phone, exc)
        return False


async def check_remote_verification(phone: str, code: str) -> bool:
    """Ask Twilio whether this code is valid. Only "approved" passes."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{_verify_base_url()}/VerificationCheck",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={"To": phone, "Code": code},
            )
        # A wrong or expired code yields 404 here, which is a normal outcome.
        if resp.status_code >= 300:
            logger.info("Twilio Verify check rejected %s: %s", phone, resp.status_code)
            return False
        return resp.json().get("status") == "approved"
    except Exception as exc:
        # Never treat a transport fault as a successful verification.
        logger.exception("Twilio Verify check error for %s: %s", phone, exc)
        return False
