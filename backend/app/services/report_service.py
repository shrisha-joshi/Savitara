"""
Report Service
Handles user and message reporting functionality
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.moderation import UserReport, ReportStatus, ReportReason, ReportAction
from app.core.exceptions import InvalidInputError, ResourceNotFoundError, PermissionDeniedError
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """Service for managing user reports"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def create_report(
        self,
        reporter_id: str,
        reported_user_id: str,
        reason: ReportReason,
        description: str = "",
        message_id: Optional[str] = None,
        evidence_urls: List[str] = None,
        context: str = "",
    ) -> UserReport:
        """
        Create a new user/message report
        
        Args:
            reporter_id: ID of user filing the report
            reported_user_id: ID of user being reported
            reason: Reason for the report
            description: Detailed description
            message_id: Optional message ID being reported
            evidence_urls: Optional URLs to evidence (screenshots, etc.)
            context: Context (booking ID, conversation ID, etc.)
            
        Returns:
            UserReport: The created report
            
        Raises:
            InvalidInputError: If trying to report self or invalid data
            ResourceNotFoundError: If reported user doesn't exist
        """
        # Validate can't report yourself
        if reporter_id == reported_user_id:
            raise InvalidInputError("reported_user_id", "Cannot report yourself")

        # Verify reported user exists
        reported_user = await self.db.users.find_one(
            {"_id": ObjectId(reported_user_id)}
        )
        if not reported_user:
            raise ResourceNotFoundError(
                resource_type="User", resource_id=reported_user_id
            )

        # If message_id provided, verify it exists
        message_data = None
        if message_id:
            message = await self.db.messages.find_one({"_id": ObjectId(message_id)})
            if not message:
                raise ResourceNotFoundError(
                    resource_type="Message", resource_id=message_id
                )
            message_data = {
                "content": message.get("content", ""),
                "created_at": message.get("created_at"),
            }

        # Calculate priority based on reason
        priority = self._calculate_priority(reason)

        # Create report
        report_data = {
            "reporter_id": reporter_id,
            "reported_user_id": reported_user_id,
            "message_id": message_id,
            "reason": reason.value if isinstance(reason, ReportReason) else reason,
            "description": description.strip(),
            "evidence_urls": evidence_urls or [],
            "context": context,
            "metadata": {"message_data": message_data} if message_data else {},
            "status": ReportStatus.PENDING.value,
            "priority": priority,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = await self.db.user_reports.insert_one(report_data)
        report_data["_id"] = str(result.inserted_id)

        logger.info(
            f"User {reporter_id} reported user {reported_user_id} for {reason} (report_id: {report_data['_id']})"
        )

        return UserReport(**report_data)

    def _calculate_priority(self, reason: ReportReason) -> int:
        """Calculate priority (1-5) based on report reason"""
        high_priority_reasons = {
            ReportReason.VIOLENCE,
            ReportReason.HATE_SPEECH,
            ReportReason.SCAM,
        }
        medium_priority_reasons = {
            ReportReason.HARASSMENT,
            ReportReason.INAPPROPRIATE_CONTENT,
        }

        if reason in high_priority_reasons:
            return 5
        elif reason in medium_priority_reasons:
            return 3
        else:
            return 1

    def _build_cursor_query(self, cursor: Optional[str]) -> Dict[str, Any]:
        """Build query filter from cursor"""
        if not cursor:
            return {}
        
        try:
            import base64
            cursor_id = base64.b64decode(cursor).decode()
            return {"_id": {"$lt": ObjectId(cursor_id)}}
        except Exception:
            return {}  # Invalid cursor, ignore

    def _generate_next_cursor(self, reports: List[Dict[str, Any]], limit: int) -> Optional[str]:
        """Generate next cursor for pagination"""
        has_more = len(reports) > limit
        if not has_more or not reports:
            return None
        
        import base64
        return base64.b64encode(str(reports[limit - 1]["_id"]).encode()).decode()

    async def _enrich_report_with_users(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a single report with user details"""
        # Get reporter and reported user details
        reporter = await self.db.users.find_one(
            {"_id": ObjectId(report["reporter_id"])}
        )
        reported = await self.db.users.find_one(
            {"_id": ObjectId(report["reported_user_id"])}
        )

        # Build enriched report
        reporter_id = str(reporter["_id"]) if reporter else report["reporter_id"]
        reporter_name = reporter.get("name", "Unknown") if reporter else "Unknown"
        reporter_email = reporter.get("email", "") if reporter else ""

        reported_id = str(reported["_id"]) if reported else report["reported_user_id"]
        reported_name = reported.get("name", "Unknown") if reported else "Unknown"
        reported_email = reported.get("email", "") if reported else ""
        reported_role = reported.get("role", "user") if reported else "user"

        return {
            **{k: (str(v) if k == "_id" else v) for k, v in report.items()},
            "reporter": {
                "id": reporter_id,
                "name": reporter_name,
                "email": reporter_email,
            },
            "reported_user": {
                "id": reported_id,
                "name": reported_name,
                "email": reported_email,
                "role": reported_role,
            },
        }

    async def get_reports(
        self,
        status: Optional[ReportStatus] = None,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get reports with pagination (for admins)
        
        Args:
            status: Filter by status
            limit: Maximum number of results
            cursor: Pagination cursor (ObjectId as base64)
            
        Returns:
            Dict with reports, next_cursor, has_more
        """
        query = {}
        if status:
            query["status"] = status.value if isinstance(status, ReportStatus) else status

        # Add cursor to query
        cursor_filter = self._build_cursor_query(cursor)
        query.update(cursor_filter)

        # Fetch reports
        reports = (
            await self.db.user_reports.find(query)
            .sort("created_at", -1)
            .limit(limit + 1)  # Fetch one extra to check has_more
            .to_list(length=limit + 1)
        )

        has_more = len(reports) > limit
        result_reports = reports[:limit] if has_more else reports

        # Generate next cursor
        next_cursor = self._generate_next_cursor(reports, limit) if has_more else None

        # Enrich with user data
        enriched_reports = []
        for report in result_reports:
            enriched = await self._enrich_report_with_users(report)
            enriched_reports.append(enriched)

        return {
            "reports": enriched_reports,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "total_returned": len(enriched_reports),
        }

    async def update_report_status(
        self,
        report_id: str,
        admin_id: str,
        status: ReportStatus,
        action_taken: Optional[ReportAction] = None,
        admin_notes: str = "",
    ) -> UserReport:
        """
        Update report status (admin only)
        
        Args:
            report_id: ID of report
            admin_id: ID of admin updating
            status: New status
            action_taken: Action taken on report
            admin_notes: Admin's notes
            
        Returns:
            Updated UserReport
            
        Raises:
            ResourceNotFoundError: If report doesn't exist
        """
        report = await self.db.user_reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise ResourceNotFoundError(resource_type="Report", resource_id=report_id)

        update_data = {
            "status": status.value if isinstance(status, ReportStatus) else status,
            "reviewed_by": admin_id,
            "reviewed_at": datetime.now(timezone.utc),
            "admin_notes": admin_notes,
            "updated_at": datetime.now(timezone.utc),
        }

        if action_taken:
            update_data["action_taken"] = (
                action_taken.value
                if isinstance(action_taken, ReportAction)
                else action_taken
            )

        await self.db.user_reports.update_one(
            {"_id": ObjectId(report_id)}, {"$set": update_data}
        )

        updated_report = await self.db.user_reports.find_one({"_id": ObjectId(report_id)})

        logger.info(
            f"Admin {admin_id} updated report {report_id} to status {status} with action {action_taken}"
        )

        return UserReport(**updated_report)

    async def get_user_report_count(self, user_id: str) -> Dict[str, int]:
        """
        Get count of reports filed by and against a user
        
        Args:
            user_id: User ID to check
            
        Returns:
            Dict with filed_count and received_count
        """
        filed_count = await self.db.user_reports.count_documents(
            {"reporter_id": user_id}
        )
        received_count = await self.db.user_reports.count_documents(
            {"reported_user_id": user_id}
        )

        return {"filed_count": filed_count, "received_count": received_count}
