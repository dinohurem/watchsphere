"""
Socket.IO Manager for real-time chat functionality.
Uses python-socketio for Socket.IO protocol compatibility with socket.io-client.
"""

import socketio
from typing import Dict, Set, Optional, TYPE_CHECKING
from datetime import datetime
import logging

from app.core.security import decode_access_token
from app.models.user import User
from app.models.chat import Conversation, Message
from beanie import PydanticObjectId

# Import will be done lazily to avoid circular imports
if TYPE_CHECKING:
    from app.services.broadcast import UnifiedBroadcastService

logger = logging.getLogger(__name__)

# Create Socket.IO server with ASGI support
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True,
)

# Create ASGI app for Socket.IO
# socketio_path='/' because we mount the whole app at /socket.io in main.py
# This makes the full path /socket.io/ which matches the client's path setting
socket_app = socketio.ASGIApp(sio, socketio_path='/')


class SocketIOManager:
    """Manages Socket.IO connections for chat functionality."""

    def __init__(self):
        # Map of sid -> user_id
        self.sid_to_user: Dict[str, str] = {}
        # Map of user_id -> set of sids (supports multiple devices)
        self.user_to_sids: Dict[str, Set[str]] = {}
        # Map of user_id -> user info
        self.user_info: Dict[str, dict] = {}

    def register_user(self, sid: str, user_id: str, user_name: str, user_avatar: str = None):
        """Register a connected user."""
        self.sid_to_user[sid] = user_id

        if user_id not in self.user_to_sids:
            self.user_to_sids[user_id] = set()
        self.user_to_sids[user_id].add(sid)

        self.user_info[user_id] = {
            "name": user_name,
            "avatar": user_avatar,
            "connected_at": datetime.utcnow()
        }
        logger.info(f"Socket.IO REGISTER: User '{user_id}' ({user_name}) with sid {sid}")
        logger.info(f"Socket.IO REGISTER: All registered user IDs: {list(self.user_to_sids.keys())}")

    def unregister_user(self, sid: str):
        """Unregister a disconnected user."""
        user_id = self.sid_to_user.pop(sid, None)
        if user_id and user_id in self.user_to_sids:
            self.user_to_sids[user_id].discard(sid)
            if not self.user_to_sids[user_id]:
                del self.user_to_sids[user_id]
                self.user_info.pop(user_id, None)
                logger.info(f"User {user_id} fully disconnected")

    def get_user_id(self, sid: str) -> Optional[str]:
        """Get user_id for a socket id."""
        return self.sid_to_user.get(sid)

    def get_user_sids(self, user_id: str) -> Set[str]:
        """Get all socket ids for a user."""
        return self.user_to_sids.get(user_id, set())

    def is_user_online(self, user_id: str) -> bool:
        """Check if a user is online."""
        return user_id in self.user_to_sids and len(self.user_to_sids[user_id]) > 0


# Global manager instance
manager = SocketIOManager()


# Socket.IO Event Handlers

@sio.event
async def connect(sid, environ, auth):
    """Handle new connection with authentication."""
    logger.info(f"Socket.IO: Connection attempt from {sid}")
    logger.info(f"Socket.IO: Auth data present: {auth is not None}")
    logger.info(f"Socket.IO: Auth keys: {list(auth.keys()) if auth else 'None'}")

    # Get token from auth data
    token = auth.get('token') if auth else None
    if not token:
        logger.warning(f"Socket.IO: No token provided for {sid}")
        logger.warning(f"Socket.IO: Auth data was: {auth}")
        return False  # Reject connection

    logger.info(f"Socket.IO: Token received, length: {len(token)}, prefix: {token[:20]}...")

    try:
        # Verify token
        payload = decode_access_token(token)
        logger.info(f"Socket.IO: Token decode result: {payload is not None}")
        if not payload or "sub" not in payload:
            logger.warning(f"Socket.IO: Invalid token for {sid}, payload: {payload}")
            return False

        user_id = payload["sub"]
        logger.info(f"Socket.IO: Token valid for user {user_id}")

        user = await User.get(PydanticObjectId(user_id))
        if not user:
            logger.warning(f"Socket.IO: User {user_id} not found for {sid}")
            return False

        # Register user with avatar
        user_avatar = user.profile_image_url or user.profile_image_thumbnail_url
        manager.register_user(sid, user_id, user.name, user_avatar)
        logger.info(f"Socket.IO: Registered user {user_id} ({user.name}) with sid {sid}")

        # Send connection success
        await sio.emit('connection', {
            'status': 'connected',
            'user_id': user_id
        }, to=sid)

        # Broadcast online status to relevant users
        await broadcast_presence(user_id, online=True)

        logger.info(f"Socket.IO: User {user_id} connected successfully via Socket.IO")
        return True

    except Exception as e:
        logger.error(f"Socket.IO: Connection error for {sid}: {e}", exc_info=True)
        return False


@sio.event
async def disconnect(sid):
    """Handle disconnection."""
    user_id = manager.get_user_id(sid)
    logger.info(f"Disconnect: sid={sid}, user_id={user_id}")

    if user_id:
        # Check if user has other connections before broadcasting offline
        manager.unregister_user(sid)
        if not manager.is_user_online(user_id):
            await broadcast_presence(user_id, online=False)


@sio.on('conversation:join')
async def conversation_join(sid, data):
    """Join a conversation room."""
    conversation_id = data.get('conversationId') or data.get('conversation_id')
    if conversation_id:
        room = f"conversation:{conversation_id}"
        await sio.enter_room(sid, room)
        logger.info(f"{sid} joined room {room}")
        await sio.emit('conversation:joined', {
            'conversation_id': conversation_id
        }, to=sid)


@sio.on('conversation:leave')
async def conversation_leave(sid, data):
    """Leave a conversation room."""
    conversation_id = data.get('conversationId') or data.get('conversation_id')
    if conversation_id:
        room = f"conversation:{conversation_id}"
        await sio.leave_room(sid, room)
        logger.info(f"{sid} left room {room}")


@sio.on('typing:start')
async def typing_start(sid, data):
    """Handle typing start event."""
    user_id = manager.get_user_id(sid)
    if not user_id:
        return

    conversation_id = data.get('conversationId') or data.get('conversation_id')
    if not conversation_id:
        return

    user_info = manager.user_info.get(user_id, {})
    room = f"conversation:{conversation_id}"

    # Using camelCase consistently
    await sio.emit('typing:start', {
        'conversationId': conversation_id,
        'userId': user_id,
        'userName': user_info.get('name', 'Unknown'),
    }, room=room, skip_sid=sid)


@sio.on('typing:stop')
async def typing_stop(sid, data):
    """Handle typing stop event."""
    user_id = manager.get_user_id(sid)
    if not user_id:
        return

    conversation_id = data.get('conversationId') or data.get('conversation_id')
    if not conversation_id:
        return

    user_info = manager.user_info.get(user_id, {})
    room = f"conversation:{conversation_id}"

    # Using camelCase consistently
    await sio.emit('typing:stop', {
        'conversationId': conversation_id,
        'userId': user_id,
        'userName': user_info.get('name', 'Unknown'),
    }, room=room, skip_sid=sid)


@sio.on('message:send')
async def message_send(sid, data, callback=None):
    """Handle sending a new message."""
    user_id = manager.get_user_id(sid)
    if not user_id:
        if callback:
            await callback({'success': False, 'error': 'Not authenticated'})
        return

    conversation_id = data.get('conversationId') or data.get('conversation_id')
    content = data.get('content')
    temp_id = data.get('tempId') or data.get('temp_id')
    reply_to = data.get('replyTo') or data.get('reply_to')

    if not conversation_id or not content:
        if callback:
            await callback({'success': False, 'error': 'Missing conversation_id or content'})
        return

    try:
        # Verify user has access to conversation
        conversation = await Conversation.get(PydanticObjectId(conversation_id))
        if not conversation or user_id not in conversation.participant_ids:
            if callback:
                await callback({'success': False, 'error': 'Conversation not found or access denied'})
            return

        user_info = manager.user_info.get(user_id, {})
        sender_name = user_info.get('name', 'Unknown')
        sender_avatar = user_info.get('avatar')

        # Create and save message
        logger.info(f"message_send: Creating message with conversation_id={conversation_id} (type: {type(conversation_id)})")
        message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content,
            reply_to_id=reply_to,
        )
        await message.insert()
        logger.info(f"message_send: Saved message with id={message.id}, conversation_id={message.conversation_id}")

        # Update conversation timestamp
        conversation.updated_at = message.created_at
        await conversation.save()

        # Prepare message data - using camelCase consistently for all platforms
        message_data = {
            'id': str(message.id),
            'conversationId': conversation_id,
            'senderId': user_id,
            'senderName': sender_name,
            'senderAvatar': sender_avatar,
            'content': content,
            'type': 'text',
            'status': 'sent',
            'timestamp': message.created_at.isoformat(),
            'replyTo': reply_to,
            'tempId': temp_id,
        }

        # Use the unified broadcast service to send to BOTH WebSocket and Socket.IO clients
        # Import here to avoid circular imports
        from app.services.broadcast import broadcast_service
        await broadcast_service.broadcast_message(
            conversation_id, message_data, user_id,
            participant_ids=conversation.participant_ids
        )

        # Broadcast unread count update to other participants
        # Also send push notifications to offline users
        from app.services.notifications import notify_new_message, notify_group_message
        is_group = conversation.type == 'group'

        for participant_id in conversation.participant_ids:
            if participant_id != user_id:
                # Get updated unread count for this participant
                unread_count = await Message.find(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != participant_id,
                    Message.read == False,
                ).count()
                await broadcast_service.broadcast_unread_update(
                    participant_id, conversation_id, unread_count
                )

                # Send push notification if user is NOT online via Socket.IO
                # (they'll see the in-app notification if online)
                if not manager.is_user_online(participant_id):
                    try:
                        # Get recipient user for push tokens
                        recipient = await User.get(PydanticObjectId(participant_id))
                        if recipient and recipient.notifications_enabled and recipient.notify_messages and recipient.fcm_tokens:
                            for token in recipient.fcm_tokens:
                                if is_group:
                                    await notify_group_message(
                                        token=token,
                                        group_name=conversation.name or 'Group',
                                        sender_name=sender_name,
                                        message_preview=content,
                                        group_id=conversation_id,
                                    )
                                else:
                                    await notify_new_message(
                                        token=token,
                                        sender_name=sender_name,
                                        message_preview=content,
                                        chat_id=conversation_id,
                                        sender_avatar=sender_avatar,
                                    )
                            logger.info(f"Push notification sent to offline user {participant_id}")
                    except Exception as push_error:
                        logger.error(f"Failed to send push notification to {participant_id}: {push_error}")

        # Send callback acknowledgement
        if callback:
            await callback({'success': True, 'message': message_data})

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        if callback:
            await callback({'success': False, 'error': str(e)})


@sio.on('messages:read')
async def messages_read(sid, data):
    """Handle marking messages as read."""
    user_id = manager.get_user_id(sid)
    if not user_id:
        return

    conversation_id = data.get('conversationId') or data.get('conversation_id')
    message_ids = data.get('messageIds') or data.get('message_ids', [])

    if not conversation_id or not message_ids:
        return

    room = f"conversation:{conversation_id}"
    # Using camelCase consistently
    await sio.emit('message:status', {
        'conversationId': conversation_id,
        'messageIds': message_ids,
        'readerId': user_id,
        'status': 'read',
    }, room=room, skip_sid=sid)


async def broadcast_presence(user_id: str, online: bool):
    """Broadcast user presence change to all connected users."""
    # For simplicity, broadcast to all connected users
    # In production, you'd want to broadcast only to users who have conversations with this user
    await sio.emit('user:online' if online else 'user:offline', user_id)
