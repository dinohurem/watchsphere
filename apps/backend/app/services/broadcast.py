"""
Unified Broadcast Service for real-time messaging.
Bridges both native WebSocket and Socket.IO to ensure messages
are delivered to ALL connected clients regardless of protocol.
"""

from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


class UnifiedBroadcastService:
    """
    Unified service that broadcasts messages to BOTH:
    - Native WebSocket clients (web)
    - Socket.IO clients (mobile)

    This ensures cross-platform message delivery.
    """

    def __init__(self):
        self._ws_manager = None
        self._socketio_server = None
        self._socketio_manager = None

    def set_ws_manager(self, ws_manager):
        """Set the WebSocket manager instance."""
        self._ws_manager = ws_manager

    def set_socketio_server(self, sio):
        """Set the Socket.IO server instance."""
        self._socketio_server = sio

    def set_socketio_manager(self, manager):
        """Set the Socket.IO manager instance (for user->sid mapping)."""
        self._socketio_manager = manager

    async def broadcast_message(
        self,
        conversation_id: str,
        message_data: dict,
        sender_id: str,
        participant_ids: Optional[List[str]] = None
    ):
        """
        Broadcast a new message to ALL connected clients.

        Args:
            conversation_id: The conversation ID
            message_data: Message data (should include both snake_case and camelCase)
            sender_id: The sender's user ID
            participant_ids: List of participant IDs for direct delivery
        """
        logger.info(f"=== BROADCAST START: conversation={conversation_id}, participants={participant_ids} ===")
        logger.info(f"broadcast_message: Message content: {message_data.get('content', 'N/A')[:50]}")
        logger.info(f"broadcast_message: ws_manager={self._ws_manager is not None}, socketio_server={self._socketio_server is not None}, socketio_manager={self._socketio_manager is not None}")

        # Ensure message_data has both formats for compatibility
        normalized_data = self._normalize_message_data(message_data)
        logger.info(f"broadcast_message: Normalized data keys: {list(normalized_data.keys())}")

        # 1. Broadcast to native WebSocket clients
        if self._ws_manager:
            try:
                logger.info(f"Attempting WebSocket broadcast to conversation {conversation_id}")
                await self._ws_manager.broadcast_new_message(
                    conversation_id,
                    normalized_data,
                    sender_id,
                    participant_ids=participant_ids
                )
                logger.info(f"Broadcast to WebSocket clients for {conversation_id}")
            except Exception as e:
                logger.error(f"Failed to broadcast to WebSocket: {e}")
        else:
            logger.warning("WebSocket manager not set in broadcast service!")

        # 2. Broadcast to Socket.IO clients
        if self._socketio_server:
            try:
                # First, broadcast to the room (for users who have joined)
                room = f"conversation:{conversation_id}"
                await self._socketio_server.emit('message:new', normalized_data, room=room)
                logger.info(f"Broadcast to Socket.IO room {room}")

                # Also send directly to all participants by their sids
                # This ensures delivery even if they haven't joined the room
                if participant_ids and self._socketio_manager:
                    logger.info(f"Socket.IO DIRECT DELIVERY: Checking participants {participant_ids}")
                    logger.info(f"Socket.IO DIRECT DELIVERY: All connected users: {list(self._socketio_manager.user_to_sids.keys())}")
                    for user_id in participant_ids:
                        sids = self._socketio_manager.get_user_sids(user_id)
                        if sids:
                            logger.info(f"Socket.IO DIRECT DELIVERY: User {user_id} has {len(sids)} sids: {sids}")
                            for sid in sids:
                                try:
                                    await self._socketio_server.emit('message:new', normalized_data, to=sid)
                                    logger.info(f"Socket.IO DIRECT DELIVERY: SENT to sid {sid} (user {user_id})")
                                except Exception as e:
                                    logger.error(f"Socket.IO DIRECT DELIVERY: FAILED to send to sid {sid}: {e}")
                        else:
                            logger.warning(f"Socket.IO DIRECT DELIVERY: User {user_id} has NO connected sids - NOT ONLINE via Socket.IO!")
                else:
                    logger.warning(f"Socket.IO: No participant_ids ({participant_ids}) or no manager ({self._socketio_manager})")
            except Exception as e:
                logger.error(f"Failed to broadcast to Socket.IO: {e}")

        logger.info(f"=== BROADCAST END: conversation={conversation_id} ===")

    async def broadcast_typing(
        self,
        conversation_id: str,
        user_id: str,
        user_name: str,
        is_typing: bool
    ):
        """Broadcast typing indicator to all clients."""
        # Using camelCase consistently for all platforms
        typing_data = {
            "conversationId": conversation_id,
            "userId": user_id,
            "userName": user_name,
            "isTyping": is_typing,
        }

        # Broadcast to WebSocket clients
        if self._ws_manager:
            try:
                await self._ws_manager.send_typing_indicator(
                    conversation_id, user_id, user_name, is_typing
                )
            except Exception as e:
                logger.error(f"Failed to broadcast typing to WebSocket: {e}")

        # Broadcast to Socket.IO clients
        if self._socketio_server:
            try:
                room = f"conversation:{conversation_id}"
                event = 'typing:start' if is_typing else 'typing:stop'
                await self._socketio_server.emit(event, typing_data, room=room)
            except Exception as e:
                logger.error(f"Failed to broadcast typing to Socket.IO: {e}")

    async def broadcast_presence(self, user_id: str, online: bool):
        """Broadcast user presence to all clients."""
        # Broadcast to WebSocket clients
        if self._ws_manager:
            try:
                await self._ws_manager.broadcast_presence(user_id, online)
            except Exception as e:
                logger.error(f"Failed to broadcast presence to WebSocket: {e}")

        # Broadcast to Socket.IO clients
        if self._socketio_server:
            try:
                event = 'user:online' if online else 'user:offline'
                await self._socketio_server.emit(event, user_id)
            except Exception as e:
                logger.error(f"Failed to broadcast presence to Socket.IO: {e}")

    async def broadcast_unread_update(
        self,
        user_id: str,
        conversation_id: str,
        unread_count: int
    ):
        """
        Broadcast unread count update to a specific user.
        Used for updating chat badges in real-time.
        """
        logger.info(f"=== UNREAD UPDATE: user={user_id}, conversation={conversation_id}, count={unread_count} ===")
        # Using camelCase consistently for all platforms
        update_data = {
            "conversationId": conversation_id,
            "unreadCount": unread_count,
        }

        # Send to WebSocket clients
        if self._ws_manager:
            try:
                await self._ws_manager.send_personal_message({
                    "type": "unread:update",
                    "data": update_data
                }, user_id)
            except Exception as e:
                logger.error(f"Failed to send unread update to WebSocket: {e}")

        # Send to Socket.IO clients directly to the user's sids
        if self._socketio_server and self._socketio_manager:
            try:
                sids = self._socketio_manager.get_user_sids(user_id)
                for sid in sids:
                    await self._socketio_server.emit('unread:update', update_data, to=sid)
                    logger.info(f"Sent unread update to Socket.IO sid {sid} (user {user_id})")
            except Exception as e:
                logger.error(f"Failed to send unread update to Socket.IO: {e}")

    async def broadcast_notification(
        self,
        user_id: str,
        notification_data: dict,
    ):
        """
        Broadcast a notification to a specific user.
        Used for real-time notification banner display.

        Args:
            user_id: The user to notify
            notification_data: Notification data including id, type, title, body, etc.
        """
        logger.info(f"=== NOTIFICATION BROADCAST: user={user_id}, type={notification_data.get('type')} ===")

        # Send to WebSocket clients
        if self._ws_manager:
            try:
                await self._ws_manager.send_personal_message({
                    "type": "notification:new",
                    "data": notification_data
                }, user_id)
                logger.info(f"Sent notification to WebSocket user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send notification to WebSocket: {e}")

        # Send to Socket.IO clients directly to the user's sids
        if self._socketio_server and self._socketio_manager:
            try:
                sids = self._socketio_manager.get_user_sids(user_id)
                for sid in sids:
                    await self._socketio_server.emit('notification:new', notification_data, to=sid)
                    logger.info(f"Sent notification to Socket.IO sid {sid} (user {user_id})")
            except Exception as e:
                logger.error(f"Failed to send notification to Socket.IO: {e}")

    def _normalize_message_data(self, data: dict) -> dict:
        """
        Normalize message data to use camelCase for all clients.
        Both web and mobile will use camelCase consistently.
        """
        # Map snake_case fields to camelCase
        field_mappings = {
            'conversation_id': 'conversationId',
            'sender_id': 'senderId',
            'sender_name': 'senderName',
            'created_at': 'timestamp',  # Use timestamp consistently
            'temp_id': 'tempId',
            'reply_to': 'replyTo',
            'reply_to_id': 'replyToId',
            'reply_to_content': 'replyToContent',
            'reply_to_sender_name': 'replyToSenderName',
            'reply_to_sender_id': 'replyToSenderId',
        }

        normalized = {}
        for key, value in data.items():
            # Convert snake_case key to camelCase if mapping exists
            new_key = field_mappings.get(key, key)
            normalized[new_key] = value

        # Ensure timestamp exists
        if 'timestamp' not in normalized and 'createdAt' in normalized:
            normalized['timestamp'] = normalized['createdAt']

        return normalized


# Global singleton instance
broadcast_service = UnifiedBroadcastService()
