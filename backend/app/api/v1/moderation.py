"""
Moderation API Endpoints
Handles blocking users and reporting violations
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Annotated, Dict, Any, Optional
import logging
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.connection import get_db
from app.services.block_service import BlockService
from app.services.report_service import ReportService
from app.core.exceptions import (
    ResourceNotFoundError,
    PermissionDeniedError,
    InvalidInputError,
)
from app.schemas.requests import StandardResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/moderation", tags=["Moderation"])


# ============ Request Schemas ============

class BlockUserRequest(BaseModel):
    """Request to block a user"""
    reason: Optional[str] = None


class CreateReportRequest(BaseModel):
    """Request to create a report"""
    reported_user_id: str
    reason: str  # harassment, spam, inappropriate, violence, hate_speech, scam, fake, other
    description: str
    message_id: Optional[str] = None
    evidence_urls: Optional[list[str]] = None
    context: Optional[Dict[str, Any]] = None


class UpdateReportStatusRequest(BaseModel):
    """Request to update report status (admin only)"""
    status: str  # reviewing, resolved, dismissed, action_taken
    action_taken: Optional[str] = None
    admin_notes: Optional[str] = None


class DismissReportRequest(BaseModel):
    """Request to dismiss a report (admin only)"""
    reason: str


class TakeActionRequest(BaseModel):
    """Request to take action on a report (admin only)"""
    action: str  # warning_sent, user_suspended, user_banned, content_removed, no_action
    reason: str


class IssueWarningRequest(BaseModel):
    """Request to issue a warning (admin only)"""
    user_id: str
    reason: str
    severity: int  # 1-5
    report_id: Optional[str] = None


# ============ Block Endpoints ============

@router.post(
    "/block/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Block a User",
    description="Block another user to prevent interactions",
)
async def block_user(
    user_id: str,
    request: BlockUserRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        blocker_id = current_user["id"]
        block_service = BlockService(db)

        result = await block_service.block_user(
            blocker_id=blocker_id, blocked_user_id=user_id, reason=request.reason
        )

        return StandardResponse(
            success=True,
            message="User blocked successfully" + (" (mutual block detected)" if result.get("is_mutual") else ""),
            data=result,
        )
    except (ResourceNotFoundError, InvalidInputError, PermissionDeniedError) as e:
        logger.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in block_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to block user",
        )


@router.delete(
    "/block/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Unblock a User",
    description="Remove a block on another user",
)
async def unblock_user(
    user_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        blocker_id = current_user["id"]
        block_service = BlockService(db)

        await block_service.unblock_user(blocker_id=blocker_id, blocked_user_id=user_id)

        return StandardResponse(
            success=True, message="User unblocked successfully", data={}
        )
    except ResourceNotFoundError as e:
        logger.error(f"Error unblocking user: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in unblock_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to unblock user",
        )


@router.get(
    "/blocks",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Blocked Users",
    description="Get list of users you have blocked",
)
async def get_blocked_users(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]
        block_service = BlockService(db)

        result = await block_service.get_blocked_users(
            user_id=user_id, limit=limit, offset=offset
        )

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result['users'])} blocked users",
            data=result,
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_blocked_users: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve blocked users",
        )


@router.get(
    "/blocks/mutual",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Mutual Blocks",
    description="Get list of users with mutual blocks",
)
async def get_mutual_blocks(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]
        block_service = BlockService(db)

        result = await block_service.get_mutual_blocks(user_id=user_id)

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result)} mutual blocks",
            data={"users": result},
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_mutual_blocks: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve mutual blocks",
        )


@router.get(
    "/blocks/count",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Block Count",
    description="Get count of users you have blocked",
)
async def get_block_count(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]
        block_service = BlockService(db)

        count = await block_service.block_count(user_id=user_id)

        return StandardResponse(
            success=True, message="Block count retrieved", data={"count": count}
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_block_count: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve block count",
        )


# ============ Report Endpoints ============

@router.post(
    "/reports",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Report",
    description="Report a user or message for violations",
)
async def create_report(
    request: CreateReportRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        reporter_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.create_report(
            reporter_id=reporter_id,
            reported_user_id=request.reported_user_id,
            reason=request.reason,
            description=request.description,
            message_id=request.message_id,
            evidence_urls=request.evidence_urls or [],
            context=request.context or {},
        )

        return StandardResponse(
            success=True,
            message="Report submitted successfully. Our team will review it.",
            data=result,
        )
    except (ResourceNotFoundError, InvalidInputError) as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in create_report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create report",
        )


@router.get(
    "/reports/{report_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Report",
    description="Get a single report (reporter, reported user, or admin only)",
)
async def get_report(
    report_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.get_report(report_id=report_id, user_id=user_id)

        return StandardResponse(
            success=True, message="Report retrieved successfully", data=result
        )
    except (ResourceNotFoundError, PermissionDeniedError) as e:
        logger.error(f"Error getting report: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve report",
        )


@router.get(
    "/reports",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Reports",
    description="Get reports created by current user",
)
async def get_user_reports(
    include_reported: Annotated[bool, Query(description="Include reports about you")] = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        user_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.get_user_reports(
            user_id=user_id,
            include_reported=include_reported,
            limit=limit,
            offset=offset,
        )

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result['reports'])} reports",
            data=result,
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_user_reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reports",
        )


# ============ Admin Endpoints ============

@router.get(
    "/admin/reports/pending",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Pending Reports (Admin)",
    description="Get all pending reports for review (admin only)",
)
async def get_pending_reports(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        # Check admin role
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can access pending reports")

        report_service = ReportService(db)
        result = await report_service.get_pending_reports(limit=limit, offset=offset)

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result['reports'])} pending reports",
            data=result,
        )
    except PermissionDeniedError as e:
        logger.error(f"Permission denied: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_pending_reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve pending reports",
        )


@router.get(
    "/admin/reports/user/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Reports for User (Admin)",
    description="Get all reports targeting a specific user (admin only)",
)
async def get_reports_for_user(
    user_id: str,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can access user reports")

        report_service = ReportService(db)
        result = await report_service.get_reports_for_user(
            reported_user_id=user_id, limit=limit, offset=offset
        )

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result['reports'])} reports for user",
            data=result,
        )
    except PermissionDeniedError as e:
        logger.error(f"Permission denied: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_reports_for_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user reports",
        )


@router.patch(
    "/admin/reports/{report_id}/status",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Report Status (Admin)",
    description="Update the status of a report (admin only)",
)
async def update_report_status(
    report_id: str,
    request: UpdateReportStatusRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can update report status")

        admin_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.update_report_status(
            report_id=report_id,
            admin_id=admin_id,
            status=request.status,
            action_taken=request.action_taken,
            admin_notes=request.admin_notes,
        )

        return StandardResponse(
            success=True, message="Report status updated successfully", data=result
        )
    except (PermissionDeniedError, ResourceNotFoundError, InvalidInputError) as e:
        logger.error(f"Error updating report status: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in update_report_status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update report status",
        )


@router.post(
    "/admin/reports/{report_id}/dismiss",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Dismiss Report (Admin)",
    description="Dismiss a report as invalid (admin only)",
)
async def dismiss_report(
    report_id: str,
    request: DismissReportRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can dismiss reports")

        admin_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.dismiss_report(
            report_id=report_id, admin_id=admin_id, reason=request.reason
        )

        return StandardResponse(
            success=True, message="Report dismissed successfully", data=result
        )
    except (PermissionDeniedError, ResourceNotFoundError) as e:
        logger.error(f"Error dismissing report: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in dismiss_report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to dismiss report",
        )


@router.post(
    "/admin/reports/{report_id}/action",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Take Action on Report (Admin)",
    description="Take moderation action based on report (admin only)",
)
async def take_action_on_report(
    report_id: str,
    request: TakeActionRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can take action on reports")

        admin_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.take_action(
            report_id=report_id,
            admin_id=admin_id,
            action=request.action,
            reason=request.reason,
        )

        return StandardResponse(
            success=True,
            message=f"Action '{request.action}' taken successfully",
            data=result,
        )
    except (PermissionDeniedError, ResourceNotFoundError) as e:
        logger.error(f"Error taking action: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in take_action_on_report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to take action on report",
        )


@router.post(
    "/admin/warnings",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue Warning (Admin)",
    description="Issue a warning to a user (admin only)",
)
async def issue_warning(
    request: IssueWarningRequest,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can issue warnings")

        admin_id = current_user["id"]
        report_service = ReportService(db)

        result = await report_service.issue_warning(
            user_id=request.user_id,
            admin_id=admin_id,
            reason=request.reason,
            severity=request.severity,
            report_id=request.report_id,
        )

        return StandardResponse(
            success=True, message="Warning issued successfully", data=result
        )
    except (PermissionDeniedError, ResourceNotFoundError, InvalidInputError) as e:
        logger.error(f"Error issuing warning: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in issue_warning: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to issue warning",
        )


@router.get(
    "/admin/warnings/user/{user_id}",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Warnings (Admin)",
    description="Get all warnings for a user (admin only)",
)
async def get_user_warnings(
    user_id: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    try:
        if current_user.get("role") != "admin":
            raise PermissionDeniedError(message="Only admins can view user warnings")

        report_service = ReportService(db)
        result = await report_service.get_user_warnings(user_id=user_id)

        return StandardResponse(
            success=True,
            message=f"Retrieved {len(result)} warnings",
            data={"warnings": result},
        )
    except PermissionDeniedError as e:
        logger.error(f"Permission denied: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_user_warnings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve warnings",
        )
