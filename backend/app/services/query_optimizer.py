"""
Database Query Optimization Utilities
Provides optimized queries and index management
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


class QueryOptimizer:
    """
    Database query optimization utilities
    Creates indexes and provides optimized query patterns
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def create_all_indexes(self):
        """Create all performance-critical indexes"""
        
        index_definitions = [
            # Users collection
            ("users", [("email", 1)], {"unique": True}),
            ("users", [("phone", 1)], {"unique": True, "sparse": True, "name": "phone_unique_idx"}),
            ("users", [("role", 1), ("status", 1)], {}),
            ("users", [("created_at", -1)], {}),
            
            # Acharya Profiles - Critical for search
            ("acharya_profiles", [("user_id", 1)], {"unique": True}),
            ("acharya_profiles", [("ratings.average", -1), ("total_bookings", -1)], {}),
            ("acharya_profiles", [("location.city", 1), ("ratings.average", -1)], {}),
            ("acharya_profiles", [("location.state", 1)], {}),
            ("acharya_profiles", [("specializations", 1)], {}),
            ("acharya_profiles", [("languages", 1)], {}),
            ("acharya_profiles", [("is_verified", 1), ("ratings.average", -1)], {}),
            
            # Text search index
            ("acharya_profiles", [("name", "text"), ("bio", "text"), ("specializations", "text")], {}),
            
            # Geospatial index for location-based queries
            ("acharya_profiles", [("location.coordinates", "2dsphere")], {}),
            
            # Bookings - High-traffic collection
            ("bookings", [("grihasta_id", 1), ("created_at", -1)], {}),
            ("bookings", [("acharya_id", 1), ("date_time", 1), ("status", 1)], {}),
            ("bookings", [("status", 1), ("date_time", 1)], {}),
            ("bookings", [("razorpay_order_id", 1)], {"unique": True, "sparse": True}),
            ("bookings", [("date_time", 1), ("acharya_id", 1)], {}),  # Conflict detection
            
            # Reviews
            ("reviews", [("booking_id", 1)], {"unique": True}),
            ("reviews", [("acharya_id", 1), ("created_at", -1)], {}),
            ("reviews", [("grihasta_id", 1), ("created_at", -1)], {}),
            ("reviews", [("is_public", 1), ("rating", -1)], {}),
            
            # Chat conversations
            ("conversations", [("participants", 1), ("last_message_at", -1)], {}),
            ("conversations", [("participants", 1)], {}),
            
            # Chat messages
            ("messages", [("conversation_id", 1), ("created_at", -1)], {}),
            ("messages", [("sender_id", 1), ("created_at", -1)], {}),
            
            # Poojas
            ("poojas", [("acharya_id", 1), ("is_active", 1)], {}),
            ("poojas", [("base_price", 1)], {}),
            
            # Analytics events
            ("analytics_events", [("user_id", 1), ("timestamp", -1)], {}),
            ("analytics_events", [("event_name", 1), ("timestamp", -1)], {}),
            
            # Audit logs
            ("audit_logs", [("user_id", 1), ("timestamp", -1)], {}),
            ("audit_logs", [("action", 1), ("timestamp", -1)], {}),
            ("audit_logs", [("severity", 1), ("timestamp", -1)], {}),
            ("audit_logs", [("resource_type", 1), ("resource_id", 1)], {}),
            
            # Loyalty points
            ("loyalty_points", [("user_id", 1)], {"unique": True}),
            
            # Referrals
            ("referrals", [("referrer_id", 1)], {}),
            ("referrals", [("referee_id", 1)], {}),
        ]
        
        created_count = 0
        failed_count = 0
        
        for collection_name, index_spec, options in index_definitions:
            try:
                collection = self.db[collection_name]
                result = await collection.create_index(index_spec, **options)
                logger.info(f"Created index on {collection_name}: {index_spec} -> {result}")
                created_count += 1
            except Exception as e:
                if "already exists" not in str(e):
                    logger.error(f"Failed to create index on {collection_name} {index_spec}: {e}")
                    failed_count += 1
        
        logger.info(f"Index creation complete: {created_count} created, {failed_count} failed")
        return {"created": created_count, "failed": failed_count}
    
    async def get_acharyas_optimized(
        self,
        filters: Dict[str, Any],
        sort: List[Tuple[str, int]],
        skip: int,
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Optimized acharya search with covered queries
        Uses projection to only fetch needed fields
        """
        
        projection = {
            "name": 1,
            "specializations": 1,
            "ratings": 1,
            "hourly_rate": 1,
            "location": 1,
            "profile_picture": 1,
            "experience_years": 1,
            "languages": 1,
            "is_verified": 1
        }
        
        pipeline = [
            {"$match": filters},
            {"$sort": dict(sort)},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": projection}
        ]
        
        try:
            results = await self.db.acharya_profiles.aggregate(pipeline).to_list(length=limit)
            return results
        except Exception as e:
            logger.error(f"Optimized acharya query failed: {e}")
            return []
    
    async def get_booking_stats_optimized(self, acharya_id: str) -> Dict[str, Any]:
        """Get booking statistics with single aggregation query"""
        
        pipeline = [
            {"$match": {"acharya_id": acharya_id, "status": "completed"}},
            {"$group": {
                "_id": None,
                "total_bookings": {"$sum": 1},
                "total_revenue": {"$sum": "$total_amount"},
                "avg_rating": {"$avg": "$rating"},
                "last_booking": {"$max": "$completed_at"}
            }}
        ]
        
        try:
            result = await self.db.bookings.aggregate(pipeline).to_list(length=1)
            return result[0] if result else {
                "total_bookings": 0,
                "total_revenue": 0,
                "avg_rating": 0,
                "last_booking": None
            }
        except Exception as e:
            logger.error(f"Booking stats query failed: {e}")
            return {}
    
    async def get_user_activity_optimized(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent user activity efficiently"""
        
        pipeline = [
            {"$match": {"grihasta_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "acharya_profiles",
                    "localField": "acharya_id",
                    "foreignField": "user_id",
                    "as": "acharya"
                }
            },
            {"$unwind": "$acharya"},
            {
                "$project": {
                    "booking_id": "$_id",
                    "status": 1,
                    "date_time": 1,
                    "total_amount": 1,
                    "acharya_name": "$acharya.name",
                    "acharya_picture": "$acharya.profile_picture"
                }
            }
        ]
        
        try:
            return await self.db.bookings.aggregate(pipeline).to_list(length=limit)
        except Exception as e:
            logger.error(f"User activity query failed: {e}")
            return []
    
    async def analyze_query_performance(self, collection_name: str, query: Dict[str, Any]):
        """Analyze query performance using explain()"""
        
        try:
            collection = self.db[collection_name]
            explanation = await collection.find(query).explain()
            
            exec_stats = explanation.get("executionStats", {})
            
            return {
                "execution_time_ms": exec_stats.get("executionTimeMillis"),
                "total_docs_examined": exec_stats.get("totalDocsExamined"),
                "total_keys_examined": exec_stats.get("totalKeysExamined"),
                "n_returned": exec_stats.get("nReturned"),
                "index_used": explanation.get("queryPlanner", {}).get("winningPlan", {}).get("inputStage", {}).get("indexName"),
                "efficient": exec_stats.get("totalDocsExamined", 0) <= exec_stats.get("nReturned", 0) * 1.2  # Within 20% overhead
            }
        except Exception as e:
            logger.error(f"Query analysis failed: {e}")
            return {}
    
    async def get_slow_queries_report(self) -> List[Dict[str, Any]]:
        """Get report of slow queries from MongoDB profiling"""
        
        try:
            # Enable profiling if not already enabled
            await self.db.command("profile", 2)  # Profile all operations
            
            # Get slow queries (> 100ms)
            slow_queries = await self.db.system.profile.find({
                "millis": {"$gt": 100}
            }).sort("millis", -1).limit(20).to_list(length=20)
            
            return [
                {
                    "collection": q.get("ns", "").split(".")[-1],
                    "operation": q.get("op"),
                    "duration_ms": q.get("millis"),
                    "timestamp": q.get("ts"),
                    "query": str(q.get("command", {}))[:200]  # Truncate for readability
                }
                for q in slow_queries
            ]
        except Exception as e:
            logger.error(f"Slow query report failed: {e}")
            return []


# Usage example:
"""
from app.services.query_optimizer import QueryOptimizer

optimizer = QueryOptimizer(db)

# Create all indexes at startup
await optimizer.create_all_indexes()

# Use optimized queries
acharyas = await optimizer.get_acharyas_optimized(
    filters={"location.city": "Mumbai", "ratings.average": {"$gte": 4.0}},
    sort=[("ratings.average", -1), ("total_bookings", -1)],
    skip=0,
    limit=20
)

# Analyze query performance
performance = await optimizer.analyze_query_performance(
    "acharya_profiles",
    {"location.city": "Mumbai"}
)

# Get slow queries report
slow_queries = await optimizer.get_slow_queries_report()
"""
