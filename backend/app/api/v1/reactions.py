"""
Reactions API Router
Handles message reaction endpoints
"""
from typing import Annotated
from fastapi import APIRouter, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.connection import get_db
from app.core.security import get_current_user
from app.models.database import User
from app.services.reactions_service import ReactionsService
from app.schemas.reactions import AddReactionRequest
from app.schemas.requests import StandardResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messages", tags=["reactions"])


@router.post(
    "/{message_id}/reactions",
    status_code=status.HTTP_200_OK,
    summary="Add a reaction to a message",
    description="Add an emoji reaction to a message. Idempotent - returns 200 if reaction already exists.",
)
async def add_reaction(
    message_id: str,
    request: AddReactionRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Add a reaction to a message

    Args:
        message_id: ID of the message to react to
        request: Reaction request containing emoji
        current_user: Authenticated user
        db: Database connection

    Returns:
        Aggregated reaction summary for the message

    Raises:
        404: Message not found
        403: User blocked or no access to conversation
        400: Invalid emoji
    """
    service = ReactionsService(db)
    user_id = str(current_user.id)

    reactions = await service.add_reaction(
        message_id=message_id, user_id=user_id, emoji=request.emoji
    )

    return StandardResponse.success(
        data={"reactions": reactions},
        message=f"Reaction {request.emoji} added successfully",
    )


@router.delete(
    "/{message_id}/reactions/{emoji}",
    status_code=status.HTTP_200_OK,
    summary="Remove a reaction from a message",
    description="Remove your emoji reaction from a message. No-op if reaction doesn't exist.",
)
async def remove_reaction(
    message_id: str,
    emoji: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Remove a reaction from a message

    Args:
        message_id: ID of the message
        emoji: Emoji to remove
        current_user: Authenticated user
        db: Database connection

    Returns:
        Updated aggregated reaction summary

    Raises:
        404: Message not found
    """
    service = ReactionsService(db)
    user_id = str(current_user.id)

    reactions = await service.remove_reaction(
        message_id=message_id, user_id=user_id, emoji=emoji
    )

    return StandardResponse.success(
        data={"reactions": reactions}, message="Reaction removed successfully"
    )


@router.get(
    "/{message_id}/reactions",
    status_code=status.HTTP_200_OK,
    summary="Get reaction summary for a message",
    description="Get aggregated reactions for a message grouped by emoji with counts.",
)
async def get_reactions(
    message_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Get aggregated reaction summary for a message

    Args:
        message_id: ID of the message
        current_user: Authenticated user
        db: Database connection

    Returns:
        List of reaction summaries [{emoji, count, reactedByMe}]

    Raises:
        404: Message not found
    """
    service = ReactionsService(db)
    user_id = str(current_user.id)

    reactions = await service.get_reactions_summary(
        message_id=message_id, user_id=user_id
    )

    return StandardResponse.success(
        data={"reactions": reactions}, message="Reactions retrieved successfully"
    )
