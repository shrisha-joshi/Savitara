"""
Base Settings
-------------
All field definitions shared across every environment.
Never instantiate this class directly — use environment-specific subclasses
or the factory in __init__.py.

SonarQube: S6437 — secrets must come from environment variables, never defaults.
"""
from __future__ import annotations

import secrets
from pathlib import Path
from typing import List, Optional, Union

from pydantic import field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseAppSettings(BaseSettings):
    """Shared field catalogue.  All defaults are *safe-for-development* values."""

    # ── Application ───────────────────────────────────────────────────────
    APP_NAME: str = "Savitara"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_VERSION: str = "v1"

    # ── Security ──────────────────────────────────────────────────────────
    # SonarQube: S6437 — token_urlsafe(32) is safe as a dev fallback;
    #            production MUST override both keys via environment.
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 1 hour (production-safe default)
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:8081",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.strip().startswith("["):
                import json
                try:
                    return json.loads(v)
                except ValueError:
                    pass
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def force_false_in_prod(cls, v: Union[str, bool], info: ValidationInfo) -> bool:
        if info.data.get("APP_ENV") == "production":
            return False
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t")
        return v

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def reject_default_secret_in_prod(cls, v: str, info: ValidationInfo) -> str:
        """SonarQube: S6437 — production must set SECRET_KEY explicitly via env."""
        if info.data.get("APP_ENV") == "production" and len(v) < 44:
            raise ValueError(
                "SECRET_KEY must be explicitly set in production. "
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        return v

    # ── Database – MongoDB ────────────────────────────────────────────────
    MONGODB_URL: Optional[str] = None
    MONGODB_DB_NAME: str = "savitara"
    MONGODB_MIN_POOL_SIZE: int = 10
    MONGODB_MAX_POOL_SIZE: int = 100

    @field_validator("MONGODB_URL", mode="before")
    @classmethod
    def require_mongodb_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            import sys
            print("\n" + "=" * 72)
            print("ERROR: MONGODB_URL is not set.")
            print("Set it in your .env file.  Example:")
            print("  MONGODB_URL=mongodb://localhost:27017")
            print("  MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/")
            print("=" * 72 + "\n")
            sys.exit(1)
        return v

    # ── Cache – Redis ─────────────────────────────────────────────────────
    REDIS_URL: Optional[str] = None
    CACHE_TTL: int = 300

    # ── Google OAuth ──────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # ── Razorpay ──────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None  # Must be set via env for webhook verification

    # ── Firebase ──────────────────────────────────────────────────────────
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_CLIENT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-key.json"

    # ── Email ─────────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@savitara.com"
    EMAIL_FROM_NAME: str = "Savitara"
    EMAIL_PROVIDER: str = "smtp"           # "smtp" | "sendgrid"
    SENDGRID_API_KEY: Optional[str] = None

    # ── SMS (Twilio) ──────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # ── Rate Limiting ─────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # ── Logging ───────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/savitara.log"

    # ── Error Tracking ────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── Elasticsearch ─────────────────────────────────────────────────────
    ELASTICSEARCH_HOSTS: Optional[str] = '["http://localhost:9200"]'
    ELASTICSEARCH_USERNAME: Optional[str] = None
    ELASTICSEARCH_PASSWORD: Optional[str] = None
    ENABLE_ELASTICSEARCH: bool = True

    # ── Encryption ────────────────────────────────────────────────────────
    ENCRYPTION_KEY: Optional[str] = None
    ENABLE_ENCRYPTION: bool = True

    # ── Feature Flags ─────────────────────────────────────────────────────
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_COMPRESSION: bool = True
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_WEBSOCKETS: bool = True

    # ── Admin ─────────────────────────────────────────────────────────────
    ADMIN_API_KEY: Optional[str] = None
    SUPER_ADMIN_EMAIL: Optional[str] = None  # SonarQube: S6437 — must be set via env

    # ── Business Rules ────────────────────────────────────────────────────
    PLATFORM_FEE_PERCENTAGE: float = 10.0
    ACHARYA_COMMISSION_PERCENTAGE: float = 85.0
    MIN_BOOKING_AMOUNT: float = 500.0
    MAX_BOOKING_AMOUNT: float = 100000.0
    REFERRAL_CREDITS: float = 50.0

    # ── Testing Helpers ───────────────────────────────────────────────────
    TEST_MODE: bool = False
    SKIP_OTP_VERIFICATION: bool = False
    TEST_OTP_CODE: Optional[str] = None  # Must be explicitly set via env; never hardcode

    # ── Pydantic config ───────────────────────────────────────────────────
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Helpers ───────────────────────────────────────────────────────────
    def get_database_url(self) -> str:
        return self.MONGODB_URL  # type: ignore[return-value]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"
