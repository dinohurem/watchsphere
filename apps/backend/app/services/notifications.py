"""
Firebase Cloud Messaging service for push notifications
"""

from typing import List, Optional, Dict, Any
from firebase_admin import messaging
from app.core.firebase import get_messaging
import logging

logger = logging.getLogger(__name__)


# Notification types
class NotificationType:
    PRICE_CHANGE = "price_change"
    BUY_OFFER = "buy_offer"
    NEW_MESSAGE = "new_message"
    GROUP_MESSAGE = "group_message"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_REJECTED = "offer_rejected"
    LISTING_SOLD = "listing_sold"
    WATCHLIST_ALERT = "watchlist_alert"


async def send_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    notification_type: Optional[str] = None,
    image_url: Optional[str] = None,
    badge: Optional[int] = None
) -> bool:
    """
    Send a push notification to a single device.

    Args:
        token: FCM device token
        title: Notification title
        body: Notification body text
        data: Additional data payload (all values must be strings)
        notification_type: Type of notification for client-side handling
        image_url: Optional image URL to display
        badge: iOS badge count

    Returns:
        True if sent successfully
    """
    try:
        fcm = get_messaging()

        # Build notification
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )

        # Build data payload
        payload = data or {}
        if notification_type:
            payload['type'] = notification_type

        # Build platform-specific configs
        android_config = messaging.AndroidConfig(
            priority='high',
            notification=messaging.AndroidNotification(
                icon='ic_notification',
                color='#1D1D1F',
                sound='default',
                channel_id='watchsphere_notifications'
            )
        )

        apns_config = messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound='default',
                    badge=badge,
                    content_available=True
                )
            )
        )

        message = messaging.Message(
            notification=notification,
            data=payload,
            token=token,
            android=android_config,
            apns=apns_config
        )

        response = fcm.send(message)
        logger.info(f"Notification sent successfully: {response}")
        return True

    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        return False


async def send_notification_to_multiple(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    notification_type: Optional[str] = None,
    image_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send a push notification to multiple devices.

    Returns:
        Dict with 'success_count' and 'failure_count'
    """
    if not tokens:
        return {'success_count': 0, 'failure_count': 0}

    try:
        fcm = get_messaging()

        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )

        payload = data or {}
        if notification_type:
            payload['type'] = notification_type

        message = messaging.MulticastMessage(
            notification=notification,
            data=payload,
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    icon='ic_notification',
                    color='#1D1D1F',
                    sound='default',
                    channel_id='watchsphere_notifications'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        content_available=True
                    )
                )
            )
        )

        response = fcm.send_each_for_multicast(message)

        return {
            'success_count': response.success_count,
            'failure_count': response.failure_count
        }

    except Exception as e:
        logger.error(f"Failed to send multicast notification: {e}")
        return {'success_count': 0, 'failure_count': len(tokens)}


# Specialized notification functions

async def notify_price_change(
    token: str,
    watch_brand: str,
    watch_model: str,
    old_price: float,
    new_price: float,
    currency: str = "EUR",
    watch_id: Optional[str] = None,
    image_url: Optional[str] = None
) -> bool:
    """Notify user about a price change on their watchlist"""
    price_diff = new_price - old_price
    direction = "increased" if price_diff > 0 else "decreased"
    diff_text = f"+{price_diff:,.0f}" if price_diff > 0 else f"{price_diff:,.0f}"

    return await send_notification(
        token=token,
        title=f"💰 Price Alert: {watch_brand} {watch_model}",
        body=f"Price {direction} to {currency} {new_price:,.0f} ({diff_text})",
        notification_type=NotificationType.PRICE_CHANGE,
        data={
            'watch_id': watch_id or '',
            'old_price': str(old_price),
            'new_price': str(new_price),
            'currency': currency
        },
        image_url=image_url
    )


async def notify_buy_offer(
    token: str,
    listing_title: str,
    offer_amount: float,
    buyer_name: str,
    currency: str = "EUR",
    listing_id: Optional[str] = None,
    offer_id: Optional[str] = None,
    image_url: Optional[str] = None
) -> bool:
    """Notify seller about a new buy offer"""
    return await send_notification(
        token=token,
        title=f"🎯 New Offer Received",
        body=f"{buyer_name} offered {currency} {offer_amount:,.0f} for {listing_title}",
        notification_type=NotificationType.BUY_OFFER,
        data={
            'listing_id': listing_id or '',
            'offer_id': offer_id or '',
            'amount': str(offer_amount),
            'buyer_name': buyer_name
        },
        image_url=image_url
    )


async def notify_new_message(
    token: str,
    sender_name: str,
    message_preview: str,
    chat_id: str,
    sender_avatar: Optional[str] = None
) -> bool:
    """Notify user about a new direct message"""
    # Truncate message preview
    if len(message_preview) > 50:
        message_preview = message_preview[:47] + "..."

    return await send_notification(
        token=token,
        title=sender_name,
        body=message_preview,
        notification_type=NotificationType.NEW_MESSAGE,
        data={
            'chat_id': chat_id,
            'sender_name': sender_name
        },
        image_url=sender_avatar
    )


async def notify_group_message(
    token: str,
    group_name: str,
    sender_name: str,
    message_preview: str,
    group_id: str,
    group_image: Optional[str] = None
) -> bool:
    """Notify user about a new group message"""
    if len(message_preview) > 50:
        message_preview = message_preview[:47] + "..."

    return await send_notification(
        token=token,
        title=group_name,
        body=f"{sender_name}: {message_preview}",
        notification_type=NotificationType.GROUP_MESSAGE,
        data={
            'group_id': group_id,
            'sender_name': sender_name
        },
        image_url=group_image
    )


async def notify_offer_accepted(
    token: str,
    listing_title: str,
    offer_amount: float,
    seller_name: str,
    currency: str = "EUR",
    listing_id: Optional[str] = None
) -> bool:
    """Notify buyer that their offer was accepted"""
    return await send_notification(
        token=token,
        title=f"✅ Offer Accepted!",
        body=f"{seller_name} accepted your {currency} {offer_amount:,.0f} offer for {listing_title}",
        notification_type=NotificationType.OFFER_ACCEPTED,
        data={
            'listing_id': listing_id or '',
            'amount': str(offer_amount),
            'seller_name': seller_name
        }
    )


async def notify_offer_rejected(
    token: str,
    listing_title: str,
    offer_amount: float,
    currency: str = "EUR",
    listing_id: Optional[str] = None
) -> bool:
    """Notify buyer that their offer was rejected"""
    return await send_notification(
        token=token,
        title=f"Offer Declined",
        body=f"Your {currency} {offer_amount:,.0f} offer for {listing_title} was declined",
        notification_type=NotificationType.OFFER_REJECTED,
        data={
            'listing_id': listing_id or '',
            'amount': str(offer_amount)
        }
    )


async def notify_watchlist_alert(
    tokens: List[str],
    watch_brand: str,
    watch_model: str,
    alert_message: str,
    watch_id: Optional[str] = None,
    image_url: Optional[str] = None
) -> Dict[str, Any]:
    """Send watchlist alert to multiple users"""
    return await send_notification_to_multiple(
        tokens=tokens,
        title=f"⌚ {watch_brand} {watch_model}",
        body=alert_message,
        notification_type=NotificationType.WATCHLIST_ALERT,
        data={
            'watch_id': watch_id or ''
        },
        image_url=image_url
    )
