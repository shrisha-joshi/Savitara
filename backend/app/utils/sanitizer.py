"""
Security Utilities for Input Sanitization and Token Management
Provides XSS sanitization, HTML cleaning, and token blacklisting
SonarQube: S5131 - XSS Prevention
"""
import re
import html
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# HTML tags that are never allowed
DISALLOWED_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'link', 'style', 'meta', 'base', 'applet', 'audio', 'video', 'source',
    'track', 'canvas', 'svg', 'math'
]

# Attributes that could be dangerous
DANGEROUS_ATTRIBUTES = [
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
    'onmousemove', 'onmouseout', 'onkeydown', 'onkeypress', 'onkeyup',
    'onload', 'onerror', 'onabort', 'onchange', 'onfocus', 'onblur',
    'onsubmit', 'onreset', 'onselect', 'onscroll', 'onresize', 'onunload',
    'href', 'src', 'data', 'action', 'formaction', 'style', 'background'
]

# Regex patterns for dangerous content
SCRIPT_PATTERN = re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL)
STYLE_PATTERN = re.compile(r'<style[^>]*>.*?</style>', re.IGNORECASE | re.DOTALL)
EVENT_HANDLER_PATTERN = re.compile(r'\bon\w+\s*=', re.IGNORECASE)
JAVASCRIPT_PROTOCOL = re.compile(r'javascript:', re.IGNORECASE)
DATA_PROTOCOL = re.compile(r'data:', re.IGNORECASE)
VB_PROTOCOL = re.compile(r'vbscript:', re.IGNORECASE)


class InputSanitizer:
    """
    Sanitizes user input to prevent XSS attacks
    """
    
    @staticmethod
    def sanitize_string(value: str, allow_html: bool = False) -> str:
        """
        Sanitize a string value
        
        Args:
            value: The input string to sanitize
            allow_html: If True, allows safe HTML; if False, escapes all HTML
            
        Returns:
            Sanitized string
        """
        if not value:
            return value
            
        # Remove null bytes
        value = value.replace('\x00', '')
        
        if not allow_html:
            # Escape all HTML entities
            return html.escape(value, quote=True)
        
        # Remove dangerous tags
        for tag in DISALLOWED_TAGS:
            pattern = re.compile(rf'<{tag}[^>]*>.*?</{tag}>', re.IGNORECASE | re.DOTALL)
            value = pattern.sub('', value)
            # Also remove self-closing versions
            pattern = re.compile(rf'<{tag}[^>]*/>', re.IGNORECASE)
            value = pattern.sub('', value)
            # Remove opening tags without closing
            pattern = re.compile(rf'<{tag}[^>]*>', re.IGNORECASE)
            value = pattern.sub('', value)
        
        # Remove event handlers
        value = EVENT_HANDLER_PATTERN.sub('', value)
        
        # Remove dangerous protocols
        value = JAVASCRIPT_PROTOCOL.sub('', value)
        value = DATA_PROTOCOL.sub('', value)
        value = VB_PROTOCOL.sub('', value)
        
        return value.strip()
    
    @staticmethod
    def _sanitize_value(value: Any, fields_to_sanitize: List[str] = None) -> Any:
        """Sanitize a single value based on its type"""
        if isinstance(value, str):
            return InputSanitizer.sanitize_string(value)
        if isinstance(value, dict):
            return InputSanitizer.sanitize_dict(value, fields_to_sanitize)
        if isinstance(value, list):
            return InputSanitizer._sanitize_list(value, fields_to_sanitize)
        return value
    
    @staticmethod
    def _sanitize_list(items: List[Any], fields_to_sanitize: List[str] = None) -> List[Any]:
        """Sanitize items in a list"""
        return [InputSanitizer._sanitize_value(item, fields_to_sanitize) for item in items]
    
    @staticmethod
    def sanitize_dict(data: Dict[str, Any], fields_to_sanitize: List[str] = None) -> Dict[str, Any]:
        """
        Sanitize string fields in a dictionary
        
        Args:
            data: Dictionary with potentially unsafe values
            fields_to_sanitize: Specific fields to sanitize (None = all string fields)
            
        Returns:
            Dictionary with sanitized values
        """
        if not data:
            return data
            
        sanitized = {}
        for key, value in data.items():
            should_sanitize = not fields_to_sanitize or key in fields_to_sanitize
            sanitized[key] = InputSanitizer._sanitize_value(value, fields_to_sanitize) if should_sanitize else value
                
        return sanitized
    
    @staticmethod
    def sanitize_user_bio(bio: str) -> str:
        """Sanitize user bio field - no HTML allowed"""
        return InputSanitizer.sanitize_string(bio, allow_html=False)
    
    @staticmethod
    def sanitize_review_text(text: str) -> str:
        """Sanitize review text - no HTML allowed"""
        return InputSanitizer.sanitize_string(text, allow_html=False)
    
    @staticmethod
    def sanitize_message_content(content: str) -> str:
        """Sanitize chat message content - no HTML allowed"""
        return InputSanitizer.sanitize_string(content, allow_html=False)
    
    @staticmethod
    def sanitize_special_requirements(requirements: str) -> str:
        """Sanitize booking special requirements - no HTML allowed"""
        return InputSanitizer.sanitize_string(requirements, allow_html=False)


class TokenBlacklist:
    """
    Manages blacklisted JWT tokens using Redis
    Tokens are blacklisted on logout to prevent reuse
    """
    
    BLACKLIST_PREFIX = "token_blacklist:"
    
    def __init__(self, redis_client):
        """
        Initialize with Redis client
        
        Args:
            redis_client: Redis client instance (from cache_service)
        """
        self.redis = redis_client
        
    async def blacklist_token(self, token: str, expires_in: int = 86400) -> bool:
        """
        Add a token to the blacklist
        
        Args:
            token: The JWT token to blacklist
            expires_in: Time in seconds until the blacklist entry expires
                       (should match token expiry)
                       
        Returns:
            True if successfully blacklisted
        """
        try:
            key = f"{self.BLACKLIST_PREFIX}{token}"
            await self.redis.setex(key, expires_in, "1")
            logger.info("Token blacklisted successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to blacklist token: {e}")
            return False
    
    async def is_blacklisted(self, token: str) -> bool:
        """
        Check if a token is blacklisted
        
        Args:
            token: The JWT token to check
            
        Returns:
            True if the token is blacklisted
        """
        try:
            key = f"{self.BLACKLIST_PREFIX}{token}"
            result = await self.redis.exists(key)
            return bool(result)
        except Exception as e:
            logger.error(f"Failed to check token blacklist: {e}")
            # Fail safe - assume not blacklisted to not break auth
            return False
    
    async def blacklist_all_user_tokens(self, user_id: str) -> bool:
        """
        Mark that all tokens for a user should be considered invalid
        Used when user changes password or is banned
        
        Args:
            user_id: The user's ID
            
        Returns:
            True if successful
        """
        try:
            key = f"user_tokens_invalidated:{user_id}"
            # Store the timestamp when tokens were invalidated
            await self.redis.set(
                key, 
                datetime.now(timezone.utc).isoformat(),
                ex=604800  # 7 days (longer than max token expiry)
            )
            logger.info(f"All tokens invalidated for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to invalidate user tokens: {e}")
            return False
    
    async def get_user_token_invalidation_time(self, user_id: str) -> Optional[datetime]:
        """
        Get the time when a user's tokens were invalidated
        
        Args:
            user_id: The user's ID
            
        Returns:
            Datetime when tokens were invalidated, or None
        """
        try:
            key = f"user_tokens_invalidated:{user_id}"
            result = await self.redis.get(key)
            if result:
                return datetime.fromisoformat(result.decode() if isinstance(result, bytes) else result)
            return None
        except Exception as e:
            logger.error(f"Failed to get token invalidation time: {e}")
            return None


# Create sanitizer instance
sanitizer = InputSanitizer()


def sanitize_request_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to sanitize request data
    Fields commonly containing user-generated content
    """
    user_content_fields = [
        'bio', 'about', 'description', 'notes', 'special_requirements',
        'content', 'message', 'text', 'comment', 'review', 'feedback',
        'address_line1', 'address_line2', 'landmark', 'title', 'name'
    ]
    return sanitizer.sanitize_dict(data, user_content_fields)
