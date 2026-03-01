"""
Analytics Aggregation Pipelines for Admin Dashboard
Implements MongoDB aggregations for demand density and hotspot analysis
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)


async def get_pooja_hotspots(
    db: AsyncIOMotorDatabase,
    city: str = "Bangalore",
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Find "Pooja Hotspots" - residential clusters with high booking density.
    
    Implements Prompt 4: Real-Time Admin Dashboard Analytics Aggregation
    
    Uses MongoDB geospatial aggregation to identify demand hotspots:
    1. Filters completed bookings in the last N days for a specific city
    2. Groups bookings by geographic clusters using $geoNear
    3. Joins with pooja collection to get service details
    4. Calculates total revenue and booking count per cluster
    5. Computes popularity score and sorts results
    
    Args:
        db: MongoDB database instance
        city: City name to filter (default: "Bangalore")
        days: Number of days to look back (default: 30)
        max_distance_meters: Maximum distance for geo clustering (default: 5000m = 5km)
    
    Returns:
        List of hotspot clusters with booking stats, sorted by popularity
    
    Example response:
        [
            {
                "cluster_location": {"type": "Point", "coordinates": [77.5946, 12.9716]},
                "city": "Bangalore",
                "pooja_name": "Satyanarayan Puja",
                "pooja_category": "festival",
                "total_bookings": 25,
                "total_revenue": 12500.0,
                "avg_distance_km": 2.3,
                "popularity_score": 312.5
            },
            ...
        ]
    
    Notes:
        - Requires a 2dsphere index on bookings.location.coordinates
        - Uses GeoJSON Point format: [longitude, latitude]
        - Popularity score = total_bookings * avg_revenue
    """
    # Calculate the date threshold
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # MongoDB aggregation pipeline
    pipeline = [
        # Stage 1: Match completed bookings in the last N days
        {
            "$match": {
                "status": "completed",
                "completed_at": {"$gte": cutoff_date},
                "location.city": city,
                "location.latitude": {"$exists": True, "$ne": None},
                "location.longitude": {"$exists": True, "$ne": None},
                "pooja_id": {"$exists": True, "$ne": None},  # Only bookings with pooja service
            }
        },
        
        # Stage 2: Project GeoJSON Point format for geospatial operations
        {
            "$project": {
                "location_point": {
                    "type": "Point",
                    "coordinates": ["$location.longitude", "$location.latitude"]
                },
                "city": "$location.city",
                "pooja_id": 1,
                "total_amount": 1,
                "date_time": 1,
            }
        },
        
        # Stage 3: Group bookings by geographic proximity and pooja type
        # Create a rounded lat/lng to cluster nearby locations
        {
            "$addFields": {
                "cluster_lat": {
                    "$round": [
                        {"$arrayElemAt": ["$location_point.coordinates", 1]},
                        2  # Round to 2 decimal places (~1km precision)
                    ]
                },
                "cluster_lng": {
                    "$round": [
                        {"$arrayElemAt": ["$location_point.coordinates", 0]},
                        2
                    ]
                }
            }
        },
        
        # Stage 4: Group by cluster coordinates and pooja type
        {
            "$group": {
                "_id": {
                    "lat": "$cluster_lat",
                    "lng": "$cluster_lng",
                    "pooja_id": "$pooja_id",
                    "city": "$city",
                },
                "total_bookings": {"$sum": 1},
                "total_revenue": {"$sum": "$total_amount"},
                "avg_revenue": {"$avg": "$total_amount"},
                "booking_ids": {"$push": "$_id"},
            }
        },
        
        # Stage 5: Lookup pooja details
        {
            "$lookup": {
                "from": "poojas",
                "localField": "_id.pooja_id",
                "foreignField": "_id",
                "as": "pooja_info"
            }
        },
        
        # Stage 6: Unwind pooja_info (should be single document)
        {
            "$unwind": {
                "path": "$pooja_info",
                "preserveNullAndEmptyArrays": True  # Keep clusters even if pooja deleted
            }
        },
        
        # Stage 7: Calculate popularity score and shape final output
        {
            "$project": {
                "_id": 0,
                "cluster_location": {
                    "type": "Point",
                    "coordinates": ["$_id.lng", "$_id.lat"]
                },
                "city": "$_id.city",
                "pooja_id": "$_id.pooja_id",
                "pooja_name": {"$ifNull": ["$pooja_info.name", "Unknown Pooja"]},
                "pooja_category": {"$ifNull": ["$pooja_info.category", "unknown"]},
                "total_bookings": 1,
                "total_revenue": 1,
                "avg_revenue": 1,
                "popularity_score": {
                    "$multiply": ["$total_bookings", {"$ifNull": ["$avg_revenue", 0]}]
                },
            }
        },
        
        # Stage 8: Sort by popularity (highest first)
        {
            "$sort": {
                "popularity_score": -1
            }
        },
        
        # Stage 9: Limit to top 50 hotspots
        {
            "$limit": 50
        }
    ]
    
    try:
        cursor = db.bookings.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        
        logger.info(
            f"Pooja hotspots query completed for {city}: "
            f"found {len(results)} clusters in last {days} days"
        )
        
        return results
    
    except Exception as e:
        logger.error(f"Failed to execute pooja hotspots aggregation: {e}", exc_info=True)
        raise


async def get_demand_heatmap(
    db: AsyncIOMotorDatabase,
    city: str = "Bangalore",
    days: int = 30,
) -> List[Dict[str, Any]]:
    """
    Get booking demand heatmap data by time and location.
    
    Returns aggregated booking counts by hour of day and day of week
    for visualization in admin dashboard heatmaps.
    
    Args:
        db: MongoDB database instance
        city: City name to filter
        days: Number of days to analyze
    
    Returns:
        List of time-based demand statistics
    """
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {
            "$match": {
                "status": "completed",
                "completed_at": {"$gte": cutoff_date},
                "location.city": city,
            }
        },
        {
            "$project": {
                "hour_of_day": {"$hour": "$date_time"},
                "day_of_week": {"$dayOfWeek": "$date_time"},  # 1=Sunday, 7=Saturday
                "total_amount": 1,
            }
        },
        {
            "$group": {
                "_id": {
                    "hour": "$hour_of_day",
                    "day": "$day_of_week",
                },
                "booking_count": {"$sum": 1},
                "total_revenue": {"$sum": "$total_amount"},
            }
        },
        {
            "$sort": {
                "_id.day": 1,
                "_id.hour": 1,
            }
        }
    ]
    
    try:
        cursor = db.bookings.aggregate(pipeline)
        results = await cursor.to_list(length=None)
        return results
    except Exception as e:
        logger.error(f"Failed to execute demand heatmap aggregation: {e}", exc_info=True)
        raise
