"""Development Settings — relaxed limits, verbose logging, local defaults."""
from .base import BaseAppSettings


class DevelopmentSettings(BaseAppSettings):
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"

    # More forgiving rate limits in dev so manual testing is painless
    RATE_LIMIT_PER_MINUTE: int = 300
    RATE_LIMIT_AUTH_PER_MINUTE: int = 60

    # Skip OTP during development to speed up end-to-end flows
    SKIP_OTP_VERIFICATION: bool = True
    TEST_OTP_CODE: str = "123456"

    # Elasticsearch is optional in dev — gracefully degrades when absent
    ENABLE_ELASTICSEARCH: bool = False
