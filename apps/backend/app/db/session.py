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
    from app.models.news import News
    from app.models.chat_group import ConversationMember
    from app.models.billing import Billing, Subscription, Transaction
    from app.models.watchlist import WatchlistRecord
    from app.models.default_watchlist import DefaultWatchlistItem
    from app.models.activity_log import ActivityLog
    from app.models.whatsapp_import import WhatsAppImport, WhatsAppMessage, ExtractedWatchListing
    from app.models.verification import VerificationCode
    from app.models.order import Order
    from app.models.listing_field import ListingField
    from app.models.filter import Filter
    from app.models.support import Dispute, Issue
    from app.models.review import Review

    await init_beanie(
        database=mongodb_client[settings.MONGODB_DB_NAME],
        document_models=[
            User, Watch, Message, Conversation,
            News, ConversationMember,
            Billing, Subscription, Transaction,
            WatchlistRecord, DefaultWatchlistItem, ActivityLog,
            WhatsAppImport, WhatsAppMessage, ExtractedWatchListing,
            VerificationCode, Order,
            ListingField, Filter,
            Dispute, Issue, Review
        ]
    )


async def close_mongo_connection():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
