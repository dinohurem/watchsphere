"""One-time script to purge duplicate orders from the database.
Dedup key: (ws_code, whatsapp_phone, price, currency, month_year)
Keeps the most recent order per group, deletes older duplicates.

Usage: python scripts/purge_duplicate_orders.py
"""
import asyncio
import os
import sys
from datetime import datetime
from collections import defaultdict

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie
    from app.models.order import Order, OrderStatus
    from app.core.config import settings

    # Connect to DB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_name = settings.MONGODB_URL.split('/')[-1].split('?')[0] or "watchsphere"
    db = client[db_name]
    await init_beanie(database=db, document_models=[Order])

    # Load all active orders
    orders = await Order.find(Order.status == OrderStatus.ACTIVE).to_list()
    print(f"Total active orders: {len(orders)}")

    # Group by dedup key
    groups = defaultdict(list)
    for order in orders:
        ws = (order.ws_code or "").strip().upper()
        phone = (order.whatsapp_phone or order.user_name or "").strip()
        price = str(int(order.price)) if order.price else ""
        currency = (order.currency or "").strip().upper()
        month_year = ""
        if order.watch_month and order.year:
            month_year = f"{order.watch_month:02d}/{order.year % 100:02d}"
        elif order.year_raw:
            month_year = order.year_raw.strip().lower()

        if ws and phone:
            key = (ws, phone, price, currency, month_year)
            groups[key].append(order)

    # Find duplicates
    total_dupes = 0
    to_delete = []
    for key, order_list in groups.items():
        if len(order_list) > 1:
            # Sort by created_at descending — keep the newest
            order_list.sort(key=lambda o: o.created_at or datetime.min, reverse=True)
            keeper = order_list[0]
            dupes = order_list[1:]
            total_dupes += len(dupes)
            to_delete.extend(dupes)

    print(f"Found {total_dupes} duplicate orders across {len([g for g in groups.values() if len(g) > 1])} groups")

    if total_dupes == 0:
        print("No duplicates found. Exiting.")
        return

    confirm = input(f"Delete {total_dupes} duplicate orders? (yes/no): ")
    if confirm.lower() != "yes":
        print("Aborted.")
        return

    # Delete duplicates in batches
    deleted = 0
    BATCH = 100
    for i in range(0, len(to_delete), BATCH):
        batch = to_delete[i:i + BATCH]
        for order in batch:
            await order.delete()
            deleted += 1
        print(f"  Deleted {deleted}/{total_dupes}...")

    print(f"Done! Deleted {deleted} duplicate orders. {len(orders) - deleted} orders remain.")


if __name__ == "__main__":
    asyncio.run(main())
