"""
Recommendation Engine Service
"""
from typing import List, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from collections import Counter
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    Recommendation engine for suggesting Acharyas to Grihastas
    
    Uses multiple strategies:
    1. Collaborative filtering (users with similar bookings)
    2. Content-based filtering (specializations, location)
    3. Popularity-based (highest rated, most booked)
    4. Location-based (same city)
    5. Parampara preference
    """
    
    @staticmethod
    async def get_recommended_acharyas(
        db: AsyncIOMotorDatabase,
        user_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get personalized acharya recommendations for a user
        
        Args:
            db: Database connection
            user_id: Grihasta user ID
            limit: Number of recommendations to return
            
        Returns:
            List of recommended acharya profiles
        """
        try:
            # Get user's profile
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return await RecommendationService._get_popular_acharyas(db, limit)
            
            grihasta = await db.grihasta_profiles.find_one({"user_id": user_id})
            if not grihasta:
                return await RecommendationService._get_popular_acharyas(db, limit)
            
            # Get user's booking history
            past_bookings = await db.bookings.find({
                "grihasta_id": user_id,
                "status": {"$in": ["completed", "confirmed"]}
            }).to_list(length=100)
            
            recommended_ids = set()
            
            # Strategy 1: Collaborative filtering
            if past_bookings:
                collaborative_recs = await RecommendationService._collaborative_filtering(
                    db, past_bookings, user_id
                )
                recommended_ids.update(collaborative_recs[:limit // 2])
            
            # Strategy 2: Location-based
            if grihasta.get("location"):
                location_recs = await RecommendationService._location_based(
                    db, grihasta["location"]["city"], list(recommended_ids)
                )
                recommended_ids.update(location_recs[:limit // 4])
            
            # Strategy 3: Fill remaining with popular acharyas
            if len(recommended_ids) < limit:
                popular_recs = await RecommendationService._get_popular_acharyas(
                    db, limit, exclude_ids=list(recommended_ids)
                )
                recommended_ids.update(r["_id"] for r in popular_recs)
            
            # Fetch full profiles
            recommendations = await db.acharya_profiles.find({
                "_id": {"$in": [ObjectId(aid) for aid in recommended_ids]},
                "status": "verified"
            }).limit(limit).to_list(length=limit)
            
            logger.info(f"Generated {len(recommendations)} recommendations for user {user_id}")
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return await RecommendationService._get_popular_acharyas(db, limit)
    
    @staticmethod
    async def _collaborative_filtering(
        db: AsyncIOMotorDatabase,
        past_bookings: List[Dict],
        user_id: str
    ) -> List[str]:
        """Find acharyas booked by similar users"""
        # Get acharyas user has booked
        booked_acharyas = [b["acharya_id"] for b in past_bookings]
        
        # Get specializations from past bookings
        past_specializations = []
        for booking in past_bookings:
            # Get acharya profile to find specializations
            acharya = await db.acharya_profiles.find_one(
                {"user_id": booking["acharya_id"]}
            )
            if acharya and acharya.get("specializations"):
                past_specializations.extend(acharya["specializations"])
        
        if not past_specializations:
            return []
        
        # Find similar users (users who booked acharyas with same specializations)
        similar_bookings = await db.bookings.find({
            "grihasta_id": {"$ne": user_id},
            "acharya_id": {"$in": booked_acharyas},
            "status": {"$in": ["completed", "confirmed"]}
        }).to_list(length=200)
        
        # Get acharyas booked by similar users
        similar_user_acharyas = [
            b["acharya_id"] for b in similar_bookings
            if b["acharya_id"] not in booked_acharyas
        ]
        
        # Count frequency
        acharya_scores = Counter(similar_user_acharyas)
        
        # Return top acharyas
        return [aid for aid, _ in acharya_scores.most_common(10)]
    
    @staticmethod
    async def _location_based(
        db: AsyncIOMotorDatabase,
        city: str,
        exclude_ids: List[str]
    ) -> List[str]:
        """Find top-rated acharyas in user's city"""
        acharyas = await db.acharya_profiles.find({
            "_id": {"$nin": [ObjectId(aid) for aid in exclude_ids]},
            "location.city": city,
            "status": "verified"
        }).sort("ratings.average", -1).limit(5).to_list(length=5)
        
        return [str(a["_id"]) for a in acharyas]
    
    @staticmethod
    async def _get_popular_acharyas(
        db: AsyncIOMotorDatabase,
        limit: int,
        exclude_ids: List[str] = None
    ) -> List[Dict]:
        """Get most popular acharyas (highest rated + most bookings)"""
        exclude_ids = exclude_ids or []
        
        query = {
            "status": "verified"
        }
        
        if exclude_ids:
            query["_id"] = {"$nin": [ObjectId(aid) for aid in exclude_ids]}
        
        acharyas = await db.acharya_profiles.find(query).sort([
            ("ratings.average", -1),
            ("ratings.count", -1)
        ]).limit(limit).to_list(length=limit)
        
        return acharyas
    
    @staticmethod
    async def get_similar_acharyas(
        db: AsyncIOMotorDatabase,
        acharya_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """
        Find similar acharyas based on specializations and location
        Useful for "You might also like" feature
        """
        # Get acharya profile
        acharya = await db.acharya_profiles.find_one({"_id": ObjectId(acharya_id)})
        if not acharya:
            return []
        
        # Find acharyas with similar specializations
        similar = await db.acharya_profiles.find({
            "_id": {"$ne": ObjectId(acharya_id)},
            "specializations": {"$in": acharya.get("specializations", [])},
            "status": "verified"
        }).sort("ratings.average", -1).limit(limit).to_list(length=limit)
        
        return similar
