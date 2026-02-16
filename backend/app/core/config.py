"""
Centralized Configuration Management
SonarQube: S6437 - Use environment variables for sensitive data
"""
from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, ValidationInfo
import secrets
from pathlib import Path


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Never hardcode secrets - always use environment variables.
    """

    # Application
    APP_NAME: str = "Savitara"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_VERSION: str = "v1"

    # Security - SonarQube: Ensure strong keys
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - SonarQube: Validate origins
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "https://savitara-web.vercel.app",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def validate_origins(
        cls, v: Union[str, List[str]], info: ValidationInfo
    ) -> List[str]:
        """Validate CORS origins"""
        if isinstance(v, str):
            # Try JSON first
            if v.strip().startswith("["):
                import json

                try:
                    return json.loads(v)
                except ValueError:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def validate_debug(cls, v: Union[str, bool], info: ValidationInfo) -> bool:
        if info.data.get("APP_ENV") == "production":
            return False
        if isinstance(v, str):
            return v.lower() in ("true", "1", "t")
        return v

    # Database - MongoDB Atlas
    MONGODB_URL: Optional[str] = None
    MONGODB_DB_NAME: str = "savitara"
    MONGODB_MIN_POOL_SIZE: int = 10
    MONGODB_MAX_POOL_SIZE: int = 100

    # Redis
    REDIS_URL: Optional[str] = None
    CACHE_TTL: int = 300

    @field_validator("MONGODB_URL", mode="before")
    @classmethod
    def validate_mongodb_url(
        cls, v: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        """Validate MongoDB URL is provided"""
        if not v:
            import sys

            print("\n" + "=" * 80)
            print("ERROR: MONGODB_URL is missing!")
            print("=" * 80)
            print("\nTo fix this error:")
            print("1. Make sure .env file exists at: backend/.env")
            print("2. Ensure MONGODB_URL is set in your .env file")
            print(
                "3. Example: MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/dbname"
            )
            print("\nFor development, you can use:")
            print("   MONGODB_URL=mongodb://localhost:27017")
            print("\nFor production (Render/Cloud), get the URL from MongoDB Atlas:")
            print("   https://www.mongodb.com/cloud/atlas")
            print("=" * 80 + "\n")
            sys.exit(1)
        return v

    # Google OAuth - SonarQube: Never expose in logs
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Razorpay
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: str = ""  # Optional for webhook verification

    # Firebase
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_CLIENT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-key.json"

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@savitara.com"
    EMAIL_FROM_NAME: str = "Savitara"
    EMAIL_PROVIDER: str = "smtp"  # 'smtp' or 'sendgrid'
    SENDGRID_API_KEY: Optional[str] = None

    # SMS (Twilio)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/savitara.log"

    # Sentry Error Tracking (Optional)
    SENTRY_DSN: Optional[str] = None

    # Enterprise Features - Elasticsearch
    ELASTICSEARCH_HOSTS: Optional[str] = '["http://localhost:9200"]'
    ELASTICSEARCH_USERNAME: Optional[str] = None
    ELASTICSEARCH_PASSWORD: Optional[str] = None
    ENABLE_ELASTICSEARCH: bool = True

    # Enterprise Features - Encryption
    ENCRYPTION_KEY: Optional[str] = None
    ENABLE_ENCRYPTION: bool = True

    # Enterprise Features - Feature Flags
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_COMPRESSION: bool = True
    ENABLE_RATE_LIMITING: bool = True
    ENABLE_WEBSOCKETS: bool = True

    # Enterprise Features - Admin
    ADMIN_API_KEY: Optional[str] = None

    # Enterprise Features - Business Settings
    PLATFORM_FEE_PERCENTAGE: float = 10.0
    ACHARYA_COMMISSION_PERCENTAGE: float = 85.0
    MIN_BOOKING_AMOUNT: float = 500.0
    MAX_BOOKING_AMOUNT: float = 100000.0
    REFERRAL_CREDITS: float = 50.0

    # Enterprise Features - Testing
    TEST_MODE: bool = False
    SKIP_OTP_VERIFICATION: bool = False
    TEST_OTP_CODE: Optional[str] = "123456"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def get_database_url(self) -> str:
        """Get MongoDB connection URL - SonarQube: Secure connection string"""
        return self.MONGODB_URL

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.APP_ENV == "production"


# Singleton instance
settings = Settings()


def get_settings() -> Settings:
    """Get settings instance"""
    return settings
