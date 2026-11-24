"""Alert the admins when exports keep arriving but no order is created.

23/24 Nov 2026: the OpenAI account ran out of credit, the worker paused (as it
should) and every upload waited in the queue. The Mac mini kept getting
``stored: true`` back, so nobody noticed for a day and a half. This check runs
every 15 minutes and emails the admins once the pipeline has been stuck for
``PIPELINE_STALL_ALERT_HOURS``, with the reason, and again every
``PIPELINE_STALL_ALERT_REPEAT_HOURS`` while it stays stuck.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 15 * 60
STATE_KEY = "stall_alert"


async def pipeline_status(now: Optional[datetime] = None, hours: Optional[float] = None) -> dict[str, Any]:
    """What the pipeline is doing right now. Read-only."""
    from app.core.config import settings
    from app.models.order import Order
    from app.models.pipeline import PipelineUpload, UploadStatus
    from app.services import pipeline

    now = now or datetime.utcnow()
    hours = settings.PIPELINE_STALL_ALERT_HOURS if hours is None else hours
    window_start = now - timedelta(hours=hours or 2)

    uploads = PipelineUpload.get_motor_collection()
    waiting = {"status": UploadStatus.RECEIVED.value, "attempts": {"$lt": pipeline.MAX_ATTEMPTS}}
    oldest = await uploads.find_one(waiting, {"received_at": 1, "error": 1}, sort=[("received_at", 1)])
    newest_order = await Order.get_motor_collection().find_one(
        {"first_seen_at": {"$ne": None}, "whatsapp_phone": {"$nin": [None, ""]}},
        {"first_seen_at": 1}, sort=[("first_seen_at", -1)],
    )
    last_order_at = newest_order.get("first_seen_at") if newest_order else None
    try:
        pause = await pipeline.pause_reason()
    except Exception as exc:  # status must answer even when the DB stats call fails
        pause = None
        logger.warning("pipeline status: pause check failed: %s", exc)

    return {
        "now": now,
        "paused": pause,
        "uploads_in_window": await uploads.count_documents({"received_at": {"$gte": window_start}}),
        "waiting_uploads": await uploads.count_documents(waiting),
        "oldest_waiting_since": oldest.get("received_at") if oldest else None,
        "oldest_waiting_note": (oldest or {}).get("error"),
        "failed_uploads_in_window": await uploads.count_documents(
            {"status": UploadStatus.FAILED.value, "received_at": {"$gte": window_start}}),
        "last_order_at": last_order_at,
        "window_hours": hours,
    }


def is_stalled(status: dict[str, Any]) -> bool:
    """Exports arrived in the window, but the newest imported order is older than the window."""
    hours = status["window_hours"]
    if not hours or status["uploads_in_window"] == 0:
        return False
    cutoff = status["now"] - timedelta(hours=hours)
    last = status["last_order_at"]
    return last is None or last < cutoff


def alert_lines(status: dict[str, Any]) -> list[str]:
    def ts(value):
        return value.strftime("%d %b %Y, %H:%M UTC") if value else "never"

    lines = [
        f"Exports received in the last {status['window_hours']:g} h: {status['uploads_in_window']}",
        f"Newest order created: {ts(status['last_order_at'])}",
        f"Uploads waiting to be processed: {status['waiting_uploads']}"
        + (f" (oldest since {ts(status['oldest_waiting_since'])})" if status["oldest_waiting_since"] else ""),
    ]
    if status["paused"]:
        lines.insert(0, f"Processing is paused: {status['paused']}")
    elif status["oldest_waiting_note"]:
        lines.insert(0, f"Oldest waiting upload: {status['oldest_waiting_note']}")
    if status["failed_uploads_in_window"]:
        lines.append(f"Failed uploads in the window: {status['failed_uploads_in_window']}")
    lines.append("The stored uploads are processed automatically once the cause is fixed.")
    return lines


async def _send(lines: list[str]) -> int:
    from app.core.config import settings
    from app.models.user import User, UserRole
    from app.services.email import email_service
    from app.services.pipeline import report_recipients

    link = f"{settings.WEB_APP_URL.rstrip('/')}/admin/approval"
    text = "WatchSphere: no new orders although exports keep arriving\n\n" + "\n".join(lines) + f"\n\n{link}\n"
    html = email_service._get_email_template(
        "<h2 style=\"margin:0 0 16px\">No new orders although exports keep arriving</h2><ul>"
        + "".join(f"<li>{line}</li>" for line in lines)
        + "</ul>"
    )
    admins = await User.find({"role": UserRole.ADMIN.value}).to_list()
    sent = 0
    for email in report_recipients([a.email for a in admins], settings.PIPELINE_REPORT_EXTRA_RECIPIENTS):
        if await email_service._send_email(email, "WatchSphere – pipeline stalled", html, text):
            sent += 1
    return sent


async def check_and_alert(now: Optional[datetime] = None) -> dict[str, Any]:
    """Run one check. Sends at most one email per repeat interval while stalled;
    a recovery clears the state so the next stall alerts right away."""
    from app.core.config import settings
    from app.models.pipeline import PipelineReportState

    status = await pipeline_status(now)
    state = await PipelineReportState.find_one({"key": STATE_KEY})
    if not is_stalled(status):
        if state and state.last_sent_at:
            logger.info("pipeline: orders are being created again; stall alert cleared")
            state.last_sent_at = None
            await state.save()
        return {"stalled": False, "sent_to": 0}

    lines = alert_lines(status)
    logger.error("pipeline: stalled. %s", " | ".join(lines))
    repeat = timedelta(hours=settings.PIPELINE_STALL_ALERT_REPEAT_HOURS)
    if state and state.last_sent_at and status["now"] - state.last_sent_at < repeat:
        return {"stalled": True, "sent_to": 0}
    sent = await _send(lines)
    if state is None:
        state = PipelineReportState(key=STATE_KEY)
    state.last_sent_at = status["now"]
    await state.save()
    return {"stalled": True, "sent_to": sent}


async def stall_alert_loop() -> None:
    from app.core.config import settings

    if not settings.PIPELINE_STALL_ALERT_HOURS:
        logger.info("pipeline: stall alert disabled (PIPELINE_STALL_ALERT_HOURS=0)")
        return
    await asyncio.sleep(60)
    while True:
        try:
            await check_and_alert()
        except Exception as exc:
            logger.warning("pipeline: stall check failed: %s", str(exc)[:200])
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
