"""Outgoing WhatsApp messages (redesign v3 §10.2: "After approval the user is notified on
WhatsApp, not by email").

The codebase had no WhatsApp sender (the bridge only *captures* group messages), so this is a
small pluggable sender:

- ``WHATSAPP_CLOUD_TOKEN`` + ``WHATSAPP_CLOUD_PHONE_NUMBER_ID`` set → WhatsApp Business Cloud
  API. If ``WHATSAPP_APPROVAL_TEMPLATE`` is set, the approval message is sent as that approved
  template (required outside the 24 h customer-service window), otherwise as plain text.
- otherwise → the message is only logged and the caller falls back to email.

Settings are read from the environment so no config change is required to deploy it.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = os.getenv("WHATSAPP_CLOUD_API_VERSION", "v21.0")

APPROVAL_MESSAGE = (
    "Your WatchSphere account has been approved. Open the app to start tracking the market."
)


def _cloud_config() -> Optional[tuple[str, str]]:
    token = os.getenv("WHATSAPP_CLOUD_TOKEN", "").strip()
    phone_id = os.getenv("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "").strip()
    if token and phone_id:
        return token, phone_id
    return None


def _to_wa_id(phone: str) -> str:
    """'+852 9123 4567' → '85291234567' (Cloud API wants digits only)."""
    return "".join(ch for ch in (phone or "") if ch.isdigit())


async def send_whatsapp_message(
    phone: Optional[str], text: str, template: Optional[str] = None
) -> bool:
    """Send a WhatsApp message. Returns True only when a provider accepted it."""
    wa_id = _to_wa_id(phone or "")
    if not wa_id:
        logger.info("WhatsApp message not sent: no phone number")
        return False

    cfg = _cloud_config()
    if not cfg:
        logger.info("[whatsapp-sender] no provider configured; would send to %s: %s", wa_id, text)
        return False

    token, phone_id = cfg
    if template:
        payload = {
            "messaging_product": "whatsapp",
            "to": wa_id,
            "type": "template",
            "template": {"name": template, "language": {"code": "en"}},
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": wa_id,
            "type": "text",
            "text": {"body": text},
        }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_id}/messages",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        if resp.status_code < 300:
            logger.info("WhatsApp message sent to %s", wa_id)
            return True
        logger.error("WhatsApp Cloud API error %s: %s", resp.status_code, resp.text[:500])
    except Exception as e:  # network errors must never break the caller
        logger.error("WhatsApp send to %s failed: %s", wa_id, e)
    return False


async def notify_account_approved(user) -> str:
    """Tell a freshly approved user. Returns the channel used: whatsapp | email | none."""
    template = os.getenv("WHATSAPP_APPROVAL_TEMPLATE", "").strip() or None
    phone = getattr(user, "whatsapp_phone", None) or getattr(user, "phone", None)
    if await send_whatsapp_message(phone, APPROVAL_MESSAGE, template=template):
        return "whatsapp"

    # Fallback: email, so the user is not left waiting on the pending screen.
    try:
        from app.services.email import email_service

        if await email_service.send_account_confirmation_email(
            to_email=user.email, user_name=user.name
        ):
            return "email"
    except Exception as e:
        logger.error("Approval email fallback for %s failed: %s", getattr(user, "email", "?"), e)
    return "none"
