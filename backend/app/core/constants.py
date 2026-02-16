"""
Application-wide constants for Savitara Backend
This eliminates code duplication and improves maintainability
"""

# MongoDB Aggregation Operators
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

# Field Names
FIELD_RATING = "$rating"
FIELD_LOCATION_CITY = "location.city"

# Error Messages
ERROR_CONFIRM_ATTENDANCE = "Confirm attendance"
ERROR_VIEW_BOOKING = "View booking"
ERROR_FETCH_REVIEWS = "Failed to fetch reviews"
ERROR_ADMIN_REQUIRED = "Admin access required"

# Regex Patterns
PHONE_REGEX = r"^\+?[1-9]\d{1,14}$"

# Setup Script Messages
MSG_DEPS_INSTALLED = "Dependencies installed"
MSG_DEPS_FAILED = "Failed to install dependencies"
MSG_ENV_EXAMPLE = ".env.example"
MSG_ENV_COPIED = ".env.example copied to .env - Please edit with your credentials"
MSG_ENV_NOT_FOUND = ".env.example not found!"
MSG_ENV_EXISTS = ".env file exists"
MSG_INSTALLING_NODE = "Installing Node.js dependencies..."
CMD_NPM_INSTALL = "npm install"
