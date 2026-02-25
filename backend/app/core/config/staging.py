"""Staging Settings — mirrors production closely; debug disabled."""
from .base import BaseAppSettings


class StagingSettings(BaseAppSettings):
    APP_ENV: str = "staging"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Staging-specific access token lifetime (shorter than prod so testers
    # get faster feedback on refresh flows)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Module flags — enable everything in staging so behaviour matches prod
    ENABLE_ELASTICSEARCH: bool = True
    ENABLE_ENCRYPTION: bool = True
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_RATE_LIMITING: bool = True
