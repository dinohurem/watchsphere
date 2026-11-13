import logging
from typing import Optional

from beanie import init_beanie
from beanie.odm.utils.init import Initializer
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure

from app.core.config import settings

logger = logging.getLogger(__name__)

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
    from app.models.billing import Billing, Subscription, SubscriptionHistory, Transaction
    from app.models.watchlist import WatchlistRecord
    from app.models.default_watchlist import DefaultWatchlistItem
    from app.models.activity_log import ActivityLog
    from app.models.whatsapp_import import WhatsAppImport, WhatsAppMessage, ExtractedWatchListing
    from app.models.verification import VerificationCode
    from app.models.order import Order
    from app.models.listing_field import ListingField
    from app.models.filter import Filter
    from app.models.support import Dispute, Issue, Report
    from app.models.review import Review
    from app.models.auth_handoff import AuthHandoffToken
    from app.models.notification import Notification
    from app.models.app_settings import AppSettings
    from app.models.watch_alert import WatchAlert
    from app.models.wtb_wts import WtbWtsRun
    from app.models.whatsapp_bridge import BridgeMessage, BridgeStatus
    from app.models.fx_rate import FxRate, FxRateHistory
    from app.models.market_stats import WatchMarketStats
    from app.models.pipeline import (
        PipelineUpload, PipelineGroupState, PipelineItem, AliasSuggestion, PipelineReportState,
    )
    from app.models.change_batch import ChangeBatch, ChangeBatchEntry
    from app.models.remark_rule import RemarkRule, RemarkPlace

    models = [
        User, Watch, Message, Conversation,
        News, ConversationMember,
        Billing, Subscription, SubscriptionHistory, Transaction,
        WatchlistRecord, DefaultWatchlistItem, ActivityLog,
        WhatsAppImport, WhatsAppMessage, ExtractedWatchListing,
        VerificationCode, Order,
        ListingField, Filter,
        Dispute, Issue, Report, Review, AuthHandoffToken,
        Notification, AppSettings, WatchAlert,
        WtbWtsRun, BridgeMessage, BridgeStatus,
        FxRate, FxRateHistory, WatchMarketStats,
        PipelineUpload, PipelineGroupState, PipelineItem, AliasSuggestion, PipelineReportState,
        ChangeBatch, ChangeBatchEntry,
        RemarkRule, RemarkPlace,
    ]
    database = mongodb_client[settings.MONGODB_DB_NAME]
    try:
        await init_beanie(database=database, document_models=models)
    except OperationFailure as exc:
        # Index sync is a write. When the cluster refuses writes (e.g. Atlas storage
        # quota, code 8000) a crash here takes the whole API down although reads
        # still work. Start without index sync instead; it runs again next start.
        logger.error(
            "MongoDB refused index creation at startup (%s: %s). Starting without "
            "index sync; writes will fail until the cluster accepts them again.",
            exc.code, str(exc)[:200],
        )
        await _init_beanie_without_indexes(database, models)


async def _init_beanie_without_indexes(database, models) -> None:
    original = Initializer.init_indexes

    async def _skip(self, cls, allow_index_dropping: bool = False):
        return None

    Initializer.init_indexes = _skip
    try:
        await init_beanie(database=database, document_models=models)
    finally:
        Initializer.init_indexes = original


async def close_mongo_connection():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
