"""Bridge ingest, status and export endpoints.

Includes the end-to-end path that justifies the whole component: messages
captured live from a group that cannot be exported, rendered back into export
format, and run through the unmodified WTS/WTB generator.
"""

import asyncio
from datetime import datetime, timedelta

import pytest

from app.api.v1.endpoints import whatsapp_bridge
from app.core.config import settings

GROUP_JID = "120363999@g.us"
GROUP_NAME = "HK Dealers"
TOKEN = "test-bridge-token"


@pytest.fixture(autouse=True)
def bridge_token(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_BRIDGE_TOKEN", TOKEN)
    return TOKEN


def _msg(message_id, content, sender="+852 6547 2648", ts=None, **overrides):
    payload = {
        "message_id": message_id,
        "group_jid": GROUP_JID,
        "group_name": GROUP_NAME,
        "sender": sender,
        "sender_phone": sender if sender.startswith("+") else None,
        "content": content,
        "timestamp": (ts or datetime(2026, 3, 5, 16, 38, 28)).isoformat(),
    }
    payload.update(overrides)
    return payload


def _ingest(api, messages, bridge_id="bridge-1", token=TOKEN):
    headers = {"X-Bridge-Token": token} if token else {}
    return api.post(
        "/whatsapp-bridge/messages",
        json={"bridge_id": bridge_id, "messages": messages},
        headers=headers,
    )


class TestIngestAuth:
    def test_rejects_missing_token(self, api):
        assert _ingest(api, [_msg("a", "hi")], token=None).status_code == 401

    def test_rejects_wrong_token(self, api):
        assert _ingest(api, [_msg("a", "hi")], token="nope").status_code == 401

    def test_unset_secret_closes_the_endpoint_rather_than_opening_it(self, api, monkeypatch):
        monkeypatch.setattr(settings, "WHATSAPP_BRIDGE_TOKEN", "")

        assert _ingest(api, [_msg("a", "hi")], token=None).status_code == 503
        assert _ingest(api, [_msg("a", "hi")], token="anything").status_code == 503

    def test_admin_endpoints_do_not_accept_the_bridge_token(self, api, monkeypatch):
        """The service secret must not be a back door into admin data."""
        from app.core.deps import get_current_admin_user

        api.app.dependency_overrides.pop(get_current_admin_user)
        response = api.get("/whatsapp-bridge/groups", headers={"X-Bridge-Token": TOKEN})

        assert response.status_code in (401, 403)


class TestIngest:
    def test_stores_messages(self, api):
        response = _ingest(api, [_msg("m1", "WTS 126610LN"), _msg("m2", "WTB 5711")])

        assert response.status_code == 200
        assert response.json() == {"received": 2, "inserted": 2, "duplicates": 0}

    def test_resend_is_idempotent(self, api):
        """The outbox replays after restarts, so duplicates are routine."""
        batch = [_msg("m1", "WTS 126610LN"), _msg("m2", "WTB 5711")]
        _ingest(api, batch)

        second = _ingest(api, batch)

        assert second.json() == {"received": 2, "inserted": 0, "duplicates": 2}
        groups = api.get("/whatsapp-bridge/groups").json()
        assert groups[0]["message_count"] == 2

    def test_resend_does_not_overwrite_stored_content(self, api):
        _ingest(api, [_msg("m1", "original text")])
        _ingest(api, [_msg("m1", "tampered text")])

        exported = api.get("/whatsapp-bridge/export", params={"group_jid": GROUP_JID}).text
        assert "original text" in exported
        assert "tampered" not in exported

    def test_partial_overlap_inserts_only_the_new_ones(self, api):
        _ingest(api, [_msg("m1", "one")])

        response = _ingest(api, [_msg("m1", "one"), _msg("m2", "two"), _msg("m3", "three")])

        assert response.json() == {"received": 3, "inserted": 2, "duplicates": 1}

    def test_empty_batch_is_accepted(self, api):
        assert _ingest(api, []).json() == {"received": 0, "inserted": 0, "duplicates": 0}

    def test_oversized_batch_is_rejected(self, api):
        batch = [_msg(f"m{i}", "x") for i in range(whatsapp_bridge.MAX_BATCH_SIZE + 1)]

        assert _ingest(api, batch).status_code == 413

    def test_ingest_updates_bridge_status(self, api):
        _ingest(api, [_msg("m1", "hi", ts=datetime(2026, 3, 5, 12, 0, 0))])

        status_rows = api.get("/whatsapp-bridge/status").json()
        assert len(status_rows) == 1
        assert status_rows[0]["bridge_id"] == "bridge-1"
        assert status_rows[0]["messages_ingested"] == 1
        assert status_rows[0]["last_message_at"].startswith("2026-03-05T12:00:00")


class TestHeartbeat:
    def test_records_state_and_groups(self, api):
        response = api.post(
            "/whatsapp-bridge/heartbeat",
            json={
                "bridge_id": "bridge-1",
                "state": "connected",
                "phone_number": "+38761111111",
                "groups": [GROUP_NAME],
            },
            headers={"X-Bridge-Token": TOKEN},
        )

        assert response.status_code == 200
        row = api.get("/whatsapp-bridge/status").json()[0]
        assert row["state"] == "connected"
        assert row["phone_number"] == "+38761111111"
        assert row["groups"] == [GROUP_NAME]
        assert row["is_stale"] is False

    def test_qr_required_surfaces_to_admins(self, api):
        """The signal that the number was logged out and needs re-pairing."""
        api.post(
            "/whatsapp-bridge/heartbeat",
            json={"bridge_id": "bridge-1", "state": "qr_required", "error": "logged out"},
            headers={"X-Bridge-Token": TOKEN},
        )

        row = api.get("/whatsapp-bridge/status").json()[0]
        assert row["state"] == "qr_required"
        assert row["error"] == "logged out"

    def test_heartbeat_requires_the_token(self, api):
        response = api.post(
            "/whatsapp-bridge/heartbeat",
            json={"bridge_id": "bridge-1", "state": "connected"},
        )
        assert response.status_code == 401

    def test_stale_bridge_is_flagged(self, api, db):
        """A bridge that stopped reporting is worse than one reporting failure —
        it looks healthy while capturing nothing."""
        api.post(
            "/whatsapp-bridge/heartbeat",
            json={"bridge_id": "bridge-1", "state": "connected"},
            headers={"X-Bridge-Token": TOKEN},
        )
        asyncio.run(
            db["watchsphere_test"]["whatsapp_bridge_status"].update_one(
                {"bridge_id": "bridge-1"},
                {"$set": {"last_heartbeat_at": datetime.utcnow() - timedelta(hours=2)}},
            )
        )

        row = api.get("/whatsapp-bridge/status").json()[0]
        assert row["is_stale"] is True


class TestGroups:
    def test_reports_coverage_window(self, api):
        _ingest(
            api,
            [
                _msg("m1", "first", ts=datetime(2026, 3, 1, 9, 0, 0)),
                _msg("m2", "second", ts=datetime(2026, 3, 5, 18, 30, 0)),
            ],
        )

        groups = api.get("/whatsapp-bridge/groups").json()

        assert len(groups) == 1
        assert groups[0]["group_jid"] == GROUP_JID
        assert groups[0]["group_name"] == GROUP_NAME
        assert groups[0]["message_count"] == 2
        assert groups[0]["first_message_at"].startswith("2026-03-01T09:00:00")
        assert groups[0]["last_message_at"].startswith("2026-03-05T18:30:00")

    def test_separates_multiple_groups(self, api):
        _ingest(api, [_msg("m1", "a"), _msg("m2", "b", group_jid="other@g.us", group_name="EU")])

        groups = {g["group_jid"]: g for g in api.get("/whatsapp-bridge/groups").json()}

        assert groups[GROUP_JID]["message_count"] == 1
        assert groups["other@g.us"]["message_count"] == 1
        assert groups["other@g.us"]["group_name"] == "EU"


class TestExport:
    def test_renders_export_format(self, api):
        _ingest(api, [_msg("m1", "5968A N2 1.17m hkd")])

        response = api.get("/whatsapp-bridge/export", params={"group_jid": GROUP_JID})

        assert response.status_code == 200
        assert response.text.strip() == "[05.03.26, 16:38:28] +852 6547 2648: 5968A N2 1.17m hkd"
        assert "attachment" in response.headers["content-disposition"]

    def test_orders_by_timestamp_not_insertion(self, api):
        _ingest(
            api,
            [
                _msg("m2", "later", ts=datetime(2026, 3, 5, 18, 0, 0)),
                _msg("m1", "earlier", ts=datetime(2026, 3, 5, 9, 0, 0)),
            ],
        )

        body = api.get("/whatsapp-bridge/export", params={"group_jid": GROUP_JID}).text

        assert body.index("earlier") < body.index("later")

    def test_time_range_filter(self, api):
        _ingest(
            api,
            [
                _msg("m1", "old one", ts=datetime(2026, 3, 1, 9, 0, 0)),
                _msg("m2", "new one", ts=datetime(2026, 3, 10, 9, 0, 0)),
            ],
        )

        body = api.get(
            "/whatsapp-bridge/export",
            params={"group_jid": GROUP_JID, "start": "2026-03-05T00:00:00"},
        ).text

        assert "new one" in body
        assert "old one" not in body

    def test_unknown_group_is_404(self, api):
        assert api.get(
            "/whatsapp-bridge/export", params={"group_jid": "nope@g.us"}
        ).status_code == 404


class TestPurge:
    def test_requires_a_filter(self, api):
        assert api.delete("/whatsapp-bridge/messages").status_code == 400

    def test_deletes_by_group(self, api):
        _ingest(api, [_msg("m1", "a"), _msg("m2", "b", group_jid="other@g.us", group_name="EU")])

        response = api.delete("/whatsapp-bridge/messages", params={"group_jid": GROUP_JID})

        assert response.json() == {"deleted": 1}
        remaining = api.get("/whatsapp-bridge/groups").json()
        assert [g["group_jid"] for g in remaining] == ["other@g.us"]

    def test_deletes_by_age(self, api):
        now = datetime.utcnow()
        _ingest(
            api,
            [
                _msg("old", "a", ts=now - timedelta(days=90)),
                _msg("recent", "b", ts=now - timedelta(days=1)),
            ],
        )

        response = api.delete("/whatsapp-bridge/messages", params={"older_than_days": 30})

        assert response.json() == {"deleted": 1}


class TestEndToEnd:
    """Captured messages → export text → the real generator."""

    CATALOG = "\n".join(
        [
            '{"ws_code": "126610LN", "brand": "Rolex", "model": "Submariner Date", '
            '"reference": "126610LN", "aliases": ["submariner"]}',
            '{"ws_code": "5968A", "brand": "Patek Philippe", "model": "Aquanaut Chronograph", '
            '"reference": "5968A", "aliases": []}',
        ]
    )

    @pytest.mark.asyncio
    async def test_bridge_capture_produces_matched_rows(self, api):
        from app.services.wtb_wts_service import process_generation

        _ingest(
            api,
            [
                _msg("m1", "WTS 126610LN unworn N2/26 12,000 USD", ts=datetime(2026, 3, 5, 10, 0, 0)),
                _msg(
                    "m2",
                    "*Stock List*\nPatek Used\n5968A N2 1.17m hkd",
                    sender="+852 5203 4944",
                    ts=datetime(2026, 3, 5, 11, 0, 0),
                ),
            ],
        )

        export_txt = api.get("/whatsapp-bridge/export", params={"group_jid": GROUP_JID}).text

        result = await process_generation(
            txt_content=export_txt,
            mode="WTS",
            ref_month=3,
            ref_year=2026,
            group_name=GROUP_NAME,
            jsonl_content=self.CATALOG,
        )

        assert result["total_messages"] == 2
        assert result["matched_count"] >= 2

        matched_csv = result["matched_csv"]
        assert "126610LN" in matched_csv
        assert "5968A" in matched_csv
        # Sender phone survives the round-trip, which is what drives country
        # detection and the dedup key.
        assert "+85265472648" in matched_csv.replace(" ", "")
        assert GROUP_NAME in matched_csv
