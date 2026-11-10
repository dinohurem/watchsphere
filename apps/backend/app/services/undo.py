"""Undo for catalog imports and bulk actions (bulk/edit spec §8.1).

Every write path records what it is about to change in a ``ChangeBatchRecorder`` before
writing, then saves the batch. ``undo_batch`` walks the entries newest-first and puts every
watch back:

* ``update`` entries restore the previous value of each changed field (incl. image URLs —
  replaced images are never deleted from storage, so the old URLs keep working);
* ``create`` entries delete the watch the batch created;
* ``delete`` entries re-insert the full document with its original id.
"""
from __future__ import annotations

import copy
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from beanie import PydanticObjectId

from app.models.change_batch import ChangeBatch, ChangeBatchEntry
from app.models.watch import Watch
from app.services.catalog_admin import plain


def snapshot_fields(current: Dict[str, Any], fields: Iterable[str]) -> Dict[str, Any]:
    """Previous values of ``fields`` (deep-copied, enums as plain values)."""
    return {f: copy.deepcopy(plain(current.get(f))) for f in fields}


def watch_document_snapshot(watch: Watch) -> Dict[str, Any]:
    """Full storable copy of a watch for delete-undo (id kept separately on the entry)."""
    return plain(watch.model_dump(exclude={"id", "revision_id"}))


def plan_undo(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Order undo operations: newest entry first, so a watch touched twice ends at its oldest state."""
    return sorted(entries, key=lambda e: e.get("seq", 0), reverse=True)


class ChangeBatchRecorder:
    """Collects undo entries for one operation; ``save`` persists them (no-op when empty)."""

    def __init__(self, kind: str, summary: str = "", user: Any = None, batch: Optional[ChangeBatch] = None):
        self.kind = kind
        self.summary = summary
        self.user = user
        self.batch = batch
        self.entries: List[Dict[str, Any]] = []
        self._seq = 0

    def _add(self, watch_id: str, op: str, before: Dict[str, Any]) -> None:
        self._seq += 1
        self.entries.append({"watch_id": str(watch_id), "op": op, "before": before, "seq": self._seq})

    def record_update(self, watch_id: str, current: Dict[str, Any], fields: Iterable[str]) -> None:
        self._add(watch_id, "update", snapshot_fields(current, fields))

    def record_create(self, watch_id: str) -> None:
        self._add(watch_id, "create", {})

    def record_delete(self, watch: Watch) -> None:
        self._add(str(watch.id), "delete", watch_document_snapshot(watch))

    @property
    def counts(self) -> Dict[str, int]:
        out = {"update": 0, "create": 0, "delete": 0}
        for e in self.entries:
            out[e["op"]] += 1
        return out

    async def save(self) -> Optional[str]:
        if not self.entries and self.batch is None:
            return None
        counts = self.counts
        if self.batch is None:
            self.batch = ChangeBatch(
                kind=self.kind,
                summary=self.summary,
                created_by=str(self.user.id) if self.user is not None and getattr(self.user, "id", None) else None,
                created_by_name=getattr(self.user, "name", None) if self.user is not None else None,
                updated_count=counts["update"],
                created_count=counts["create"],
                deleted_count=counts["delete"],
            )
            await self.batch.insert()
            offset = 0
        else:
            # Appending to an existing batch (bulk images uploaded in several requests).
            offset = await ChangeBatchEntry.find(ChangeBatchEntry.batch_id == str(self.batch.id)).count()
            self.batch.updated_count += counts["update"]
            self.batch.created_count += counts["create"]
            self.batch.deleted_count += counts["delete"]
            if self.summary:
                self.batch.summary = self.summary
            await self.batch.save()

        batch_id = str(self.batch.id)
        docs = [
            ChangeBatchEntry(batch_id=batch_id, watch_id=e["watch_id"], op=e["op"],
                             before=e["before"], seq=offset + e["seq"])
            for e in self.entries
        ]
        for i in range(0, len(docs), 500):
            await ChangeBatchEntry.insert_many(docs[i:i + 500])
        self.entries = []
        return batch_id


async def undo_batch(batch_id: str, user: Any = None) -> Dict[str, Any]:
    batch = await ChangeBatch.get(PydanticObjectId(batch_id))
    if batch is None:
        raise LookupError("batch not found")
    if batch.undone_at is not None:
        raise ValueError("this change was already undone")

    entries = await ChangeBatchEntry.find(ChangeBatchEntry.batch_id == batch_id).to_list()
    ops = plan_undo([e.model_dump() for e in entries])

    result = {"restored": 0, "deleted": 0, "recreated": 0, "skipped": 0}
    for op in ops:
        oid = PydanticObjectId(op["watch_id"])
        if op["op"] == "update":
            watch = await Watch.get(oid)
            if watch is None:
                result["skipped"] += 1
                continue
            if op["before"]:
                await Watch.find_one(Watch.id == oid).update({"$set": op["before"]})
            result["restored"] += 1
        elif op["op"] == "create":
            watch = await Watch.get(oid)
            if watch is None:
                result["skipped"] += 1
                continue
            await watch.delete()
            result["deleted"] += 1
        elif op["op"] == "delete":
            if await Watch.get(oid) is not None:
                result["skipped"] += 1
                continue
            doc = Watch(**op["before"])
            doc.id = oid
            await doc.insert()
            result["recreated"] += 1

    batch.undone_at = datetime.utcnow()
    batch.undone_by = str(user.id) if user is not None and getattr(user, "id", None) else None
    batch.undo_result = result
    await batch.save()
    return result


def batch_to_dict(batch: ChangeBatch) -> Dict[str, Any]:
    return {
        "id": str(batch.id),
        "kind": batch.kind,
        "summary": batch.summary,
        "created_at": batch.created_at,
        "created_by_name": batch.created_by_name,
        "updated_count": batch.updated_count,
        "created_count": batch.created_count,
        "deleted_count": batch.deleted_count,
        "undone_at": batch.undone_at,
        "undo_result": batch.undo_result,
    }
