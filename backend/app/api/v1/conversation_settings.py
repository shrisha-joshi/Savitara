"""
API endpoints for conversation settings
"""
from fastapi import APIRouter, Depends, status
from typing import Annotated

from app.core.security import get_current_user
from app.models.database import User
from app.schemas.requests import StandardResponse
from app.schemas.conversation_settings import (
    ConversationSettingsResponse,
    UpdateSettingsRequest,
    MuteRequest,
    MuteResponse,
)
from app.services.conversation_settings_service import ConversationSettingsService
from app.db.connection import get_database

router = APIRouter(prefix="/conversations", tags=["conversation_settings"])


@router.get(
    "/{conversation_id}/settings",
    response_model=StandardResponse[ConversationSettingsResponse],
    summary="Get conversation settings",
)
async def get_conversation_settings(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Get user's settings for a specific conversation"""
    service = ConversationSettingsService(db)
    settings = await service.get_settings(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Settings retrieved successfully",
        success=True,
    )


@router.patch(
    "/{conversation_id}/settings",
    response_model=StandardResponse[ConversationSettingsResponse],
    summary="Update conversation settings",
)
async def update_conversation_settings(
    conversation_id: str,
    request: UpdateSettingsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Update multiple settings at once"""
    service = ConversationSettingsService(db)

    # Filter out None values
    updates = {k: v for k, v in request.model_dump().items() if v is not None}

    settings = await service.update_settings(
        conversation_id, str(current_user.id), updates
    )

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Settings updated successfully",
        success=True,
    )


@router.post(
    "/{conversation_id}/pin",
    response_model=StandardResponse[ConversationSettingsResponse],
    status_code=status.HTTP_200_OK,
    summary="Pin conversation",
)
async def pin_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Pin conversation to top of list"""
    service = ConversationSettingsService(db)
    settings = await service.pin_conversation(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation pinned successfully",
        success=True,
    )


@router.delete(
    "/{conversation_id}/pin",
    response_model=StandardResponse[ConversationSettingsResponse],
    summary="Unpin conversation",
)
async def unpin_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Unpin conversation"""
    service = ConversationSettingsService(db)
    settings = await service.unpin_conversation(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation unpinned successfully",
        success=True,
    )


@router.post(
    "/{conversation_id}/archive",
    response_model=StandardResponse[ConversationSettingsResponse],
    status_code=status.HTTP_200_OK,
    summary="Archive conversation",
)
async def archive_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Archive conversation"""
    service = ConversationSettingsService(db)
    settings = await service.archive_conversation(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation archived successfully",
        success=True,
    )


@router.delete(
    "/{conversation_id}/archive",
    response_model=StandardResponse[ConversationSettingsResponse],
    summary="Unarchive conversation",
)
async def unarchive_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Unarchive conversation"""
    service = ConversationSettingsService(db)
    settings = await service.unarchive_conversation(
        conversation_id, str(current_user.id)
    )

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation unarchived successfully",
        success=True,
    )


@router.post(
    "/{conversation_id}/mute",
    response_model=StandardResponse[MuteResponse],
    status_code=status.HTTP_200_OK,
    summary="Mute conversation",
)
async def mute_conversation(
    conversation_id: str,
    request: MuteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Mute conversation for specified duration"""
    service = ConversationSettingsService(db)

    # Calculate mute_until timestamp
    mute_until = service.calculate_mute_until(request.duration)

    # Update settings
    await service.mute_conversation(conversation_id, str(current_user.id), mute_until)

    return StandardResponse(
        data=MuteResponse(
            muted_until=mute_until, is_indefinite=(mute_until is None)
        ),
        message="Conversation muted successfully",
        success=True,
    )


@router.delete(
    "/{conversation_id}/mute",
    response_model=StandardResponse[ConversationSettingsResponse],
    summary="Unmute conversation",
)
async def unmute_conversation(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Unmute conversation"""
    service = ConversationSettingsService(db)
    settings = await service.unmute_conversation(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation unmuted successfully",
        success=True,
    )


@router.post(
    "/{conversation_id}/read",
    response_model=StandardResponse[ConversationSettingsResponse],
    status_code=status.HTTP_200_OK,
    summary="Mark conversation as read",
)
async def mark_conversation_read(
    conversation_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db=Depends(get_database),
):
    """Mark conversation as read"""
    service = ConversationSettingsService(db)
    settings = await service.mark_as_read(conversation_id, str(current_user.id))

    return StandardResponse(
        data=ConversationSettingsResponse(**settings),
        message="Conversation marked as read",
        success=True,
    )
