"""
Seed script to create an admin user for WatchSphere Production
Run this script once to initialize the production database with an admin account.

Usage:
    python scripts/seed_prod_admin.py

Required environment variables (no defaults — this writes to production):
    MONGODB_URL     Atlas connection string
    ADMIN_EMAIL     login for the admin account to create
    ADMIN_PASSWORD  password for that account

Optional:
    MONGODB_DB_NAME (default "watchsphere")
    ADMIN_NAME      (default "WatchSphere Admin")
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.append(str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User, UserRole
from app.core.security import get_password_hash


def _required_env(name: str) -> str:
    """Read a required env var, failing with an actionable message.

    Deliberately has no fallback: this script writes to the production
    database, so any committed default would be a published credential.
    """
    value = os.environ.get(name)
    if not value:
        sys.exit(
            f"❌ {name} is not set.\n"
            f"   This script targets production and has no built-in defaults.\n"
            f"   Set it in the environment before running, e.g.:\n"
            f"     export {name}='...'"
        )
    return value


MONGODB_URL = _required_env("MONGODB_URL")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "watchsphere")

# Admin credentials for production
ADMIN_EMAIL = _required_env("ADMIN_EMAIL")
ADMIN_PASSWORD = _required_env("ADMIN_PASSWORD")
ADMIN_NAME = os.getenv("ADMIN_NAME", "WatchSphere Admin")


async def seed_prod_admin():
    """Create admin user for production database"""

    print("\n" + "=" * 60)
    print("WatchSphere Production Admin Seeder")
    print("=" * 60)
    print(f"\nConnecting to: {MONGODB_DB_NAME}")
    print(f"MongoDB URL: {MONGODB_URL[:50]}...")

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)

    try:
        # Initialize Beanie with only the User model
        await init_beanie(
            database=client[MONGODB_DB_NAME],
            document_models=[User]
        )

        # Check if admin already exists
        existing_admin = await User.find_one(User.email == ADMIN_EMAIL)

        if existing_admin:
            print(f"\n⚠️  Admin user already exists: {ADMIN_EMAIL}")
            print(f"   Role: {existing_admin.role}")
            print(f"   Verified: {existing_admin.verified}")
            print(f"   Approved: {existing_admin.approved}")
            return

        # Create admin user
        admin_user = User(
            email=ADMIN_EMAIL,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            name=ADMIN_NAME,
            role=UserRole.ADMIN,
            verified=True,
            approved=True,
            is_active=True
        )

        await admin_user.insert()

        print("\n" + "=" * 60)
        print("✅ ADMIN USER CREATED SUCCESSFULLY!")
        print("=" * 60)
        print(f"\n📧 Email:    {ADMIN_EMAIL}")
        print(f"🔑 Password: (as supplied in ADMIN_PASSWORD — not echoed)")
        print(f"👤 Name:     {ADMIN_NAME}")
        print(f"🛡️  Role:     ADMIN")
        print("\n⚠️  IMPORTANT: Change the password after first login!")
        print("=" * 60 + "\n")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    print("\n🚀 Starting production admin seeder...\n")
    asyncio.run(seed_prod_admin())
    print("✅ Done!\n")
