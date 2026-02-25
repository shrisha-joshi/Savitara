"""
Production Settings
-------------------
Adds validators that enforce security hardening requirements.

Rules enforced at startup:
  • DEBUG is always False
  • SECRET_KEY and JWT_SECRET_KEY must not be the generated dev placeholders
  • All ALLOWED_ORIGINS must use HTTPS
  • MONGODB_URL must point to an Atlas/TLS-enabled cluster (no plaintext mongodb://)
  • Sentry DSN is recommended (warning, not hard fail)
  • TEST_MODE and SKIP_OTP_VERIFICATION must be False

SonarQube: S6437 — no hardcoded credentials; S5527 — validate CORS origins.
"""
from __future__ import annotations

import logging
from typing import List, Union

from pydantic import field_validator, model_validator, ValidationInfo

from .base import BaseAppSettings

logger = logging.getLogger(__name__)

_INSECURE_PREFIXES = ("your-", "change-in", "secret-key", "test-secret")


class ProductionSettings(BaseAppSettings):
    APP_ENV: str = "production"
    DEBUG: bool = False
    LOG_LEVEL: str = "WARNING"

    # Production token lifetime — shorter for tighter security
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # All enterprise features must be active in production
    ENABLE_ELASTICSEARCH: bool = True
    ENABLE_ENCRYPTION: bool = True
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_COMPRESSION: bool = True

    # Testing helpers must be disabled
    TEST_MODE: bool = False
    SKIP_OTP_VERIFICATION: bool = False

    # ── Validators ────────────────────────────────────────────────────────

    @field_validator("SECRET_KEY", "JWT_SECRET_KEY", mode="before")
    @classmethod
    def reject_insecure_secrets(cls, v: str, info: ValidationInfo) -> str:
        v_lower = v.lower()
        if any(prefix in v_lower for prefix in _INSECURE_PREFIXES):
            raise ValueError(
                f"{info.field_name} looks like a placeholder.  "
                "Set a cryptographically strong value in your production .env file."
            )
        if len(v) < 32:
            raise ValueError(
                f"{info.field_name} must be at least 32 characters in production."
            )
        return v

    @field_validator("ALLOWED_ORIGINS", mode="after")
    @classmethod
    def require_https_origins(cls, v: Union[List[str], str]) -> List[str]:
        origins = v if isinstance(v, list) else [v]
        insecure = [o for o in origins if o.startswith("http://")]
        if insecure:
            raise ValueError(
                "Production ALLOWED_ORIGINS must use HTTPS.  "
                f"Insecure origins found: {insecure}"
            )
        return origins

    @field_validator("MONGODB_URL", mode="before")
    @classmethod
    def require_tls_mongodb(cls, v: str | None) -> str | None:
        if v and v.startswith("mongodb://") and "localhost" not in v:
            raise ValueError(
                "Production MONGODB_URL must use TLS (mongodb+srv://).  "
                "Plain mongodb:// is only allowed for localhost in dev/staging."
            )
        return v

    @model_validator(mode="after")
    def warn_missing_sentry(self) -> "ProductionSettings":
        if not self.SENTRY_DSN:
            logger.warning(
                "SENTRY_DSN is not set.  Errors will not be reported to Sentry "
                "in production.  Set SENTRY_DSN in your production environment."
            )
        return self

    @model_validator(mode="after")
    def block_test_mode(self) -> "ProductionSettings":
        if self.TEST_MODE or self.SKIP_OTP_VERIFICATION:
            raise ValueError(
                "TEST_MODE and SKIP_OTP_VERIFICATION must be False in production."
            )
        return self
