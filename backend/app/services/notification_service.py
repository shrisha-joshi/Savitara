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

logger = logging.getLogger(__name__)
settings = get_settings()


class FirebaseService:
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
            logger.warning(f"Firebase previously failed to initialize: {self._initialization_error}")
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
        fcm_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> str:
        """
        Send push notification to a single device
        
        Args:
            fcm_token: FCM registration token
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
                details={"error": "Firebase not configured", "reason": self._initialization_error}
            )
            
        try:
            # Build notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            # Build message
            message = messaging.Message(
                notification=notification,
                data=data or {},
                token=fcm_token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='savitara_notifications'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            
            # Send message
            response = messaging.send(message)
            
            logger.info(f"Notification sent successfully: {response}")
            return response
            
        except messaging.UnregisteredError:
            logger.warning(f"FCM token is invalid or unregistered: {fcm_token[:20]}...")
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": "Invalid or expired FCM token"}
            )
        except Exception as e:
            logger.error(f"Failed to send notification: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e)}
            )
    
    def send_multicast(
        self,
        fcm_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple devices
        
        Args:
            fcm_tokens: List of FCM registration tokens (max 500)
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
                details={"error": "Firebase not configured", "reason": self._initialization_error}
            )
            
        try:
            if len(fcm_tokens) > 500:
                raise ValueError("Maximum 500 tokens allowed per multicast")
            
            # Build notification
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            # Build multicast message
            message = messaging.MulticastMessage(
                notification=notification,
                data=data or {},
                tokens=fcm_tokens,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='savitara_notifications'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            
            # Send multicast
            response = messaging.send_multicast(message)
            
            logger.info(
                f"Multicast notification sent: {response.success_count} successful, "
                f"{response.failure_count} failed out of {len(fcm_tokens)} tokens"
            )
            
            # Log failed tokens
            if response.failure_count > 0:
                failed_tokens = [
                    fcm_tokens[idx] for idx, resp in enumerate(response.responses)
                    if not resp.success
                ]
                logger.warning(f"Failed tokens: {failed_tokens}")
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "total": len(fcm_tokens),
                "failed_tokens": [
                    fcm_tokens[idx] for idx, resp in enumerate(response.responses)
                    if not resp.success
                ]
            }
            
        except Exception as e:
            logger.error(f"Multicast notification failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e)}
            )
    
    def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
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
                title=title,
                body=body,
                image=image_url
            )
            
            # Build message
            message = messaging.Message(
                notification=notification,
                data=data or {},
                topic=topic,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='savitara_notifications'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            
            # Send to topic
            response = messaging.send(message)
            
            logger.info(f"Topic notification sent to '{topic}': {response}")
            return response
            
        except Exception as e:
            logger.error(f"Topic notification failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e), "topic": topic}
            )
    
    def subscribe_to_topic(
        self,
        fcm_tokens: List[str],
        topic: str
    ) -> Dict[str, Any]:
        """
        Subscribe devices to a topic
        
        Args:
            fcm_tokens: List of FCM tokens
            topic: Topic name
            
        Returns:
            Subscription results
        """
        try:
            response = messaging.subscribe_to_topic(fcm_tokens, topic)
            
            logger.info(
                f"Topic subscription '{topic}': {response.success_count} successful, "
                f"{response.failure_count} failed"
            )
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "topic": topic
            }
            
        except Exception as e:
            logger.error(f"Topic subscription failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e), "topic": topic}
            )
    
    def unsubscribe_from_topic(
        self,
        fcm_tokens: List[str],
        topic: str
    ) -> Dict[str, Any]:
        """
        Unsubscribe devices from a topic
        
        Args:
            fcm_tokens: List of FCM tokens
            topic: Topic name
            
        Returns:
            Unsubscription results
        """
        try:
            response = messaging.unsubscribe_from_topic(fcm_tokens, topic)
            
            logger.info(
                f"Topic unsubscription '{topic}': {response.success_count} successful, "
                f"{response.failure_count} failed"
            )
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "topic": topic
            }
            
        except Exception as e:
            logger.error(f"Topic unsubscription failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e), "topic": topic}
            )
    
    def send_data_message(
        self,
        fcm_token: str,
        data: Dict[str, str]
    ) -> str:
        """
        Send data-only message (no notification displayed)
        
        Useful for silent data sync, background updates
        
        Args:
            fcm_token: FCM registration token
            data: Data payload
            
        Returns:
            Message ID if successful
        """
        try:
            message = messaging.Message(
                data=data,
                token=fcm_token,
                android=messaging.AndroidConfig(
                    priority='high'
                ),
                apns=messaging.APNSConfig(
                    headers={'apns-priority': '10'},
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(content_available=True)
                    )
                )
            )
            
            response = messaging.send(message)
            
            logger.info(f"Data message sent: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Data message failed: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Firebase",
                details={"error": str(e)}
            )


# Singleton instance
_firebase_service: Optional[FirebaseService] = None


def get_firebase_service() -> FirebaseService:
    """Get Firebase service singleton instance"""
    global _firebase_service
    if _firebase_service is None:
        _firebase_service = FirebaseService()
    return _firebase_service
