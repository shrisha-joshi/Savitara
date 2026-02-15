"""
Chat API Endpoints
Handles 1-to-1 messaging and open chat (24h expiry)
SonarQube: S5122 - Input validation with Pydantic
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from app.schemas.requests import (
    MessageSendRequest,
    MessageResponse,
    ConversationResponse,
    StandardResponse
)
from app.core.security import get_current_user, get_current_grihasta, get_current_acharya
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError
)
from app.db.connection import get_db
from app.models.database import Message, Conversation, UserRole
from slowapi.errors import RateLimitExceeded
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.core.config import settings
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])

import re

def sanitize_message_content(content: str) -> Tuple[str, bool]:
    """
    Production-grade contact information blocker
    Blocks: Indian/International phones, emails, obfuscated tricks, social handles, URLs
    Returns (sanitized_content, was_blocked)
    """
    # PRODUCTION PATTERNS - NO LOOPHOLES
    
    # 1. Indian phone numbers (comprehensive)
    # Matches all variations: +91, 91, spaces, dashes, brackets
    indian_phone = r'(?<!\d)(?:\+?91[\s\-]?)?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}(?!\d)'
    
    # 2. Indian phone with spaces (catches "98 7654 3210")
    indian_phone_spaced = r'(?<!\d)[6-9]\d[\s\-]\d{4}[\s\-]\d{4}(?!\d)'
    
    # 3. Indian landlines (optional but recommended)
    indian_landline = r'0\d{2,4}[\s\-]?\d{6,8}'
    
    # 4. International phone numbers (general)
    intl_phone = r'(?<!\d)\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{2,4}(?!\d)'
    
    # 5. Email addresses (all TLDs)
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    
    # 6. Obfuscated email tricks ("at", "dot")
    obfuscated_at = r'(?<!\S)(?:at|\[at\]|\(at\)|@)(?!\S)'
    obfuscated_dot = r'(?<!\S)(?:dot|\[dot\]|\(dot\)|\.)(?!\S)'
    
    # 7. Social handles and platforms
    # WhatsApp, Telegram, Instagram, Signal, etc.
    social_handles = r'(whatsapp|telegram|signal|instagram|insta|wa\.me|t\.me|instagr\.am)[\s:@]*[\d\w@./]+'
    
    # 8. URLs (comprehensive)
    url_pattern = r'(https?://|www\.|[a-zA-Z0-9-]+\.(com|net|org|in|ai|io|co|biz))'
    
    # COMBINED BLOCKING PATTERN
    block_patterns = [
        indian_phone,
        indian_phone_spaced,
        indian_landline,
        intl_phone,
        email_pattern,
        obfuscated_at,
        obfuscated_dot,
        social_handles,
        url_pattern
    ]
    
    for pattern in block_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            logger.warning(f"Contact info blocked - Pattern: {pattern[:30]}...")
            return "[Contact information removed - Please use in-app communication]", True
    
    return content, False


def _create_open_chat_message(sender_id: str, content: str) -> Tuple[Message, str]:
    """Create message for open chat"""
    message = Message(
        sender_id=sender_id,
        receiver_id=None,
        content=content,
        is_open_chat=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    return message, "open_chat"


async def _get_or_create_conversation(db, sender_id: str, receiver_id: str) -> str:
    """Get existing conversation or create new one"""
    participants = sorted([sender_id, receiver_id])
    conversation_doc = await db.conversations.find_one({
        "participants": participants,
        "is_open_chat": False
    })
    
    if not conversation_doc:
        conversation = Conversation(
            participants=participants,
            is_open_chat=False,
            last_message_at=datetime.now(timezone.utc)
        )
        result = await db.conversations.insert_one(conversation.model_dump(by_alias=True))
        return str(result.inserted_id)
    
    # Update last message time
    await db.conversations.update_one(
        {"_id": str(conversation_doc["_id"])},
        {"$set": {"last_message_at": datetime.now(timezone.utc)}}
    )
    return str(conversation_doc["_id"])


async def _create_one_to_one_message(db, sender_id: str, receiver_id: str, content: str) -> Tuple[Message, str]:
    """Create message for 1-to-1 chat"""
    conversation_id = await _get_or_create_conversation(db, sender_id, receiver_id)
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        is_open_chat=False
    )
    return message, conversation_id


async def _get_display_name(db, other_user: dict) -> str:
    """Get display name for a user based on their role"""
    if not other_user:
        return "User"
    
    user_role = other_user.get("role")
    user_id = str(other_user["_id"])
    
    if user_role == UserRole.ACHARYA.value:
        profile = await db.acharya_profiles.find_one({"user_id": user_id})
        return profile.get("name", "Acharya") if profile else "Acharya"
    
    if user_role == UserRole.GRIHASTA.value:
        profile = await db.grihasta_profiles.find_one({"user_id": user_id})
        return profile.get("name", "User") if profile else "User"
    
    return "User"


async def _enrich_conversation(db, conv: dict, user_id: str) -> dict:
    """Enrich a conversation with unread count, other user info, and last message"""
    conv_id = str(conv["_id"])
    
    # Count unread messages
    unread_count = await db.messages.count_documents({
        "conversation_id": conv_id,
        "receiver_id": user_id,
        "read": False
    })
    
    # Get other participant's info
    other_user_id = next((p for p in conv["participants"] if p != user_id), None)
    other_user = await db.users.find_one({"_id": other_user_id}) if other_user_id else None
    display_name = await _get_display_name(db, other_user)
    
    # Get last message
    last_message = await db.messages.find_one(
        {"conversation_id": conv_id},
        sort=[("created_at", -1)]
    )
    
    return {
        "id": conv_id,
        "other_user": {
            "id": str(other_user["_id"]),
            "name": display_name,
            "role": other_user["role"],
            "profile_picture": other_user.get("profile_picture")
        } if other_user else None,
        "last_message": {
            "content": last_message.get("content"),
            "created_at": last_message.get("created_at")
        } if last_message else None,
        "unread_count": unread_count,
        "last_message_at": conv["last_message_at"]
    }


async def _send_message_notification(db, conversation_doc: dict, current_user: dict, content: str, conversation_id: str):
    """Send push notification to message receiver"""
    if not conversation_doc:
        return
    
    try:
        # Find receiver
        receiver_id = next(
            (pid for pid in conversation_doc["participants"] if pid != current_user["id"]),
            None
        )
        
        if not receiver_id:
            return
        
        from app.services.notification_service import NotificationService
        notification_service = NotificationService()
        receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
        
        if receiver and receiver.get("fcm_token"):
            notification_service.send_notification(
                token=receiver["fcm_token"],
                title=f"Message from {current_user['full_name']}",
                body=content[:100],
                data={"type": "new_message", "conversation_id": conversation_id}
            )
    except Exception as e:
        logger.warning(f"Failed to send message notification: {e}")


def _handle_open_chat_message(sender_id: str, sender_role: str, content: str) -> Tuple[Message, str]:
    """Handle open chat message creation with permission check"""
    if sender_role != UserRole.ACHARYA.value:
        raise PermissionDeniedError(
            action="Post to open chat",
            details={"message": "Only Acharyas can post to open chat"}
        )
    return _create_open_chat_message(sender_id, content)


async def _handle_one_to_one_message(
    db: AsyncIOMotorDatabase,
    sender_id: str,
    receiver_id: Optional[str],
    content: str
) -> Tuple[Message, str, dict]:
    """Handle 1-to-1 message creation with validation"""
    if not receiver_id:
        raise InvalidInputError(
            message="receiver_id required for 1-to-1 chat",
            field="receiver_id"
        )
    
    receiver = await db.users.find_one({"_id": receiver_id})
    if not receiver:
        raise ResourceNotFoundError(
            resource_type="User",
            resource_id=receiver_id
        )
    
    # Sanitize message content
    sanitized_content, was_blocked = sanitize_message_content(content)
    
    if was_blocked:
        logger.warning(f"Contact sharing attempt blocked from user {sender_id}")
        await db.users.update_one(
            {"_id": ObjectId(sender_id)},
            {"$inc": {"contact_share_attempts": 1}}
        )

    message, conversation_id = await _create_one_to_one_message(
        db, sender_id, receiver_id, sanitized_content
    )
    conversation_doc = await db.conversations.find_one({"_id": conversation_id})
    
    return message, conversation_id, conversation_doc


@router.post(
    "/messages",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message",
    description="Send a message in 1-to-1 chat or open chat"
)
async def send_message(
    message_data: MessageSendRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Send message
    
    Types:
    - 1-to-1 chat: requires receiver_id, permanent
    - Open chat: no receiver_id, expires in 24 hours, only Grihastas can read
    """
    try:
        sender_id = current_user["id"]
        sender_role = current_user["role"]
        conversation_doc = None
        
        if message_data.is_open_chat:
            message, conversation_id = _handle_open_chat_message(
                sender_id, sender_role, message_data.content
            )
        else:
            message, conversation_id, conversation_doc = await _handle_one_to_one_message(
                db, sender_id, message_data.receiver_id, message_data.content
            )
        
        # Save message
        result = await db.messages.insert_one(message.model_dump(by_alias=True))
        message.id = str(result.inserted_id)
        
        # Broadcast real-time message via WebSocket
        try:
            ws_message = {
                "type": "new_message",
                "conversation_id": "open_chat" if message_data.is_open_chat else conversation_id,
                "sender_id": sender_id,
                "content": message_data.content,
                "timestamp": message.created_at.isoformat() if message.created_at else datetime.now().isoformat(),
                "id": str(message.id)
            }
            
            if message_data.is_open_chat:
                # For open chat, better to have a specific room/channel, 
                # but for now we rely on the specific open-chat pulling or global broadcast if envisioned.
                # Since open chat is high volume, we might skip global broadcast here 
                # unless a "room" concept is fully implemented.
                pass 
            else:
                # 1-to-1: Send to receiver
                await manager.send_personal_message(message_data.receiver_id, ws_message)
                
                # 1-to-1: Send to sender (so their other devices update)
                await manager.send_personal_message(sender_id, ws_message)
                
        except Exception as e:
            logger.error(f"Failed to broadcast real-time message: {e}") 
        
        # Send push notification for 1-to-1 messages
        if not message_data.is_open_chat:
            await _send_message_notification(db, conversation_doc, current_user, message_data.content, conversation_id)
        
        logger.info(f"Message sent from {sender_id} - Type: {'open' if message_data.is_open_chat else '1-to-1'}")
        
        return StandardResponse(
            success=True,
            data={
                "message_id": str(message.id),
                "conversation_id": "open_chat" if message_data.is_open_chat else conversation_id,
                "expires_at": message.expires_at.isoformat() if message.expires_at else None
            },
            message="Message sent successfully"
        )
        
    except (InvalidInputError, PermissionDeniedError, ResourceNotFoundError):
        raise
    except RateLimitExceeded:
        logger.warning(f"Rate limit exceeded for user {current_user.get('id', 'unknown')}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Message rate limit exceeded. Please wait a moment."
        )
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service momentarily unavailable. Please retry."
        )
    except Exception as e:
        logger.error(f"Send message critical error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
        )


from pydantic import BaseModel

class ConversationVerifyRequest(BaseModel):
    recipient_id: str

@router.post(
    "/verify-conversation",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or Create Conversation",
    description="Get existing conversation ID or create new one with recipient"
)
async def verify_conversation(
    request: ConversationVerifyRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get or create conversation with specific user"""
    try:
        sender_id = current_user["id"]
        receiver_id = request.recipient_id
        
        if sender_id == receiver_id:
                raise InvalidInputError(
                message="Cannot chat with yourself",
                field="recipient_id"
            )

        # Check if receiver exists
        receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
        if not receiver:
            raise ResourceNotFoundError(
                resource_type="User",
                resource_id=receiver_id
            )

        conversation_id = await _get_or_create_conversation(db, sender_id, receiver_id)
        
        return StandardResponse(
            success=True,
            data={"conversation_id": conversation_id}
        )
    except (InvalidInputError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(f"Verify conversation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify conversation"
        )


@router.get(
    "/conversations",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversations",
    description="Get all conversations for current user"
)
async def get_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user's conversations with unread count"""
    try:
        user_id = current_user["id"]
        
        # Get conversations where user is participant
        conversations = await db.conversations.find({
            "participants": user_id,
            "is_open_chat": False
        }).sort("last_message_at", -1).skip((page - 1) * limit).limit(limit).to_list(length=limit)
        
        # Enrich each conversation with metadata
        result_conversations = [
            await _enrich_conversation(db, conv, user_id)
            for conv in conversations
        ]
        
        # Get total count
        total_count = await db.conversations.count_documents({
            "participants": user_id,
            "is_open_chat": False
        })
        
        return StandardResponse(
            success=True,
            data={
                "conversations": result_conversations,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get conversations error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations"
        )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversation Messages",
    description="Get all messages in a conversation"
)
async def get_conversation_messages(
    conversation_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get messages from a specific conversation"""
    try:
        user_id = current_user["id"]
        
        # Verify user is participant
        conversation = await db.conversations.find_one({"_id": conversation_id})
        if not conversation:
            raise ResourceNotFoundError(
                resource_type="Conversation",
                resource_id=conversation_id
            )
        
        if user_id not in conversation["participants"]:
            raise PermissionDeniedError(
                action="View conversation",
                details={"message": "You are not a participant in this conversation"}
            )
        
        # Get messages
        messages = await db.messages.find({
            "conversation_id": conversation_id
        }).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(length=limit)
        
        # Mark messages as read
        await db.messages.update_many(
            {
                "conversation_id": conversation_id,
                "receiver_id": user_id,
                "read": False
            },
            {"$set": {"read": True}}
        )
        
        # Get total count
        total_count = await db.messages.count_documents({
            "conversation_id": conversation_id
        })
        
        return StandardResponse(
            success=True,
            data={
                "messages": messages,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Get messages error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages"
        )


@router.get(
    "/open-chat",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Open Chat Messages",
    description="Get all active open chat messages (Grihasta only)"
)
async def get_open_chat_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_grihasta),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get open chat messages
    
    Only Grihastas can read open chat
    Messages expire after 24 hours
    """
    try:
        # Get non-expired messages
        messages = await db.messages.find({
            "is_open_chat": True,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(length=limit)
        
        # Populate Acharya info
        result_messages = []
        for msg in messages:
            # Get Acharya profile
            acharya_profile = await db.acharya_profiles.find_one({"user_id": msg["sender_id"]})
            
            result_messages.append({
                "id": str(msg["_id"]),
                "content": msg["content"],
                "created_at": msg["created_at"],
                "expires_at": msg["expires_at"],
                "acharya": {
                    "id": msg["sender_id"],
                    "name": acharya_profile.get("name") if acharya_profile else "Anonymous",
                    "parampara": acharya_profile.get("parampara") if acharya_profile else None,
                    "rating": acharya_profile.get("rating", 0.0) if acharya_profile else 0.0
                }
            })
        
        # Get total count (non-expired only)
        total_count = await db.messages.count_documents({
            "is_open_chat": True,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        
        return StandardResponse(
            success=True,
            data={
                "messages": result_messages,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
        )
        
    except Exception as e:
        logger.error(f"Get open chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch open chat messages"
        )


@router.delete(
    "/messages/{message_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Message",
    description="Delete a message (sender only)"
)
async def delete_message(
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Delete a message (soft delete - mark as deleted)"""
    try:
        user_id = current_user["id"]
        
        # Get message
        message = await db.messages.find_one({"_id": message_id})
        if not message:
            raise ResourceNotFoundError(
                resource_type="Message",
                resource_id=message_id
            )
        
        # Verify sender
        if message["sender_id"] != user_id:
            raise PermissionDeniedError(
                action="Delete message",
                details={"message": "You can only delete your own messages"}
            )
        
        # Soft delete
        await db.messages.update_one(
            {"_id": message_id},
            {"$set": {"content": "[Message deleted]", "deleted": True}}
        )
        
        logger.info(f"Message {message_id} deleted by user {user_id}")
        
        return StandardResponse(
            success=True,
            message="Message deleted successfully"
        )
        
    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Delete message error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message"
        )


@router.get(
    "/unread-count",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unread Message Count",
    description="Get total unread message count for current user"
)
async def get_unread_count(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get total unread message count"""
    try:
        user_id = current_user["id"]
        
        unread_count = await db.messages.count_documents({
            "receiver_id": user_id,
            "read": False
        })
        
        return StandardResponse(
            success=True,
            data={"unread_count": unread_count}
        )
        
    except Exception as e:
        logger.error(f"Get unread count error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread count"
        )
