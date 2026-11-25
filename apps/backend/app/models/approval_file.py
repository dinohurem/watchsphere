"""Approval decisions from an uploaded file (admin): batches, planned rows, snapshots.

Same shape as the orders bulk fix: a file is previewed first (nothing changes), committed
once, and can be undone. Before a row is applied, every document it can change is copied
into ``approval_file_snapshots``; deleted documents are therefore archived, and undo puts
the copies back and removes what the commit created.
"""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field


class ApprovalFileBatch(Document):
    file_name: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "previewed"  # previewed | committing | committed | undoing | undone | expired
    summary: dict = Field(default_factory=dict)
    committed_at: Optional[datetime] = None
    undone_at: Optional[datetime] = None
    result: dict = Field(default_factory=dict)

    class Settings:
        name = "approval_file_batches"
        indexes = [[("created_at", -1)]]


class ApprovalFileItem(Document):
    batch_id: str
    line: int
    tab: str            # ai | unsure | aliases | new_watches | prices
    case_id: str
    decision: str
    new_value: str = ""
    version: str = ""   # fingerprint from the downloaded file
    # apply | already_decided | not_found | changed | invalid | duplicate   (preview)
    # done | failed                                                          (after commit)
    status: str
    detail: str = ""

    class Settings:
        name = "approval_file_items"
        indexes = ["batch_id", [("batch_id", 1), ("status", 1)]]


class ApprovalFileSnapshot(Document):
    """A document as it was before the commit touched it, plus how it looked right after."""
    batch_id: str
    line: int
    # pipeline_items | orders | alias_suggestions | watches   (before-state of a changed document)
    # created:pipeline_items | created:orders                  (made by the commit; undo removes them)
    coll: str
    doc_id: str
    doc: dict
    after: dict = Field(default_factory=dict)  # guard values for undo

    class Settings:
        name = "approval_file_snapshots"
        indexes = ["batch_id"]
