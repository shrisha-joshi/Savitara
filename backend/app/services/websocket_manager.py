"""
WebSocket Connection Manager for Real-time Communication
"""
from typing import Dict, List, Set, Optional, Callable, Awaitable
from fastapi import WebSocket
from datetime import datetime
import json
import logging
import asyncio
import redis.asyncio as redis
from redis.exceptions import RedisError
from app.core.config import settings
from app.utils.logging_config import get_correlation_id, set_correlation_id

logger = logging.getLogger(__name__)

# MON-02: Prometheus metrics for active WebSocket connections
try:
    from prometheus_client import Counter, Gauge, Histogram

    WS_ACTIVE_CONNECTIONS = Gauge(
        "savitara_ws_active_connections",
        "Number of currently active WebSocket connections",
    )
    WS_CONNECT_TOTAL = Counter(
        "savitara_ws_connect_total",
        "Total WebSocket connection attempts",
    )
    WS_DISCONNECT_TOTAL = Counter(
        "savitara_ws_disconnect_total",
        "Total WebSocket disconnections",
    )
    WS_MESSAGES_SENT = Counter(
        "savitara_ws_messages_sent_total",
        "Total WebSocket messages sent to clients",
    )
    _METRICS_ENABLED = True
except ImportError:  # pragma: no cover
    _METRICS_ENABLED = False
    logger.warning("prometheus_client not installed — WS metrics disabled")


class RedisRealtimeTransport:
    """Encapsulates Redis Pub/Sub + offline queue concerns for WebSocket delivery."""

    def __init__(self) -> None:
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self.listener_task: Optional[asyncio.Task] = None

    async def connect(self) -> None:
        if self.redis_client:
            return

        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.pubsub = self.redis_client.pubsub()
        await self.pubsub.subscribe("system:heartbeat")

    async def _process_pubsub_message(
        self,
        message: dict,
        dispatch_user_message: Callable[[str, dict], Awaitable[None]],
    ) -> None:
        if message.get("type") != "message":
            return

        raw_data = message.get("data")
        try:
            data = json.loads(raw_data)
        except json.JSONDecodeError:
            logger.error("Failed to decode Redis message: %s", raw_data)
            return

        channel = message.get("channel", "")
        if channel.startswith("user:"):
            await dispatch_user_message(channel, data)

    def start_listener(
        self,
        dispatch_user_message: Callable[[str, dict], Awaitable[None]],
    ) -> None:
        if not self.pubsub or self.listener_task:
            return

        async def _listen() -> None:
            if not self.pubsub:
                return
            try:
                async for message in self.pubsub.listen():
                    await self._process_pubsub_message(message, dispatch_user_message)
            except (RedisError, RuntimeError) as exc:
                logger.error("Redis listener error: %s", exc)
            except Exception:
                logger.exception("Unexpected Redis listener failure")

        self.listener_task = asyncio.create_task(_listen())

    async def subscribe_user(self, user_id: str) -> None:
        if self.pubsub:
            await self.pubsub.subscribe(f"user:{user_id}")

    async def unsubscribe_user(self, user_id: str) -> None:
        if self.pubsub:
            await self.pubsub.unsubscribe(f"user:{user_id}")

    async def publish_user_message(self, user_id: str, message_str: str) -> int:
        if not self.redis_client:
            return 0
        return await self.redis_client.publish(f"user:{user_id}", message_str)

    async def queue_offline_message(self, user_id: str, message_str: str) -> None:
        if not self.redis_client:
            return
        queue_key = f"offline_queue:{user_id}"
        await self.redis_client.rpush(queue_key, message_str)
        await self.redis_client.expire(queue_key, 86400 * 7)

    async def get_offline_messages(self, user_id: str) -> list[str]:
        if not self.redis_client:
            return []
        return await self.redis_client.lrange(f"offline_queue:{user_id}", 0, -1)

    async def clear_offline_messages(self, user_id: str) -> None:
        if self.redis_client:
            await self.redis_client.delete(f"offline_queue:{user_id}")


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
        self._transport = RedisRealtimeTransport()

    @property
    def redis_client(self) -> Optional[redis.Redis]:
        return self._transport.redis_client

    @redis_client.setter
    def redis_client(self, value: Optional[redis.Redis]) -> None:
        self._transport.redis_client = value

    @property
    def pubsub(self) -> Optional[redis.client.PubSub]:
        return self._transport.pubsub

    @pubsub.setter
    def pubsub(self, value: Optional[redis.client.PubSub]) -> None:
        self._transport.pubsub = value

    @property
    def listener_task(self) -> Optional[asyncio.Task]:
        return self._transport.listener_task

    @listener_task.setter
    def listener_task(self, value: Optional[asyncio.Task]) -> None:
        self._transport.listener_task = value

    def _log_event(self, event: str, **fields) -> None:
        """Emit a structured WebSocket event log (lightweight, no metrics backend)."""
        try:
            logger.info("ws_event", extra={"ws": {"event": event, **fields}})
        except Exception:
            # Never fail the main flow due to logging
            logger.debug(f"ws_event {event} {fields}")

    async def connect_redis(self):
        """Initialize Redis connection for Pub/Sub"""
        try:
            await self._transport.connect()
            self._transport.start_listener(self._handle_user_message)
            logger.info("WebSocket Manager connected to Redis")
            self._log_event("redis_connected")
        except RedisError as e:
            logger.error(f"Failed to connect WebSocket Manager to Redis: {e}")
            self._log_event("redis_connect_failed", error=str(e))
        except Exception:
            logger.exception("Unexpected Redis connection failure")
            self._log_event("redis_connect_failed", error="unexpected_error")

    async def _handle_user_message(self, channel: str, data: dict) -> None:
        """Handle a message for a specific user channel"""
        user_id = channel.split(":", 1)[1]
        websocket = self.active_connections.get(user_id)

        if websocket:
            try:
                await websocket.send_json(data)
            except RuntimeError as e:
                logger.error(f"Error sending to {user_id}: {e}")
                self._log_event("deliver_failed", user_id=user_id, error=str(e))
            except Exception:
                logger.exception("Unexpected websocket send failure for user %s", user_id)
                self._log_event("deliver_failed", user_id=user_id, error="unexpected_error")

    async def connect(self, user_id: str, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket

        if _METRICS_ENABLED:
            WS_CONNECT_TOTAL.inc()
            WS_ACTIVE_CONNECTIONS.set(len(self.active_connections))

        if self.pubsub:
            # Subscribe to this user's channel on Redis
            await self._transport.subscribe_user(user_id)
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
        if not self.redis_client:
            return

        messages = await self._transport.get_offline_messages(user_id)
        if not messages:
            logger.debug(f"No offline messages for {user_id}")
            return

        await self._deliver_offline_messages(user_id, messages)
        await self._transport.clear_offline_messages(user_id)
        logger.info(f"Delivered {len(messages)} offline messages to {user_id}")
        self._log_event("offline_delivered", user_id=user_id, count=len(messages))

    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected.")
            self._log_event("disconnect", user_id=user_id, connections=len(self.active_connections))

            if _METRICS_ENABLED:
                WS_DISCONNECT_TOTAL.inc()
                WS_ACTIVE_CONNECTIONS.set(len(self.active_connections))

        if self.pubsub:
            # Unsubscribe in background
            try:
                loop = asyncio.get_event_loop()
                loop.create_task(self._transport.unsubscribe_user(user_id))
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

        enriched = dict(message)
        correlation_id = enriched.get("correlation_id") or get_correlation_id()
        if correlation_id:
            enriched["correlation_id"] = correlation_id

        if not self.redis_client:
            return await self._deliver_local(user_id, enriched)

        message_str = json.dumps(enriched)
        return await self._deliver_via_redis(user_id, enriched, message_str)

    async def _deliver_offline_messages(self, user_id: str, messages: list[str]) -> None:
        websocket = self.active_connections.get(user_id)
        if not websocket:
            return

        for msg_str in messages:
            try:
                await websocket.send_json(json.loads(msg_str))
            except json.JSONDecodeError as exc:
                logger.error("Invalid queued message payload for %s: %s", user_id, exc)
            except RuntimeError as exc:
                logger.error("Offline queue delivery runtime error for %s: %s", user_id, exc)
            except Exception:
                logger.exception("Unexpected error while delivering offline queue for %s", user_id)

    async def _deliver_local(self, user_id: str, message: dict) -> str:
        websocket = self.active_connections.get(user_id)
        if not websocket:
            return "queued"
        try:
            await websocket.send_json(message)
            logger.debug(f"WS local delivery to {user_id}")
            self._log_event("local", user_id=user_id)
            return "local"
        except RuntimeError as exc:
            logger.error("Failed local WS delivery for %s: %s", user_id, exc)
            self._log_event("local_failed", user_id=user_id, error=str(exc))
            self.disconnect(user_id)
        except Exception:
            logger.exception("Unexpected local message delivery failure for %s", user_id)
            self._log_event("local_failed", user_id=user_id, error="unexpected_error")
        return "queued"

    async def _deliver_via_redis(self, user_id: str, message: dict, message_str: str) -> str:
        try:
            subscriber_count = await self._transport.publish_user_message(user_id, message_str)
            if subscriber_count > 0:
                self._log_event("delivered", user_id=user_id, channel=f"user:{user_id}")
                if _METRICS_ENABLED:
                    WS_MESSAGES_SENT.inc()
                return "delivered"

            await self._transport.queue_offline_message(user_id, message_str)
            logger.info(f"WS queued message for offline user {user_id}")
            self._log_event("queued", user_id=user_id, channel=f"user:{user_id}")
            return "queued"
        except RedisError as exc:
            logger.error("Redis publish error for %s: %s", user_id, exc)
            self._log_event("publish_error", user_id=user_id, error=str(exc))
            return await self._deliver_local_fallback(user_id, message)
        except Exception:
            logger.exception("Unexpected delivery pipeline failure for %s", user_id)
            return "queued"

    async def _deliver_local_fallback(self, user_id: str, message: dict) -> str:
        websocket = self.active_connections.get(user_id)
        if not websocket:
            return "queued"
        try:
            await websocket.send_json(message)
            self._log_event("local_fallback", user_id=user_id)
            return "local"
        except RuntimeError as exc:
            logger.error("WS local fallback failed for %s: %s", user_id, exc)
            self._log_event("local_fallback_failed", user_id=user_id, error=str(exc))
        except Exception:
            logger.exception("Unexpected local fallback failure for %s", user_id)
            self._log_event("local_fallback_failed", user_id=user_id, error="unexpected_error")
        return "queued"

    async def emit_to_user(
        self,
        user_id: str,
        event: str,
        payload: Optional[dict] = None,
    ) -> str:
        """Backward-compatible event emitter wrapper for legacy services/tests."""
        message = {
            "type": event,
            **(payload or {}),
            "timestamp": datetime.now().isoformat(),
        }
        return await self.send_personal_message(user_id, message)

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

    def join_room(self, room_id: str, user_id: str):
        """Add user to a room.

        Signature kept as (room_id, user_id) to match existing tests/callers.
        """
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(user_id)
        logger.info(f"User {user_id} joined room {room_id}")

    def leave_room(self, room_id: str, user_id: str):
        """Remove user from a room.

        Signature kept as (room_id, user_id) to match existing tests/callers.
        """
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

    async def broadcast_to_room(self, room_id: str, message: dict, exclude: List[str] = None):
        """Backward-compatible alias used by older tests/callers."""
        await self.send_to_room(room_id, message, exclude)

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


async def handle_read_receipt(user_id: str, data: dict):
    """Handle explicit read receipts from clients."""
    receiver_id = data.get("receiver_id")
    if not receiver_id:
        return
    await manager.send_personal_message(
        receiver_id,
        {
            "type": "message_read",
            "conversation_id": data.get("conversation_id"),
            "message_id": data.get("message_id"),
            "read_by": user_id,
            "read_at": datetime.now().isoformat(),
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
    "typing": handle_typing_indicator,
    "booking_update": handle_booking_update,
    "read_receipt": handle_read_receipt,
    "ping": handle_ping,
}


async def process_websocket_message(user_id: str, message: dict):
    """Process incoming WebSocket message"""
    incoming_corr = message.get("correlation_id")
    if isinstance(incoming_corr, str) and incoming_corr.strip():
        set_correlation_id(incoming_corr.strip())

    message_type = message.get("type")

    if not message_type:
        logger.warning("Dropped WS message with no type")
        return

    handler = MESSAGE_HANDLERS.get(message_type)
    if handler:
        try:
            await handler(user_id, message)
        except (ValueError, RuntimeError) as exc:
            logger.error(f"WS handler error for {message_type}: {exc}")
        except Exception:
            logger.exception("Unexpected WS handler error for %s", message_type)
    else:
        logger.warning(f"Unknown message type: {message_type}")

    set_correlation_id("")
