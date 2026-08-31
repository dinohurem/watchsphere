"""Reading the local macOS WhatsApp database.

Built against a synthetic database shaped like the real one, so the suite runs
anywhere. The shape itself was verified against a live ChatStorage.sqlite —
verify_schema passes on it, which is what these column names are asserting.
"""

import sqlite3
from datetime import datetime
from pathlib import Path

import pytest

from app.services.whatsapp_local_db import (
    SchemaChangedError,
    chat_is_allowed,
    read_messages,
    snapshot_database,
    verify_schema,
)

# Seconds since 2001-01-01 for 2026-08-30 12:00:00.
APPLE_TS = (datetime(2026, 8, 30, 12) - datetime(2001, 1, 1)).total_seconds()


def _build_db(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE ZWACHATSESSION (
            Z_PK INTEGER PRIMARY KEY, ZCONTACTJID TEXT,
            ZPARTNERNAME TEXT, ZSESSIONTYPE INTEGER
        );
        CREATE TABLE ZWAMEDIAITEM (
            Z_PK INTEGER PRIMARY KEY, ZMESSAGE INTEGER, ZMEDIALOCALPATH TEXT
        );
        CREATE TABLE ZWAMESSAGE (
            Z_PK INTEGER PRIMARY KEY, ZSTANZAID TEXT, ZTEXT TEXT,
            ZMESSAGEDATE REAL, ZFROMJID TEXT, ZTOJID TEXT, ZISFROMME INTEGER,
            ZCHATSESSION INTEGER, ZMEDIAITEM INTEGER, ZPUSHNAME TEXT
        );
        INSERT INTO ZWACHATSESSION VALUES (1, '12345-67@g.us', 'HK Dealers', 1);
        INSERT INTO ZWACHATSESSION VALUES (2, '99999-88@g.us', 'Family', 1);
        INSERT INTO ZWACHATSESSION VALUES (3, '85265472648@s.whatsapp.net', 'A Dealer', 0);
        INSERT INTO ZWAMEDIAITEM VALUES (10, 2, '/Media/photo.jpg');
        """
    )
    rows = [
        # in-scope group message from a phone JID
        (1, "STANZA1", "WTS 126610LN HKD 942k", APPLE_TS,
         "85265472648@s.whatsapp.net", "12345-67@g.us", 0, 1, None, "HK Dealer"),
        # in-scope, with media attached
        (2, "STANZA2", "Photo caption 5711", APPLE_TS,
         "85265472648@s.whatsapp.net", "12345-67@g.us", 0, 1, 10, "HK Dealer"),
        # a chat that is not allow-listed
        (3, "STANZA3", "family chatter", APPLE_TS,
         "44777@s.whatsapp.net", "99999-88@g.us", 0, 2, None, "Mum"),
        # empty body — no parseable listing
        (4, "STANZA4", "   ", APPLE_TS,
         "85265472648@s.whatsapp.net", "12345-67@g.us", 0, 1, None, "HK Dealer"),
        # a one-to-one chat
        (5, "STANZA5", "WTS private offer", APPLE_TS,
         "85265472648@s.whatsapp.net", None, 0, 3, None, "A Dealer"),
    ]
    connection.executemany(
        "INSERT INTO ZWAMESSAGE VALUES (?,?,?,?,?,?,?,?,?,?)", rows
    )
    connection.commit()
    return connection


@pytest.fixture
def db(tmp_path):
    connection = _build_db(tmp_path / "ChatStorage.sqlite")
    yield connection
    connection.close()


class TestAllowlist:
    def test_empty_allowlist_captures_nothing(self):
        """Fail-closed: an unset allowlist must not mean 'read everything'."""
        assert chat_is_allowed([], "12345-67@g.us", "HK Dealers") is False

    def test_matches_name_case_insensitively(self):
        assert chat_is_allowed(["hk dealers"], "12345-67@g.us", "HK Dealers")

    def test_matches_jid_exactly(self):
        assert chat_is_allowed(["12345-67@g.us"], "12345-67@g.us", None)

    def test_rejects_an_unlisted_chat(self):
        assert chat_is_allowed(["HK Dealers"], "99999-88@g.us", "Family") is False


class TestReadMessages:
    def test_reads_only_allow_listed_chats(self, db):
        messages = read_messages(db, allowlist=["HK Dealers"])
        assert [m.message_id for m in messages] == ["STANZA1", "STANZA2"]

    def test_maps_a_row_onto_the_ingest_payload(self, db):
        message = read_messages(db, allowlist=["HK Dealers"])[0]

        assert message.group_jid == "12345-67@g.us"
        assert message.group_name == "HK Dealers"
        assert message.content == "WTS 126610LN HKD 942k"
        # The phone is what the parser derives country and currency from.
        assert message.sender_phone == "+85265472648"
        assert message.timestamp == datetime(2026, 8, 30, 12)
        assert message.from_me is False

    def test_links_media_to_its_message(self, db):
        """The explicit FK is why this beats an export's <Attachment:> markers."""
        with_media = read_messages(db, allowlist=["HK Dealers"])[1]

        assert with_media.has_media is True
        assert with_media.attachments == ["/Media/photo.jpg"]

    def test_skips_messages_with_no_text(self, db):
        ids = [m.message_id for m in read_messages(db, allowlist=["HK Dealers"])]
        assert "STANZA4" not in ids

    def test_one_to_one_chats_need_opting_in(self, db):
        without = read_messages(db, allowlist=["A Dealer"])
        assert without == []

        with_dms = read_messages(db, allowlist=["A Dealer"], include_dms=True)
        assert [m.message_id for m in with_dms] == ["STANZA5"]

    def test_watermark_only_returns_newer_rows(self, db):
        assert [m.message_id for m in read_messages(db, allowlist=["HK Dealers"], since_row_id=1)] == [
            "STANZA2"
        ]
        assert read_messages(db, allowlist=["HK Dealers"], since_row_id=99) == []

    def test_watermark_is_the_row_id_not_the_date(self, db):
        """Late-synced history has an old timestamp but a fresh row id.

        A date watermark would step straight over it.
        """
        db.execute(
            "INSERT INTO ZWAMESSAGE VALUES (?,?,?,?,?,?,?,?,?,?)",
            (6, "OLD-BACKFILL", "WTS old listing", APPLE_TS - 86_400 * 365,
             "85265472648@s.whatsapp.net", "12345-67@g.us", 0, 1, None, "HK Dealer"),
        )
        db.commit()

        recovered = read_messages(db, allowlist=["HK Dealers"], since_row_id=5)
        assert [m.message_id for m in recovered] == ["OLD-BACKFILL"]


class TestSchemaDrift:
    def test_a_renamed_column_raises_rather_than_returning_nothing(self, db):
        """An app update must not look like a quiet day in the group."""
        db.execute("ALTER TABLE ZWAMESSAGE RENAME COLUMN ZSTANZAID TO ZSTANZAID_V2")
        db.commit()

        with pytest.raises(SchemaChangedError, match="ZSTANZAID"):
            read_messages(db, allowlist=["HK Dealers"])

    def test_a_missing_table_raises(self, db):
        db.execute("DROP TABLE ZWAMEDIAITEM")
        db.commit()

        with pytest.raises(SchemaChangedError, match="ZWAMEDIAITEM"):
            verify_schema(db)


class TestSnapshot:
    def test_copies_the_wal_and_shm_alongside(self, tmp_path):
        """Without the -wal the newest messages are invisible."""
        source = tmp_path / "src" / "ChatStorage.sqlite"
        source.parent.mkdir()
        _build_db(source).close()
        source.with_name("ChatStorage.sqlite-wal").write_bytes(b"wal")
        source.with_name("ChatStorage.sqlite-shm").write_bytes(b"shm")

        copied = snapshot_database(source, tmp_path / "snap")

        assert copied.exists()
        assert copied.with_name("ChatStorage.sqlite-wal").read_bytes() == b"wal"
        assert copied.with_name("ChatStorage.sqlite-shm").read_bytes() == b"shm"
        # The original must be left exactly as found — WhatsApp is running.
        assert source.exists()

    def test_a_missing_database_says_so_clearly(self, tmp_path):
        with pytest.raises(FileNotFoundError, match="WhatsApp"):
            snapshot_database(tmp_path / "nope.sqlite", tmp_path / "snap")
