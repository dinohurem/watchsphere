"""
Push notification service supporting both Expo Push and Firebase Cloud Messaging
"""

from typing import List, Optional, Dict, Any
import httpx
import logging

logger = logging.getLogger(__name__)

# Expo Push API endpoint
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


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


def is_expo_token(token: str) -> bool:
    """Check if token is an Expo push token"""
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


async def send_expo_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    badge: Optional[int] = None,
    sound: str = "default"
) -> bool:
    """
    Send push notification via Expo Push API.

    Args:
        token: Expo push token (ExponentPushToken[xxx])
        title: Notification title
        body: Notification body
        data: Additional data payload
        badge: iOS badge count
        sound: Notification sound

    Returns:
        True if sent successfully
    """
    try:
        message = {
            "to": token,
            "title": title,
            "body": body,
            "sound": sound,
        }

        if data:
            message["data"] = data
        if badge is not None:
            message["badge"] = badge

        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("data", {}).get("status") == "ok":
                    logger.info(f"Expo notification sent successfully to {token[:30]}...")
                    return True
                else:
                    logger.warning(f"Expo notification failed: {result}")
                    return False
            else:
                logger.error(f"Expo push API error: {response.status_code} - {response.text}")
                return False

    except Exception as e:
        logger.error(f"Failed to send Expo notification: {e}")
        return False


async def send_expo_notifications_batch(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    sound: str = "default"
) -> Dict[str, Any]:
    """
    Send push notifications to multiple Expo tokens in batch.

    Returns:
        Dict with 'success_count' and 'failure_count'
    """
    if not tokens:
        return {'success_count': 0, 'failure_count': 0}

    try:
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "sound": sound,
                "data": data or {}
            }
            for token in tokens
        ]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
            )

            if response.status_code == 200:
                result = response.json()
                data_list = result.get("data", [])
                success_count = sum(1 for item in data_list if item.get("status") == "ok")
                failure_count = len(data_list) - success_count
                return {'success_count': success_count, 'failure_count': failure_count}
            else:
                logger.error(f"Expo push API batch error: {response.status_code}")
                return {'success_count': 0, 'failure_count': len(tokens)}

    except Exception as e:
        logger.error(f"Failed to send Expo batch notifications: {e}")
        return {'success_count': 0, 'failure_count': len(tokens)}


async def send_fcm_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    image_url: Optional[str] = None,
    badge: Optional[int] = None
) -> bool:
    """
    Send push notification via Firebase Cloud Messaging.
    """
    try:
        from firebase_admin import messaging
        from app.core.firebase import get_messaging

        fcm = get_messaging()

        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )

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
            data=data or {},
            token=token,
            android=android_config,
            apns=apns_config
        )

        response = fcm.send(message)
        logger.info(f"FCM notification sent successfully: {response}")
        return True

    except Exception as e:
        logger.error(f"Failed to send FCM notification: {e}")
        return False


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
    Automatically detects token type and uses appropriate service.

    Args:
        token: Device push token (Expo or FCM)
        title: Notification title
        body: Notification body text
        data: Additional data payload (all values must be strings)
        notification_type: Type of notification for client-side handling
        image_url: Optional image URL to display
        badge: iOS badge count

    Returns:
        True if sent successfully
    """
    # Build data payload
    payload = data or {}
    if notification_type:
        payload['type'] = notification_type

    if is_expo_token(token):
        return await send_expo_notification(
            token=token,
            title=title,
            body=body,
            data=payload,
            badge=badge
        )
    else:
        return await send_fcm_notification(
            token=token,
            title=title,
            body=body,
            data=payload,
            image_url=image_url,
            badge=badge
        )


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
    Automatically separates Expo and FCM tokens.

    Returns:
        Dict with 'success_count' and 'failure_count'
    """
    if not tokens:
        return {'success_count': 0, 'failure_count': 0}

    # Build data payload
    payload = data or {}
    if notification_type:
        payload['type'] = notification_type

    # Separate tokens by type
    expo_tokens = [t for t in tokens if is_expo_token(t)]
    fcm_tokens = [t for t in tokens if not is_expo_token(t)]

    total_success = 0
    total_failure = 0

    # Send to Expo tokens
    if expo_tokens:
        result = await send_expo_notifications_batch(
            tokens=expo_tokens,
            title=title,
            body=body,
            data=payload
        )
        total_success += result['success_count']
        total_failure += result['failure_count']

    # Send to FCM tokens
    for token in fcm_tokens:
        success = await send_fcm_notification(
            token=token,
            title=title,
            body=body,
            data=payload,
            image_url=image_url
        )
        if success:
            total_success += 1
        else:
            total_failure += 1

    return {
        'success_count': total_success,
        'failure_count': total_failure
    }


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
        title=f"Price Alert: {watch_brand} {watch_model}",
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
        title="New Offer Received",
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
        title="Offer Accepted!",
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
        title="Offer Declined",
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
        title=f"{watch_brand} {watch_model}",
        body=alert_message,
        notification_type=NotificationType.WATCHLIST_ALERT,
        data={
            'watch_id': watch_id or ''
        },
        image_url=image_url
    )


# Helper function to send push notification to a user
async def send_push_to_user(
    user,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    notification_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send push notification to all devices of a user.

    Args:
        user: User model instance with fcm_tokens list
        title: Notification title
        body: Notification body
        data: Additional data payload
        notification_type: Type of notification

    Returns:
        Dict with 'success_count' and 'failure_count'
    """
    if not user.notifications_enabled:
        logger.info(f"Notifications disabled for user {user.id}")
        return {'success_count': 0, 'failure_count': 0, 'skipped': True}

    if not user.fcm_tokens:
        logger.info(f"No push tokens for user {user.id}")
        return {'success_count': 0, 'failure_count': 0, 'no_tokens': True}

    return await send_notification_to_multiple(
        tokens=user.fcm_tokens,
        title=title,
        body=body,
        data=data,
        notification_type=notification_type
    )
