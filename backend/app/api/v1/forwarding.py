"""
Message Forwarding API Routes

Endpoints for forwarding messages to users and conversations with proper
authorization and real-time notifications.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, field_validator

from app.schemas.requests import StandardResponse
from app.core.security import get_current_user
from app.models.database import User
from app.services.forwarding_service import ForwardingService
from app.services.websocket_manager import manager as websocket_manager


router = APIRouter(prefix="/messages", tags=["Message Forwarding"])


# Request/Response Models
class ForwardToUsersRequest(BaseModel):
    """Request body for forwarding message to users"""
    recipient_ids: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of user IDs to forward the message to (max 50)"
    )
    include_original_context: bool = Field(
        default=True,
        description="Whether to include original sender name and room info"
    )

    @field_validator("recipient_ids")
    @classmethod
    def validate_unique_recipients(cls, v: List[str]) -> List[str]:
        """Ensure no duplicate recipient IDs"""
        if len(v) != len(set(v)):
            raise ValueError("Duplicate recipient IDs are not allowed")
        return v


class ForwardToConversationRequest(BaseModel):
    """Request body for forwarding message to a conversation"""
    conversation_id: str = Field(
        ...,
        description="Target conversation ID"
    )
    include_original_context: bool = Field(
        default=True,
        description="Whether to include original sender name and room info"
    )


class ForwardedMessageResponse(BaseModel):
    """Response for a single forwarded message"""
    message_id: str
    conversation_id: str
    recipient_id: Optional[str]
    created_at: str


class ForwardCountResponse(BaseModel):
    """Response for forward count query"""
    message_id: str
    forward_count: int


# API Endpoints
@router.post(
    "/{message_id}/forward",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Forward message to users",
    description="""
    Forward a message to one or more users. Creates new conversations if needed.
    
    Features:
    - Forward to up to 50 users at once
    - Auto-creates conversations with new recipients
    - Preserves original message context (sender, room)
    - Validates sender has access to original message
    - Checks block status before forwarding
    - Sends real-time WebSocket notifications
    
    Permissions:
    - Sender must have access to original message (participant in conversation)
    - Cannot forward to users who have blocked the sender
    - Cannot forward deleted messages
    """
)
async def forward_message_to_users(
    message_id: str,
    request: ForwardToUsersRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StandardResponse:
    """Forward a message to multiple users"""
    forwarding_service = ForwardingService()

    # Forward the message
    forwarded_messages = await forwarding_service.forward_message(
        message_id=message_id,
        sender_id=str(current_user.id),
        recipient_ids=request.recipient_ids,
        include_original_context=request.include_original_context,
    )

    # Send WebSocket notifications to all recipients
    for msg in forwarded_messages:
        if msg.get("receiver_id"):
            await websocket_manager.send_personal_message(
                user_id=str(msg["receiver_id"]),
                message={
                    "type": "new_message",
                    "conversation_id": str(msg["conversation_id"]),
                    "message_id": str(msg["_id"]),
                    "sender_id": str(msg["sender_id"]),
                    "content": msg["content"],
                    "message_type": msg["message_type"],
                    "is_forwarded": True,
                    "created_at": msg["created_at"].isoformat(),
                }
            )

    # Build response data
    response_data = {
        "forwarded_count": len(forwarded_messages),
        "messages": [
            ForwardedMessageResponse(
                message_id=str(msg["_id"]),
                conversation_id=str(msg["conversation_id"]),
                recipient_id=str(msg["receiver_id"]) if msg.get("receiver_id") else None,
                created_at=msg["created_at"].isoformat(),
            ).model_dump()
            for msg in forwarded_messages
        ]
    }

    return StandardResponse(
        success=True,
        message=f"Message forwarded to {len(forwarded_messages)} recipient(s)",
        data=response_data
    )


@router.post(
    "/{message_id}/forward/conversation",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Forward message to conversation",
    description="""
    Forward a message to an existing conversation (e.g., group chat).
    
    Use Cases:
    - Share message from 1-on-1 chat to group
    - Forward announcement to community
    - Cross-post between groups
    
    Permissions:
    - Sender must be participant in target conversation
    - Sender must have access to original message
    - Target conversation must exist
    """
)
async def forward_message_to_conversation(
    message_id: str,
    request: ForwardToConversationRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StandardResponse:
    """Forward a message to an existing conversation"""
    forwarding_service = ForwardingService()

    # Forward to conversation
    forwarded_msg = await forwarding_service.forward_message_to_conversation(
        message_id=message_id,
        sender_id=str(current_user.id),
        conversation_id=request.conversation_id,
        include_original_context=request.include_original_context,
    )

    # Send WebSocket notification to conversation
    await websocket_manager.send_to_room(
        room_id=request.conversation_id,
        message={
            "type": "new_message",
            "conversation_id": str(forwarded_msg["conversation_id"]),
            "message_id": str(forwarded_msg["_id"]),
            "sender_id": str(forwarded_msg["sender_id"]),
            "content": forwarded_msg["content"],
            "message_type": forwarded_msg["message_type"],
            "is_forwarded": True,
            "created_at": forwarded_msg["created_at"].isoformat(),
        }
    )

    response_data = ForwardedMessageResponse(
        message_id=str(forwarded_msg["_id"]),
        conversation_id=str(forwarded_msg["conversation_id"]),
        recipient_id=str(forwarded_msg["receiver_id"]) if forwarded_msg.get("receiver_id") else None,
        created_at=forwarded_msg["created_at"].isoformat(),
    )

    return StandardResponse(
        success=True,
        message="Message forwarded to conversation",
        data=response_data.model_dump()
    )


@router.get(
    "/{message_id}/forward-count",
    response_model=StandardResponse,
    summary="Get forward count",
    description="""
    Get the number of times a message has been forwarded.
    
    Use Cases:
    - Display "Forwarded 5 times" badge
    - Analytics on message virality
    - Trending content detection
    
    Note: Only counts non-deleted forwarded instances.
    """
)
async def get_forward_count(
    message_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> StandardResponse:
    """Get the number of times a message has been forwarded"""
    forwarding_service = ForwardingService()

    forward_count = await forwarding_service.get_forward_count(message_id)

    response_data = ForwardCountResponse(
        message_id=message_id,
        forward_count=forward_count
    )

    return StandardResponse(
        success=True,
        message="Forward count retrieved",
        data=response_data.model_dump()
    )
