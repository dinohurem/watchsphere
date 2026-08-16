"""Render bridge-captured messages back into WhatsApp export format.

The WTS/WTB generator's entry point is `parse_whatsapp_txt`, which expects the
text of a WhatsApp "Export chat" file. Rather than teach the generator a second
input shape, the bridge's captures are rendered into that exact format. The
round-trip is the contract: anything this module emits must parse back into the
same messages, so the whole downstream pipeline (matching, AI passes, dedup,
CSV output) is reached without modification.

Canonical output line (parser pattern 1):

    [DD.MM.YY, HH:MM:SS] sender: content

Continuation lines of a multi-line message are emitted raw, exactly as WhatsApp
does for stock lists.
"""

from datetime import datetime, timedelta
from typing import Any, Iterable, List, Optional


def sanitize_sender(sender: str) -> str:
    """Make a sender label safe for the export header format.

    The header regex captures the sender as `[^:]+`, so a colon inside the
    sender would truncate it and swallow part of the message. Newlines and
    closing brackets would break the header just as badly.
    """
    cleaned = (sender or "").replace("\n", " ").replace("\r", " ")
    cleaned = cleaned.replace(":", " ").replace("]", " ")
    cleaned = " ".join(cleaned.split())
    return cleaned or "Unknown"


def _field(message: Any, name: str, default: Any = None) -> Any:
    """Read a field from either a Beanie document or a plain dict."""
    if isinstance(message, dict):
        return message.get(name, default)
    return getattr(message, name, default)


def render_export_line(
    timestamp: datetime,
    sender: str,
    content: str,
    tz_offset_minutes: int = 0,
) -> Optional[str]:
    """Render one captured message as export-format text.

    Returns None when there is nothing worth emitting (empty content), so
    callers can drop the message entirely rather than write a header with no
    body — a bare header would otherwise absorb the next message's lines as
    continuation text.
    """
    body = (content or "").strip()
    if not body:
        return None

    local_ts = timestamp + timedelta(minutes=tz_offset_minutes)
    stamp = local_ts.strftime("%d.%m.%y, %H:%M:%S")
    return f"[{stamp}] {sanitize_sender(sender)}: {body}"


def render_export_txt(
    messages: Iterable[Any],
    tz_offset_minutes: int = 0,
) -> str:
    """Render an iterable of captured messages into a WhatsApp export .txt.

    `tz_offset_minutes` shifts stored UTC timestamps into the operator's local
    time so bridge-generated files line up with manually exported ones (real
    exports are written in the phone's local time, with no timezone marker).
    """
    lines: List[str] = []
    for message in messages:
        line = render_export_line(
            timestamp=_field(message, "timestamp"),
            sender=_field(message, "sender", ""),
            content=_field(message, "content", ""),
            tz_offset_minutes=tz_offset_minutes,
        )
        if line:
            lines.append(line)

    if not lines:
        return ""
    return "\n".join(lines) + "\n"
