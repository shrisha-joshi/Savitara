"""
WebSocket Connection Manager for Real-time Communication
"""
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time features:
    - Chat messages
    - Booking updates
    - Notifications
    - Live status updates
    """
    
    def __init__(self):
        # User ID -> WebSocket mapping
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Room-based connections (for group features)
        self.rooms: Dict[str, Set[str]] = {}
    
    async def connect(self, user_id: str, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
        
        # Send connection confirmation
        await self.send_personal_message(user_id, {
            "type": "connection_established",
            "message": "Connected to Savitara real-time service",
            "timestamp": datetime.now().isoformat()
        })
    
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
        
        # Remove from all rooms
        for room_users in self.rooms.values():
            room_users.discard(user_id)
    
    async def send_personal_message(self, user_id: str, message: dict):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                logger.debug(f"Sent message to {user_id}: {message.get('type')}")
            except Exception as e:
                logger.error(f"Failed to send message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast(self, message: dict, exclude: List[str] = None):
        """Broadcast message to all connected users"""
        exclude = exclude or []
        disconnected = []
        
        for user_id, connection in self.active_connections.items():
            if user_id not in exclude:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {user_id}: {e}")
                    disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            self.disconnect(user_id)
    
    async def join_room(self, user_id: str, room_id: str):
        """Add user to a room (e.g., conversation room)"""
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(user_id)
        logger.info(f"User {user_id} joined room {room_id}")
    
    async def leave_room(self, user_id: str, room_id: str):
        """Remove user from a room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            logger.info(f"User {user_id} left room {room_id}")
    
    async def send_to_room(self, room_id: str, message: dict, exclude: List[str] = None):
        """Send message to all users in a room"""
        if room_id not in self.rooms:
            return
        
        exclude = exclude or []
        for user_id in self.rooms[room_id]:
            if user_id not in exclude:
                await self.send_personal_message(user_id, message)
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user is currently connected"""
        return user_id in self.active_connections
    
    def get_online_users(self) -> List[str]:
        """Get list of all online users"""
        return list(self.active_connections.keys())
    
    def get_room_users(self, room_id: str) -> List[str]:
        """Get list of users in a room"""
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
        "timestamp": datetime.now().isoformat()
    }
    
    # Send to receiver if online
    await manager.send_personal_message(receiver_id, message)
    
    # Send confirmation to sender
    await manager.send_personal_message(user_id, {
        "type": "message_sent",
        "conversation_id": conversation_id,
        "timestamp": datetime.now().isoformat()
    })


async def handle_typing_indicator(user_id: str, data: dict):
    """Handle typing indicator"""
    receiver_id = data.get("receiver_id")
    conversation_id = data.get("conversation_id")
    is_typing = data.get("is_typing", True)
    
    await manager.send_personal_message(receiver_id, {
        "type": "typing_indicator",
        "conversation_id": conversation_id,
        "user_id": user_id,
        "is_typing": is_typing
    })


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
        "timestamp": datetime.now().isoformat()
    }
    
    await manager.send_personal_message(grihasta_id, update_message)
    await manager.send_personal_message(acharya_id, update_message)


# Message router
MESSAGE_HANDLERS = {
    "chat_message": handle_chat_message,
    "typing_indicator": handle_typing_indicator,
    "booking_update": handle_booking_update,
}


async def process_websocket_message(user_id: str, message: dict):
    """Process incoming WebSocket message"""
    message_type = message.get("type")
    
    if message_type in MESSAGE_HANDLERS:
        await MESSAGE_HANDLERS[message_type](user_id, message)
    else:
        logger.warning(f"Unknown message type: {message_type}")
