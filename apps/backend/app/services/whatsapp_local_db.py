"""Read captured messages straight out of the macOS WhatsApp database.

WhatsApp for Mac keeps its history in a plain, unencrypted SQLite file in a
group container that is readable without Full Disk Access. Reading it beats
pairing an unofficial protocol client: nothing contacts WhatsApp, so there is no
number to ban, the full history is already on disk rather than only what arrived
after connecting, and media is linked to its message by a real foreign key.

    ~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite

This module is deliberately pure: it snapshots, reads and maps. Delivery lives
in scripts/whatsapp_local_sync.py so this stays testable without a network.

Two traps this handles, both of which fail silently if you get them wrong:

* Opening the live file with ``immutable=1`` makes SQLite ignore the -wal, so
  the newest messages — exactly the ones an incremental sync is looking for —
  are invisible. The snapshot copies the -wal and -shm alongside the database.
* The schema is undocumented and moves with app releases. Every read is preceded
  by a check that raises rather than returning zero rows, because "no new
  messages" and "the schema changed underneath us" must not look identical.
"""

from __future__ import annotations

import shutil
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Optional

# Core Data stores timestamps as seconds since 2001-01-01, not the Unix epoch.
APPLE_EPOCH_OFFSET = 978_307_200

DEFAULT_DB_PATH = (
    Path.home()
    / "Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite"
)

# Columns this reader depends on. Checked before every read so an app update
# that renames one produces a loud error instead of an empty sync.
REQUIRED_SCHEMA: dict[str, set[str]] = {
    "ZWAMESSAGE": {
        "Z_PK",
        "ZSTANZAID",
        "ZTEXT",
        "ZMESSAGEDATE",
        "ZFROMJID",
        "ZTOJID",
        "ZISFROMME",
        "ZCHATSESSION",
        "ZMEDIAITEM",
        "ZPUSHNAME",
    },
    "ZWACHATSESSION": {"Z_PK", "ZCONTACTJID", "ZPARTNERNAME", "ZSESSIONTYPE"},
    "ZWAMEDIAITEM": {"Z_PK", "ZMESSAGE", "ZMEDIALOCALPATH"},
}

# ZWACHATSESSION.ZSESSIONTYPE. Anything else is a one-to-one conversation.
SESSION_TYPE_GROUP = 1


class SchemaChangedError(RuntimeError):
    """The database no longer looks the way this reader expects."""


@dataclass
class LocalMessage:
    """One row, shaped like the bridge's ingest payload."""

    message_id: str
    group_jid: str
    group_name: str
    sender: str
    sender_phone: Optional[str]
    push_name: Optional[str]
    content: str
    timestamp: datetime
    from_me: bool = False
    has_media: bool = False
    attachments: list[str] = field(default_factory=list)
    #: Row id, used as the incremental watermark. Not sent to the backend.
    row_id: int = 0

    def to_payload(self) -> dict:
        return {
            "message_id": self.message_id,
            "group_jid": self.group_jid,
            "group_name": self.group_name,
            "sender": self.sender,
            "sender_phone": self.sender_phone,
            "push_name": self.push_name,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "from_me": self.from_me,
            "has_media": self.has_media,
            "attachments": self.attachments,
        }


def snapshot_database(source: Path, destination_dir: Path) -> Path:
    """Copy the database and its sidecars so the live file is never touched.

    WhatsApp is running while this happens. Copying the -wal and -shm with the
    database keeps the snapshot consistent and, crucially, keeps the newest
    messages: they live in the -wal until it is checkpointed.
    """
    if not source.exists():
        raise FileNotFoundError(
            f"No WhatsApp database at {source}. Is WhatsApp for Mac installed and signed in?"
        )

    destination_dir.mkdir(parents=True, exist_ok=True)
    target = destination_dir / source.name
    shutil.copy2(source, target)
    for suffix in ("-wal", "-shm"):
        sidecar = source.with_name(source.name + suffix)
        if sidecar.exists():
            shutil.copy2(sidecar, target.with_name(target.name + suffix))
    return target


def verify_schema(connection: sqlite3.Connection) -> None:
    """Raise if a table or column this reader relies on has moved."""
    for table, columns in REQUIRED_SCHEMA.items():
        rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
        if not rows:
            raise SchemaChangedError(
                f"Table {table} is missing — the WhatsApp schema changed. "
                "This reader needs updating; refusing to sync rather than "
                "silently reporting no new messages."
            )
        present = {row[1] for row in rows}
        missing = columns - present
        if missing:
            raise SchemaChangedError(
                f"{table} is missing column(s) {sorted(missing)} — the WhatsApp "
                "schema changed. Refusing to sync rather than returning nothing."
            )


def _to_datetime(apple_seconds: Optional[float]) -> datetime:
    if not apple_seconds:
        return datetime.now(tz=timezone.utc).replace(tzinfo=None)
    return datetime(2001, 1, 1) + timedelta(seconds=float(apple_seconds))


def _phone_from_jid(jid: Optional[str]) -> Optional[str]:
    """+<digits> when the JID identifies a phone number, else None."""
    if not jid:
        return None
    user = jid.split("@")[0].split(":")[0].split(".")[0]
    if user.isdigit() and 7 <= len(user) <= 15:
        return f"+{user}"
    return None


def chat_is_allowed(allowlist: Iterable[str], jid: str, name: Optional[str]) -> bool:
    """Fail-closed allowlist, matching the bridge's semantics.

    An empty list captures nothing. Entries match a chat JID exactly, or the
    chat name case-insensitively as a substring — an operator knows a group by
    its name, not its numeric JID.
    """
    entries = [entry.strip().lower() for entry in allowlist if entry.strip()]
    if not entries:
        return False

    jid_lower = (jid or "").lower()
    name_lower = (name or "").lower()
    for entry in entries:
        if entry == jid_lower:
            return True
        if name_lower and entry in name_lower:
            return True
    return False


def read_messages(
    connection: sqlite3.Connection,
    *,
    allowlist: Iterable[str],
    since_row_id: int = 0,
    include_dms: bool = False,
    limit: int = 5000,
) -> list[LocalMessage]:
    """Rows added since the watermark, for chats that are in scope.

    Ordered and filtered by Z_PK rather than message date: history that syncs
    late is inserted with a fresh row id but an old timestamp, so a date
    watermark would step straight over it.
    """
    verify_schema(connection)

    rows = connection.execute(
        """
        SELECT m.Z_PK, m.ZSTANZAID, m.ZTEXT, m.ZMESSAGEDATE, m.ZFROMJID,
               m.ZTOJID, m.ZISFROMME, m.ZPUSHNAME,
               s.ZCONTACTJID, s.ZPARTNERNAME, s.ZSESSIONTYPE,
               media.ZMEDIALOCALPATH
        FROM ZWAMESSAGE m
        LEFT JOIN ZWACHATSESSION s ON s.Z_PK = m.ZCHATSESSION
        LEFT JOIN ZWAMEDIAITEM media ON media.Z_PK = m.ZMEDIAITEM
        WHERE m.Z_PK > ?
        ORDER BY m.Z_PK ASC
        LIMIT ?
        """,
        (since_row_id, limit),
    ).fetchall()

    messages: list[LocalMessage] = []
    for row in rows:
        (
            row_id, stanza_id, text, message_date, from_jid, to_jid,
            is_from_me, push_name, chat_jid, chat_name, session_type, media_path,
        ) = row

        if not stanza_id:
            continue

        chat_jid = chat_jid or to_jid or from_jid or ""
        is_group = session_type == SESSION_TYPE_GROUP
        if not is_group and not include_dms:
            continue

        display_name = chat_name or chat_jid
        if not chat_is_allowed(allowlist, chat_jid, display_name):
            continue

        # A bare photo carries no parseable listing; the caption is the content.
        content = (text or "").strip()
        if not content:
            continue

        author_jid = from_jid or (None if is_from_me else chat_jid)
        phone = _phone_from_jid(author_jid)

        messages.append(
            LocalMessage(
                message_id=stanza_id,
                group_jid=chat_jid,
                group_name=display_name,
                sender=phone or (push_name or "Unknown"),
                sender_phone=phone,
                push_name=push_name,
                content=content,
                timestamp=_to_datetime(message_date),
                from_me=bool(is_from_me),
                has_media=bool(media_path),
                attachments=[media_path] if media_path else [],
                row_id=row_id,
            )
        )

    return messages
