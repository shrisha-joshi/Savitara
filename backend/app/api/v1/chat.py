"""
Chat API Endpoints
Handles 1-to-1 messaging and open chat (24h expiry)
SonarQube: S5122 - Input validation with Pydantic
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any, Optional, Tuple
import logging
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from app.schemas.requests import MessageSendRequest, StandardResponse
from app.core.security import get_current_user, get_current_grihasta
from app.core.exceptions import (
    ResourceNotFoundError,
    InvalidInputError,
    PermissionDeniedError,
)
from app.db.connection import get_db
from app.models.database import Message, Conversation, UserRole
from slowapi.errors import RateLimitExceeded
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.services.websocket_manager import manager
from app.middleware.block_enforcement import BlockEnforcementMiddleware
import re
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


def sanitize_message_content(content: str) -> Tuple[str, bool]:
    """
    Production-grade contact information blocker
    Blocks: Indian/International phones, emails, obfuscated tricks, social handles, URLs
    Returns (sanitized_content, was_blocked)
    """
    # PRODUCTION PATTERNS - NO LOOPHOLES

    # 1. Indian phone numbers (comprehensive)
    # Matches all variations: +91, 91, spaces, dashes, brackets
    indian_phone = r"(?<!\d)(?:\+?91[\s\-]?)?[6-9]\d{2}[\s\-]?\d{3}[\s\-]?\d{4}(?!\d)"

    # 2. Indian phone with spaces (catches "98 7654 3210")
    indian_phone_spaced = r"(?<!\d)[6-9]\d[\s\-]\d{4}[\s\-]\d{4}(?!\d)"

    # 3. Indian landlines (optional but recommended)
    indian_landline = r"0\d{2,4}[\s\-]?\d{6,8}"

    # 4. International phone numbers (general)
    intl_phone = r"(?<!\d)\+\d{1,3}[\s\-]?\d{2,4}[\s\-]?\d{2,4}[\s\-]?\d{2,4}(?!\d)"

    # 5. Email addresses (all TLDs)
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

    # 6. Obfuscated "at" tricks — precision patterns to avoid false positives.
    #
    # OLD bad pattern `(?<!\S)(?:at|\[at\]|...)(?!\S)` matched ANY standalone word "at",
    # which flagged innocent messages like "Meet at 5pm" or "I was at the temple".
    #
    # NEW approach: require email-like context on BOTH sides of "at".

    # 6a. Full obfuscated email: "word AT word DOT tld"
    # Catches: "email at gmail dot com", "john at yahoo dot in"
    # Does NOT catch: "Meet at 5pm", "I was at the temple" (no trailing dot-TLD)
    _TLD = r"(?:com|net|org|in|io|co|biz|info|edu|gov|ai|app|dev|me|tech|uk|us|au|ca)"
    obfuscated_full_email = (
        r"\w[\w.%+-]*\s+(?:at|\[at\]|\(at\))\s+[a-zA-Z]\w*"
        r"\s+(?:dot|\[dot\]|\(dot\))\s+" + _TLD + r"\b"
    )

    # 6b. Obfuscated "at" where domain still has a literal dot-TLD:
    # Catches: "john at gmail.com", "me at savitara.in"
    # Does NOT catch: "Meet at 5pm" ("5pm" has no dot-TLD suffix)
    obfuscated_at_real_domain = (
        r"\w[\w.%+-]*\s+(?:at|\[at\]|\(at\))\s+[a-zA-Z]\w*\.[a-zA-Z]{2,}"
    )

    # 6c. Spaced @ symbol: "john @ gmail.com" — email_pattern won't catch the spaces
    spaced_at_symbol = r"[a-zA-Z0-9._%+-]\s+@\s+[a-zA-Z0-9]"

    # 6d. Generic social/contact @handle — @word not preceded by a word character
    # Catches: "@johndoe", "ping me @username"
    # Does NOT catch: "john@gmail.com" (@ preceded by word char; email_pattern covers it)
    social_at_handle = r"(?<!\w)@[a-zA-Z]\w*"

    # 7. Obfuscated "dot" — ONLY flag when it's a domain context (TLD follows).
    # OLD pattern matched standalone "dot" anywhere, e.g. "connecting the dots".
    # NEW pattern requires a recognised TLD to follow.
    # Catches: "gmail dot com", "yahoo dot co dot in"
    # Does NOT catch: ordinary "dot" in prose
    _TLD_DOT = r"(?:com|net|org|in|io|co|biz|info|edu|gov|ai|app|dev|me|tech|uk|us|au|ca)"
    obfuscated_dot = (
        r"[a-zA-Z0-9]\s+(?:dot|\[dot\]|\(dot\))\s+" + _TLD_DOT + r"\b"
    )

    # 7. Social handles and platforms
    # WhatsApp, Telegram, Instagram, Signal, etc.
    social_handles = r"(whatsapp|telegram|signal|instagram|insta|wa\.me|t\.me|instagr\.am)[\s:@]*[\d\w@./]+"

    # 8. URLs (comprehensive)
    url_pattern = r"(https?://|www\.|[a-zA-Z0-9-]+\.(com|net|org|in|ai|io|co|biz))"

    # COMBINED BLOCKING PATTERN
    block_patterns = [
        indian_phone,
        indian_phone_spaced,
        indian_landline,
        intl_phone,
        email_pattern,
        obfuscated_full_email,
        obfuscated_at_real_domain,
        spaced_at_symbol,
        social_at_handle,
        obfuscated_dot,
        social_handles,
        url_pattern,
    ]

    for pattern in block_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            logger.warning(f"Contact info blocked - Pattern: {pattern[:30]}...")
            return (
                "[Contact information removed - Please use in-app communication]",
                True,
            )

    return content, False


def _create_open_chat_message(sender_id: str, content: str) -> Tuple[Message, str]:
    """Create message for open chat"""
    message = Message(
        conversation_id=None,  # No specific conversation for open chat
        sender_id=ObjectId(sender_id),
        receiver_id=None,
        content=content,
        is_open_chat=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    return message, "open_chat"


async def _get_or_create_conversation(db, sender_id: str, receiver_id: str) -> str:
    """Get existing conversation or create new one"""
    # Convert to ObjectId for query because Pydantic stores them as ObjectIds
    try:
        sender_oid = ObjectId(sender_id)
        receiver_oid = ObjectId(receiver_id)
        participants_oids = sorted([sender_oid, receiver_oid])

        # Try finding with ObjectIds first (correct way)
        conversation_doc = await db.conversations.find_one(
            {"participants": participants_oids, "is_open_chat": False}
        )

        # Fallback to strings query if not found (legacy data)
        if not conversation_doc:
            participants_strs = sorted([str(sender_id), str(receiver_id)])
            conversation_doc = await db.conversations.find_one(
                {"participants": participants_strs, "is_open_chat": False}
            )

    except Exception:
        # Fallback if conversion fails
        participants = sorted([sender_id, receiver_id])
        conversation_doc = await db.conversations.find_one(
            {"participants": participants, "is_open_chat": False}
        )

    if not conversation_doc:
        # Create new one using ObjectIds if possible
        try:
            participants_for_create = sorted(
                [ObjectId(sender_id), ObjectId(receiver_id)]
            )
        except Exception:
            participants_for_create = sorted([sender_id, receiver_id])

        conversation = Conversation(
            participants=participants_for_create,
            is_open_chat=False,
            last_message_at=datetime.now(timezone.utc),
        )
        result = await db.conversations.insert_one(
            conversation.model_dump(by_alias=True, exclude={"id"})
        )
        return str(result.inserted_id)

    # Update last message time
    await db.conversations.update_one(
        {"_id": conversation_doc["_id"]},
        {"$set": {"last_message_at": datetime.now(timezone.utc)}},
    )
    return str(conversation_doc["_id"])


async def _create_one_to_one_message(
    db, sender_id: str, receiver_id: str, content: str
) -> Tuple[Message, str]:
    """Create message for 1-to-1 chat with block enforcement"""
    # Check if users have blocked each other
    block_enforcer = BlockEnforcementMiddleware(db)
    await block_enforcer.check_block_status(
        sender_id, receiver_id, action="send message"
    )

    conversation_id = await _get_or_create_conversation(db, sender_id, receiver_id)
    message = Message(
        conversation_id=ObjectId(conversation_id),
        sender_id=ObjectId(sender_id),
        receiver_id=ObjectId(receiver_id) if receiver_id else None,
        content=content,
        is_open_chat=False,
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


async def _count_unread_messages(db, conv_oid, conv_id: str, user_id: str, user_oid) -> int:
    """Count unread messages for a conversation."""
    unread_count = 0
    if user_oid:
        unread_count = await db.messages.count_documents(
            {"conversation_id": conv_oid, "receiver_id": user_oid, "read": False}
        )
    if unread_count == 0:
        unread_count = await db.messages.count_documents(
            {"conversation_id": conv_id, "receiver_id": user_id, "read": False}
        )
    return unread_count


async def _get_other_participant(db, conv: dict, user_id: str):
    """Get the other participant in a conversation."""
    other_user_id = next(
        (p for p in conv.get("participants", []) if str(p) != user_id), None
    )
    if not other_user_id:
        return None
    
    oid = (
        ObjectId(str(other_user_id))
        if ObjectId.is_valid(str(other_user_id))
        else None
    )
    if oid:
        other_user = await db.users.find_one({"_id": oid})
        if other_user:
            return other_user
    return await db.users.find_one({"_id": other_user_id})


async def _get_last_message(db, conv_oid, conv_id: str):
    """Get the last message for a conversation."""
    last_message = await db.messages.find_one(
        {"conversation_id": conv_oid}, sort=[("created_at", -1)]
    )
    if not last_message:
        last_message = await db.messages.find_one(
            {"conversation_id": conv_id}, sort=[("created_at", -1)]
        )
    
    if not last_message:
        return None
    
    return {
        "content": last_message.get("content"),
        "created_at": last_message.get("created_at"),
        "timestamp": last_message.get("created_at").isoformat()
        if last_message.get("created_at")
        else None,
    }


async def _get_conversation_settings(db, conv_id: str, user_id: str):
    """Get conversation settings for a user."""
    settings = await db.conversation_user_settings.find_one(
        {"conversation_id": conv_id, "user_id": user_id}
    )
    
    if not settings:
        return {
            "is_pinned": False,
            "pin_rank": None,
            "is_archived": False,
            "muted_until": None,
            "notifications_on": True,
            "last_read_at": None,
        }
    
    return {
        "is_pinned": settings.get("is_pinned", False),
        "pin_rank": settings.get("pin_rank"),
        "is_archived": settings.get("is_archived", False),
        "muted_until": settings.get("muted_until"),
        "notifications_on": settings.get("notifications_on", True),
        "last_read_at": settings.get("last_read_at"),
    }


async def _enrich_conversation(db, conv: dict, user_id: str) -> dict:
    """Enrich a conversation with unread count, other user info, last message, and settings"""
    conv_oid = conv["_id"]
    conv_id = str(conv_oid)
    user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None

    # Get conversation data using helper functions
    unread_count = await _count_unread_messages(db, conv_oid, conv_id, user_id, user_oid)
    other_user = await _get_other_participant(db, conv, user_id)
    last_msg_data = await _get_last_message(db, conv_oid, conv_id)
    settings_data = await _get_conversation_settings(db, conv_id, user_id)
    
    # Get display name for other user
    display_name = await _get_display_name(db, other_user)

    return {
        "id": conv_id,
        "_id": conv_id,
        "other_user": {
            "id": str(other_user["_id"]),
            "_id": str(other_user["_id"]),
            "name": display_name,
            "role": other_user.get("role"),
            "profile_picture": other_user.get("profile_picture"),
            "profile_image": other_user.get("profile_picture"),
        }
        if other_user
        else None,
        "last_message": last_msg_data,
        "unread_count": unread_count,
        "last_message_at": conv.get("last_message_at"),
        "participants": [str(p) for p in conv.get("participants", [])],
        **settings_data,  # Unpack settings dict
    }


async def _send_message_notification(
    db, conversation_doc: dict, current_user: dict, content: str, conversation_id: str
):
    """Send push notification to message receiver"""
    if not conversation_doc:
        return

    try:
        # Find receiver - compare as strings to handle ObjectId/string mix
        receiver_id = next(
            (
                pid
                for pid in conversation_doc["participants"]
                if str(pid) != current_user["id"]
            ),
            None,
        )

        if not receiver_id:
            return

        from app.services.notification_service import NotificationService

        notification_service = NotificationService()
        receiver_oid = (
            ObjectId(str(receiver_id)) if ObjectId.is_valid(str(receiver_id)) else None
        )
        receiver = (
            await db.users.find_one({"_id": receiver_oid}) if receiver_oid else None
        )

        if receiver and receiver.get("fcm_token"):
            notification_service.send_notification(
                token=receiver["fcm_token"],
                title=f"Message from {current_user['full_name']}",
                body=content[:100],
                data={"type": "new_message", "conversation_id": conversation_id},
            )
    except Exception as e:
        logger.warning(f"Failed to send message notification: {e}")


def _handle_open_chat_message(
    sender_id: str, sender_role: str, content: str
) -> Tuple[Message, str]:
    """Handle open chat message creation with permission check"""
    if sender_role != UserRole.ACHARYA.value:
        raise PermissionDeniedError(
            action="Post to open chat",
            details={"message": "Only Acharyas can post to open chat"},
        )
    return _create_open_chat_message(sender_id, content)


async def _try_resolve_acharya_profile(db, profile_oid: ObjectId) -> Optional[dict]:
    """Try to resolve an acharya profile ID to a user"""
    profile = await db.acharya_profiles.find_one({"_id": profile_oid})
    if not profile or "user_id" not in profile:
        return None

    real_oid = (
        ObjectId(profile["user_id"]) if ObjectId.is_valid(profile["user_id"]) else None
    )
    if not real_oid:
        return None

    return await db.users.find_one({"_id": real_oid})


async def _resolve_receiver(db, receiver_id: str) -> Tuple[dict, str]:
    """Resolve receiver by ID, handling both User IDs and Acharya Profile IDs"""
    if not ObjectId.is_valid(receiver_id):
        raise InvalidInputError(
            message="Invalid receiver_id format", field="receiver_id"
        )

    receiver_oid = ObjectId(receiver_id)
    receiver = await db.users.find_one({"_id": receiver_oid})

    # Try Acharya Profile ID if not found as User
    if not receiver:
        receiver = await _try_resolve_acharya_profile(db, receiver_oid)
        if receiver:
            receiver_id = str(receiver["_id"])

    if not receiver:
        raise ResourceNotFoundError(resource_type="User", resource_id=receiver_id)

    return receiver, receiver_id


async def _process_message_content(db, sender_id: str, content: str) -> str:
    """Sanitize message content and track violations"""
    sanitized_content, was_blocked = sanitize_message_content(content)

    if was_blocked:
        logger.warning(f"Contact sharing attempt blocked from user {sender_id}")
        await db.users.update_one(
            {"_id": ObjectId(sender_id)}, {"$inc": {"contact_share_attempts": 1}}
        )

    return sanitized_content


async def _handle_one_to_one_message(
    db: AsyncIOMotorDatabase, sender_id: str, receiver_id: Optional[str], content: str
) -> Tuple[Message, str, dict]:
    """Handle 1-to-1 message creation with validation"""
    if not receiver_id:
        raise InvalidInputError(
            message="receiver_id required for 1-to-1 chat", field="receiver_id"
        )

    # Resolve receiver using helper
    _, resolved_receiver_id = await _resolve_receiver(db, receiver_id)

    # Sanitize content using helper
    sanitized_content = await _process_message_content(db, sender_id, content)

    # Create message
    message, conversation_id = await _create_one_to_one_message(
        db, sender_id, resolved_receiver_id, sanitized_content
    )

    # Find conversation document
    conversation_doc = await _find_conversation(db, conversation_id)

    return message, conversation_id, conversation_doc


def _serialize_message_doc(msg: dict) -> dict:
    """Serialize a message document for JSON response"""
    return {
        "id": str(msg["_id"]),
        "_id": str(msg["_id"]),
        "conversation_id": str(msg.get("conversation_id", "")),
        "sender_id": str(msg.get("sender_id", "")),
        "receiver_id": str(msg.get("receiver_id", ""))
        if msg.get("receiver_id")
        else None,
        "content": msg.get("content", ""),
        "is_open_chat": msg.get("is_open_chat", False),
        "read": msg.get("read", False),
        "created_at": msg.get("created_at").isoformat()
        if msg.get("created_at")
        else None,
        "timestamp": msg.get("created_at").isoformat()
        if msg.get("created_at")
        else None,
        "deleted": msg.get("deleted", False),
    }


async def _find_conversation(db, conversation_id: str) -> Optional[dict]:
    """Find conversation by ID, trying both ObjectId and string"""
    conv_oid = ObjectId(conversation_id) if ObjectId.is_valid(conversation_id) else None
    if conv_oid:
        conv = await db.conversations.find_one({"_id": conv_oid})
        if conv:
            return conv
    return await db.conversations.find_one({"_id": conversation_id})


async def _get_other_participant_info(
    db, conversation: dict, user_id: str
) -> Optional[dict]:
    """Get info about the other participant in a conversation"""
    participant_strs = [str(p) for p in conversation.get("participants", [])]
    other_user_id = next((p for p in participant_strs if p != user_id), None)

    if not other_user_id:
        return None

    other_oid = ObjectId(other_user_id) if ObjectId.is_valid(other_user_id) else None
    other_user = await db.users.find_one({"_id": other_oid}) if other_oid else None

    if not other_user:
        return None

    display_name = await _get_display_name(db, other_user)
    return {
        "id": str(other_user["_id"]),
        "_id": str(other_user["_id"]),
        "name": display_name,
        "role": other_user.get("role"),
        "profile_picture": other_user.get("profile_picture"),
        "profile_image": other_user.get("profile_picture"),
    }


async def _find_acharya_profile(db, sender_id: Any) -> Optional[dict]:
    """Find acharya profile by user_id or _id"""
    sender_id_str = str(sender_id)
    profile = await db.acharya_profiles.find_one({"user_id": sender_id_str})
    if not profile:
        sender_oid = (
            ObjectId(sender_id_str) if ObjectId.is_valid(sender_id_str) else None
        )
        if sender_oid:
            profile = await db.acharya_profiles.find_one({"_id": sender_oid})
    return profile


async def _enrich_open_chat_message(db, msg: dict) -> dict:
    """Enrich an open chat message with acharya info"""
    sender_id_str = str(msg.get("sender_id", ""))
    acharya_profile = await _find_acharya_profile(db, sender_id_str)

    return {
        "id": str(msg["_id"]),
        "content": msg.get("content", ""),
        "created_at": msg.get("created_at"),
        "expires_at": msg.get("expires_at"),
        "acharya": {
            "id": sender_id_str,
            "name": acharya_profile.get("name") if acharya_profile else "Anonymous",
            "parampara": acharya_profile.get("parampara") if acharya_profile else None,
            "rating": acharya_profile.get("ratings", {}).get("average", 0.0)
            if acharya_profile
            else 0.0,
        },
    }


async def _broadcast_message_via_websocket(
    message_data: MessageSendRequest,
    message: Message,
    saved_id: str,
    conversation_id: str,
    sender_id: str,
) -> None:
    """Broadcast message via WebSocket to participants"""
    try:
        ws_message = {
            "type": "new_message",
            "id": saved_id,
            "_id": saved_id,
            "conversation_id": "open_chat"
            if message_data.is_open_chat
            else conversation_id,
            "sender_id": sender_id,
            "receiver_id": message_data.receiver_id,
            "content": message.content,
            "created_at": message.created_at.isoformat()
            if message.created_at
            else datetime.now(timezone.utc).isoformat(),
            "timestamp": message.created_at.isoformat()
            if message.created_at
            else datetime.now(timezone.utc).isoformat(),
        }

        if message_data.is_open_chat:
            logger.debug("Open chat message - skipping WebSocket broadcast")
        else:
            await manager.send_personal_message(message_data.receiver_id, ws_message)
            await manager.send_personal_message(sender_id, ws_message)
    except Exception as e:
        logger.error(f"Failed to broadcast real-time message: {e}")


def _build_message_response(
    message: Message,
    saved_id: str,
    conversation_id: str,
    sender_id: str,
    receiver_id: Optional[str],
    is_open_chat: bool,
) -> dict:
    """Build the message response data"""
    return {
        "message_id": saved_id,
        "id": saved_id,
        "_id": saved_id,
        "conversation_id": "open_chat" if is_open_chat else conversation_id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "timestamp": message.created_at.isoformat() if message.created_at else None,
        "expires_at": message.expires_at.isoformat() if message.expires_at else None,
    }


@router.post(
    "/messages",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message",
    description="Send a message in 1-to-1 chat or open chat",
)
async def send_message(
    message_data: MessageSendRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
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

        # Create message based on type
        if message_data.is_open_chat:
            message, conversation_id = _handle_open_chat_message(
                sender_id, sender_role, message_data.content
            )
        else:
            (
                message,
                conversation_id,
                conversation_doc,
            ) = await _handle_one_to_one_message(
                db, sender_id, message_data.receiver_id, message_data.content
            )

        # Save message to database
        result = await db.messages.insert_one(
            message.model_dump(by_alias=True, exclude={"id"})
        )
        saved_id = str(result.inserted_id)

        # Broadcast via WebSocket
        await _broadcast_message_via_websocket(
            message_data, message, saved_id, conversation_id, sender_id
        )

        # Send push notification for 1-to-1
        if not message_data.is_open_chat:
            await _send_message_notification(
                db, conversation_doc, current_user, message.content, conversation_id
            )

        logger.info(
            f"Message sent from {sender_id} - Type: {'open' if message_data.is_open_chat else '1-to-1'}"
        )

        return StandardResponse(
            success=True,
            data=_build_message_response(
                message,
                saved_id,
                conversation_id,
                sender_id,
                message_data.receiver_id,
                message_data.is_open_chat,
            ),
            message="Message sent successfully",
        )

    except (InvalidInputError, PermissionDeniedError, ResourceNotFoundError):
        raise
    except RateLimitExceeded:
        logger.warning(
            f"Rate limit exceeded for user {current_user.get('id', 'unknown')}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Message rate limit exceeded. Please wait a moment.",
        )
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service momentarily unavailable. Please retry.",
        )
    except Exception as e:
        logger.error(f"Send message critical error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message",
        )


class ConversationVerifyRequest(BaseModel):
    recipient_id: str


@router.post(
    "/verify-conversation",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify or Create Conversation",
    description="Get existing conversation ID or create new one with recipient",
)
async def verify_conversation(
    request: ConversationVerifyRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get or create conversation with specific user"""
    try:
        sender_id = current_user["id"]
        receiver_id = request.recipient_id

        if sender_id == receiver_id:
            raise InvalidInputError(
                message="Cannot chat with yourself", field="recipient_id"
            )

        # Validate receiver ID format first
        if not ObjectId.is_valid(receiver_id):
            raise InvalidInputError(
                message="Invalid recipient ID format", field="recipient_id"
            )

        # Check if receiver exists
        receiver_oid = ObjectId(receiver_id)
        receiver = await db.users.find_one({"_id": receiver_oid})

        # If not found in users, check if it's an Acharya Profile ID
        if not receiver:
            profile = await db.acharya_profiles.find_one({"_id": receiver_oid})
            if profile and "user_id" in profile:
                # Found profile! Use the linked user_id
                real_receiver_id = profile["user_id"]
                # Verify this user exists
                try:
                    receiver = await db.users.find_one(
                        {"_id": ObjectId(real_receiver_id)}
                    )
                    if receiver:
                        # Found the real user! Update receiver_id for conversation creation
                        receiver_id = str(receiver["_id"])
                except Exception:  # nosec
                    pass

        if not receiver:
            raise ResourceNotFoundError(resource_type="User", resource_id=receiver_id)

        conversation_id = await _get_or_create_conversation(db, sender_id, receiver_id)

        # Get recipient display info for frontend
        display_name = await _get_display_name(db, receiver)

        return StandardResponse(
            success=True,
            data={
                "conversation_id": conversation_id,
                "recipient": {
                    "id": str(receiver["_id"]),
                    "_id": str(receiver["_id"]),
                    "name": display_name,
                    "role": receiver.get("role"),
                    "profile_picture": receiver.get("profile_picture"),
                    "profile_image": receiver.get("profile_picture"),
                },
            },
        )
    except (InvalidInputError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(f"Verify conversation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify conversation",
        )


@router.get(
    "/conversations",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversations",
    description="Get all conversations for current user",
)
async def get_conversations(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    include_archived: Annotated[bool, Query(description="Include archived conversations")] = False,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get user's conversations with unread count and settings"""
    try:
        user_id = current_user["id"]
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None

        # Get ALL conversations where user is participant (we'll filter after enrichment)
        conversations = []
        if user_oid:
            conversations = (
                await db.conversations.find(
                    {"participants": user_oid, "is_open_chat": False}
                )
                .sort("last_message_at", -1)
                .to_list(length=None)  # Get all, we'll paginate after filtering
            )

        # Fallback: query with string (legacy data)
        if not conversations:
            conversations = (
                await db.conversations.find(
                    {"participants": user_id, "is_open_chat": False}
                )
                .sort("last_message_at", -1)
                .to_list(length=None)
            )

        # Enrich each conversation with metadata and settings
        result_conversations = [
            await _enrich_conversation(db, conv, user_id) for conv in conversations
        ]

        # Filter out archived conversations unless include_archived=True
        if not include_archived:
            result_conversations = [
                conv for conv in result_conversations if not conv.get("is_archived", False)
            ]

        # Sort: pinned first (by pin_rank ascending), then unpinned (by last_message_at descending)
        # pin_rank of 0 is most recent pin, higher numbers are older pins
        result_conversations.sort(
            key=lambda c: (
                not c.get("is_pinned", False),  # Pinned conversations first (False < True)
                c.get("pin_rank") if c.get("is_pinned") else float("inf"),  # Lower pin_rank first
                -(c.get("last_message_at").timestamp() if c.get("last_message_at") else 0),  # Recent messages first
            )
        )

        # Apply pagination after filtering and sorting
        total_count = len(result_conversations)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_conversations = result_conversations[start_idx:end_idx]

        return StandardResponse(
            success=True,
            data={
                "conversations": paginated_conversations,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get conversations error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations",
        )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversation Messages",
    description="Get all messages in a conversation",
)
async def get_conversation_messages(
    conversation_id: str,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get messages from a specific conversation"""
    try:
        user_id = current_user["id"]
        conv_oid = (
            ObjectId(conversation_id) if ObjectId.is_valid(conversation_id) else None
        )
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None

        # Find conversation using helper
        conversation = await _find_conversation(db, conversation_id)
        if not conversation:
            raise ResourceNotFoundError(
                resource_type="Conversation", resource_id=conversation_id
            )

        # Check participation
        participant_strs = [str(p) for p in conversation.get("participants", [])]
        if user_id not in participant_strs:
            raise PermissionDeniedError(
                action="View conversation",
                details={"message": "You are not a participant in this conversation"},
            )

        # Get recipient info using helper
        recipient_info = await _get_other_participant_info(db, conversation, user_id)

        # Build conversation query
        conv_query = {"$or": []}
        if conv_oid:
            conv_query["$or"].append({"conversation_id": conv_oid})
        conv_query["$or"].append({"conversation_id": conversation_id})

        # Fetch messages
        raw_messages = (
            await db.messages.find(conv_query)
            .sort("created_at", 1)
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list(length=limit)
        )

        # Serialize with helper
        serialized_messages = [_serialize_message_doc(msg) for msg in raw_messages]

        # Mark as read - build filter
        mark_read_filter = {"$or": [], "read": False}
        if conv_oid and user_oid:
            mark_read_filter["$or"].append(
                {"conversation_id": conv_oid, "receiver_id": user_oid}
            )
        if conv_oid:
            mark_read_filter["$or"].append(
                {"conversation_id": conv_oid, "receiver_id": user_id}
            )
        if user_oid:
            mark_read_filter["$or"].append(
                {"conversation_id": conversation_id, "receiver_id": user_oid}
            )
        mark_read_filter["$or"].append(
            {"conversation_id": conversation_id, "receiver_id": user_id}
        )

        await db.messages.update_many(mark_read_filter, {"$set": {"read": True}})

        # Total count
        total_count = await db.messages.count_documents(conv_query)

        return StandardResponse(
            success=True,
            data={
                "messages": serialized_messages,
                "recipient": recipient_info,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": max(1, (total_count + limit - 1) // limit),
                },
            },
        )

    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Get messages error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch messages",
        )


@router.get(
    "/open-chat",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Open Chat Messages",
    description="Get all active open chat messages (Grihasta only)",
)
async def get_open_chat_messages(
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    current_user: Annotated[Dict[str, Any], Depends(get_current_grihasta)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Get open chat messages

    Only Grihastas can read open chat
    Messages expire after 24 hours
    """
    try:
        # Get non-expired messages
        messages = (
            await db.messages.find(
                {
                    "is_open_chat": True,
                    "expires_at": {"$gt": datetime.now(timezone.utc)},
                }
            )
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
            .to_list(length=limit)
        )

        # Enrich messages with acharya info using helper
        result_messages = [await _enrich_open_chat_message(db, msg) for msg in messages]

        # Get total count
        total_count = await db.messages.count_documents(
            {"is_open_chat": True, "expires_at": {"$gt": datetime.now(timezone.utc)}}
        )

        return StandardResponse(
            success=True,
            data={
                "messages": result_messages,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit,
                },
            },
        )

    except Exception as e:
        logger.error(f"Get open chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch open chat messages",
        )


@router.delete(
    "/messages/{message_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Message",
    description="Delete a message (sender only)",
)
async def delete_message(
    message_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Delete a message (soft delete - mark as deleted)"""
    try:
        user_id = current_user["id"]
        msg_oid = ObjectId(message_id) if ObjectId.is_valid(message_id) else None

        # Get message - try ObjectId first
        message = None
        if msg_oid:
            message = await db.messages.find_one({"_id": msg_oid})
        if not message:
            message = await db.messages.find_one({"_id": message_id})

        if not message:
            raise ResourceNotFoundError(resource_type="Message", resource_id=message_id)

        # Verify sender - compare as strings
        if str(message.get("sender_id", "")) != user_id:
            raise PermissionDeniedError(
                action="Delete message",
                details={"message": "You can only delete your own messages"},
            )

        # Soft delete
        await db.messages.update_one(
            {"_id": message["_id"]},
            {"$set": {"content": "[Message deleted]", "deleted": True}},
        )

        logger.info(f"Message {message_id} deleted by user {user_id}")

        return StandardResponse(success=True, message="Message deleted successfully")

    except (ResourceNotFoundError, PermissionDeniedError):
        raise
    except Exception as e:
        logger.error(f"Delete message error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message",
        )


@router.get(
    "/unread-count",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unread Message Count",
    description="Get total unread message count for current user",
)
async def get_unread_count(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Get total unread message count"""
    try:
        user_id = current_user["id"]
        user_oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None

        # Count with both ObjectId and string receiver_id
        unread_count = 0
        if user_oid:
            unread_count = await db.messages.count_documents(
                {"receiver_id": user_oid, "read": False}
            )
        if unread_count == 0:
            unread_count = await db.messages.count_documents(
                {"receiver_id": user_id, "read": False}
            )

        return StandardResponse(success=True, data={"unread_count": unread_count})

    except Exception as e:
        logger.error(f"Get unread count error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread count",
        )
