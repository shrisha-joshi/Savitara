"""
Audit Logging Service
Tracks all critical user actions for compliance and security
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from enum import Enum

logger = logging.getLogger(__name__)


class AuditAction(str, Enum):
    """Enumeration of auditable actions"""

    # Authentication
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET = "PASSWORD_RESET"

    # User Management
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    USER_DELETE = "USER_DELETE"
    USER_VIEW = "USER_VIEW"

    # Booking Operations
    BOOKING_CREATE = "BOOKING_CREATE"
    BOOKING_UPDATE = "BOOKING_UPDATE"
    BOOKING_CANCEL = "BOOKING_CANCEL"
    BOOKING_COMPLETE = "BOOKING_COMPLETE"

    # Payment Operations
    PAYMENT_INITIATE = "PAYMENT_INITIATE"
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYMENT_REFUND = "PAYMENT_REFUND"

    # Admin Operations
    ADMIN_ACCESS = "ADMIN_ACCESS"
    USER_BAN = "USER_BAN"
    USER_UNBAN = "USER_UNBAN"
    VERIFICATION_APPROVE = "VERIFICATION_APPROVE"
    VERIFICATION_REJECT = "VERIFICATION_REJECT"

    # Data Operations
    DATA_EXPORT = "DATA_EXPORT"
    DATA_DELETE = "DATA_DELETE"
    SENSITIVE_DATA_ACCESS = "SENSITIVE_DATA_ACCESS"


class AuditSeverity(str, Enum):
    """Severity levels for audit events"""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AuditService:
    """
    Comprehensive audit logging service
    Tracks all critical operations for security and compliance
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.audit_logs
        self.logger = logging.getLogger(__name__)

    async def log_action(
        self,
        user_id: str,
        action: AuditAction,
        resource_type: str,
        resource_id: str,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> str:
        """
        Log an auditable action

        Args:
            user_id: ID of user performing action
            action: Type of action (from AuditAction enum)
            resource_type: Type of resource affected (user, booking, payment, etc.)
            resource_id: ID of affected resource
            details: Additional context about the action
            ip_address: Client IP address
            user_agent: Client user agent string
            success: Whether action succeeded
            error_message: Error message if action failed

        Returns:
            Audit log entry ID
        """
        severity = self._determine_severity(action, success)

        audit_entry = {
            "user_id": user_id,
            "action": action.value,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "success": success,
            "error_message": error_message,
            "severity": severity.value,
            "timestamp": datetime.now(timezone.utc),
            "indexed": False,  # For batch processing
        }

        try:
            result = await self.collection.insert_one(audit_entry)

            # Log to application logger based on severity
            log_method = {
                AuditSeverity.LOW: self.logger.info,
                AuditSeverity.MEDIUM: self.logger.warning,
                AuditSeverity.HIGH: self.logger.error,
                AuditSeverity.CRITICAL: self.logger.critical,
            }.get(severity, self.logger.info)

            log_method(
                f"AUDIT [{severity.value}]: User {user_id} performed {action.value} on {resource_type}:{resource_id}",
                extra={
                    "audit_id": str(result.inserted_id),
                    "user_id": user_id,
                    "action": action.value,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "ip": ip_address,
                    "success": success,
                },
            )

            return str(result.inserted_id)

        except Exception as e:
            self.logger.error(f"Failed to log audit entry: {e}")
            # Don't let audit logging failure affect main operation
            return ""

    def _determine_severity(self, action: AuditAction, success: bool) -> AuditSeverity:
        """Determine severity based on action type and outcome"""

        # Critical actions
        critical_actions = [
            AuditAction.DATA_DELETE,
            AuditAction.USER_BAN,
            AuditAction.ADMIN_ACCESS,
            AuditAction.SENSITIVE_DATA_ACCESS,
        ]

        # High severity actions
        high_actions = [
            AuditAction.PASSWORD_CHANGE,
            AuditAction.PAYMENT_FAILED,
            AuditAction.PAYMENT_REFUND,
            AuditAction.USER_DELETE,
            AuditAction.VERIFICATION_REJECT,
        ]

        # Failed login attempts are high severity
        if action == AuditAction.LOGIN_FAILED:
            return AuditSeverity.HIGH

        # Failed critical/high actions are critical
        if not success and action in (critical_actions + high_actions):
            return AuditSeverity.CRITICAL

        if action in critical_actions:
            return AuditSeverity.CRITICAL

        if action in high_actions:
            return AuditSeverity.HIGH

        # Medium severity for financial operations
        medium_actions = [
            AuditAction.PAYMENT_INITIATE,
            AuditAction.PAYMENT_SUCCESS,
            AuditAction.BOOKING_CREATE,
            AuditAction.USER_CREATE,
        ]

        if action in medium_actions:
            return AuditSeverity.MEDIUM

        return AuditSeverity.LOW

    async def get_audit_trail(
        self,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        severity: Optional[AuditSeverity] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        success: Optional[bool] = None,
        limit: int = 100,
        skip: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve audit logs with filtering

        Args:
            Various filter parameters
            limit: Max results to return
            skip: Number of results to skip (pagination)

        Returns:
            List of audit log entries
        """
        query = {}

        if user_id:
            query["user_id"] = user_id

        if resource_type:
            query["resource_type"] = resource_type

        if resource_id:
            query["resource_id"] = resource_id

        if action:
            query["action"] = action.value

        if severity:
            query["severity"] = severity.value

        if success is not None:
            query["success"] = success

        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date

        try:
            cursor = (
                self.collection.find(query)
                .sort("timestamp", -1)
                .skip(skip)
                .limit(limit)
            )
            logs = await cursor.to_list(length=limit)

            # Convert ObjectId to string
            for log in logs:
                log["_id"] = str(log["_id"])

            return logs

        except Exception as e:
            self.logger.error(f"Failed to retrieve audit logs: {e}")
            return []

    async def get_user_activity_summary(
        self, user_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """
        Get summary of user's activity for the past N days

        Returns:
            Dictionary with activity statistics
        """
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": start_date}}},
            {
                "$group": {
                    "_id": "$action",
                    "count": {"$sum": 1},
                    "failed_count": {
                        "$sum": {"$cond": [{"$eq": ["$success", False]}, 1, 0]}
                    },
                }
            },
        ]

        try:
            results = await self.collection.aggregate(pipeline).to_list(length=100)

            summary = {
                "user_id": user_id,
                "period_days": days,
                "actions": {
                    result["_id"]: {
                        "total": result["count"],
                        "failed": result["failed_count"],
                    }
                    for result in results
                },
                "total_actions": sum(r["count"] for r in results),
                "total_failures": sum(r["failed_count"] for r in results),
            }

            return summary

        except Exception as e:
            self.logger.error(f"Failed to get activity summary: {e}")
            return {}

    async def get_security_alerts(
        self, hours: int = 24, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get recent security-related audit events

        Args:
            hours: Look back period in hours
            limit: Max alerts to return

        Returns:
            List of security alerts
        """
        start_time = datetime.now(timezone.utc) - timedelta(hours=hours)

        query = {
            "timestamp": {"$gte": start_time},
            "severity": {
                "$in": [AuditSeverity.HIGH.value, AuditSeverity.CRITICAL.value]
            },
        }

        try:
            cursor = self.collection.find(query).sort("timestamp", -1).limit(limit)
            alerts = await cursor.to_list(length=limit)

            for alert in alerts:
                alert["_id"] = str(alert["_id"])

            return alerts

        except Exception as e:
            self.logger.error(f"Failed to get security alerts: {e}")
            return []


# End of file

# Usage example:
"""
# In your API endpoint:
from app.services.audit_service import AuditService, AuditAction

audit = AuditService(db)

# Log a booking creation
await audit.log_action(
    user_id=current_user.id,
    action=AuditAction.BOOKING_CREATE,
    resource_type="booking",
    resource_id=str(booking.id),
    details={
        "acharya_id": booking.acharya_id,
        "amount": booking.total_amount
    },
    ip_address=request.client.host,
    user_agent=request.headers.get("user-agent")
)

# Log a failed login
await audit.log_action(
    user_id=user_email,
    action=AuditAction.LOGIN_FAILED,
    resource_type="user",
    resource_id=user_email,
    ip_address=request.client.host,
    user_agent=request.headers.get("user-agent"),
    success=False,
    error_message="Invalid credentials"
)

# Get audit trail for a user
logs = await audit.get_audit_trail(
    user_id=user_id,
    start_date=datetime.now() - timedelta(days=30)
)

# Get security alerts
alerts = await audit.get_security_alerts(hours=24)
"""
