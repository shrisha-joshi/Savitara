"""
AI Personalization and ML Recommendation Models
Panchanga-based triggers, ML matching, behavioral recommendations
"""
from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


def utcnow():
    return datetime.now(timezone.utc)


# ==================== PANCHANGA SERVICE ====================


class PanchangaElement(str, Enum):
    """Hindu calendar elements"""
    TITHI = "tithi"  # Lunar day (1-30)
    NAKSHATRA = "nakshatra"  # Lunar mansion (27 total)
    YOGA = "yoga"  # Special combinations (27 types)
    KARANA = "karana"  # Half of tithi (11 types)
    PAKSHA = "paksha"  # Lunar fortnight (Shukla/Krishna)
    MASA = "masa"  # Lunar month
    SAMVATSARA = "samvatsara"  # Year in 60-year cycle


class AuspiciousTiming(BaseModel):
    """
    Muhurat (auspicious timing) calculation
    
    Used for:
    - Grihapravesh (housewarming)
    - Vivah (marriage)
    - Upanayana (thread ceremony)
    - Vehicle purchase
    - Business inauguration
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Date & Location
    date: date
    city: str
    latitude: float
    longitude: float
    timezone_offset: str = "+05:30"  # IST
    
    # Panchanga Elements
    tithi: str  # "Shukla Paksha Dashami"
    nakshatra: str  # "Rohini"
    yoga: str  # "Vishkambha"
    karana: str  # "Bava"
    masa: str  # "Chaitra"
    
    # Auspicious Windows
    brahma_muhurta: Dict[str, str] = {}  # {"start": "04:30", "end": "05:45"}
    abhijit_muhurta: Dict[str, str] = {}  # {"start": "11:30", "end": "12:15"}
    
    # Inauspicious Periods
    rahu_kaal: Dict[str, str] = {}
    yamaganda: Dict[str, str] = {}
    gulika: Dict[str, str] = {}
    
    # Day Rating
    overall_auspiciousness_score: int = Field(ge=1, le=10)
    suitable_for: List[str] = []  # ["grihapravesh", "vivah", "upanayana"]
    not_suitable_for: List[str] = []
    
    # Special Events
    is_ekadashi: bool = False
    is_purnima: bool = False
    is_amavasya: bool = False
    is_festival: bool = False
    festival_name: Optional[str] = None
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class FestivalPrediction(BaseModel):
    """
    Upcoming festival predictions for proactive Acharya booking
    
    Triggers push notifications 7 days before major festivals
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Festival
    festival_name: str  # "Diwali", "Ganesh Chaturthi", "Navaratri"
    festival_date: date
    days_until_festival: int
    
    # Demand Prediction
    predicted_booking_surge: float  # Multiplier (e.g., 3.5x normal)
    predicted_demand_category: str  # "low", "medium", "high", "very_high"
    
    # Services in Demand
    high_demand_poojas: List[str] = []  # ["Lakshmi Pooja", "Ganesh Pooja"]
    suggested_services: List[str] = []
    
    # Notification Status
    notification_sent: bool = False
    notification_sent_at: Optional[datetime]
    target_user_segments: List[str] = []  # ["lapsed_users", "high_ltv", "new_users"]
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class PersonalizedRecommendation(BaseModel):
    """
    Personalized Panchanga-based recommendations
    
    Examples:
    - "Ekadashi tomorrow - book Vishnu Pooja for spiritual merit"
    - "Shukla Paksha Dashami - ideal for Grihapravesh in next 3 days"
    - "Saturn transit in 15 days - book Shani Pooja for relief"
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Target User
    user_id: str
    user_type: str = "grihasta"
    
    # Recommendation
    recommendation_type: str  # "festival", "muhurat", "planetary_transit", "tithi_based"
    title: str
    description: str
    call_to_action: str  # "Book Now", "View Acharyas", "Learn More"
    
    # Panchanga Context
    panchanga_trigger: Dict[str, Any] = {}
    # {"event": "ekadashi", "date": "2024-02-15", "significance": "Mokshada Ekadashi"}
    
    # Suggested Services
    recommended_poojas: List[str] = []
    recommended_acharyas: List[str] = []  # Filtered by specs/availability
    
    # Urgency
    urgency_level: str = "low"  # "low", "medium", "high"
    valid_until: datetime  # Recommendation expiry
    
    # Engagement
    shown_to_user: bool = False
    shown_at: Optional[datetime]
    clicked: bool = False
    clicked_at: Optional[datetime]
    resulted_in_booking: bool = False
    booking_id: Optional[str]
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== ML RECOMMENDATION ENGINE ====================


class UserBehaviorProfile(BaseModel):
    """
    ML-generated user behavior profile for personalization
    
    Features extracted from:
    - Booking history
    - Search patterns
    - Chat interactions
    - App usage
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    user_id: str
    user_type: str  # "grihasta" or "acharya"
    
    # Booking Preferences (Grihastas)
    preferred_pooja_categories: List[str] = []
    preferred_time_slots: List[str] = []  # ["morning", "evening"]
    preferred_budget_range: Optional[Dict[str, float]]  # {"min": 500, "max": 2000}
    preferred_acharya_characteristics: List[str] = []  # ["verified", "high_rating", "fast_response"]
    
    # Behavioral Signals
    avg_booking_frequency_days: Optional[float]  # Books every X days
    churn_risk_score: float = Field(ge=0.0, le=1.0, default=0.0)  # 0 = low, 1 = high
    price_sensitivity: str = "medium"  # "low", "medium", "high"
    quality_sensitivity: str = "high"  # "low", "medium", "high"
    
    # Engagement
    avg_session_duration_minutes: Optional[float]
    last_active_at: Optional[datetime]
    days_since_last_booking: Optional[int]
    
    # Seasonality
    books_on_festivals: bool = False
    books_on_ekadashi: bool = False
    books_monthly: bool = False
    
    # Derived Segments
    user_segment: str = "new"  # "new", "active", "at_risk", "dormant", "churned", "vip"
    ltv_bucket: str = "low"  # "low", "medium", "high"
    
    # Model Metadata
    model_version: str = "v1.0"
    last_updated: datetime = Field(default_factory=utcnow)
    features_hash: Optional[str]  # For model versioning
    
    model_config = ConfigDict(populate_by_name=True)


class AcharyaRankingScore(BaseModel):
    """
    ML-based Acharya ranking for search results
    
    Factors:
    - Trust score (30%)
    - Response time (20%)
    - Availability (15%)
    - Price competitiveness (10%)
    - User preference match (15%)
    - Geoproximity (10%)
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    acharya_id: str
    query_context_id: str  # Links to search query
    
    # Ranking Components
    trust_score: float = Field(ge=0.0, le=100.0)
    response_time_score: float = Field(ge=0.0, le=100.0)
    availability_score: float = Field(ge=0.0, le=100.0)
    price_competitiveness_score: float = Field(ge=0.0, le=100.0)
    user_match_score: float = Field(ge=0.0, le=100.0)
    geoproximity_score: float = Field(ge=0.0, le=100.0)
    
    # Weighted Composite
    composite_score: float = Field(ge=0.0, le=100.0)
    
    # Personalization Boosts
    previous_booking_boost: float = 0.0  # +10 if user booked this Acharya before
    festival_demand_boost: float = 0.0  # Boost if Acharya specializes in festive poojas
    
    # Final Rank
    final_score: float
    rank_position: int  # 1, 2, 3... in search results
    
    # Context
    search_query: str
    user_id: str
    user_location: Optional[Dict[str, float]]  # {"lat": 12.9716, "lng": 77.5946}
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class SearchQuery(BaseModel):
    """
    User search query logging for ML model training
    
    Used to improve:
    - Search relevance
    - Autocomplete suggestions
    - Trending services detection
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Query
    user_id: str
    query_text: str
    query_type: str = "free_text"  # "free_text", "filter", "voice"
    
    # Filters Applied
    filters: Dict[str, Any] = {}
    # {"city": "Bangalore", "price_max": 2000, "rating_min": 4.0}
    
    # Results
    total_results: int
    results_shown: List[str] = []  # Acharya IDs
    
    # Engagement
    result_clicked: Optional[str]  # Acharya ID
    click_position: Optional[int]  # 1-based
    resulted_in_booking: bool = False
    booking_id: Optional[str]
    
    # Metadata
    session_id: str
    timestamp: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class CollaborativeFilteringSignal(BaseModel):
    """
    User-item interaction signals for collaborative filtering
    
    "Users who booked Acharya A also booked Acharya B"
    "Users who searched for Pooja X also searched for Pooja Y"
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Interaction
    user_id: str
    item_id: str  # Acharya ID or Pooja ID
    item_type: str  # "acharya" or "pooja"
    
    # Event
    event_type: str  # "view", "favorite", "booking", "review"
    event_weight: float = 1.0  # Heavier weight for bookings (5.0) vs views (1.0)
    
    # Context
    session_id: str
    timestamp: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class ABTestVariant(BaseModel):
    """
    A/B testing for feature experiments
    
    Examples:
    - "Search ranking algorithm v1 vs v2"
    - "Pricing display: total vs breakdown"
    - "Recommendation carousel: personalized vs trending"
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Experiment
    experiment_name: str
    variant_name: str  # "control", "treatment_a", "treatment_b"
    
    # User Assignment
    user_id: str
    assigned_at: datetime = Field(default_factory=utcnow)
    
    # Metrics
    primary_metric: str  # "conversion_rate", "avg_booking_value", "retention_rate"
    primary_metric_value: Optional[float]
    
    secondary_metrics: Dict[str, float] = {}
    # {"time_to_booking": 120.5, "search_queries": 3}
    
    # Engagement
    feature_used: bool = False
    feature_used_at: Optional[datetime]
    resulted_in_conversion: bool = False
    conversion_value: Optional[float]
    
    model_config = ConfigDict(populate_by_name=True)


# ==================== CONTENT PERSONALIZATION ====================


class PersonalizedNotification(BaseModel):
    """
    AI-generated personalized push notifications
    
    Avoid generic blasts - tailor to:
    - User behavior
    - Panchanga events
    - Booking history
    - Location
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Target
    user_id: str
    user_segment: str  # "new", "active", "at_risk", "dormant"
    
    # Message
    title: str
    body: str
    image_url: Optional[str]
    deep_link: Optional[str]  # "savitara://acharyas/123"
    
    # Personalization Context
    personalization_type: str
    # "festival_reminder", "dormant_reactivation", "price_drop", "new_acharya_nearby"
    
    context_data: Dict[str, Any] = {}
    # {"festival": "Diwali", "days_until": 7, "recommended_pooja": "Lakshmi Pooja"}
    
    # Sending
    scheduled_for: datetime
    sent_at: Optional[datetime]
    delivery_status: str = "scheduled"  # "scheduled", "sent", "failed", "clicked"
    
    # Engagement
    opened: bool = False
    opened_at: Optional[datetime]
    clicked: bool = False
    clicked_at: Optional[datetime]
    conversion: bool = False
    booking_id: Optional[str]
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class DynamicPricingRecommendation(BaseModel):
    """
    ML-based dynamic pricing suggestions for Acharyas
    
    Factors:
    - Demand (surge pricing during festivals)
    - Competition (nearby Acharyas' prices)
    - Acharya tier (premium can charge more)
    - Historical conversion rates
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    acharya_id: str
    pooja_id: str
    
    # Current Pricing
    current_price: float
    
    # Recommended Pricing
    recommended_price: float
    price_change_percentage: float
    confidence_score: float = Field(ge=0.0, le=1.0)
    
    # Reasoning
    demand_multiplier: float = 1.0  # 1.5x during festivals
    competitive_pressure: str = "neutral"  # "low", "neutral", "high"
    conversion_impact_estimate: str = "+5%"  # Estimated booking increase
    
    # Market Context
    similar_acharyas_avg_price: float
    city_average_price: float
    
    # Recommendation Status
    shown_to_acharya: bool = False
    acharya_accepted: bool = False
    price_updated_at: Optional[datetime]
    
    created_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)


class TrendingService(BaseModel):
    """
    Trending poojas/services detection
    
    Displayed on homepage: "Trending This Week"
    """
    id: Optional[str] = Field(alias="_id", default=None)
    
    # Service
    pooja_name: str
    pooja_category: str
    
    # Trend Stats
    bookings_this_week: int
    bookings_last_week: int
    growth_percentage: float
    trend_score: float = Field(ge=0.0, le=100.0)
    
    # Context
    trending_reason: str  # "festival", "seasonal", "viral", "organic"
    related_festival: Optional[str]
    
    # Display
    display_title: str  # "🔥 Trending: Lakshmi Pooja"
    display_subtitle: str  # "3,500 bookings this week"
    trend_badge: str = "🔥"  # "🔥", "⚡", "🌟"
    
    # Validity
    trending_since: datetime
    valid_until: datetime
    is_active: bool = True
    
    calculated_at: datetime = Field(default_factory=utcnow)
    
    model_config = ConfigDict(populate_by_name=True)
