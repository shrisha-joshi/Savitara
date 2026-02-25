"""
Unit Tests for ReportService
Tests the business logic for user and message reporting functionality
"""
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.report_service import ReportService
from app.models.moderation import ReportReason, ReportStatus, ReportAction
from app.core.exceptions import InvalidInputError, ResourceNotFoundError, PermissionDeniedError


@pytest.fixture
def mock_db():
    """Create mock database"""
    db = MagicMock()
    db.users = AsyncMock()
    db.user_reports = AsyncMock()
    db.messages = AsyncMock()
    db.warnings = AsyncMock()
    return db


@pytest.fixture
def report_service(mock_db):
    """Create ReportService instance with mock database"""
    return ReportService(mock_db)


class TestCreateReport:
    """Tests for create_report method"""

    @pytest.mark.asyncio
    async def test_create_user_report_success(self, report_service, mock_db):
        """Test successfully creating a user report"""
        reporter_id = str(ObjectId())
        reported_id = str(ObjectId())

        # Mock reported user exists
        mock_db.users.find_one.return_value = {
            "_id": ObjectId(reported_id),
            "email": "reported@test.com",
            "role": "grihasta",
        }

        # Mock insert
        inserted_id = ObjectId()
        mock_db.user_reports.insert_one.return_value = AsyncMock(inserted_id=inserted_id)

        result = await report_service.create_report(
            reporter_id=reporter_id,
            reported_user_id=reported_id,
            reason=ReportReason.SPAM,
            description="This user is sending spam messages repeatedly",
            evidence_urls=["https://example.com/screenshot.png"],
        )

        assert result.reporter_id == reporter_id
        assert result.reported_user_id == reported_id
        assert result.reason == "spam"
        assert result.status == "pending"
        assert result.priority >= 1
        assert result.priority <= 5
        assert mock_db.user_reports.insert_one.called

    @pytest.mark.asyncio
    async def test_create_message_report(self, report_service, mock_db):
        """Test creating a report for a specific message"""
        reporter_id = str(ObjectId())
        reported_id = str(ObjectId())
        message_id = str(ObjectId())

        # Mock reported user exists
        mock_db.users.find_one.return_value = {"_id": ObjectId(reported_id)}

        # Mock message exists
        mock_db.messages.find_one.return_value = {
            "_id": ObjectId(message_id),
            "content": "Inappropriate message content",
            "created_at": datetime.now(timezone.utc),
        }

        # Mock insert
        mock_db.user_reports.insert_one.return_value = AsyncMock(inserted_id=ObjectId())

        result = await report_service.create_report(
            reporter_id=reporter_id,
            reported_user_id=reported_id,
            reason=ReportReason.INAPPROPRIATE_CONTENT,
            description="Inappropriate language",
            message_id=message_id,
        )

        assert result.message_id == message_id
        assert "message_data" in result.metadata

    @pytest.mark.asyncio
    async def test_cannot_report_self(self, report_service):
        """Test that users cannot report themselves"""
        user_id = str(ObjectId())

        with pytest.raises(InvalidInputError) as exc_info:
            await report_service.create_report(
                reporter_id=user_id,
                reported_user_id=user_id,
                reason=ReportReason.SPAM,
                description="Test",
            )

        assert "Cannot report yourself" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_report_nonexistent_user(self, report_service, mock_db):
        """Test reporting a user that doesn't exist"""
        reporter_id = str(ObjectId())
        reported_id = str(ObjectId())

        # Mock user doesn't exist
        mock_db.users.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError) as exc_info:
            await report_service.create_report(
                reporter_id=reporter_id,
                reported_user_id=reported_id,
                reason=ReportReason.HARASSMENT,
                description="Test",
            )

        assert reported_id in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_report_nonexistent_message(self, report_service, mock_db):
        """Test reporting a message that doesn't exist"""
        reporter_id = str(ObjectId())
        reported_id = str(ObjectId())
        message_id = str(ObjectId())

        # Mock user exists
        mock_db.users.find_one.return_value = {"_id": ObjectId(reported_id)}

        # Mock message doesn't exist
        mock_db.messages.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError) as exc_info:
            await report_service.create_report(
                reporter_id=reporter_id,
                reported_user_id=reported_id,
                reason=ReportReason.SPAM,
                description="Test",
                message_id=message_id,
            )

        assert message_id in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_priority_calculation(self, report_service, mock_db):
        """Test that different reasons get appropriate priority levels"""
        reporter_id = str(ObjectId())
        reported_id = str(ObjectId())

        # Mock user exists
        mock_db.users.find_one.return_value = {"_id": ObjectId(reported_id)}
        mock_db.user_reports.insert_one.return_value = AsyncMock(inserted_id=ObjectId())

        # Test high priority reasons
        high_priority_reasons = [
            ReportReason.HATE_SPEECH,
            ReportReason.VIOLENCE,
            ReportReason.SCAM,
        ]

        for reason in high_priority_reasons:
            result = await report_service.create_report(
                reporter_id=reporter_id,
                reported_user_id=reported_id,
                reason=reason,
                description="Test",
            )
            # High priority reasons should get priority 4 or 5
            assert result.priority >= 4, f"{reason} should have high priority"


class TestGetReport:
    """Tests for get_report method"""

    @pytest.mark.asyncio
    async def test_get_report_success(self, report_service, mock_db):
        """Test getting a specific report"""
        report_id = str(ObjectId())
        user_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "reporter_id": user_id,
            "reported_user_id": str(ObjectId()),
            "reason": "spam",
            "description": "Test report",
            "status": "pending",
            "priority": 3,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        mock_db.user_reports.find_one.return_value = mock_report

        result = await report_service.get_report(report_id, user_id)

        assert str(result.id) == report_id
        assert result.reporter_id == user_id

    @pytest.mark.asyncio
    async def test_get_nonexistent_report(self, report_service, mock_db):
        """Test getting a report that doesn't exist"""
        report_id = str(ObjectId())
        user_id = str(ObjectId())

        mock_db.user_reports.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError):
            await report_service.get_report(report_id, user_id)

    @pytest.mark.asyncio
    async def test_get_report_permission_denied(self, report_service, mock_db):
        """Test that users can only view their own reports (unless admin)"""
        report_id = str(ObjectId())
        user_id = str(ObjectId())
        other_user_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "reporter_id": user_id,
            "reported_user_id": str(ObjectId()),
            "reason": "spam",
            "status": "pending",
            "priority": 3,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        mock_db.user_reports.find_one.return_value = mock_report

        with pytest.raises(PermissionDeniedError):
            await report_service.get_report(report_id, other_user_id, is_admin=False)


class TestGetUserReports:
    """Tests for get_user_reports method"""

    @pytest.mark.asyncio
    async def test_get_user_reports_as_reporter(self, report_service, mock_db):
        """Test getting reports created by user"""
        user_id = str(ObjectId())

        mock_reports = [
            {
                "_id": ObjectId(),
                "reporter_id": user_id,
                "reported_user_id": str(ObjectId()),
                "reason": "spam",
                "status": "pending",
                "priority": 3,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "reporter_id": user_id,
                "reported_user_id": str(ObjectId()),
                "reason": "harassment",
                "status": "resolved",
                "priority": 4,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        ]

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = mock_reports
        mock_db.user_reports.find.return_value = mock_cursor
        mock_db.user_reports.count_documents.return_value = 2

        result = await report_service.get_user_reports(
            user_id=user_id,
            include_reported=False,
            limit=20,
            offset=0,
        )

        assert result["total"] == 2
        assert len(result["reports"]) == 2
        assert all(r["reporter_id"] == user_id for r in result["reports"])

    @pytest.mark.asyncio
    async def test_get_reports_about_user(self, report_service, mock_db):
        """Test getting reports where user is reported"""
        user_id = str(ObjectId())

        mock_reports = [
            {
                "_id": ObjectId(),
                "reporter_id": str(ObjectId()),
                "reported_user_id": user_id,
                "reason": "spam",
                "status": "pending",
                "priority": 2,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        ]

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = mock_reports
        mock_db.user_reports.find.return_value = mock_cursor
        mock_db.user_reports.count_documents.return_value = 1

        result = await report_service.get_user_reports(
            user_id=user_id,
            include_reported=True,
            limit=20,
            offset=0,
        )

        assert result["total"] == 1
        assert result["reports"][0]["reported_user_id"] == user_id

    @pytest.mark.asyncio
    async def test_reports_pagination(self, report_service, mock_db):
        """Test pagination of reports"""
        user_id = str(ObjectId())

        # Mock empty result for page 2
        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = []
        mock_db.user_reports.find.return_value = mock_cursor
        mock_db.user_reports.count_documents.return_value = 0

        result = await report_service.get_user_reports(
            user_id=user_id,
            include_reported=False,
            limit=20,
            offset=40,
        )

        assert result["total"] == 0
        assert len(result["reports"]) == 0


class TestUpdateReportStatus:
    """Tests for update_report_status method (admin only)"""

    @pytest.mark.asyncio
    async def test_update_status_success(self, report_service, mock_db):
        """Test admin updating report status"""
        report_id = str(ObjectId())
        admin_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "status": "pending",
            "priority": 3,
        }

        mock_db.user_reports.find_one.return_value = mock_report
        mock_db.user_reports.update_one.return_value = AsyncMock(modified_count=1)

        result = await report_service.update_report_status(
            report_id=report_id,
            admin_id=admin_id,
            new_status=ReportStatus.REVIEWING,
            admin_notes="Under investigation",
        )

        assert result.status == "reviewing"
        assert result.admin_notes == "Under investigation"
        assert result.reviewed_by == admin_id
        mock_db.user_reports.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_nonexistent_report(self, report_service, mock_db):
        """Test updating a report that doesn't exist"""
        report_id = str(ObjectId())
        admin_id = str(ObjectId())

        mock_db.user_reports.find_one.return_value = None

        with pytest.raises(ResourceNotFoundError):
            await report_service.update_report_status(
                report_id=report_id,
                admin_id=admin_id,
                new_status=ReportStatus.RESOLVED,
            )


class TestTakeAction:
    """Tests for take_action method (admin action on reports)"""

    @pytest.mark.asyncio
    async def test_take_action_warning(self, report_service, mock_db):
        """Test issuing a warning as report action"""
        report_id = str(ObjectId())
        admin_id = str(ObjectId())
        reported_user_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "reported_user_id": str(reported_user_id),
            "status": "pending",
        }

        mock_db.user_reports.find_one.return_value = mock_report
        mock_db.user_reports.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.warnings.insert_one.return_value = AsyncMock(inserted_id=ObjectId())

        with patch('app.services.report_service.NotificationService') as mock_notification:
            mock_notification_instance = AsyncMock()
            mock_notification.return_value = mock_notification_instance

            result = await report_service.take_action(
                report_id=report_id,
                admin_id=admin_id,
                action_type=ReportAction.WARNING,
                details="First warning for spam",
                warning_level=1,
            )

        assert result.status == "action_taken"
        assert result.action_type == "warning"
        mock_db.warnings.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_take_action_ban(self, report_service, mock_db):
        """Test banning a user as report action"""
        report_id = str(ObjectId())
        admin_id = str(ObjectId())
        reported_user_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "reported_user_id": str(reported_user_id),
            "status": "reviewing",
        }

        mock_db.user_reports.find_one.return_value = mock_report
        mock_db.user_reports.update_one.return_value = AsyncMock(modified_count=1)
        mock_db.users.update_one.return_value = AsyncMock(modified_count=1)

        with patch('app.services.report_service.NotificationService') as mock_notification:
            mock_notification_instance = AsyncMock()
            mock_notification.return_value = mock_notification_instance

            result = await report_service.take_action(
                report_id=report_id,
                admin_id=admin_id,
                action_type=ReportAction.BAN,
                details="Banned for 7 days due to harassment",
                ban_duration_days=7,
            )

        assert result.status == "action_taken"
        assert result.action_type == "ban"
        # Should update user's banned_until field
        mock_db.users.update_one.assert_called_once()


class TestDismissReport:
    """Tests for dismiss_report method"""

    @pytest.mark.asyncio
    async def test_dismiss_report_success(self, report_service, mock_db):
        """Test dismissing a report"""
        report_id = str(ObjectId())
        admin_id = str(ObjectId())

        mock_report = {
            "_id": ObjectId(report_id),
            "status": "pending",
        }

        mock_db.user_reports.find_one.return_value = mock_report
        mock_db.user_reports.update_one.return_value = AsyncMock(modified_count=1)

        result = await report_service.dismiss_report(
            report_id=report_id,
            admin_id=admin_id,
            reason="Not a violation of terms",
        )

        assert result.status == "dismissed"
        assert "Not a violation" in result.admin_notes


class TestGetPendingReports:
    """Tests for get_pending_reports method (admin queue)"""

    @pytest.mark.asyncio
    async def test_get_pending_reports_sorted_by_priority(self, report_service, mock_db):
        """Test that pending reports are sorted by priority"""
        mock_reports = [
            {
                "_id": ObjectId(),
                "priority": 5,
                "status": "pending",
                "reason": "violence",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "priority": 3,
                "status": "pending",
                "reason": "spam",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "priority": 4,
                "status": "pending",
                "reason": "harassment",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            },
        ]

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = mock_reports
        mock_db.user_reports.find.return_value = mock_cursor

        result = await report_service.get_pending_reports(limit=20)

        assert len(result) == 3
        # Should be sorted by priority descending
        assert result[0]["priority"] == 5
        assert result[1]["priority"] == 4
        assert result[2]["priority"] == 3


class TestGetUserWarnings:
    """Tests for get_user_warnings method"""

    @pytest.mark.asyncio
    async def test_get_user_warnings(self, report_service, mock_db):
        """Test getting warnings for a user"""
        user_id = str(ObjectId())

        mock_warnings = [
            {
                "_id": ObjectId(),
                "user_id": user_id,
                "level": 1,
                "reason": "spam",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "_id": ObjectId(),
                "user_id": user_id,
                "level": 2,
                "reason": "harassment",
                "created_at": datetime.now(timezone.utc),
            },
        ]

        mock_cursor = AsyncMock()
        mock_cursor.to_list.return_value = mock_warnings
        mock_db.warnings.find.return_value = mock_cursor

        result = await report_service.get_user_warnings(user_id)

        assert len(result) == 2
        assert all(w["user_id"] == user_id for w in result)
