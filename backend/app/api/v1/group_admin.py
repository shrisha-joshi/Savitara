"""
Group Admin API Endpoints
Handles group chat moderation and administration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
import logging
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.connection import get_db
from app.services.group_admin_service import GroupAdminService
from app.core.exceptions import (
    ResourceNotFoundError,
    PermissionDeniedError,
    InvalidInputError,
)
from app.schemas.requests import StandardResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/groups", tags=["Group Admin"])


# ============ Request Schemas ============

class MuteMemberRequest(BaseModel):
    """Request to mute a member"""
    user_id: str
    duration_hours: Optional[int] = None  # Duration in hours, None means indefinite


class BanMemberRequest(BaseModel):
    """Request to ban a member"""
    user_id: str
    duration_days: Optional[int] = None  # Duration in days, None means permanent


class RemoveMemberRequest(BaseModel):
    """Request to remove a member"""
    user_id: str


class ChangeRoleRequest(BaseModel):
    """Request to change member role"""
    user_id: str
    new_role: str  # admin or member


class DeleteMessageRequest(BaseModel):
    """Request to delete a message"""
    message_id: str


class PinMessageRequest(BaseModel):
    """Request to pin a message"""
    message_id: str


class LockRoomRequest(BaseModel):
    """Request to lock/unlock room"""
    locked: bool


# ============ Member Moderation Endpoints ============

@router.post(
    "/{conversation_id}/mute",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Mute Member",
    description="Mute a member in a group (admins only)",
)
async def mute_member(
    conversation_id: str,
    request: MuteMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.mute_member(
            conversation_id=conversation_id,
            admin_id=admin_id,
            target_user_id=request.user_id,
            duration_hours=request.duration_hours,
        )

        duration_msg = f" for {request.duration_hours} hours" if request.duration_hours else " indefinitely"
        return StandardResponse(
            success=True,
            message=f"Member muted{duration_msg}",
            data=result,
        )
    except (PermissionDeniedError, InvalidInputError, ResourceNotFoundError) as e:
        logger.error(f"Error muting member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in mute_member: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mute member",
        )


@router.post(
    "/{conversation_id}/unmute",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Unmute Member",
    description="Unmute a member in a group (admins only)",
)
async def unmute_member(
    conversation_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.unmute_member(
            conversation_id=conversation_id, admin_id=admin_id, target_user_id=user_id
        )

        return StandardResponse(
            success=True, message="Member unmuted successfully", data=result
        )
    except (PermissionDeniedError, ResourceNotFoundError) as e:
        logger.error(f"Error unmuting member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in unmute_member: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unmute member",
        )


@router.post(
    "/{conversation_id}/ban",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Ban Member",
    description="Ban a member from a group (admins only)",
)
async def ban_member(
    conversation_id: str,
    request: BanMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.ban_member(
            conversation_id=conversation_id,
            admin_id=admin_id,
            target_user_id=request.user_id,
            duration_days=request.duration_days,
        )

        duration_msg = f" for {request.duration_days} days" if request.duration_days else " permanently"
        return StandardResponse(
            success=True, message=f"Member banned{duration_msg}", data=result
        )
    except (PermissionDeniedError, InvalidInputError, ResourceNotFoundError) as e:
        logger.error(f"Error banning member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in ban_member: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ban member",
        )


@router.delete(
    "/{conversation_id}/members/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove Member",
    description="Remove a member from a group (admins only)",
)
async def remove_member(
    conversation_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        await service.remove_member(
            conversation_id=conversation_id, admin_id=admin_id, target_user_id=user_id
        )

        return StandardResponse(
            success=True, message="Member removed successfully", data={}
        )
    except (PermissionDeniedError, InvalidInputError, ResourceNotFoundError) as e:
        logger.error(f"Error removing member: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in remove_member: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove member",
        )


# ============ Role Management Endpoints ============

@router.patch(
    "/{conversation_id}/members/{user_id}/role",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Change Member Role",
    description="Change a member's role (owner only)",
)
async def change_member_role(
    conversation_id: str,
    user_id: str,
    request: ChangeRoleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        owner_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.change_member_role(
            conversation_id=conversation_id,
            owner_id=owner_id,
            target_user_id=user_id,
            new_role=request.new_role,
        )

        return StandardResponse(
            success=True,
            message=f"Member role changed to {request.new_role}",
            data=result,
        )
    except (PermissionDeniedError, InvalidInputError, ResourceNotFoundError) as e:
        logger.error(f"Error changing member role: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in change_member_role: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change member role",
        )


# ============ Message Moderation Endpoints ============

@router.delete(
    "/{conversation_id}/messages/{message_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Message",
    description="Delete a message (admins, owner, or sender)",
)
async def delete_message(
    conversation_id: str,
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        await service.delete_message(
            conversation_id=conversation_id, admin_id=admin_id, message_id=message_id
        )

        return StandardResponse(
            success=True, message="Message deleted successfully", data={}
        )
    except (PermissionDeniedError, ResourceNotFoundError) as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in delete_message: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete message",
        )


@router.post(
    "/{conversation_id}/pin",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Pin Message",
    description="Pin a message to the top of the group (admins only)",
)
async def pin_message(
    conversation_id: str,
    request: PinMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.pin_message(
            conversation_id=conversation_id,
            admin_id=admin_id,
            message_id=request.message_id,
        )

        return StandardResponse(
            success=True, message="Message pinned successfully", data=result
        )
    except (PermissionDeniedError, ResourceNotFoundError) as e:
        logger.error(f"Error pinning message: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in pin_message: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to pin message",
        )


# ============ Room Settings Endpoints ============

@router.patch(
    "/{conversation_id}/lock",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Lock/Unlock Room",
    description="Lock or unlock a room (owner only)",
)
async def lock_room(
    conversation_id: str,
    request: LockRoomRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        owner_id = current_user["id"]
        service = GroupAdminService(db)

        result = await service.lock_room(
            conversation_id=conversation_id, owner_id=owner_id, locked=request.locked
        )

        action = "locked" if request.locked else "unlocked"
        return StandardResponse(
            success=True, message=f"Room {action} successfully", data=result
        )
    except PermissionDeniedError as e:
        logger.error(f"Error locking room: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in lock_room: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to lock/unlock room",
        )


# ============ Audit Log Endpoint ============

@router.get(
    "/{conversation_id}/audit",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Audit Log",
    description="Get audit log for group admin actions (admins only)",
)
async def get_audit_log(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        admin_id = current_user["id"]
        service = GroupAdminService(db)

        logs = await service.get_audit_log(
            conversation_id=conversation_id, admin_id=admin_id, limit=limit, skip=skip
        )

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(logs)} audit log entries",
            data={"logs": logs},
        )
    except PermissionDeniedError as e:
        logger.error(f"Error getting audit log: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_audit_log: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit log",
        )
