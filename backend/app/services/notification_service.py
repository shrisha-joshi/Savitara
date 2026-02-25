"""
Firebase Cloud Messaging Service
Handles push notification sending and FCM token management
SonarQube: S6437 - Firebase credentials from secure file
"""
import firebase_admin  # type: ignore
from firebase_admin import credentials, messaging  # type: ignore
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError
from app.core.interfaces import INotificationService

logger = logging.getLogger(__name__)
settings = get_settings()


class NotificationService(INotificationService):
    """Firebase Cloud Messaging service"""

    def __init__(self):
        """Initialize Firebase Admin SDK with lazy loading"""
        self._initialized = False
        self._initialization_error = None

    def _ensure_initialized(self):
        """Lazy initialization of Firebase - only when first used"""
        if self._initialized:
            return True

        if self._initialization_error:
            logger.warning(
                f"Firebase previously failed to initialize: {self._initialization_error}"
            )
            return False

        try:
            # Check if Firebase is already initialized
            if not firebase_admin._apps:
                # SonarQube: S6437 - Credentials from secure file path
                cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)

                if not cred_path.exists():
                    error_msg = f"Firebase credentials file not found: {cred_path}"
                    logger.warning(f"{error_msg} - Push notifications will be disabled")
                    self._initialization_error = error_msg
                    return False

                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred)

                logger.info("Firebase Admin SDK initialized successfully")
            else:
                logger.info("Firebase Admin SDK already initialized")

            self._initialized = True
            return True

        except Exception as e:
            error_msg = f"Firebase initialization error: {e}"
            logger.warning(f"{error_msg} - Push notifications will be disabled")
            self._initialization_error = str(e)
            return False

    def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
    ) -> str:
        """
        Send push notification to a single device

        Args:
            token: FCM registration token
            title: Notification title
            body: Notification body
            data: Additional data payload
            image_url: Optional notification image URL

        Returns:
            Message ID if successful

        Raises:
            ExternalServiceError: If notification sending fails
        """
        # Check if Firebase is initialized
        if not self._ensure_initialized():
            logger.warning("Firebase not initialized - notification not sent")
            raise ExternalServiceError(
                service_name="Firebase",
                details={
                    "error": "Firebase not configured",
                    "reason": self._initialization_error,
                },
            )

        try:
            # Build notification
            notification = messaging.Notification(
                title=title, body=body, image=image_url
            )

            # Build message
            message = messaging.Message(
                notification=notification,
                data=data or {},
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default", channel_id="savitara_notifications"
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                ),
            )

            # Send message
            response = messaging.send(message)

            logger.info(f"Notification sent successfully: {response}")
            return response

        except messaging.UnregisteredError:
            logger.warning(f"FCM token is invalid or unregistered: {token[:20]}...")
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": "Invalid or expired FCM token"},
            )
        except Exception as e:
            logger.error(f"Failed to send notification: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e)}
            )

    def send_multicast_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Interface-required alias for send_multicast (without image_url)."""
        return self.send_multicast(tokens=tokens, title=title, body=body, data=data)

    def send_topic_notification(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> str:
        """Interface-required alias for send_to_topic (without image_url)."""
        return self.send_to_topic(topic=topic, title=title, body=body, data=data)

    def send_multicast(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple devices

        Args:
            tokens: List of FCM registration tokens (max 500)
            title: Notification title
            body: Notification body
            data: Additional data payload
            image_url: Optional notification image URL

        Returns:
            Results with success/failure counts
        """
        # Check if Firebase is initialized
        if not self._ensure_initialized():
            logger.warning("Firebase not initialized - multicast notification not sent")
            raise ExternalServiceError(
                service_name="Firebase",
                details={
                    "error": "Firebase not configured",
                    "reason": self._initialization_error,
                },
            )

        try:
            if len(tokens) > 500:
                raise ValueError("Maximum 500 tokens allowed per multicast")

            # Build notification
            notification = messaging.Notification(
                title=title, body=body, image=image_url
            )

            # Build multicast message
            message = messaging.MulticastMessage(
                notification=notification,
                data=data or {},
                tokens=tokens,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default", channel_id="savitara_notifications"
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                ),
            )

            # Send multicast
            response = messaging.send_multicast(message)

            logger.info(
                f"Multicast notification sent: {response.success_count} successful, "
                f"{response.failure_count} failed out of {len(tokens)} tokens"
            )

            # Log failed tokens
            if response.failure_count > 0:
                failed_tokens = [
                    tokens[idx]
                    for idx, resp in enumerate(response.responses)
                    if not resp.success
                ]
                logger.warning(f"Failed tokens: {failed_tokens}")

            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "total": len(tokens),
                "failed_tokens": [
                    tokens[idx]
                    for idx, resp in enumerate(response.responses)
                    if not resp.success
                ],
            }

        except Exception as e:
            logger.error(f"Multicast notification failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e)}
            )

    def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
    ) -> str:
        """
        Send push notification to a topic

        Topics allow sending to multiple devices subscribed to that topic

        Args:
            topic: Topic name (e.g., 'all_grihastas', 'all_acharyas')
            title: Notification title
            body: Notification body
            data: Additional data payload
            image_url: Optional notification image URL

        Returns:
            Message ID if successful
        """
        try:
            # Build notification
            notification = messaging.Notification(
                title=title, body=body, image=image_url
            )

            # Build message
            message = messaging.Message(
                notification=notification,
                data=data or {},
                topic=topic,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        sound="default", channel_id="savitara_notifications"
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                ),
            )

            # Send to topic
            response = messaging.send(message)

            logger.info(f"Topic notification sent to '{topic}': {response}")
            return response

        except Exception as e:
            logger.error(f"Topic notification failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e), "topic": topic}
            )

    def subscribe_to_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """
        Subscribe devices to a topic

        Args:
            tokens: List of FCM tokens
            topic: Topic name

        Returns:
            Subscription results
        """
        try:
            response = messaging.subscribe_to_topic(tokens, topic)

            logger.info(
                f"Topic subscription '{topic}': {response.success_count} successful, "
                f"{response.failure_count} failed"
            )

            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "topic": topic,
            }

        except Exception as e:
            logger.error(f"Topic subscription failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e), "topic": topic}
            )

    def unsubscribe_from_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """
        Unsubscribe devices from a topic

        Args:
            tokens: List of FCM tokens
            topic: Topic name

        Returns:
            Unsubscription results
        """
        try:
            response = messaging.unsubscribe_from_topic(tokens, topic)

            logger.info(
                f"Topic unsubscription '{topic}': {response.success_count} successful, "
                f"{response.failure_count} failed"
            )

            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "topic": topic,
            }

        except Exception as e:
            logger.error(f"Topic unsubscription failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e), "topic": topic}
            )

    def send_data_message(self, token: str, data: Dict[str, str]) -> str:
        """
        Send data-only message (no notification displayed)

        Useful for silent data sync, background updates

        Args:
            token: FCM registration token
            data: Data payload

        Returns:
            Message ID if successful
        """
        try:
            message = messaging.Message(
                data=data,
                token=token,
                android=messaging.AndroidConfig(priority="high"),
                apns=messaging.APNSConfig(
                    headers={"apns-priority": "10"},
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(content_available=True)
                    ),
                ),
            )

            response = messaging.send(message)

            logger.info(f"Data message sent: {response}")
            return response

        except Exception as e:
            logger.error(f"Data message failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase", details={"error": str(e)}
            )

    # ============ Moderation-Specific Notifications ============

    def send_block_notification(
        self, token: str, blocker_name: str, is_mutual: bool = False
    ) -> Optional[str]:
        """
        Send notification when user is blocked

        Args:
            token: FCM token of the blocked user
            blocker_name: Name of the user who blocked
            is_mutual: Whether this is a mutual block

        Returns:
            Message ID or None if failed
        """
        try:
            title = "User Interaction Blocked"
            if is_mutual:
                body = f"You and {blocker_name} can no longer interact"
            else:
                body = f"{blocker_name} has blocked you"

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={"type": "user_blocked", "is_mutual": str(is_mutual)},
            )
        except Exception as e:
            logger.error(f"Failed to send block notification: {e}")
            return None

    def send_report_notification(
        self, token: str, report_id: str, admin_action: Optional[str] = None
    ) -> Optional[str]:
        """
        Send notification about report status

        Args:
            token: FCM token of the reporter
            report_id: Report ID
            admin_action: Action taken by admin (if any)

        Returns:
            Message ID or None if failed
        """
        try:
            if admin_action:
                title = "Report Update"
                body = f"Your report has been reviewed. Action taken: {admin_action}"
            else:
                title = "Report Received"
                body = "Thank you for your report. Our team will review it soon."

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={"type": "report_update", "report_id": report_id},
            )
        except Exception as e:
            logger.error(f"Failed to send report notification: {e}")
            return None

    def send_warning_notification(
        self, token: str, reason: str, severity: int
    ) -> Optional[str]:
        """
        Send notification when user receives a warning

        Args:
            token: FCM token of the warned user
            reason: Reason for warning
            severity: Warning severity (1-5)

        Returns:
            Message ID or None if failed
        """
        try:
            title = "Community Guidelines Warning"
            severity_text = ["", "Minor", "Moderate", "Serious", "Severe", "Critical"][
                min(severity, 5)
            ]
            body = f"{severity_text} warning: {reason}"

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={
                    "type": "user_warning",
                    "severity": str(severity),
                    "reason": reason,
                },
            )
        except Exception as e:
            logger.error(f"Failed to send warning notification: {e}")
            return None

    def send_member_muted_notification(
        self,
        token: str,
        group_name: str,
        duration_hours: Optional[int] = None,
        admin_name: str = "Admin",
    ) -> Optional[str]:
        """
        Send notification when member is muted in a group

        Args:
            token: FCM token of the muted user
            group_name: Name of the group
            duration_hours: Mute duration in hours (None = indefinite)
            admin_name: Name of the admin who muted

        Returns:
            Message ID or None if failed
        """
        try:
            title = f"Muted in {group_name}"
            if duration_hours:
                body = f"{admin_name} muted you for {duration_hours} hours"
            else:
                body = f"{admin_name} muted you indefinitely"

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={
                    "type": "member_muted",
                    "group_name": group_name,
                    "duration_hours": str(duration_hours) if duration_hours else "indefinite",
                },
            )
        except Exception as e:
            logger.error(f"Failed to send mute notification: {e}")
            return None

    def send_member_removed_notification(
        self, token: str, group_name: str, admin_name: str = "Admin"
    ) -> Optional[str]:
        """
        Send notification when member is removed from a group

        Args:
            token: FCM token of the removed user
            group_name: Name of the group
            admin_name: Name of the admin who removed

        Returns:
            Message ID or None if failed
        """
        try:
            title = f"Removed from {group_name}"
            body = f"{admin_name} removed you from the group"

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={"type": "member_removed", "group_name": group_name},
            )
        except Exception as e:
            logger.error(f"Failed to send removal notification: {e}")
            return None

    def send_role_changed_notification(
        self, token: str, group_name: str, new_role: str, owner_name: str = "Owner"
    ) -> Optional[str]:
        """
        Send notification when member's role changes

        Args:
            token: FCM token of the user
            group_name: Name of the group
            new_role: New role (admin or member)
            owner_name: Name of the owner who changed the role

        Returns:
            Message ID or None if failed
        """
        try:
            title = f"Role Changed in {group_name}"
            role_display = "Administrator" if new_role == "admin" else "Member"
            body = f"{owner_name} changed your role to {role_display}"

            return self.send_notification(
                token=token,
                title=title,
                body=body,
                data={
                    "type": "role_changed",
                    "group_name": group_name,
                    "new_role": new_role,
                },
            )
        except Exception as e:
            logger.error(f"Failed to send role change notification: {e}")
            return None


# Singleton instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """Get Notification service singleton instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
