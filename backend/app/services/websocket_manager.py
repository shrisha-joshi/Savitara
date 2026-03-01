"""
WebSocket Connection Manager for Real-time Communication
"""
from typing import Dict, List, Set, Optional
from fastapi import WebSocket
from datetime import datetime
import json
import logging
import asyncio
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time features using Redis Pub/Sub.

    Architecture:
    - Persistence: MongoDB (handled by services)
    - Real-time: Redis Pub/Sub
    - Offline Queue: Redis Lists
    """

    def __init__(self):
        # User ID -> WebSocket mapping (Local to this instance)
        self.active_connections: Dict[str, WebSocket] = {}

        # Room-based connections (for group features)
        self.rooms: Dict[str, Set[str]] = {}

        # Redis Client for publishing
        self.redis_client: Optional[redis.Redis] = None

        # Redis PubSub for subscribing
        self.pubsub: Optional[redis.client.PubSub] = None

        # Background task for listening to Redis
        self.listener_task: Optional[asyncio.Task] = None

    def _log_event(self, event: str, **fields) -> None:
        """Emit a structured WebSocket event log (lightweight, no metrics backend)."""
        try:
            logger.info("ws_event", extra={"ws": {"event": event, **fields}})
        except Exception:
            # Never fail the main flow due to logging
            logger.debug(f"ws_event {event} {fields}")

    async def connect_redis(self):
        """Initialize Redis connection for Pub/Sub"""
        if self.redis_client:
            return  # Already connected

        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
            self.pubsub = self.redis_client.pubsub()

            # Subscribe to a default channel to ensure pubsub is initialized (async operation)
            await self.pubsub.subscribe("system:heartbeat")

            # Start the listener loop in background
            self.listener_task = asyncio.create_task(self._redis_listener())
            logger.info("WebSocket Manager connected to Redis")
            self._log_event("redis_connected")
        except Exception as e:
            logger.error(f"Failed to connect WebSocket Manager to Redis: {e}")
            self._log_event("redis_connect_failed", error=str(e))

    async def _handle_user_message(self, channel: str, data: dict) -> None:
        """Handle a message for a specific user channel"""
        user_id = channel.split(":", 1)[1]
        websocket = self.active_connections.get(user_id)

        if websocket:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Error sending to {user_id}: {e}")
                self._log_event("deliver_failed", user_id=user_id, error=str(e))

    def _parse_message_data(self, data_str: str) -> Optional[dict]:
        """Parse JSON message data, return None on failure"""
        try:
            return json.loads(data_str)
        except json.JSONDecodeError:
            logger.error(f"Failed to decode Redis message: {data_str}")
            return None

    async def _redis_listener(self):
        """Continuously listen for Redis messages and dispatch to local websockets"""
        if not self.pubsub:
            return

        try:
            async for message in self.pubsub.listen():
                if message["type"] != "message":
                    continue

                data = self._parse_message_data(message["data"])
                if not data:
                    continue

                channel = message["channel"]
                if channel.startswith("user:"):
                    await self._handle_user_message(channel, data)

        except Exception as e:
            logger.error(f"Redis listener error: {e}")
            self._log_event("redis_listener_error", error=str(e))

    async def connect(self, user_id: str, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket

        if self.pubsub:
            # Subscribe to this user's channel on Redis
            await self.pubsub.subscribe(f"user:{user_id}")
            # Check Offline Queue
            await self.check_offline_queue(user_id)

        logger.info(
            f"User {user_id} connected. Total local connections: {len(self.active_connections)}"
        )
        self._log_event(
            "connect",
            user_id=user_id,
            connections=len(self.active_connections),
            has_redis=bool(self.redis_client),
        )

        # Send connection confirmation
        await self.send_personal_message(
            user_id,
            {
                "type": "connection_established",
                "message": "Connected to Savitara real-time service",
                "timestamp": datetime.now().isoformat(),
            },
        )

    async def check_offline_queue(self, user_id: str):
        """Deliver messages stored while user was offline"""
        queue_key = f"offline_queue:{user_id}"
        if not self.redis_client:
            return

        messages = await self.redis_client.lrange(queue_key, 0, -1)
        if messages:
            for msg_str in messages:
                try:
                    msg = json.loads(msg_str)
                    if user_id in self.active_connections:
                        await self.active_connections[user_id].send_json(msg)
                except Exception as e:
                    logger.error(f"Error checking offline queue for {user_id}: {e}")

            await self.redis_client.delete(queue_key)
            logger.info(f"Delivered {len(messages)} offline messages to {user_id}")
            self._log_event("offline_delivered", user_id=user_id, count=len(messages))
        else:
            logger.debug(f"No offline messages for {user_id}")

    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected.")
            self._log_event("disconnect", user_id=user_id, connections=len(self.active_connections))

        if self.pubsub:
            # Unsubscribe in background
            try:
                loop = asyncio.get_event_loop()
                loop.create_task(self.pubsub.unsubscribe(f"user:{user_id}"))
            except RuntimeError as e:
                # Event loop not running or other runtime errors
                logger.warning(f"Failed to unsubscribe user {user_id}: {e}")

        for room_users in self.rooms.values():
            room_users.discard(user_id)

    async def send_personal_message(self, user_id: str, message: dict) -> str:
        """Send message to specific user via Redis Pub/Sub.

        Returns delivery status: "delivered" (subscriber active), "queued" (offline),
        or "local" (no Redis, sent only to local connection). Emits lightweight logs for observability.
        """

        if not self.redis_client:
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_json(message)
                    logger.debug(f"WS local delivery to {user_id}")
                    self._log_event("local", user_id=user_id)
                    return "local"
                except Exception as e:
                    logger.error(f"Failed to send local message: {e}")
                    self._log_event("local_failed", user_id=user_id, error=str(e))
                    self.disconnect(user_id)
            return "queued"

        channel = f"user:{user_id}"
        message_str = json.dumps(message)

        try:
            # Publish returns number of clients subscribed
            subscriber_count = await self.redis_client.publish(channel, message_str)

            if subscriber_count == 0:
                # User offline
                await self.redis_client.rpush(f"offline_queue:{user_id}", message_str)
                await self.redis_client.expire(
                    f"offline_queue:{user_id}", 86400 * 7
                )  # 7 days
                logger.info(f"WS queued message for offline user {user_id}")
                self._log_event("queued", user_id=user_id, channel=channel)
                return "queued"

            logger.debug(f"WS delivered to {user_id} via Redis pubsub")
            self._log_event("delivered", user_id=user_id, channel=channel)
            return "delivered"

        except Exception as e:
            logger.error(f"Redis publish error: {e}")
            self._log_event("publish_error", user_id=user_id, error=str(e))
            # Fallback local check
            if user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_json(message)
                    logger.debug(f"WS local fallback delivery to {user_id}")
                    self._log_event("local_fallback", user_id=user_id)
                    return "local"
                except Exception as e2:  # noqa: BLE001
                    logger.error(f"WS local fallback failed for {user_id}: {e2}")
                    self._log_event("local_fallback_failed", user_id=user_id, error=str(e2))
            return "queued"

    async def broadcast(self, message: dict, exclude: List[str] = None):
        """Broadcast message to all connected users (Local Implementation for Phase 2)"""
        exclude = exclude or []
        disconnected = []

        # Ideally: Publish to 'broadcast' channel
        for user_id, connection in self.active_connections.items():
            if user_id not in exclude:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {user_id}: {e}")
                    disconnected.append(user_id)

        for user_id in disconnected:
            self.disconnect(user_id)

    def join_room(self, user_id: str, room_id: str):
        """Add user to a room"""
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(user_id)
        logger.info(f"User {user_id} joined room {room_id}")

    def leave_room(self, user_id: str, room_id: str):
        """Remove user from a room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            logger.info(f"User {user_id} left room {room_id}")

    async def send_to_room(
        self, room_id: str, message: dict, exclude: List[str] = None
    ):
        """Send message to all users in a room"""
        if room_id not in self.rooms:
            return

        exclude = exclude or []
        for user_id in self.rooms[room_id]:
            if user_id not in exclude:
                await self.send_personal_message(user_id, message)

    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently connected (Local)"""
        return user_id in self.active_connections

    def get_online_users(self) -> List[str]:
        """Get list of all online users (Local)"""
        return list(self.active_connections.keys())

    def get_room_users(self, room_id: str) -> List[str]:
        """Get list of users in a room (Local)"""
        return list(self.rooms.get(room_id, set()))


# Global connection manager instance
manager = ConnectionManager()


# Message type handlers
async def handle_chat_message(user_id: str, data: dict):
    """Handle incoming chat message"""
    receiver_id = data.get("receiver_id")
    conversation_id = data.get("conversation_id")
    content = data.get("content")

    message = {
        "type": "new_message",
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    }

    # Send to receiver and capture delivery status
    delivery_status = await manager.send_personal_message(receiver_id, message)

    # Send confirmation to sender with delivery status
    await manager.send_personal_message(
        user_id,
        {
            "type": "message_sent",
            "conversation_id": conversation_id,
            "delivery_status": delivery_status,
            "timestamp": datetime.now().isoformat(),
        },
    )


async def handle_typing_indicator(user_id: str, data: dict):
    """Handle typing indicator"""
    receiver_id = data.get("receiver_id")
    conversation_id = data.get("conversation_id")
    is_typing = data.get("is_typing", True)

    await manager.send_personal_message(
        receiver_id,
        {
            "type": "typing_indicator",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "is_typing": is_typing,
        },
    )


async def handle_booking_update(user_id: str, data: dict):
    """Handle booking status update"""
    booking_id = data.get("booking_id")
    status = data.get("status")

    # Notify both grihasta and acharya
    grihasta_id = data.get("grihasta_id")
    acharya_id = data.get("acharya_id")

    update_message = {
        "type": "booking_update",
        "booking_id": booking_id,
        "status": status,
        "grihasta_id": grihasta_id,
        "acharya_id": acharya_id,
        "initiator_id": user_id,
        "timestamp": datetime.now().isoformat(),
    }

    await manager.send_personal_message(grihasta_id, update_message)
    await manager.send_personal_message(acharya_id, update_message)


async def handle_ping(user_id: str, data: dict):
    """Respond to client heartbeat ping."""
    await manager.send_personal_message(
        user_id,
        {
            "type": "pong",
            "server_time": datetime.now().isoformat(),
        },
    )


# Message router
MESSAGE_HANDLERS = {
    "chat_message": handle_chat_message,
    "typing_indicator": handle_typing_indicator,
    "booking_update": handle_booking_update,
    "ping": handle_ping,
}


async def process_websocket_message(user_id: str, message: dict):
    """Process incoming WebSocket message"""
    message_type = message.get("type")

    if not message_type:
        logger.warning("Dropped WS message with no type")
        return

    handler = MESSAGE_HANDLERS.get(message_type)
    if handler:
        try:
            await handler(user_id, message)
        except Exception as exc:  # noqa: BLE001
            logger.error(f"WS handler error for {message_type}: {exc}")
    else:
        logger.warning(f"Unknown message type: {message_type}")
