"""
API v1 endpoints initialization
"""
from app.api.v1 import auth, users, bookings, chat, reviews, admin

__all__ = ["auth", "users", "bookings", "chat", "reviews", "admin"]
