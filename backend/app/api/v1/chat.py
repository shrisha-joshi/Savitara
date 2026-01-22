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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


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
        result = await db.conversations.insert_one(conversation.dict(by_alias=True))
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


async def _send_message_notification(db, conversation_doc: dict, current_user: dict, content: str, conversation_id: str):
    """Send push notification to message receiver"""
    if not conversation_doc:
        return
    
    try:
        # Find receiver
        receiver_id = None
        for participant_id in conversation_doc["participants"]:
            if participant_id != current_user["id"]:
                receiver_id = participant_id
                break
        
        if not receiver_id:
            return
        
        from app.services.notification_service import NotificationService
        notification_service = NotificationService()
        receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
        
        if receiver and receiver.get("fcm_token"):
            await notification_service.send_notification(
                token=receiver["fcm_token"],
                title=f"Message from {current_user['full_name']}",
                body=content[:100],
                data={"type": "new_message", "conversation_id": conversation_id}
            )
    except Exception as e:
        logger.warning(f"Failed to send message notification: {e}")


@router.post(
    "/messages",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message",
    description="Send a message in 1-to-1 chat or open chat"
)
# NOSONAR python:S3776 - Message routing logic requires handling multiple chat types
async def send_message(  # noqa: C901
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
            # Open chat - only Acharyas can post
            if sender_role != UserRole.ACHARYA.value:
                raise PermissionDeniedError(
                    action="Post to open chat",
                    details={"message": "Only Acharyas can post to open chat"}
                )
            message, conversation_id = _create_open_chat_message(sender_id, message_data.content)
        else:
            # 1-to-1 chat
            if not message_data.receiver_id:
                raise InvalidInputError(
                    message="receiver_id required for 1-to-1 chat",
                    field="receiver_id"
                )
            
            # Verify receiver exists
            receiver = await db.users.find_one({"_id": message_data.receiver_id})
            if not receiver:
                raise ResourceNotFoundError(
                    resource_type="User",
                    resource_id=message_data.receiver_id
                )
            
            message, conversation_id = await _create_one_to_one_message(
                db, sender_id, message_data.receiver_id, message_data.content
            )
            conversation_doc = await db.conversations.find_one({"_id": conversation_id})
        
        # Save message
        result = await db.messages.insert_one(message.dict(by_alias=True))
        message.id = str(result.inserted_id)
        
        # Send push notification for 1-to-1 messages
        if not message_data.is_open_chat:
            await _send_message_notification(db, conversation_doc, current_user, message_data.content, conversation_id)
        
        logger.info(f"Message sent from {sender_id} - Type: {'open' if message_data.is_open_chat else '1-to-1'}")
        
        return StandardResponse(
            success=True,
            data={
                "message_id": str(message.id),
                "conversation_id": conversation_id if not message_data.is_open_chat else "open_chat",
                "expires_at": message.expires_at.isoformat() if message.expires_at else None
            },
            message="Message sent successfully"
        )
        
    except (InvalidInputError, PermissionDeniedError, ResourceNotFoundError):
        raise
    except Exception as e:
        logger.error(f"Send message error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message"
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
        
        # Get unread count for each conversation
        result_conversations = []
        for conv in conversations:
            conv_id = str(conv["_id"])
            
            # Count unread messages
            unread_count = await db.messages.count_documents({
                "conversation_id": conv_id,
                "receiver_id": user_id,
                "read": False
            })
            
            # Get other participant's info
            other_user_id = [p for p in conv["participants"] if p != user_id][0]
            other_user = await db.users.find_one({"_id": other_user_id})
            
            # Get last message
            last_message = await db.messages.find_one(
                {"conversation_id": conv_id},
                sort=[("created_at", -1)]
            )
            
            result_conversations.append({
                "id": conv_id,
                "other_user": {
                    "id": str(other_user["_id"]),
                    "email": other_user["email"],
                    "role": other_user["role"],
                    "profile_picture": other_user.get("profile_picture")
                } if other_user else None,
                "last_message": {
                    "content": last_message.get("content"),
                    "created_at": last_message.get("created_at")
                } if last_message else None,
                "unread_count": unread_count,
                "last_message_at": conv["last_message_at"]
            })
        
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
