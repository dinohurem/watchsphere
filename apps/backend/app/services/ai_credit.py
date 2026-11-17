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

_exhausted_until: float = 0.0
_provider: str | None = None


def is_credit_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _CREDIT_MARKERS)


def mark_exhausted(provider: str, exc: BaseException | None = None) -> None:
    global _exhausted_until, _provider
    if not is_exhausted():
        logger.error("AI provider %s is out of credit; pipeline processing pauses: %s",
                     provider, str(exc or "")[:200])
    _exhausted_until = time.monotonic() + PAUSE_SECONDS
    _provider = provider


def check(provider: str, exc: BaseException) -> bool:
    """Mark the provider exhausted when ``exc`` is a credit error. Returns whether it was."""
    if is_credit_error(exc):
        mark_exhausted(provider, exc)
        return True
    return False


def is_exhausted() -> bool:
    return time.monotonic() < _exhausted_until


def provider() -> str | None:
    return _provider if is_exhausted() else None


def reset() -> None:
    global _exhausted_until, _provider
    _exhausted_until = 0.0
    _provider = None
