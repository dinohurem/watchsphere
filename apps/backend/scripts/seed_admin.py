"""
Seed script to create an admin user for WatchSphere
Run this script to create the initial admin account

The credentials below are LOCAL DEVELOPMENT FIXTURES. They are well known,
so never seed them into a shared or production database — this script writes
to whatever settings.MONGODB_URL points at. Override via the environment when
targeting anything other than a local database:

    SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
    SEED_DEALER_PASSWORD / SEED_COLLECTOR_PASSWORD

For production use scripts/seed_prod_admin.py, which requires every value to
come from the environment.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User, UserRole
from app.core.config import settings
from app.core.security import get_password_hash


async def seed_admin():
    """Create admin user if it doesn't exist"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[User]
    )

    # Admin credentials - local dev fixture defaults, override via env
    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@watchsphere.com")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "Admin123!")
    admin_name = os.getenv("SEED_ADMIN_NAME", "WatchSphere Admin")

    # Check if admin already exists
    existing_admin = await User.find_one(User.email == admin_email)

    if existing_admin:
        print(f"✓ Admin user already exists: {admin_email}")
        print(f"  Role: {existing_admin.role}")
        return

    # Create admin user
    admin_user = User(
        email=admin_email,
        hashed_password=get_password_hash(admin_password),
        name=admin_name,
        role=UserRole.ADMIN,
        verified=True,
        approved=True,  # Admin is auto-approved
        is_active=True
    )

    await admin_user.insert()

    print("\n" + "="*60)
    print("✓ Admin user created successfully!")
    print("="*60)
    print(f"\n📧 Email:    {admin_email}")
    print("🔑 Password: (fixture default, or SEED_ADMIN_PASSWORD if set)")
    print(f"\n⚠️  IMPORTANT: Change this password after first login!")
    print("="*60 + "\n")

    # Close connection
    client.close()


async def create_test_users():
    """Create some test users for development"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.MONGODB_DB_NAME],
        document_models=[User]
    )

    test_users = [
        {
            "email": "dealer@watchsphere.com",
            "password": os.getenv("SEED_DEALER_PASSWORD", "Dealer123!"),
            "name": "Test Dealer",
            "role": UserRole.DEALER,
        },
        {
            "email": "collector@watchsphere.com",
            "password": os.getenv("SEED_COLLECTOR_PASSWORD", "Collector123!"),
            "name": "Test Collector",
            "role": UserRole.COLLECTOR,
        }
    ]

    print("\nCreating test users...\n")

    for user_data in test_users:
        existing = await User.find_one(User.email == user_data["email"])

        if existing:
            print(f"✓ User already exists: {user_data['email']}")
            continue

        user = User(
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            name=user_data["name"],
            role=user_data["role"],
            verified=True,
            approved=False,  # Test users need admin approval
            is_active=True
        )

        await user.insert()
        print(f"✓ Created {user_data['role'].value}: {user_data['email']}")

    print("\n" + "="*60)
    print("Test Users Created")
    print("="*60)
    for user_data in test_users:
        print(f"\n{user_data['role'].value.upper()}:")
        print(f"  Email: {user_data['email']}")
        print("  Password: (fixture default, or SEED_*_PASSWORD if set)")
    print("="*60 + "\n")

    # Close connection
    client.close()


async def main():
    """Main function"""
    print("\n🌟 WatchSphere User Seeding Script\n")

    # Create admin user
    await seed_admin()

    # Ask if user wants to create test users
    response = input("Create test users (dealer & collector)? [y/N]: ")
    if response.lower() == 'y':
        await create_test_users()

    print("✅ Done!\n")


if __name__ == "__main__":
    asyncio.run(main())
