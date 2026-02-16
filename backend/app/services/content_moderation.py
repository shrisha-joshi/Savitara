"""
Content Moderation Service for Reviews and Comments
"""
import re
from typing import Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ModerationResult(str, Enum):
    """Moderation results"""

    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"  # Needs manual review


class ContentModerationService:
    """
    Content moderation service for user-generated content

    Checks for:
    - Spam keywords
    - Offensive language
    - Contact information (phone, email)
    - URLs
    - Minimum content length
    - Excessive capitalization
    """

    # Spam keywords
    SPAM_KEYWORDS = [
        "fake",
        "scam",
        "fraud",
        "cheat",
        "liar",
        "call me",
        "whatsapp",
        "telegram",
        "dm me",
        "contact",
        "reach me",
        "text me",
        "message me",
        "click here",
        "visit",
        "check out",
        "follow me",
    ]

    # Offensive words (add more as needed)
    OFFENSIVE_WORDS = [
        # Add appropriate offensive words list for your context
        "offensive1",
        "offensive2",  # Placeholder
    ]

    # Patterns to detect
    PHONE_PATTERN = r"\b\d{10}\b|\b\d{5}[\s-]\d{5}\b"
    EMAIL_PATTERN = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    URL_PATTERN = r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"

    MIN_REVIEW_LENGTH = 20
    MAX_CAPS_PERCENTAGE = 0.6  # 60% capital letters

    @classmethod
    def moderate_review(cls, content: str) -> Tuple[ModerationResult, str]:
        """
        Moderate review content

        Args:
            content: Review text to moderate

        Returns:
            Tuple of (result, reason)
        """
        content_lower = content.lower()

        # Check minimum length
        if len(content.strip()) < cls.MIN_REVIEW_LENGTH:
            return (
                ModerationResult.REJECTED,
                f"Review too short (minimum {cls.MIN_REVIEW_LENGTH} characters)",
            )

        # Check for spam keywords
        for keyword in cls.SPAM_KEYWORDS:
            if keyword in content_lower:
                return (ModerationResult.REJECTED, f"Contains spam keyword: {keyword}")

        # Check for offensive language
        for word in cls.OFFENSIVE_WORDS:
            if word in content_lower:
                return (ModerationResult.REJECTED, "Contains offensive language")

        # Check for phone numbers
        if re.search(cls.PHONE_PATTERN, content):
            return (ModerationResult.REJECTED, "Contains phone number")

        # Check for email addresses
        if re.search(cls.EMAIL_PATTERN, content):
            return (ModerationResult.REJECTED, "Contains email address")

        # Check for URLs
        if re.search(cls.URL_PATTERN, content):
            return (ModerationResult.REJECTED, "Contains URL")

        # Check for excessive capitalization (shouting)
        if len(content) > 10:
            caps_count = sum(1 for c in content if c.isupper())
            if caps_count / len(content) > cls.MAX_CAPS_PERCENTAGE:
                return (
                    ModerationResult.FLAGGED,
                    "Excessive capitalization (needs review)",
                )

        # All checks passed
        return (ModerationResult.APPROVED, "Content approved")

    @classmethod
    def moderate_message(cls, content: str) -> Tuple[ModerationResult, str]:
        """
        Moderate chat message (less strict than review)

        Args:
            content: Message text to moderate

        Returns:
            Tuple of (result, reason)
        """
        content_lower = content.lower()

        # Check for offensive language
        for word in cls.OFFENSIVE_WORDS:
            if word in content_lower:
                return (ModerationResult.REJECTED, "Contains inappropriate language")

        # Allow contact info in direct messages (less strict)
        # But still check for spam
        spam_count = sum(1 for keyword in cls.SPAM_KEYWORDS if keyword in content_lower)
        if spam_count >= 2:  # Multiple spam indicators
            return (ModerationResult.REJECTED, "Message appears to be spam")

        return (ModerationResult.APPROVED, "Message approved")

    @classmethod
    def filter_profanity(cls, content: str) -> str:
        """
        Filter out profanity by replacing with asterisks

        Args:
            content: Text to filter

        Returns:
            Filtered text
        """
        filtered = content
        for word in cls.OFFENSIVE_WORDS:
            pattern = re.compile(re.escape(word), re.IGNORECASE)
            filtered = pattern.sub("*" * len(word), filtered)

        return filtered

    @classmethod
    def get_content_sentiment(cls, content: str) -> str:
        """
        Simple sentiment analysis (positive/negative/neutral)

        This is a basic implementation. For production,
        consider using ML models or services like AWS Comprehend
        """
        positive_words = [
            "excellent",
            "great",
            "good",
            "amazing",
            "wonderful",
            "fantastic",
            "outstanding",
            "professional",
            "helpful",
            "knowledgeable",
            "respectful",
            "punctual",
            "recommended",
        ]

        negative_words = [
            "terrible",
            "bad",
            "awful",
            "horrible",
            "worst",
            "unprofessional",
            "rude",
            "late",
            "disappointed",
            "waste",
            "avoid",
            "not recommended",
        ]

        content_lower = content.lower()

        positive_count = sum(1 for word in positive_words if word in content_lower)
        negative_count = sum(1 for word in negative_words if word in content_lower)

        if positive_count > negative_count * 1.5:
            return "positive"
        elif negative_count > positive_count * 1.5:
            return "negative"
        else:
            return "neutral"

    @classmethod
    def extract_rating_from_text(cls, content: str) -> int:
        """
        Try to extract numeric rating from text (1-5 stars)
        Useful when user mentions rating in review
        """
        patterns = [
            r"(\d)/5",  # "4/5"
            r"(\d)\s*stars?",  # "4 stars"
            r"(\d)\s*out of 5",  # "4 out of 5"
        ]

        for pattern in patterns:
            match = re.search(pattern, content.lower())
            if match:
                rating = int(match.group(1))
                if 1 <= rating <= 5:
                    return rating

        return 0  # No rating found
