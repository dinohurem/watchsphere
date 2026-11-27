from datetime import datetime
from typing import Any, Dict, List

from beanie import Document
from pydantic import Field


class ParserAuditReport(Document):
    """One run of the daily parser audit (app/services/parser_audit.py)."""
    run_at: datetime = Field(default_factory=datetime.utcnow)
    since: datetime
    hours: float = 24
    checked: int = 0
    total_findings: int = 0
    counts: Dict[str, int] = Field(default_factory=dict)
    examples: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    trigger: str = "scheduled"  # scheduled | manual
    emailed_to: int = 0

    class Settings:
        name = "parser_audit_reports"
