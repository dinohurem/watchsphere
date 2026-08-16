from beanie import Document
from pydantic import Field
from datetime import datetime
from enum import Enum
from typing import List, Optional

import pymongo


class BridgeState(str, Enum):
    """Connection state reported by the bridge client."""
    STARTING = "starting"
    QR_REQUIRED = "qr_required"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    LOGGED_OUT = "logged_out"


class BridgeMessage(Document):
    """A single message captured live by the WhatsApp bridge client.

    These are raw captures. Nothing here is parsed or matched — the rows are
    rendered back into WhatsApp export format on demand and handed to the
    existing WTS/WTB generator, so the bridge never bypasses the human review
    step that stands between a chat message and the order book.
    """
    group_jid: str = Field(..., index=True)
    group_name: str
    message_id: str

    # Sender label as it should appear in the rendered export line. Phone
    # number when available (that is what the parser derives country from),
    # otherwise the contact/push name.
    sender: str
    sender_phone: Optional[str] = None
    push_name: Optional[str] = None

    content: str
    timestamp: datetime
    from_me: bool = False
    has_media: bool = False
    attachments: List[str] = Field(default_factory=list)

    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    bridge_id: Optional[str] = None

    class Settings:
        name = "whatsapp_bridge_messages"
        indexes = [
            pymongo.IndexModel(
                [("group_jid", pymongo.ASCENDING), ("message_id", pymongo.ASCENDING)],
                unique=True,
                name="uniq_group_message",
            ),
            pymongo.IndexModel(
                [("group_jid", pymongo.ASCENDING), ("timestamp", pymongo.ASCENDING)],
                name="group_timestamp",
            ),
            "timestamp",
        ]


class BridgeStatus(Document):
    """Heartbeat / connection state for a bridge client instance."""
    bridge_id: str = Field(..., index=True)

    state: BridgeState = BridgeState.STARTING
    phone_number: Optional[str] = None
    error: Optional[str] = None

    # Groups the bridge is currently capturing from
    groups: List[str] = Field(default_factory=list)

    last_heartbeat_at: datetime = Field(default_factory=datetime.utcnow)
    last_message_at: Optional[datetime] = None
    messages_ingested: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "whatsapp_bridge_status"
        indexes = [
            pymongo.IndexModel(
                [("bridge_id", pymongo.ASCENDING)],
                unique=True,
                name="uniq_bridge_id",
            ),
        ]
