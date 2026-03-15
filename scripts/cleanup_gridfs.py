#!/usr/bin/env python3
"""
Cleanup script to free MongoDB Atlas storage space.
Drops empty/unneeded collections to reclaim disk space.

Usage:
    MONGODB_URL="mongodb+srv://..." python scripts/cleanup_gridfs.py
"""

import os
import sys
from pymongo import MongoClient

MONGODB_URL = os.environ.get("MONGODB_URL")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "watchsphere")

if not MONGODB_URL:
    print("ERROR: Set MONGODB_URL environment variable")
    sys.exit(1)


def sizeof_fmt(num):
    for unit in ["B", "KB", "MB", "GB"]:
        if abs(num) < 1024.0:
            return f"{num:3.1f} {unit}"
        num /= 1024.0
    return f"{num:.1f} TB"


def show_sizes(db):
    total_size = 0
    collections = []
    for name in sorted(db.list_collection_names()):
        stats = db.command("collStats", name)
        size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
        total_size += size
        collections.append((name, size, stats.get("storageSize", 0), stats.get("totalIndexSize", 0), stats.get("count", 0)))

    collections.sort(key=lambda x: x[1], reverse=True)

    print(f"{'Collection':<35} {'Total':>10} {'Data':>10} {'Index':>10} {'Docs':>8}")
    print(f"{'-'*35} {'-'*10} {'-'*10} {'-'*10} {'-'*8}")
    for name, total, data, idx, count in collections:
        print(f"{name:<35} {sizeof_fmt(total):>10} {sizeof_fmt(data):>10} {sizeof_fmt(idx):>10} {count:>8}")
    print(f"{'-'*35} {'-'*10}")
    print(f"{'TOTAL':<35} {sizeof_fmt(total_size):>10}")
    return total_size


def main():
    print("Connecting to MongoDB...")
    client = MongoClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]

    print(f"\n{'='*60}")
    print(f"Collection sizes in '{MONGODB_DB_NAME}':")
    print(f"{'='*60}")
    total_before = show_sizes(db)

    # Identify collections to drop
    print(f"\n{'='*60}")
    print("CLEANUP OPTIONS:")
    print(f"{'='*60}")
    print()
    print("Collections that can be DROPPED (removes data + reclaims disk space):")
    print()

    droppable = []

    # GridFS collections (already emptied, but space not reclaimed)
    for name in ["wtb_wts_files.chunks", "wtb_wts_files.files"]:
        if name in db.list_collection_names():
            stats = db.command("collStats", name)
            count = stats.get("count", 0)
            size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
            droppable.append((name, size, count))
            print(f"  [{len(droppable)}] {name} ({sizeof_fmt(size)}, {count} docs)")

    # extracted_watch_listings - old WhatsApp import data
    if "extracted_watch_listings" in db.list_collection_names():
        stats = db.command("collStats", "extracted_watch_listings")
        count = stats.get("count", 0)
        size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
        droppable.append(("extracted_watch_listings", size, count))
        print(f"  [{len(droppable)}] extracted_watch_listings ({sizeof_fmt(size)}, {count} docs)")

    # whatsapp_messages - old WhatsApp import data
    if "whatsapp_messages" in db.list_collection_names():
        stats = db.command("collStats", "whatsapp_messages")
        count = stats.get("count", 0)
        size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
        droppable.append(("whatsapp_messages", size, count))
        print(f"  [{len(droppable)}] whatsapp_messages ({sizeof_fmt(size)}, {count} docs)")

    # whatsapp_imports - old WhatsApp import metadata
    if "whatsapp_imports" in db.list_collection_names():
        stats = db.command("collStats", "whatsapp_imports")
        count = stats.get("count", 0)
        size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
        droppable.append(("whatsapp_imports", size, count))
        print(f"  [{len(droppable)}] whatsapp_imports ({sizeof_fmt(size)}, {count} docs)")

    # wtb_wts_runs - can be dropped and recreated
    if "wtb_wts_runs" in db.list_collection_names():
        stats = db.command("collStats", "wtb_wts_runs")
        count = stats.get("count", 0)
        size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
        droppable.append(("wtb_wts_runs", size, count))
        print(f"  [{len(droppable)}] wtb_wts_runs ({sizeof_fmt(size)}, {count} docs)")

    # Empty collections with only indexes taking space
    for name in db.list_collection_names():
        if name in [d[0] for d in droppable]:
            continue
        stats = db.command("collStats", name)
        count = stats.get("count", 0)
        if count == 0:
            size = stats.get("storageSize", 0) + stats.get("totalIndexSize", 0)
            if size > 0:
                droppable.append((name, size, count))
                print(f"  [{len(droppable)}] {name} ({sizeof_fmt(size)}, EMPTY)")

    est_savings = sum(s for _, s, _ in droppable)
    print(f"\nEstimated space to reclaim: {sizeof_fmt(est_savings)}")

    print(f"\n{'='*60}")
    print("OPTIONS:")
    print("  a. Drop ALL listed collections above (maximum space recovery)")
    print("  b. Drop only GridFS + extracted_watch_listings + whatsapp data (keep runs)")
    print("  c. Drop only GridFS collections (already emptied, reclaim allocated space)")
    print("  n. No changes")
    print(f"{'='*60}")

    choice = input("\nChoose option [a/b/c/n]: ").strip().lower()

    if choice == "n":
        print("No changes made.")
        client.close()
        return

    if choice == "a":
        to_drop = [name for name, _, _ in droppable]
    elif choice == "b":
        to_drop = [name for name, _, _ in droppable
                   if name in ("wtb_wts_files.chunks", "wtb_wts_files.files",
                               "extracted_watch_listings", "whatsapp_messages", "whatsapp_imports")]
    elif choice == "c":
        to_drop = [name for name, _, _ in droppable
                   if name in ("wtb_wts_files.chunks", "wtb_wts_files.files")]
    else:
        print("Invalid choice.")
        client.close()
        return

    print(f"\nDropping {len(to_drop)} collections...")
    for name in to_drop:
        try:
            db.drop_collection(name)
            print(f"  Dropped: {name}")
        except Exception as e:
            print(f"  ERROR dropping {name}: {e}")

    print(f"\n{'='*60}")
    print("Storage after cleanup:")
    print(f"{'='*60}")
    total_after = show_sizes(db)
    print(f"\nFreed: ~{sizeof_fmt(total_before - total_after)}")
    print("\nBeanie will recreate collections + indexes on next app startup.")

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
