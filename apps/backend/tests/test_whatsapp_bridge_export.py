"""Rendering captured messages back into WhatsApp export format.

The load-bearing property is the round-trip: whatever the bridge stores must
come back out of `parse_whatsapp_txt` unchanged, because that parser is the
front door to the entire WTS/WTB pipeline.
"""

from datetime import datetime

import pytest

from app.services.whatsapp_bridge_export import (
    render_export_line,
    render_export_txt,
    sanitize_sender,
)
from app.services.wtb_wts_service import parse_whatsapp_txt


def _message(content, sender="+852 6547 2648 WS", ts=datetime(2026, 3, 5, 16, 38, 28)):
    return {"timestamp": ts, "sender": sender, "content": content}


class TestSanitizeSender:
    def test_strips_colon_that_would_truncate_the_header(self):
        assert sanitize_sender("Dealer: HK") == "Dealer HK"

    def test_strips_newlines_and_closing_bracket(self):
        assert sanitize_sender("Dealer]\nHK") == "Dealer HK"

    def test_empty_sender_falls_back(self):
        assert sanitize_sender("") == "Unknown"
        assert sanitize_sender("   ") == "Unknown"

    def test_keeps_plain_phone_numbers_intact(self):
        assert sanitize_sender("+852 6547 2648 WS") == "+852 6547 2648 WS"


class TestRenderExportLine:
    def test_matches_the_canonical_export_format(self):
        line = render_export_line(
            datetime(2026, 3, 5, 16, 38, 28), "+852 6547 2648", "5968A N2 1.17m hkd"
        )
        assert line == "[05.03.26, 16:38:28] +852 6547 2648: 5968A N2 1.17m hkd"

    def test_empty_content_is_dropped(self):
        assert render_export_line(datetime(2026, 3, 5), "+852 1", "") is None
        assert render_export_line(datetime(2026, 3, 5), "+852 1", "   \n ") is None

    def test_tz_offset_shifts_the_stamp(self):
        line = render_export_line(
            datetime(2026, 3, 5, 16, 38, 28), "+852 1", "hi", tz_offset_minutes=480
        )
        assert line.startswith("[06.03.26, 00:38:28]")


class TestRoundTrip:
    """render → parse must be lossless."""

    def test_single_message(self):
        messages = [_message("WTS 126610LN 12,000 USD")]
        parsed = parse_whatsapp_txt(render_export_txt(messages))

        assert len(parsed) == 1
        assert parsed[0]["sender"] == "+852 6547 2648 WS"
        assert parsed[0]["content"] == "WTS 126610LN 12,000 USD"
        assert parsed[0]["timestamp"] == datetime(2026, 3, 5, 16, 38, 28)

    def test_multiline_stock_list_survives(self):
        stock_list = (
            "*5/3/2026 Stock List*\n"
            "Patek Used\n"
            "5968A N2 1.17m hkd\n"
            "5712/1A blue N1 1.52m hkd"
        )
        parsed = parse_whatsapp_txt(render_export_txt([_message(stock_list)]))

        assert len(parsed) == 1
        assert parsed[0]["content"] == stock_list

    def test_several_messages_keep_order_and_senders(self):
        messages = [
            _message("first", sender="+852 1111 1111", ts=datetime(2026, 3, 5, 10, 0, 0)),
            _message("second", sender="+49 170 2222222", ts=datetime(2026, 3, 5, 11, 30, 15)),
            _message("third", sender="~ Mei Li", ts=datetime(2026, 3, 6, 9, 5, 0)),
        ]
        parsed = parse_whatsapp_txt(render_export_txt(messages))

        assert [p["content"] for p in parsed] == ["first", "second", "third"]
        assert [p["sender"] for p in parsed] == ["+852 1111 1111", "+49 170 2222222", "~ Mei Li"]
        assert parsed[2]["timestamp"] == datetime(2026, 3, 6, 9, 5, 0)

    def test_sender_with_colon_does_not_swallow_content(self):
        """Without sanitising, `[^:]+` would cut the sender at the colon and
        push the rest of the name into the message body."""
        parsed = parse_whatsapp_txt(render_export_txt([_message("WTS 5711", sender="HK: Dealer")]))

        assert parsed[0]["sender"] == "HK Dealer"
        assert parsed[0]["content"] == "WTS 5711"

    def test_empty_input_renders_empty_string(self):
        assert render_export_txt([]) == ""
        assert parse_whatsapp_txt(render_export_txt([])) == []

    def test_blank_message_does_not_absorb_the_next_one(self):
        """A header with no body would turn the following message into
        continuation text, silently merging two dealers' posts."""
        messages = [
            _message("", ts=datetime(2026, 3, 5, 10, 0, 0)),
            _message("WTS 126610LN", ts=datetime(2026, 3, 5, 10, 1, 0)),
        ]
        parsed = parse_whatsapp_txt(render_export_txt(messages))

        assert len(parsed) == 1
        assert parsed[0]["content"] == "WTS 126610LN"

    @pytest.mark.parametrize(
        "content",
        [
            "RM07-01 Starry night 2/26\nHKD3.37m USDT 448k",
            "126334G Grey Jub N2 🏷️ 162,000",
            "WTB 5711/1A any year, worldwide",
            "5139G-010 2022 New 440,000hkd",
        ],
    )
    def test_real_world_shapes(self, content):
        parsed = parse_whatsapp_txt(render_export_txt([_message(content)]))
        assert parsed[0]["content"] == content
