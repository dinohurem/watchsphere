from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import json
from beanie import PydanticObjectId

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import connect_to_mongo, close_mongo_connection
from app.services.websocket import manager
from app.core.security import decode_access_token
from app.models.user import User
from app.models.chat import Conversation, Message, ConversationType

# Import Socket.IO manager
from app.services.socketio_manager import socket_app, sio as socketio_server, manager as socketio_manager

# Import unified broadcast service
from app.services.broadcast import broadcast_service

logger = logging.getLogger(__name__)

# Create FastAPI app
fastapi_app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="WatchSphere - Premium Watch Trading Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
# In development, allow all origins. In production, use settings.cors_origins
# Note: allow_origins=["*"] + allow_credentials=True is invalid per CORS spec,
# so in debug mode we use allow_origin_regex to match any origin instead.
if settings.DEBUG:
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

# GZip Middleware for response compression
fastapi_app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API router
fastapi_app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Initialize the unified broadcast service with both managers
broadcast_service.set_ws_manager(manager)
broadcast_service.set_socketio_server(socketio_server)
broadcast_service.set_socketio_manager(socketio_manager)


@fastapi_app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@fastapi_app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy"}


@fastapi_app.get("/debug/connections")
async def debug_connections():
    """Debug endpoint to check current WebSocket/Socket.IO connections"""
    from app.services.socketio_manager import manager as socketio_manager

    ws_users = list(manager.active_connections.keys())
    ws_conversation_members = {k: list(v) for k, v in manager.conversation_members.items()}

    sio_users = list(socketio_manager.user_to_sids.keys())
    sio_sids = {k: list(v) for k, v in socketio_manager.user_to_sids.items()}

    return {
        "websocket": {
            "connected_users": ws_users,
            "conversation_members": ws_conversation_members,
        },
        "socketio": {
            "connected_users": sio_users,
            "user_sids": sio_sids,
        }
    }


# ============== Native WebSocket Endpoint (for web clients) ==============

@fastapi_app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    WebSocket endpoint for real-time chat functionality.
    Connect with: ws://host/ws?token=<jwt_token>
    """
    logger.info(f"Native WebSocket: Connection attempt received")
    user_id = None
    user_name = None
    user_avatar = None

    try:
        # Verify token
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            logger.warning(f"Native WebSocket: Invalid token")
            await websocket.close(code=4001, reason="Invalid token")
            return

        user_id = payload["sub"]
        logger.info(f"Native WebSocket: Token valid for user {user_id}")

        user = await User.get(PydanticObjectId(user_id))
        if not user:
            logger.warning(f"Native WebSocket: User {user_id} not found")
            await websocket.close(code=4001, reason="User not found")
            return

        user_name = user.name
        user_avatar = user.profile_image_url or user.profile_image_thumbnail_url

        # Connect the user
        await manager.connect(websocket, user_id, user_name)
        logger.info(f"Native WebSocket: User {user_id} ({user_name}) connected successfully")

        # Send connection confirmation (wrapped in try-except for race conditions)
        try:
            await websocket.send_json({
                "type": "connection",
                "data": {"status": "connected", "user_id": user_id}
            })
        except Exception as e:
            logger.warning(f"Native WebSocket: Failed to send connection confirmation to {user_id}: {e}")
            # Client may have disconnected immediately, continue anyway

        # Handle incoming messages
        while True:
            data = await websocket.receive_json()
            await handle_websocket_message(websocket, user_id, user_name, user_avatar, data)

    except WebSocketDisconnect:
        logger.info(f"Native WebSocket: User {user_id} disconnected")
    except Exception as e:
        logger.error(f"Native WebSocket: Error for user {user_id}: {e}", exc_info=True)
    finally:
        if user_id:
            manager.disconnect(websocket, user_id)
            # Broadcast offline status
            await manager.broadcast_presence(user_id, online=False)


async def handle_websocket_message(
    websocket: WebSocket,
    user_id: str,
    user_name: str,
    user_avatar: str,
    data: dict
):
    """Handle incoming WebSocket messages."""
    message_type = data.get("type")
    payload = data.get("data", {})

    if message_type == "conversation:join":
        # Join a conversation room - support both camelCase and snake_case
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        if conversation_id:
            manager.join_conversation(user_id, conversation_id)
            await websocket.send_json({
                "type": "conversation:joined",
                "data": {"conversationId": conversation_id}
            })

    elif message_type == "conversation:leave":
        # Leave a conversation room
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        if conversation_id:
            manager.leave_conversation(user_id, conversation_id)

    elif message_type == "typing:start":
        # User started typing
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        if conversation_id:
            await manager.send_typing_indicator(
                conversation_id, user_id, user_name, is_typing=True
            )

    elif message_type == "typing:stop":
        # User stopped typing
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        if conversation_id:
            await manager.send_typing_indicator(
                conversation_id, user_id, user_name, is_typing=False
            )

    elif message_type == "message:send":
        # Send a new message
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        content = payload.get("content")
        temp_id = payload.get("tempId") or payload.get("temp_id")
        reply_to = payload.get("replyTo") or payload.get("reply_to")

        if conversation_id and content:
            try:
                # Get conversation to verify access
                conversation = await Conversation.get(PydanticObjectId(conversation_id))
                if not conversation or user_id not in conversation.participant_ids:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Conversation not found or access denied"}
                    })
                    return

                # Create and save message
                logger.info(f"WebSocket message_send: Creating message with conversation_id={conversation_id} (type: {type(conversation_id)})")
                message = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    content=content,
                    reply_to_id=reply_to,
                )
                await message.insert()
                logger.info(f"WebSocket message_send: Saved message with id={message.id}, conversation_id={message.conversation_id}")

                # Update conversation timestamp
                conversation.updated_at = message.created_at
                await conversation.save()

                # Prepare message data - using camelCase consistently for all platforms
                message_data = {
                    "id": str(message.id),
                    "conversationId": conversation_id,
                    "senderId": user_id,
                    "senderName": user_name,
                    "senderAvatar": user_avatar,
                    "content": content,
                    "type": "text",
                    "status": "sent",
                    "timestamp": message.created_at.isoformat(),
                    "replyTo": reply_to,
                    "tempId": temp_id,
                }

                # Use unified broadcast service to send to BOTH WebSocket and Socket.IO clients
                await broadcast_service.broadcast_message(
                    conversation_id, message_data, user_id,
                    participant_ids=conversation.participant_ids
                )

                # Broadcast unread count update to other participants
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

            except Exception as e:
                logger.error(f"Error sending message: {e}")
                await websocket.send_json({
                    "type": "message:failed",
                    "data": {"tempId": temp_id, "error": str(e)}
                })

    elif message_type == "messages:read":
        # Mark messages as read - support both camelCase and snake_case
        conversation_id = payload.get("conversationId") or payload.get("conversation_id")
        message_ids = payload.get("messageIds") or payload.get("message_ids", [])

        if conversation_id and message_ids:
            await manager.broadcast_message_read(
                conversation_id, message_ids, user_id
            )

    elif message_type == "ping":
        # Keep-alive ping
        await websocket.send_json({"type": "pong"})


# ============== Combined ASGI Application ==============
# Mount Socket.IO for mobile clients using socket.io-client
# The FastAPI app handles REST API and native WebSocket for web clients

# Create combined ASGI app that routes /socket.io to Socket.IO and everything else to FastAPI
from starlette.routing import Mount
from starlette.applications import Starlette

# The main 'app' that uvicorn will run
# Socket.IO will be available at /socket.io/ path
# FastAPI handles everything else including /ws for native WebSocket
async def startup():
    await connect_to_mongo()
    # Clean up any expired WTB/WTS GridFS files from previous runs
    try:
        from app.api.v1.endpoints.wtb_wts import _cleanup_all_expired
        await _cleanup_all_expired()
        logger.info("Startup: cleaned up expired WTB/WTS files")
    except Exception as e:
        logger.warning(f"Startup: failed to clean up expired files: {e}")

app = Starlette(
    routes=[
        Mount('/socket.io', app=socket_app),
        Mount('/', app=fastapi_app),
    ],
    on_startup=[startup],
    on_shutdown=[close_mongo_connection],
)

# Add CORS middleware to the outer Starlette app so preflight OPTIONS requests
# are handled before routing to FastAPI or Socket.IO sub-apps
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
