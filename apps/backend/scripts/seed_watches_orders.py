"""
Seed script to insert watches with detailed order book records (buy and sell orders).
Creates 10 watches with 15 buy orders and 15 sell orders each.
Run with: python scripts/seed_watches_orders.py
"""

import asyncio
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

# Add the app directory to the path
import sys
sys.path.insert(0, '/Users/dinohurem/Documents/dev/watchsphere/apps/backend')

from app.models.watch import Watch, WatchCondition, WatchStatus
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.user import User
from app.models.billing import Subscription


# Country data for orders
COUNTRIES = [
    {"code": "us", "name": "United States"},
    {"code": "de", "name": "Germany"},
    {"code": "ch", "name": "Switzerland"},
    {"code": "it", "name": "Italy"},
    {"code": "fr", "name": "France"},
    {"code": "gb", "name": "United Kingdom"},
    {"code": "ae", "name": "United Arab Emirates"},
    {"code": "jp", "name": "Japan"},
    {"code": "hk", "name": "Hong Kong"},
    {"code": "sg", "name": "Singapore"},
]

# Detailed watch data with full specifications
WATCHES_DATA = [
    {
        "brand": "Rolex",
        "model": "Submariner Date",
        "reference": "126610LN",
        "base_price": 14500,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "The Rolex Submariner Date ref. 126610LN features a 41mm Oystersteel case with a black Cerachrom ceramic bezel. Powered by the calibre 3235 movement with 70-hour power reserve. Water resistant to 300 meters. Black dial with luminescent hour markers.",
        "price_history": [13800, 14000, 14200, 14100, 14300, 14500, 14400, 14600, 14500, 14700, 14500, 14300, 14500, 14400, 14500, 14600, 14500, 14400, 14500, 14500],
        "price_change": 2.5,
    },
    {
        "brand": "Rolex",
        "model": "GMT-Master II",
        "reference": "126710BLRO",
        "base_price": 21500,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "The iconic 'Pepsi' GMT-Master II ref. 126710BLRO with blue and red Cerachrom bezel insert. 40mm Oystersteel case on Jubilee bracelet. Calibre 3285 movement with 70-hour power reserve. GMT function for tracking multiple time zones.",
        "price_history": [20000, 20500, 21000, 20800, 21200, 21500, 21300, 21700, 21500, 21800, 21500, 21200, 21500, 21400, 21500, 21600, 21500, 21400, 21500, 21500],
        "price_change": 3.2,
    },
    {
        "brand": "Rolex",
        "model": "Daytona",
        "reference": "116500LN",
        "base_price": 36000,
        "year": 2023,
        "condition": WatchCondition.EXCELLENT,
        "description": "Rolex Cosmograph Daytona ref. 116500LN with white dial and black Cerachrom bezel. 40mm Oystersteel case. Calibre 4130 movement with 72-hour power reserve. Chronograph function with tachymetric scale. Complete set with box and papers.",
        "price_history": [34000, 34500, 35000, 35200, 35500, 36000, 35800, 36200, 36000, 36500, 36000, 35500, 36000, 35800, 36000, 36200, 36000, 35800, 36000, 36000],
        "price_change": 4.8,
    },
    {
        "brand": "Patek Philippe",
        "model": "Nautilus",
        "reference": "5711/1A-010",
        "base_price": 168000,
        "year": 2021,
        "condition": WatchCondition.EXCELLENT,
        "description": "The legendary Patek Philippe Nautilus ref. 5711/1A-010 with blue dial gradient. 40mm stainless steel case designed by Gerald Genta. Calibre 26-330 S C movement with date function. Discontinued reference, highly collectible. Complete with extract from archives.",
        "price_history": [155000, 158000, 162000, 165000, 168000, 170000, 168000, 172000, 168000, 175000, 168000, 165000, 168000, 166000, 168000, 170000, 168000, 166000, 168000, 168000],
        "price_change": 5.2,
    },
    {
        "brand": "Patek Philippe",
        "model": "Aquanaut",
        "reference": "5167A-001",
        "base_price": 52000,
        "year": 2023,
        "condition": WatchCondition.NEW,
        "description": "Patek Philippe Aquanaut ref. 5167A-001 with embossed black dial. 40mm stainless steel case with rounded octagonal bezel. Calibre 324 S C movement with date function. Tropical composite strap. 120m water resistance.",
        "price_history": [48000, 49000, 50000, 51000, 52000, 52500, 52000, 53000, 52000, 53500, 52000, 51000, 52000, 51500, 52000, 52500, 52000, 51500, 52000, 52000],
        "price_change": 2.8,
    },
    {
        "brand": "Audemars Piguet",
        "model": "Royal Oak",
        "reference": "15500ST",
        "base_price": 42000,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "Audemars Piguet Royal Oak ref. 15500ST with blue Grande Tapisserie dial. 41mm stainless steel case with integrated bracelet. Calibre 4302 movement with 70-hour power reserve. Date function at 3 o'clock. 50m water resistance.",
        "price_history": [39000, 40000, 41000, 41500, 42000, 42500, 42000, 43000, 42000, 43500, 42000, 41000, 42000, 41500, 42000, 42500, 42000, 41500, 42000, 42000],
        "price_change": 3.5,
    },
    {
        "brand": "Audemars Piguet",
        "model": "Royal Oak Offshore",
        "reference": "26470ST",
        "base_price": 38000,
        "year": 2023,
        "condition": WatchCondition.EXCELLENT,
        "description": "Audemars Piguet Royal Oak Offshore Chronograph ref. 26470ST with black dial. 42mm stainless steel case with ceramic pushers. Calibre 3126/3840 movement. Chronograph and date functions. 100m water resistance. Complete with box and papers.",
        "price_history": [35000, 36000, 37000, 37500, 38000, 38500, 38000, 39000, 38000, 39500, 38000, 37000, 38000, 37500, 38000, 38500, 38000, 37500, 38000, 38000],
        "price_change": 4.1,
    },
    {
        "brand": "Omega",
        "model": "Speedmaster Professional",
        "reference": "310.30.42.50.01.001",
        "base_price": 7500,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "Omega Speedmaster Professional Moonwatch ref. 310.30.42.50.01.001 with black dial and hesalite crystal. 42mm stainless steel case. Calibre 3861 manual-winding movement. The original NASA-qualified moonwatch. Tachymeter bezel. Complete with special presentation box.",
        "price_history": [7000, 7100, 7200, 7300, 7500, 7600, 7500, 7700, 7500, 7800, 7500, 7300, 7500, 7400, 7500, 7600, 7500, 7400, 7500, 7500],
        "price_change": 2.2,
    },
    {
        "brand": "Omega",
        "model": "Seamaster Diver 300M",
        "reference": "210.30.42.20.01.001",
        "base_price": 5800,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "Omega Seamaster Diver 300M ref. 210.30.42.20.01.001 with black ceramic dial and laser-engraved waves. 42mm stainless steel case with ceramic bezel. Calibre 8800 Master Chronometer movement. 300m water resistance. Helium escape valve.",
        "price_history": [5400, 5500, 5600, 5700, 5800, 5900, 5800, 6000, 5800, 6100, 5800, 5600, 5800, 5700, 5800, 5900, 5800, 5700, 5800, 5800],
        "price_change": 1.8,
    },
    {
        "brand": "IWC",
        "model": "Portugieser Chronograph",
        "reference": "IW371605",
        "base_price": 9200,
        "year": 2024,
        "condition": WatchCondition.NEW,
        "description": "IWC Portugieser Chronograph ref. IW371605 with blue dial and silver subdials. 41mm stainless steel case. Calibre 69355 movement with 46-hour power reserve. Chronograph function with 12-hour and 30-minute totalizers. Blue alligator strap.",
        "price_history": [8600, 8800, 9000, 9100, 9200, 9400, 9200, 9500, 9200, 9600, 9200, 9000, 9200, 9100, 9200, 9400, 9200, 9100, 9200, 9200],
        "price_change": 2.6,
    },
]

# User names for orders
USER_NAMES = [
    "John Smith", "Hans Mueller", "Pierre Dubois", "Marco Rossi", "James Wilson",
    "Ahmed Al-Rashid", "Takeshi Yamamoto", "Wei Chen", "Michael Brown", "Sebastian Koch",
    "Oliver Taylor", "Lucas Martin", "Alexander Schmidt", "David Lee", "Thomas Anderson",
]


def generate_price_variation(base_price: float, order_type: str) -> float:
    """Generate price with market variation based on order type."""
    variation_percent = random.uniform(-0.08, 0.08)  # +/- 8% variation

    if order_type == "buy":
        # Buyers typically bid slightly lower
        adjustment = random.uniform(-0.05, 0.02)
    else:
        # Sellers typically ask slightly higher
        adjustment = random.uniform(-0.02, 0.05)

    final_price = base_price * (1 + variation_percent + adjustment)
    return round(final_price / 100) * 100  # Round to nearest 100


def generate_random_date(days_back: int = 90) -> datetime:
    """Generate a random date within the specified days back."""
    random_days = random.randint(0, days_back)
    random_hours = random.randint(0, 23)
    random_minutes = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=random_days, hours=random_hours, minutes=random_minutes)


async def seed_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.watchsphere

    # Initialize Beanie with all document models
    await init_beanie(
        database=db,
        document_models=[Watch, Order, User, Subscription]
    )

    print("Connected to MongoDB. Starting seed...")

    # Get admin user for dealer info
    admin_user = await User.find_one(User.role == "admin")
    if not admin_user:
        print("No admin user found. Please run seed_admin.py first.")
        return

    admin_id = str(admin_user.id)
    admin_name = admin_user.name

    # Delete existing seeded watches and orders (keep user-created ones)
    print("\nClearing existing seeded watches and orders...")

    # Find and delete watches created by admin with these references
    seeded_references = [w["reference"] for w in WATCHES_DATA]
    deleted_watches = 0
    deleted_orders = 0

    for ref in seeded_references:
        # Delete watches
        result = await Watch.find(Watch.reference == ref, Watch.dealer_id == admin_id).delete()
        deleted_watches += result.deleted_count if result else 0

        # Delete orders for this reference
        result = await Order.find(Order.reference == ref).delete()
        deleted_orders += result.deleted_count if result else 0

    print(f"  Deleted {deleted_watches} existing watches")
    print(f"  Deleted {deleted_orders} existing orders")

    # ============== CREATE WATCHES ==============
    print("\nSeeding watches with detailed information...")

    created_watches = []
    for watch_data in WATCHES_DATA:
        watch = Watch(
            brand=watch_data["brand"],
            model=watch_data["model"],
            reference=watch_data["reference"],
            price=watch_data["base_price"],
            currency="EUR",
            condition=watch_data["condition"],
            year=watch_data["year"],
            description=watch_data["description"],
            status=WatchStatus.ACTIVE,
            featured=random.choice([True, False]),
            trending=random.choice([True, False]),
            dealer_id=admin_id,
            dealer_name=admin_name,
            price_history=watch_data["price_history"],
            price_change=watch_data["price_change"],
            views=random.randint(50, 500),
            order_count=30,  # Will have 30 orders (15 buy + 15 sell)
            published_at=datetime.utcnow() - timedelta(days=random.randint(1, 60)),
        )
        await watch.insert()
        created_watches.append(watch)
        print(f"  Created watch: {watch_data['brand']} {watch_data['model']} ({watch_data['reference']})")

    # ============== CREATE ORDERS ==============
    print("\nSeeding order book entries...")

    total_buy_orders = 0
    total_sell_orders = 0

    for watch_data in WATCHES_DATA:
        reference = watch_data["reference"]
        brand = watch_data["brand"]
        model = watch_data["model"]
        base_price = watch_data["base_price"]

        print(f"\n  Creating orders for {brand} {model} ({reference}):")

        # Create 15 buy orders
        for i in range(15):
            country = random.choice(COUNTRIES)
            user_name = random.choice(USER_NAMES)

            buy_order = Order(
                order_type=OrderType.BUY,
                brand=brand,
                model=model,
                reference=reference,
                price=generate_price_variation(base_price, "buy"),
                currency="EUR",
                condition=random.choice([OrderCondition.UNWORN, OrderCondition.USED]),
                country_code=country["code"],
                country_name=country["name"],
                user_id=admin_id,  # Using admin as placeholder user
                user_name=user_name,
                user_email=f"{user_name.lower().replace(' ', '.')}@example.com",
                status=OrderStatus.ACTIVE,
                has_box=random.choice([True, False]),
                has_papers=random.choice([True, False]),
                notes=random.choice([
                    None,
                    "Looking for complete set only",
                    "Flexible on condition",
                    "Quick buyer, can pay immediately",
                    "Prefer unworn condition",
                    "Looking for specific serial range",
                ]),
                created_at=generate_random_date(90),
            )
            await buy_order.insert()
            total_buy_orders += 1

        print(f"    - Created 15 buy orders")

        # Create 15 sell orders
        for i in range(15):
            country = random.choice(COUNTRIES)
            user_name = random.choice(USER_NAMES)

            sell_order = Order(
                order_type=OrderType.SELL,
                brand=brand,
                model=model,
                reference=reference,
                price=generate_price_variation(base_price, "sell"),
                currency="EUR",
                condition=random.choice([OrderCondition.UNWORN, OrderCondition.USED]),
                country_code=country["code"],
                country_name=country["name"],
                user_id=admin_id,  # Using admin as placeholder user
                user_name=user_name,
                user_email=f"{user_name.lower().replace(' ', '.')}@example.com",
                status=OrderStatus.ACTIVE,
                has_box=random.choice([True, True, True, False]),  # Higher chance of having box
                has_papers=random.choice([True, True, True, False]),  # Higher chance of having papers
                notes=random.choice([
                    None,
                    "Complete set with all accessories",
                    "Serviced recently",
                    "Excellent condition, minimal wear",
                    "Original everything",
                    "International warranty valid",
                    "Can ship worldwide",
                ]),
                created_at=generate_random_date(90),
            )
            await sell_order.insert()
            total_sell_orders += 1

        print(f"    - Created 15 sell orders")

    # ============== SUMMARY ==============
    print("\n" + "="*50)
    print("SEED COMPLETED SUCCESSFULLY!")
    print("="*50)

    total_watches = await Watch.find_all().count()
    total_orders = await Order.find_all().count()
    active_buy_orders = await Order.find(Order.order_type == OrderType.BUY, Order.status == OrderStatus.ACTIVE).count()
    active_sell_orders = await Order.find(Order.order_type == OrderType.SELL, Order.status == OrderStatus.ACTIVE).count()

    print(f"\nDatabase Statistics:")
    print(f"  Total Watches: {total_watches}")
    print(f"  Total Orders: {total_orders}")
    print(f"  - Active Buy Orders: {active_buy_orders}")
    print(f"  - Active Sell Orders: {active_sell_orders}")

    print(f"\nThis Seed Created:")
    print(f"  Watches: {len(created_watches)}")
    print(f"  Buy Orders: {total_buy_orders}")
    print(f"  Sell Orders: {total_sell_orders}")

    print("\n" + "="*50)
    print("Watches with Order Book Data:")
    print("="*50)
    for watch_data in WATCHES_DATA:
        print(f"  - {watch_data['brand']} {watch_data['model']} ({watch_data['reference']}) @ EUR {watch_data['base_price']:,}")


if __name__ == "__main__":
    asyncio.run(seed_data())
