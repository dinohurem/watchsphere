"""
WebSocket Manager for real-time chat functionality.
Handles connection management, message broadcasting, and presence tracking.
"""

from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for chat functionality."""

    def __init__(self):
        # Map of user_id -> set of WebSocket connections (supports multiple devices)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map of conversation_id -> set of user_ids
        self.conversation_members: Dict[str, Set[str]] = {}
        # Map of user_id -> user info (name, etc.)
        self.user_info: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, user_name: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)
        self.user_info[user_id] = {"name": user_name, "connected_at": datetime.utcnow()}

        logger.info(f"WebSocket CONNECT: User '{user_id}' ({user_name}) connected")
        logger.info(f"WebSocket CONNECT: All active user IDs: {list(self.active_connections.keys())}")

        # Notify others that user is online
        await self.broadcast_presence(user_id, online=True)

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)

            # If no more connections for this user, remove entirely
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.user_info:
                    del self.user_info[user_id]
                logger.info(f"User {user_id} fully disconnected from WebSocket")

    def is_user_online(self, user_id: str) -> bool:
        """Check if a user has any active connections."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_users(self) -> Set[str]:
        """Get all currently online user IDs."""
        return set(self.active_connections.keys())

    async def send_personal_message(self, message: dict, user_id: str):
        """Send a message to a specific user (all their devices)."""
        logger.info(f"WebSocket: Attempting to send to user {user_id}, active connections: {list(self.active_connections.keys())}")
        if user_id in self.active_connections:
            dead_connections = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                    logger.info(f"WebSocket: Successfully sent message to user {user_id}")
                except Exception as e:
                    logger.error(f"Error sending to user {user_id}: {e}")
                    dead_connections.add(connection)

            # Clean up dead connections
            for conn in dead_connections:
                self.active_connections[user_id].discard(conn)
        else:
            logger.warning(f"WebSocket: User {user_id} not found in active connections")

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        message: dict,
        exclude_user_id: Optional[str] = None,
        participant_ids: Optional[list] = None
    ):
        """Broadcast a message to all users in a conversation.

        Args:
            conversation_id: The conversation ID
            message: The message to broadcast
            exclude_user_id: Optional user ID to exclude from broadcast
            participant_ids: Optional list of participant IDs to broadcast to directly
                            (used when users haven't explicitly joined the room)
        """
        logger.info(f"WebSocket broadcast_to_conversation: conv={conversation_id}")
        logger.info(f"WebSocket broadcast_to_conversation: exclude_user_id={exclude_user_id}")
        logger.info(f"WebSocket broadcast_to_conversation: participant_ids={participant_ids}")
        logger.info(f"WebSocket broadcast_to_conversation: active_connections={list(self.active_connections.keys())}")
        logger.info(f"WebSocket broadcast_to_conversation: conversation_members={self.conversation_members}")

        notified_users = set()

        # First, send to users who have joined the conversation room
        if conversation_id in self.conversation_members:
            for user_id in self.conversation_members[conversation_id]:
                if user_id != exclude_user_id:
                    logger.info(f"WebSocket: Sending to room member {user_id}")
                    await self.send_personal_message(message, user_id)
                    notified_users.add(user_id)

        # Then, also send directly to all participants (if provided)
        # This ensures delivery even if they haven't joined the room
        if participant_ids:
            for user_id in participant_ids:
                logger.info(f"WebSocket: Checking participant {user_id}, exclude={exclude_user_id}, notified={notified_users}")
                if user_id != exclude_user_id and user_id not in notified_users:
                    logger.info(f"WebSocket: Sending directly to participant {user_id}")
                    await self.send_personal_message(message, user_id)
                else:
                    logger.info(f"WebSocket: Skipped participant {user_id} (excluded or already notified)")

    async def broadcast_presence(self, user_id: str, online: bool):
        """Broadcast presence change to relevant users."""
        # Find all conversations this user is part of
        conversations_with_user = [
            conv_id for conv_id, members in self.conversation_members.items()
            if user_id in members
        ]

        # Notify all members of those conversations
        notified_users = set()
        for conv_id in conversations_with_user:
            for member_id in self.conversation_members.get(conv_id, set()):
                if member_id != user_id and member_id not in notified_users:
                    await self.send_personal_message({
                        "type": "user:presence",
                        "data": {
                            "user_id": user_id,
                            "online": online
                        }
                    }, member_id)
                    notified_users.add(member_id)

    def join_conversation(self, user_id: str, conversation_id: str):
        """Add a user to a conversation room."""
        if conversation_id not in self.conversation_members:
            self.conversation_members[conversation_id] = set()
        self.conversation_members[conversation_id].add(user_id)

    def leave_conversation(self, user_id: str, conversation_id: str):
        """Remove a user from a conversation room."""
        if conversation_id in self.conversation_members:
            self.conversation_members[conversation_id].discard(user_id)
            if not self.conversation_members[conversation_id]:
                del self.conversation_members[conversation_id]

    async def send_typing_indicator(
        self,
        conversation_id: str,
        user_id: str,
        user_name: str,
        is_typing: bool
    ):
        """Send typing indicator to conversation members."""
        # Using camelCase consistently for all platforms
        await self.broadcast_to_conversation(
            conversation_id,
            {
                "type": "typing",
                "data": {
                    "conversationId": conversation_id,
                    "userId": user_id,
                    "userName": user_name,
                    "isTyping": is_typing
                }
            },
            exclude_user_id=user_id
        )

    async def broadcast_new_message(
        self,
        conversation_id: str,
        message_data: dict,
        sender_id: str,
        participant_ids: Optional[list] = None
    ):
        """Broadcast a new message to all conversation members."""
        await self.broadcast_to_conversation(
            conversation_id,
            {
                "type": "message:new",
                "data": message_data
            },
            exclude_user_id=None,  # Include sender to confirm delivery
            participant_ids=participant_ids
        )

    async def broadcast_message_read(
        self,
        conversation_id: str,
        message_ids: list,
        reader_id: str
    ):
        """Broadcast read receipts to conversation members."""
        # Using camelCase consistently for all platforms
        await self.broadcast_to_conversation(
            conversation_id,
            {
                "type": "message:read",
                "data": {
                    "conversationId": conversation_id,
                    "messageIds": message_ids,
                    "readerId": reader_id
                }
            },
            exclude_user_id=reader_id
        )


# Global connection manager instance
manager = ConnectionManager()
