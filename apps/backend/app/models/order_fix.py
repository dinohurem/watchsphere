"""Bulk fix of orders from an uploaded file (admin): batches, planned rows, archive.

A batch is previewed first (nothing changes), then committed once, and can be
undone: every deleted order is copied completely into ``orders_archive`` before
it is removed, and every edited order keeps its previous fields on its item.
"""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field


class OrderFixBatch(Document):
    file_name: str
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "previewed"  # previewed | committing | committed | undoing | undone
    summary: dict = Field(default_factory=dict)
    committed_at: Optional[datetime] = None
    undone_at: Optional[datetime] = None
    result: dict = Field(default_factory=dict)

    class Settings:
        name = "order_fix_batches"
        indexes = [[("created_at", -1)]]


class OrderFixItem(Document):
    batch_id: str
    line: int
    order_id: str
    action: str
    new_value: str = ""
    reason: str = ""
    source_line: str = ""
    # apply | already_done | not_found | changed | invalid | duplicate  (preview)
    # done | failed                                                      (after commit)
    status: str
    detail: str = ""
    before: dict = Field(default_factory=dict)
    after: dict = Field(default_factory=dict)  # what the commit set (edits only)

    class Settings:
        name = "order_fix_items"
        indexes = ["batch_id", "order_id", [("batch_id", 1), ("status", 1)]]


class OrderArchive(Document):
    """A deleted order, complete, so undo can put it back with the same id."""
    batch_id: str
    order_id: str
    deleted_at: datetime = Field(default_factory=datetime.utcnow)
    doc: dict

    class Settings:
        name = "orders_archive"
        indexes = ["batch_id", "order_id"]
