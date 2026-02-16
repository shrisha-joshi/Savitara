"""
Initialize Services Collection with Default Data
Run this once to seed the database
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
import logging

from app.models.services_catalog import HINDU_SERVICES_CATALOG

logger = logging.getLogger(__name__)


async def initialize_services_collection(db: AsyncIOMotorDatabase):
    """Initialize services collection with catalog data"""
    try:
        # Check if services already exist
        existing_count = await db.services.count_documents({})

        if existing_count > 0:
            logger.info(
                f"Services collection already has {existing_count} services. Skipping initialization."
            )
            return

        # Insert all services from catalog
        services_to_insert = []
        for service in HINDU_SERVICES_CATALOG:
            service_doc = service.copy()
            service_doc["created_at"] = datetime.now(timezone.utc)
            service_doc["updated_at"] = datetime.now(timezone.utc)
            service_doc["is_active"] = True
            service_doc["popularity_score"] = 0
            service_doc["total_bookings"] = 0
            service_doc["average_rating"] = 0.0
            services_to_insert.append(service_doc)

        result = await db.services.insert_many(services_to_insert)
        logger.info(
            f"Initialized services collection with {len(result.inserted_ids)} services"
        )

        # Create indexes
        await db.services.create_index([("category", 1)])
        await db.services.create_index([("is_active", 1)])
        await db.services.create_index(
            [
                ("name_english", "text"),
                ("name_sanskrit", "text"),
                ("short_description", "text"),
            ]
        )
        await db.services.create_index([("popularity_score", -1)])

        await db.service_bookings.create_index([("user_id", 1)])
        await db.service_bookings.create_index([("service_id", 1)])
        await db.service_bookings.create_index([("status", 1)])
        await db.service_bookings.create_index([("created_at", -1)])

        logger.info("Services indexes created successfully")

    except Exception as e:
        logger.error(f"Error initializing services collection: {e}")
        raise
