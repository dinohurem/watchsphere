"""
Seed script to insert sample data for testing
Run with: python scripts/seed_sample_data.py
"""

import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

# Add the app directory to the path
import sys
sys.path.insert(0, '/Users/dinohurem/Documents/dev/watchsphere/apps/backend')

from app.models.watch import Watch, WatchCondition, WatchStatus
from app.models.news import News, NewsStatus
from app.models.default_watchlist import DefaultWatchlistItem
from app.models.watchlist import WatchlistItemType
from app.models.user import User
from app.models.billing import Subscription


async def seed_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.watchsphere

    # Initialize Beanie with all document models
    await init_beanie(
        database=db,
        document_models=[Watch, News, DefaultWatchlistItem, User, Subscription]
    )

    print("Connected to MongoDB. Starting seed...")

    # Get admin user for author info
    admin_user = await User.find_one(User.role == "admin")
    if not admin_user:
        print("No admin user found. Please create an admin user first.")
        return

    admin_id = str(admin_user.id)
    admin_name = admin_user.name

    # ============== SAMPLE WATCHES ==============
    print("\nSeeding watches...")

    # Check if watches already exist
    existing_watches = await Watch.find_all().count()
    if existing_watches > 0:
        print(f"  Watches already exist ({existing_watches}). Skipping...")
    else:
        sample_watches = [
            {
                "brand": "Rolex",
                "model": "Submariner",
                "reference": "126610LN",
                "price": 12500,
                "currency": "EUR",
                "condition": WatchCondition.EXCELLENT,
                "year": 2023,
                "description": "Rolex Submariner Date with black ceramic bezel and Oystersteel case. Complete with box and papers.",
                "status": WatchStatus.ACTIVE,
                "featured": True,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
            {
                "brand": "Rolex",
                "model": "GMT-Master II",
                "reference": "126710BLRO",
                "price": 20800,
                "currency": "EUR",
                "condition": WatchCondition.NEW,
                "year": 2024,
                "description": "The iconic 'Pepsi' GMT-Master II with Jubilee bracelet. Unworn with full set.",
                "status": WatchStatus.ACTIVE,
                "featured": True,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
            {
                "brand": "Audemars Piguet",
                "model": "Royal Oak",
                "reference": "26240OR Blue",
                "price": 106000,
                "currency": "EUR",
                "condition": WatchCondition.EXCELLENT,
                "year": 2023,
                "description": "Royal Oak Chronograph in 18k rose gold with blue dial. Stunning piece.",
                "status": WatchStatus.ACTIVE,
                "featured": True,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
            {
                "brand": "Patek Philippe",
                "model": "Nautilus",
                "reference": "5711/1A-010",
                "price": 168000,
                "currency": "EUR",
                "condition": WatchCondition.NEW,
                "year": 2021,
                "description": "Discontinued Nautilus reference in stainless steel with blue dial. Investment piece.",
                "status": WatchStatus.ACTIVE,
                "featured": True,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
            {
                "brand": "Rolex",
                "model": "Day-Date",
                "reference": "228238A",
                "price": 55200,
                "currency": "EUR",
                "condition": WatchCondition.EXCELLENT,
                "year": 2022,
                "description": "Day-Date 40 in 18k yellow gold with black dial and President bracelet.",
                "status": WatchStatus.ACTIVE,
                "featured": False,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
            {
                "brand": "Rolex",
                "model": "Explorer",
                "reference": "224270",
                "price": 8149,
                "currency": "EUR",
                "condition": WatchCondition.NEW,
                "year": 2024,
                "description": "New 40mm Explorer with black dial. Unworn full set.",
                "status": WatchStatus.ACTIVE,
                "featured": False,
                "dealer_id": admin_id,
                "dealer_name": admin_name,
            },
        ]

        for watch_data in sample_watches:
            watch = Watch(**watch_data, published_at=datetime.utcnow())
            await watch.insert()
            print(f"  Created watch: {watch_data['brand']} {watch_data['model']}")

    # ============== SAMPLE NEWS ==============
    print("\nSeeding news...")

    existing_news = await News.find_all().count()
    if existing_news > 0:
        print(f"  News already exist ({existing_news}). Skipping...")
    else:
        sample_news = [
            {
                "title": "Patek Philippe increases Nautilus production rate by 5%",
                "slug": "patek-philippe-increases-nautilus-production",
                "content": "In a surprising move, Patek Philippe has announced a 5% increase in Nautilus production. This decision comes after years of extreme scarcity in the market. Industry experts suggest this could help stabilize the secondary market prices while maintaining exclusivity.",
                "excerpt": "Patek Philippe announces increased Nautilus production, potentially stabilizing secondary market prices.",
                "author_id": admin_id,
                "author_name": admin_name,
                "status": NewsStatus.PUBLISHED,
                "tags": ["Patek Philippe", "Nautilus", "Market News"],
                "published_at": datetime.utcnow(),
            },
            {
                "title": "Rolex unveils new Submariner model with enhanced features",
                "slug": "rolex-unveils-new-submariner-model",
                "content": "Rolex has announced updates to its iconic Submariner line, featuring improved movement accuracy and enhanced water resistance. The new models maintain the classic design while incorporating modern technological advancements.",
                "excerpt": "Rolex announces Submariner updates with improved accuracy and water resistance.",
                "author_id": admin_id,
                "author_name": admin_name,
                "status": NewsStatus.PUBLISHED,
                "tags": ["Rolex", "Submariner", "New Release"],
                "published_at": datetime.utcnow(),
            },
            {
                "title": "Audemars Piguet introduces new concept watch at Geneva Watch Fair",
                "slug": "audemars-piguet-concept-watch-geneva",
                "content": "At the Geneva Watch Fair, Audemars Piguet unveiled their latest concept watch, pushing the boundaries of horological innovation. The timepiece features revolutionary materials and a striking new design language.",
                "excerpt": "AP showcases revolutionary concept watch at Geneva Watch Fair.",
                "author_id": admin_id,
                "author_name": admin_name,
                "status": NewsStatus.PUBLISHED,
                "tags": ["Audemars Piguet", "Concept Watch", "Geneva Watch Fair"],
                "published_at": datetime.utcnow(),
            },
        ]

        for news_data in sample_news:
            news = News(**news_data)
            await news.insert()
            print(f"  Created news: {news_data['title'][:50]}...")

    # ============== SAMPLE DEFAULT WATCHLIST ==============
    print("\nSeeding default watchlist items...")

    existing_defaults = await DefaultWatchlistItem.find_all().count()
    if existing_defaults > 0:
        print(f"  Default watchlist items already exist ({existing_defaults}). Skipping...")
    else:
        default_watchlist = [
            {
                "brand": "Rolex",
                "model": "Submariner",
                "reference": "126610LN",
                "item_type": WatchlistItemType.WATCHING,
                "target_price": 12000,
                "currency": "EUR",
                "is_active": True,
                "display_order": 1,
                "created_by_id": admin_id,
                "created_by_name": admin_name,
            },
            {
                "brand": "Rolex",
                "model": "GMT-Master II",
                "reference": "126710BLRO",
                "item_type": WatchlistItemType.WATCHING,
                "target_price": 20000,
                "currency": "EUR",
                "is_active": True,
                "display_order": 2,
                "created_by_id": admin_id,
                "created_by_name": admin_name,
            },
            {
                "brand": "Audemars Piguet",
                "model": "Royal Oak",
                "reference": "26240OR",
                "item_type": WatchlistItemType.WATCHING,
                "target_price": 100000,
                "currency": "EUR",
                "is_active": True,
                "display_order": 3,
                "created_by_id": admin_id,
                "created_by_name": admin_name,
            },
            {
                "brand": "Patek Philippe",
                "model": "Nautilus",
                "reference": "5711/1A",
                "item_type": WatchlistItemType.WATCHING,
                "target_price": 160000,
                "currency": "EUR",
                "is_active": True,
                "display_order": 4,
                "created_by_id": admin_id,
                "created_by_name": admin_name,
            },
        ]

        for item_data in default_watchlist:
            item = DefaultWatchlistItem(**item_data)
            await item.insert()
            print(f"  Created default watchlist: {item_data['brand']} {item_data['model']}")

    print("\nSeed completed successfully!")
    print("\nSummary:")
    print(f"  Watches: {await Watch.find_all().count()}")
    print(f"  News: {await News.find_all().count()}")
    print(f"  Default Watchlist: {await DefaultWatchlistItem.find_all().count()}")


if __name__ == "__main__":
    asyncio.run(seed_data())
