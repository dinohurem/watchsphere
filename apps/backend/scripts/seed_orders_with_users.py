"""
Seed script to create 15 buy and 15 sell orders for 10 watches.
Uses real users from the database and dynamically populates listing fields.
Run with: python scripts/seed_orders_with_users.py
"""

import asyncio
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

# Add the app directory to the path
import sys
sys.path.insert(0, '/Users/dinohurem/Documents/dev/watchsphere/apps/backend')

from app.models.watch import Watch, WatchStatus
from app.models.order import Order, OrderType, OrderCondition, OrderStatus
from app.models.user import User
from app.models.listing_field import ListingField
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

# Watch data to create orders for (10 watches)
WATCHES_DATA = [
    {"brand": "Rolex", "model": "Submariner Date", "reference": "126610LN", "base_price": 14500},
    {"brand": "Rolex", "model": "GMT-Master II", "reference": "126710BLRO", "base_price": 21500},
    {"brand": "Rolex", "model": "Daytona", "reference": "116500LN", "base_price": 36000},
    {"brand": "Patek Philippe", "model": "Nautilus", "reference": "5711/1A-010", "base_price": 168000},
    {"brand": "Patek Philippe", "model": "Aquanaut", "reference": "5167A-001", "base_price": 52000},
    {"brand": "Audemars Piguet", "model": "Royal Oak", "reference": "15500ST", "base_price": 42000},
    {"brand": "Audemars Piguet", "model": "Royal Oak Offshore", "reference": "26470ST", "base_price": 38000},
    {"brand": "Omega", "model": "Speedmaster Professional", "reference": "310.30.42.50.01.001", "base_price": 7500},
    {"brand": "Omega", "model": "Seamaster Diver 300M", "reference": "210.30.42.20.01.001", "base_price": 5800},
    {"brand": "IWC", "model": "Portugieser Chronograph", "reference": "IW371605", "base_price": 9200},
]

# Dynamic field options (will be supplemented with actual listing fields from DB)
MOVEMENT_TYPES = ["Automatic", "Manual", "Quartz"]
CALIBERS = ["3135", "3235", "4130", "324 SC", "26-330 S C", "3861", "4302", "69355"]
POWER_RESERVES = ["48 hours", "55 hours", "70 hours", "72 hours", "46 hours"]
CASE_MATERIALS = ["Stainless Steel", "Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Titanium"]
CASE_DIAMETERS = ["36mm", "38mm", "39mm", "40mm", "41mm", "42mm", "44mm"]
WATER_RESISTANCES = ["30m", "50m", "100m", "200m", "300m"]
BEZEL_MATERIALS = ["Ceramic", "Stainless Steel", "Gold", "Aluminum"]
CRYSTALS = ["Sapphire", "Hesalite", "Mineral"]
DIAL_COLORS = ["Black", "Blue", "White", "Silver", "Green", "Grey", "Champagne"]
DIAL_NUMERALS = ["Arabic", "Roman", "Index", "Mixed"]
BRACELET_MATERIALS = ["Stainless Steel", "Leather", "Rubber", "Gold", "Titanium"]
BRACELET_COLORS = ["Silver", "Black", "Brown", "Blue", "Green"]
CLASP_TYPES = ["Folding", "Deployant", "Tang Buckle", "Oysterlock", "Oysterclasp"]
CLASP_MATERIALS = ["Stainless Steel", "Gold", "Titanium"]
YEARS = list(range(2018, 2025))


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


def maybe_include(value, chance: float = 0.7):
    """Randomly include or exclude a value based on chance."""
    return value if random.random() < chance else None


def generate_extended_fields(is_sell_order: bool):
    """Generate extended watch details for orders. Randomize which fields are included."""
    if not is_sell_order:
        # Buy orders have fewer details
        return {
            "year": maybe_include(random.choice(YEARS), 0.5),
        }

    # Sell orders have more detailed information, but randomize inclusion
    fields = {}

    # Basic extended info
    if random.random() < 0.8:
        fields["year"] = random.choice(YEARS)

    # Caliber information (include 60% of the time)
    if random.random() < 0.6:
        fields["movement_type"] = random.choice(MOVEMENT_TYPES)
    if random.random() < 0.5:
        fields["caliber"] = random.choice(CALIBERS)
    if random.random() < 0.4:
        fields["power_reserve"] = random.choice(POWER_RESERVES)
    if random.random() < 0.3:
        fields["number_of_jewels"] = random.randint(21, 42)

    # Case information (include 70% of the time)
    if random.random() < 0.7:
        fields["case_material"] = random.choice(CASE_MATERIALS)
    if random.random() < 0.6:
        fields["case_diameter"] = random.choice(CASE_DIAMETERS)
    if random.random() < 0.5:
        fields["water_resistance"] = random.choice(WATER_RESISTANCES)
    if random.random() < 0.4:
        fields["bezel_material"] = random.choice(BEZEL_MATERIALS)
    if random.random() < 0.5:
        fields["crystal"] = random.choice(CRYSTALS)
    if random.random() < 0.6:
        fields["dial"] = random.choice(DIAL_COLORS)
    if random.random() < 0.4:
        fields["dial_numerals"] = random.choice(DIAL_NUMERALS)

    # Bracelet/strap information (include 50% of the time)
    if random.random() < 0.6:
        fields["bracelet_material"] = random.choice(BRACELET_MATERIALS)
    if random.random() < 0.4:
        fields["bracelet_color"] = random.choice(BRACELET_COLORS)
    if random.random() < 0.3:
        fields["clasp_type"] = random.choice(CLASP_TYPES)
    if random.random() < 0.3:
        fields["clasp_material"] = random.choice(CLASP_MATERIALS)

    return fields


async def seed_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.watchsphere

    # Initialize Beanie with all document models
    await init_beanie(
        database=db,
        document_models=[Watch, Order, User, Subscription, ListingField]
    )

    print("Connected to MongoDB. Starting seed...")

    # Get all active users from the database
    users = await User.find(User.is_active == True).to_list()

    if len(users) < 2:
        print("Error: Need at least 2 users in the database. Please create some users first.")
        return

    print(f"\nFound {len(users)} active users in database:")
    for user in users:
        print(f"  - {user.name} ({user.email}) - {user.role}")

    # Delete ALL existing orders
    print("\nDeleting ALL existing orders...")
    delete_result = await Order.find_all().delete()
    deleted_count = delete_result.deleted_count if delete_result else 0
    print(f"  Deleted {deleted_count} existing orders")

    # Get enabled listing fields for reference
    enabled_fields = await ListingField.find(ListingField.is_enabled == True).to_list()
    print(f"\nFound {len(enabled_fields)} enabled listing fields:")
    for field in enabled_fields:
        print(f"  - {field.key} ({field.category})")

    # ============== CREATE ORDERS ==============
    print("\nCreating orders for 10 watches...")

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
            # Pick a random user
            user = random.choice(users)
            country = random.choice(COUNTRIES)
            extended_fields = generate_extended_fields(is_sell_order=False)

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
                user_id=str(user.id),
                user_name=user.name,
                user_email=user.email,
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
                **extended_fields,
            )
            await buy_order.insert()
            total_buy_orders += 1

        print(f"    - Created 15 buy orders")

        # Create 15 sell orders
        for i in range(15):
            # Pick a random user
            user = random.choice(users)
            country = random.choice(COUNTRIES)
            extended_fields = generate_extended_fields(is_sell_order=True)

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
                user_id=str(user.id),
                user_name=user.name,
                user_email=user.email,
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
                **extended_fields,
            )
            await sell_order.insert()
            total_sell_orders += 1

        print(f"    - Created 15 sell orders")

    # ============== SUMMARY ==============
    print("\n" + "="*50)
    print("SEED COMPLETED SUCCESSFULLY!")
    print("="*50)

    total_orders = await Order.find_all().count()
    active_buy_orders = await Order.find(Order.order_type == OrderType.BUY, Order.status == OrderStatus.ACTIVE).count()
    active_sell_orders = await Order.find(Order.order_type == OrderType.SELL, Order.status == OrderStatus.ACTIVE).count()

    print(f"\nDatabase Statistics:")
    print(f"  Total Orders: {total_orders}")
    print(f"  - Active Buy Orders: {active_buy_orders}")
    print(f"  - Active Sell Orders: {active_sell_orders}")

    print(f"\nThis Seed Created:")
    print(f"  Buy Orders: {total_buy_orders}")
    print(f"  Sell Orders: {total_sell_orders}")

    print("\n" + "="*50)
    print("Orders created for watches:")
    print("="*50)
    for watch_data in WATCHES_DATA:
        print(f"  - {watch_data['brand']} {watch_data['model']} ({watch_data['reference']}) @ EUR {watch_data['base_price']:,}")


if __name__ == "__main__":
    asyncio.run(seed_data())
