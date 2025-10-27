from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from typing import Optional

# Global MongoDB client
mongodb_client: Optional[AsyncIOMotorClient] = None


async def connect_to_mongo():
    """Initialize MongoDB connection and Beanie"""
    global mongodb_client
    mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)

    # Import all document models here
    from app.models.user import User
    from app.models.watch import Watch
    from app.models.chat import Message, Conversation

    await init_beanie(
        database=mongodb_client[settings.MONGODB_DB_NAME],
        document_models=[User, Watch, Message, Conversation]
    )


async def close_mongo_connection():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
