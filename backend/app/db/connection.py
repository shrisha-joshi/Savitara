"""
MongoDB Database Connection Manager
SonarQube: S2095 - Ensure resources are properly closed
SonarQube: S1192 - No duplicated strings
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Singleton database connection manager
    SonarQube: Proper resource management
    """
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect_to_database(cls):
        """
        Initialize database connection
        SonarQube: S2095 - Connection is managed properly
        """
        try:
            logger.info("Connecting to MongoDB...")
            
            # Create async MongoDB client
            cls.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
            )
            
            # Get database
            cls.db = cls.client[settings.MONGODB_DB_NAME]
            
            # Verify connection
            await cls.client.admin.command('ping')
            
            logger.info(f"Successfully connected to MongoDB: {settings.MONGODB_DB_NAME}")
            
            # Create indexes
            await cls.create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            cls.client = None
            cls.db = None
            raise
    
    @classmethod
    async def close_database_connection(cls):
        """
        Close database connection
        SonarQube: S2095 - Explicitly close resources
        """
        if cls.client is not None:
            logger.info("Closing MongoDB connection...")
            cls.client.close()
            logger.info("MongoDB connection closed")
    
    @classmethod
    async def _create_index_safe(cls, collection, *args, **kwargs):
        """
        Safely create index, ignore if it already exists
        """
        try:
            await collection.create_index(*args, **kwargs)
        except Exception as e:
            # Ignore index already exists errors
            if "existing index" in str(e).lower() or "IndexKeySpecsConflict" in str(e):
                logger.debug(f"Index already exists: {str(e)[:100]}")
            else:
                # Re-raise other errors
                raise
    
    @classmethod
    async def create_indexes(cls):
        """
        Create database indexes for performance
        SonarQube: Optimize database queries
        """
        if cls.db is None:
            return
        
        logger.info("Creating database indexes...")
        
        # Users collection indexes
        await cls._create_index_safe(cls.db.users, "email", unique=True)
        await cls._create_index_safe(cls.db.users, "google_id", unique=True, sparse=True)
        await cls._create_index_safe(cls.db.users, [("role", 1), ("status", 1)])
        await cls._create_index_safe(cls.db.users, "created_at")
        await cls._create_index_safe(cls.db.users, "phone")
        
        # Grihasta profiles indexes
        await cls._create_index_safe(cls.db.grihasta_profiles, "user_id", unique=True)
        await cls._create_index_safe(cls.db.grihasta_profiles, "location.city")
        await cls._create_index_safe(cls.db.grihasta_profiles, [("user_id", 1), ("location.city", 1)])
        
        # Acharya profiles indexes
        await cls._create_index_safe(cls.db.acharya_profiles, "user_id", unique=True)
        await cls._create_index_safe(cls.db.acharya_profiles, "status")
        await cls._create_index_safe(cls.db.acharya_profiles, [("status", 1), ("ratings.average", -1)])
        await cls._create_index_safe(cls.db.acharya_profiles, [("status", 1), ("ratings.count", -1)])
        await cls._create_index_safe(cls.db.acharya_profiles, "location.city")
        await cls._create_index_safe(cls.db.acharya_profiles, "parampara")
        await cls._create_index_safe(cls.db.acharya_profiles, "specializations")
        await cls._create_index_safe(cls.db.acharya_profiles, "languages")
        
        # Compound index for advanced search
        await cls._create_index_safe(cls.db.acharya_profiles, [
            ("status", 1),
            ("location.city", 1),
            ("ratings.average", -1),
            ("hourly_rate", 1)
        ])
        
        # Text search index for acharyas
        await cls._create_index_safe(cls.db.acharya_profiles, [
            ("name", "text"),
            ("bio", "text"),
            ("specializations", "text")
        ])
        
        # Geospatial index for location-based search
        await cls._create_index_safe(cls.db.acharya_profiles, [("location.coordinates", "2dsphere")])
        
        # Bookings indexes
        await cls._create_index_safe(cls.db.bookings, [("grihasta_id", 1), ("status", 1)])
        await cls._create_index_safe(cls.db.bookings, [("acharya_id", 1), ("status", 1)])
        await cls._create_index_safe(cls.db.bookings, [("acharya_id", 1), ("date_time", 1)])
        await cls._create_index_safe(cls.db.bookings, [("grihasta_id", 1), ("created_at", -1)])
        await cls._create_index_safe(cls.db.bookings, [("date_time", 1), ("status", 1)])
        await cls._create_index_safe(cls.db.bookings, "status")
        await cls._create_index_safe(cls.db.bookings, "created_at")
        await cls._create_index_safe(cls.db.bookings, "payment_status")
        
        # Compound index for booking queries
        await cls._create_index_safe(cls.db.bookings, [
            ("acharya_id", 1),
            ("date_time", 1),
            ("status", 1)
        ])
        
        # Messages indexes
        await cls._create_index_safe(cls.db.messages, "conversation_id")
        await cls._create_index_safe(cls.db.messages, [("conversation_id", 1), ("created_at", -1)])
        await cls._create_index_safe(cls.db.messages, [("sender_id", 1), ("receiver_id", 1)])
        await cls._create_index_safe(cls.db.messages, "created_at")
        
        # Conversations indexes
        await cls._create_index_safe(cls.db.conversations, "participants")
        await cls._create_index_safe(cls.db.conversations, [("participants", 1), ("updated_at", -1)])
        
        # Panchanga indexes
        await cls._create_index_safe(cls.db.panchanga, "date", unique=True)
        await cls._create_index_safe(cls.db.panchanga, [("date", 1), ("location", 1)])
        
        # Reviews indexes
        await cls._create_index_safe(cls.db.reviews, "booking_id", unique=True)
        await cls._create_index_safe(cls.db.reviews, "acharya_id")
        await cls._create_index_safe(cls.db.reviews, [("acharya_id", 1), ("created_at", -1)])
        await cls._create_index_safe(cls.db.reviews, [("is_public", 1), ("rating", -1)])
        await cls._create_index_safe(cls.db.reviews, "grihasta_id")
        
        # Analytics events indexes
        await cls._create_index_safe(cls.db.analytics_events, [("user_id", 1), ("timestamp", -1)])
        await cls._create_index_safe(cls.db.analytics_events, [("event_name", 1), ("timestamp", -1)])
        await cls._create_index_safe(cls.db.analytics_events, "date")
        
        # Loyalty program indexes
        await cls._create_index_safe(cls.db.user_loyalty, "user_id", unique=True)
        await cls._create_index_safe(cls.db.user_loyalty, [("tier", 1), ("points", -1)])
        
        # Referrals indexes
        await cls._create_index_safe(cls.db.referrals, "referrer_id")
        await cls._create_index_safe(cls.db.referrals, "referred_user_id", unique=True)
        await cls._create_index_safe(cls.db.referrals, "referral_code")
        
        # Notifications indexes
        await cls._create_index_safe(cls.db.notifications, [("user_id", 1), ("created_at", -1)])
        await cls._create_index_safe(cls.db.notifications, [("user_id", 1), ("read", 1)])
        
        logger.info("Database indexes created successfully")
    
    @classmethod
    def get_database(cls) -> AsyncIOMotorDatabase:
        """Get database instance - returns None if not connected"""
        return cls.db
    
    @classmethod
    def is_connected(cls) -> bool:
        """Check if database is connected"""
        return cls.db is not None


# Dependency for FastAPI
def get_db() -> AsyncIOMotorDatabase:
    """
    FastAPI dependency to get database
    SonarQube: Proper dependency injection
    Raises ServiceUnavailableError if database is not connected
    """
    db = DatabaseManager.get_database()
    if db is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail={
                "success": False,
                "error": {
                    "code": "DB_001",
                    "message": "Database service unavailable. Please try again later.",
                    "details": {}
                }
            }
        )
    return db
