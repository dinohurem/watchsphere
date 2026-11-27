"""Remembers when an AI provider refused a call because the account is out of credit.

Without credit every generator row lands in review ("AI review unavailable",
"not in database") and the group's watermark still moves, so those messages are
never matched properly later. The pipeline checks ``is_exhausted()`` and waits
instead; the newest export of a group still holds every message.
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

# How long to wait before trying the providers again after a credit error.
PAUSE_SECONDS = 30 * 60

_CREDIT_MARKERS = (
    "insufficient_quota",
    "credit_balance_exhausted",
    "credit balance is too low",
    "you have no credits remaining",
)

# Exhaustion is tracked per provider: one provider being out of credit must not pause
# the pipeline while another one can still do the work (the AI review falls back).
_exhausted_until: dict[str, float] = {}


def is_credit_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _CREDIT_MARKERS)


def mark_exhausted(provider: str, exc: BaseException | None = None) -> None:
    if not is_exhausted(provider):
        logger.error("AI provider %s is out of credit; it is skipped for %d min: %s",
                     provider, PAUSE_SECONDS // 60, str(exc or "")[:200])
    _exhausted_until[provider] = time.monotonic() + PAUSE_SECONDS


def check(provider: str, exc: BaseException) -> bool:
    """Mark the provider exhausted when ``exc`` is a credit error. Returns whether it was."""
    if is_credit_error(exc):
        mark_exhausted(provider, exc)
        return True
    return False


def is_exhausted(provider: str | None = None) -> bool:
    """One provider, or (no argument) whether any provider is out of credit."""
    now = time.monotonic()
    if provider is not None:
        return now < _exhausted_until.get(provider, 0.0)
    return any(now < until for until in _exhausted_until.values())


def provider() -> str | None:
    """The provider that is out of credit (the one whose pause ends last), or None."""
    now = time.monotonic()
    live = {p: u for p, u in _exhausted_until.items() if now < u}
    return max(live, key=live.get) if live else None


def reset() -> None:
    _exhausted_until.clear()
