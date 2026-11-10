"""Undo journal for catalog imports and bulk actions (bulk/edit spec §8.1).

One ``ChangeBatch`` per operation (edit import, bulk import, bulk images, bulk action) plus one
``ChangeBatchEntry`` per touched watch. Entries live in their own collection so a batch that
deletes or rewrites thousands of watches never runs into Mongo's 16 MB document limit.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import Document
from pydantic import Field


class ChangeBatch(Document):
    # edit_import | bulk_import | bulk_images | bulk_action
    kind: str
    # Human-readable one-liner shown in "Recent changes", e.g. "Edit import · 312 watches".
    summary: str
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    updated_count: int = 0
    created_count: int = 0
    deleted_count: int = 0

    undone_at: Optional[datetime] = None
    undone_by: Optional[str] = None
    undo_result: Optional[Dict[str, Any]] = None

    class Settings:
        name = "change_batches"
        indexes = [[("created_at", -1)]]


class ChangeBatchEntry(Document):
    batch_id: str
    watch_id: str
    # update → ``before`` holds the previous value of every field the batch changed.
    # create → the watch did not exist before; undo deletes it.
    # delete → ``before`` holds the full document; undo re-inserts it with the same id.
    op: str
    before: Dict[str, Any] = Field(default_factory=dict)
    seq: int = 0

    class Settings:
        name = "change_batch_entries"
        indexes = ["batch_id", [("batch_id", 1), ("seq", 1)]]
