from datetime import datetime
from typing import List

from app.models.default_watchlist import DefaultWatchlistItem
from app.models.watchlist import WatchlistRecord
from app.models.user import User


async def assign_default_watchlist_to_user(user: User) -> List[str]:
    """
    Assign all active default watchlist items to a new user.
    Returns a list of created watchlist record IDs.
    """
    # Get all active default watchlist items
    default_items = await DefaultWatchlistItem.find(
        DefaultWatchlistItem.is_active == True
    ).sort([("display_order", 1)]).to_list()

    created_ids = []

    for item in default_items:
        # Create a watchlist record for the user
        watchlist_record = WatchlistRecord(
            user_id=str(user.id),
            user_name=user.name,
            user_email=user.email,
            item_type=item.item_type,
            brand=item.brand,
            model=item.model,
            reference=item.reference,
            target_price=item.target_price,
            currency=item.currency,
            price_alert_enabled=False,  # Default to false for new users
            notes=item.notes,
            is_active=True,
            created_at=datetime.utcnow(),
        )

        await watchlist_record.insert()
        created_ids.append(str(watchlist_record.id))

    return created_ids
