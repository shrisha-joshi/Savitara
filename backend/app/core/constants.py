"""
Application-wide constants for Savitara Backend
This eliminates code duplication and improves maintainability
SonarQube: S1192 - No magic numbers or duplicated strings
"""

# ---------------------------------------------------------------------------
# MongoDB Aggregation Operators
# ---------------------------------------------------------------------------
MONGO_LOOKUP = "$lookup"
MONGO_MATCH = "$match"
MONGO_UNWIND = "$unwind"
MONGO_GROUP = "$group"
MONGO_SORT = "$sort"
MONGO_SKIP = "$skip"
MONGO_LIMIT = "$limit"
MONGO_AVG = "$avg"
MONGO_SUM = "$sum"
MONGO_COND = "$cond"
MONGO_EQ = "$eq"
MONGO_REGEX = "$regex"
MONGO_OPTIONS = "$options"
MONGO_PROJECT = "$project"
MONGO_STATUS = "$status"
MONGO_IN = "$in"
MONGO_ADD_FIELDS = "$addFields"
MONGO_FIRST = "$first"
MONGO_PUSH = "$push"
MONGO_COUNT = "$count"
MONGO_IF_NULL = "$ifNull"
MONGO_EXISTS = "$exists"

# ---------------------------------------------------------------------------
# Timezone Constants
# ---------------------------------------------------------------------------
TIMEZONE_UTC_OFFSET = "+00:00"  # UTC timezone offset for ISO datetime parsing

# ---------------------------------------------------------------------------
# Field Names (MongoDB aggregation field references)
# ---------------------------------------------------------------------------
FIELD_TOTAL_AMOUNT = "$total_amount"
FIELD_POOJA_NAME = "$pooja.name"
FIELD_SERVICE_NAME = "$service_name"
FIELD_RATING = "$rating"
FIELD_LOCATION_CITY = "location.city"
FIELD_ID = "_id"
FIELD_USER_ID = "user_id"
FIELD_ACHARYA_ID = "acharya_id"
FIELD_GRIHASTA_ID = "grihasta_id"
FIELD_STATUS = "status"
FIELD_CREATED_AT = "created_at"
FIELD_UPDATED_AT = "updated_at"
FIELD_IS_ACTIVE = "is_active"
FIELD_IS_VERIFIED = "is_verified"
FIELD_TOKEN = "token"
FIELD_EMAIL = "email"
FIELD_ROLE = "role"

# ---------------------------------------------------------------------------
# Pagination Defaults
# ---------------------------------------------------------------------------
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_PAGE = 1

# ---------------------------------------------------------------------------
# Token & Auth
# ---------------------------------------------------------------------------
ACCESS_TOKEN_EXPIRE_MINUTES = 60          # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS = 30
EMAIL_VERIFY_TOKEN_EXPIRE_HOURS = 24
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 15
OTP_EXPIRE_MINUTES = 10
OTP_LENGTH = 6
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30

# ---------------------------------------------------------------------------
# Booking
# ---------------------------------------------------------------------------
BOOKING_TIMEOUT_SECONDS = 900            # 15 minutes to start after OTP
BOOKING_CANCELLATION_WINDOW_HOURS = 24
BOOKING_ADVANCE_BOOKING_DAYS = 30
MIN_BOOKING_DURATION_MINUTES = 30
MAX_BOOKING_DURATION_HOURS = 8
BOOKING_OTP_EXPIRE_MINUTES = 10

# ---------------------------------------------------------------------------
# Payments & Wallet
# ---------------------------------------------------------------------------
MIN_WITHDRAWAL_AMOUNT = 100.0            # INR
MAX_WITHDRAWAL_AMOUNT = 50000.0          # INR
PLATFORM_COMMISSION_PERCENT = 20.0
MIN_RECHARGE_AMOUNT = 100.0
MAX_RECHARGE_AMOUNT = 100000.0
REFUND_PROCESSING_DAYS = 5

# ---------------------------------------------------------------------------
# Cache TTLs (seconds)
# ---------------------------------------------------------------------------
CACHE_TTL_SHORT = 300                    # 5 minutes  — volatile data
CACHE_TTL_MEDIUM = 3600                  # 1 hour     — semi-stable data
CACHE_TTL_LONG = 86400                   # 24 hours   — stable reference data
CACHE_TTL_ACHARYA_PROFILE = 1800        # 30 minutes
CACHE_TTL_USER_PROFILE = 3600           # 1 hour
CACHE_TTL_ANALYTICS = 900               # 15 minutes

# ---------------------------------------------------------------------------
# Media / Upload
# ---------------------------------------------------------------------------
MAX_PROFILE_IMAGE_SIZE_MB = 5
MAX_DOCUMENT_SIZE_MB = 10
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"]
THUMBNAIL_SIZE = (200, 200)
MEDIUM_IMAGE_SIZE = (800, 800)

# ---------------------------------------------------------------------------
# Rate Limiting (references — canonical values live in rate_limit_config.py)
# ---------------------------------------------------------------------------
RATE_LIMIT_DEFAULT_REQUESTS = 100
RATE_LIMIT_DEFAULT_WINDOW = 60           # seconds

# ---------------------------------------------------------------------------
# Gamification
# ---------------------------------------------------------------------------
POINTS_BOOKING_COMPLETE = 100
POINTS_REVIEW_GIVEN = 50
POINTS_PROFILE_COMPLETE = 200
POINTS_REFERRAL = 500
POINTS_FIRST_BOOKING = 150

# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
MAX_PUSH_TOKENS_PER_USER = 5
NOTIFICATION_BATCH_SIZE = 500
FCM_TIMEOUT_SECONDS = 10

# ---------------------------------------------------------------------------
# Error Messages (shared, avoids SonarQube S1192 duplication warnings)
# ---------------------------------------------------------------------------
ERROR_CONFIRM_ATTENDANCE = "Confirm attendance"
ERROR_VIEW_BOOKING = "View booking"
ERROR_FETCH_REVIEWS = "Failed to fetch reviews"
ERROR_ADMIN_REQUIRED = "Admin access required"
ERROR_NOT_FOUND = "Resource not found"
ERROR_UNAUTHORIZED = "Authentication required"
ERROR_FORBIDDEN = "You do not have permission to perform this action"
ERROR_VALIDATION = "Validation failed"
ERROR_INTERNAL = "An internal error occurred. Please try again."
ERROR_RATE_LIMITED = "Too many requests. Please slow down."
ERROR_PAYMENT_FAILED = "Payment processing failed"
ERROR_BOOKING_NOT_FOUND = "Booking not found"
ERROR_USER_NOT_FOUND = "User not found"
ERROR_ALREADY_EXISTS = "Resource already exists"

# ---------------------------------------------------------------------------
# Regex Patterns
# ---------------------------------------------------------------------------
PHONE_REGEX = r"^\+?[1-9]\d{1,14}$"
EMAIL_REGEX = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
OTP_REGEX = r"^\d{6}$"

# ---------------------------------------------------------------------------
# Setup Script Messages (kept for backward compatibility)
# ---------------------------------------------------------------------------
MSG_DEPS_INSTALLED = "Dependencies installed"
MSG_DEPS_FAILED = "Failed to install dependencies"
MSG_ENV_EXAMPLE = ".env.example"
MSG_ENV_COPIED = ".env.example copied to .env - Please edit with your credentials"
MSG_ENV_NOT_FOUND = ".env.example not found!"
MSG_ENV_EXISTS = ".env file exists"
MSG_INSTALLING_NODE = "Installing Node.js dependencies..."
CMD_NPM_INSTALL = "npm install"
