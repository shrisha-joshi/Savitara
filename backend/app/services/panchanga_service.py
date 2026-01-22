"""
Panchanga (Hindu Calendar) Service for Savitara
Provides Tithi, Nakshatra, Muhurat, and Festival information
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta, timezone
from enum import Enum
import httpx

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)
settings = get_settings()


class Tithi(Enum):
    """Lunar day (Tithi) names"""
    PRATIPADA = 1  # First day
    DWITIYA = 2    # Second day
    TRITIYA = 3    # Third day
    CHATURTHI = 4  # Fourth day
    PANCHAMI = 5   # Fifth day
    SHASHTHI = 6   # Sixth day
    SAPTAMI = 7    # Seventh day
    ASHTAMI = 8    # Eighth day
    NAVAMI = 9     # Ninth day
    DASHAMI = 10   # Tenth day
    EKADASHI = 11  # Eleventh day
    DWADASHI = 12  # Twelfth day
    TRAYODASHI = 13 # Thirteenth day
    CHATURDASHI = 14 # Fourteenth day
    PURNIMA = 15   # Full moon
    AMAVASYA = 30  # New moon


class Nakshatra(Enum):
    """27 Nakshatras (Lunar mansions)"""
    ASHWINI = 1
    BHARANI = 2
    KRITTIKA = 3
    ROHINI = 4
    MRIGASHIRA = 5
    ARDRA = 6
    PUNARVASU = 7
    PUSHYA = 8
    ASHLESHA = 9
    MAGHA = 10
    PURVA_PHALGUNI = 11
    UTTARA_PHALGUNI = 12
    HASTA = 13
    CHITRA = 14
    SWATI = 15
    VISHAKHA = 16
    ANURADHA = 17
    JYESHTHA = 18
    MULA = 19
    PURVA_ASHADHA = 20
    UTTARA_ASHADHA = 21
    SHRAVANA = 22
    DHANISHTA = 23
    SHATABHISHA = 24
    PURVA_BHADRAPADA = 25
    UTTARA_BHADRAPADA = 26
    REVATI = 27


class Yoga(Enum):
    """27 Yogas"""
    VISHKUMBHA = 1
    PRITI = 2
    AYUSHMAN = 3
    SAUBHAGYA = 4
    SHOBHANA = 5
    ATIGANDA = 6
    SUKARMA = 7
    DHRITI = 8
    SHULA = 9
    GANDA = 10
    VRIDDHI = 11
    DHRUVA = 12
    VYAGHATA = 13
    HARSHANA = 14
    VAJRA = 15
    SIDDHI = 16
    VYATIPATA = 17
    VARIYAN = 18
    PARIGHA = 19
    SHIVA = 20
    SIDDHA = 21
    SADHYA = 22
    SHUBHA = 23
    SHUKLA = 24
    BRAHMA = 25
    INDRA = 26
    VAIDHRITI = 27


class Karana(Enum):
    """11 Karanas (half-Tithi)"""
    BAVA = 1
    BALAVA = 2
    KAULAVA = 3
    TAITILA = 4
    GARA = 5
    VANIJA = 6
    VISHTI = 7  # Bhadra
    SHAKUNI = 8
    CHATUSHPADA = 9
    NAGA = 10
    KIMSTUGHNA = 11


class MuhuratType(Enum):
    """Types of Muhurat"""
    ABHIJIT = "abhijit"           # Best muhurat for all activities
    BRAHMA = "brahma"             # First hour after sunrise
    VIJAYA = "vijaya"             # Victory muhurat
    AMRIT = "amrit"               # Nectar muhurat
    SHUBH = "shubh"               # Auspicious muhurat
    LABH = "labh"                 # Gain muhurat
    RAHU_KALAM = "rahu_kalam"     # Inauspicious period
    YAMAGANDAM = "yamagandam"     # Inauspicious period
    GULIKA_KALAM = "gulika_kalam" # Inauspicious period


# Tithi names in Sanskrit and English
TITHI_NAMES = {
    1: ("Pratipada", "First day"),
    2: ("Dwitiya", "Second day"),
    3: ("Tritiya", "Third day"),
    4: ("Chaturthi", "Fourth day"),
    5: ("Panchami", "Fifth day"),
    6: ("Shashthi", "Sixth day"),
    7: ("Saptami", "Seventh day"),
    8: ("Ashtami", "Eighth day"),
    9: ("Navami", "Ninth day"),
    10: ("Dashami", "Tenth day"),
    11: ("Ekadashi", "Eleventh day"),
    12: ("Dwadashi", "Twelfth day"),
    13: ("Trayodashi", "Thirteenth day"),
    14: ("Chaturdashi", "Fourteenth day"),
    15: ("Purnima", "Full Moon"),
    30: ("Amavasya", "New Moon")
}

# Nakshatra names
NAKSHATRA_NAMES = {
    1: ("Ashwini", "अश्विनी"),
    2: ("Bharani", "भरणी"),
    3: ("Krittika", "कृत्तिका"),
    4: ("Rohini", "रोहिणी"),
    5: ("Mrigashira", "मृगशिरा"),
    6: ("Ardra", "आर्द्रा"),
    7: ("Punarvasu", "पुनर्वसु"),
    8: ("Pushya", "पुष्य"),
    9: ("Ashlesha", "आश्लेषा"),
    10: ("Magha", "मघा"),
    11: ("Purva Phalguni", "पूर्व फाल्गुनी"),
    12: ("Uttara Phalguni", "उत्तर फाल्गुनी"),
    13: ("Hasta", "हस्त"),
    14: ("Chitra", "चित्रा"),
    15: ("Swati", "स्वाति"),
    16: ("Vishakha", "विशाखा"),
    17: ("Anuradha", "अनुराधा"),
    18: ("Jyeshtha", "ज्येष्ठा"),
    19: ("Mula", "मूल"),
    20: ("Purva Ashadha", "पूर्वाषाढ़ा"),
    21: ("Uttara Ashadha", "उत्तराषाढ़ा"),
    22: ("Shravana", "श्रवण"),
    23: ("Dhanishta", "धनिष्ठा"),
    24: ("Shatabhisha", "शतभिषा"),
    25: ("Purva Bhadrapada", "पूर्व भाद्रपद"),
    26: ("Uttara Bhadrapada", "उत्तर भाद्रपद"),
    27: ("Revati", "रेवती")
}

# Major Hindu festivals with dates (approximate, actual dates vary by year)
MAJOR_FESTIVALS = [
    {"name": "Makar Sankranti", "month": 1, "day": 14, "description": "Harvest festival marking sun's transition to Capricorn"},
    {"name": "Basant Panchami", "month": 2, "description": "Saraswati Puja - Spring festival"},
    {"name": "Maha Shivaratri", "month": 2, "description": "Great night of Lord Shiva"},
    {"name": "Holi", "month": 3, "description": "Festival of colors"},
    {"name": "Ugadi/Gudi Padwa", "month": 3, "description": "Hindu New Year"},
    {"name": "Ram Navami", "month": 4, "description": "Birth of Lord Rama"},
    {"name": "Hanuman Jayanti", "month": 4, "description": "Birth of Lord Hanuman"},
    {"name": "Akshaya Tritiya", "month": 5, "description": "Auspicious day for new beginnings"},
    {"name": "Guru Purnima", "month": 7, "description": "Day to honor gurus and teachers"},
    {"name": "Raksha Bandhan", "month": 8, "description": "Festival celebrating brother-sister bond"},
    {"name": "Krishna Janmashtami", "month": 8, "description": "Birth of Lord Krishna"},
    {"name": "Ganesh Chaturthi", "month": 9, "description": "Birth of Lord Ganesha"},
    {"name": "Navratri", "month": 10, "description": "Nine nights celebrating divine feminine"},
    {"name": "Dussehra/Vijayadashami", "month": 10, "description": "Victory of good over evil"},
    {"name": "Karwa Chauth", "month": 10, "description": "Married women fast for husband's longevity"},
    {"name": "Diwali", "month": 11, "description": "Festival of lights"},
    {"name": "Govardhan Puja", "month": 11, "description": "Day after Diwali"},
    {"name": "Bhai Dooj", "month": 11, "description": "Festival celebrating brother-sister bond"},
    {"name": "Kartik Purnima", "month": 11, "description": "Holy dip in sacred rivers"},
]

# String constants to avoid duplication
AVOID_AUSPICIOUS = "Avoid auspicious activities"
GOOD_FOR_DURGA = "Good for Durga worship"

# Auspicious activities by tithi
TITHI_ACTIVITIES = {
    1: ["Starting new ventures", "House warming", "Travel"],
    2: ["Marriage", "Naming ceremony", "Grihapravesh"],
    3: ["Vehicle purchase", "Hair cutting", "Shaving"],
    4: [AVOID_AUSPICIOUS, "Good for Ganesh worship"],
    5: ["Education start", "Medical treatment", "Vratas"],
    6: ["Starting construction", "Plantation", "Agriculture"],
    7: ["Vehicle purchase", "Journey", "New clothes"],
    8: ["Avoid auspicious work", GOOD_FOR_DURGA],
    9: [AVOID_AUSPICIOUS, GOOD_FOR_DURGA],
    10: ["Government work", "Education", "Marriage"],
    11: ["Fasting", "Spiritual activities", "Vratas"],
    12: ["Temple visits", "Donations", "Charity"],
    13: ["Mixed results", "Good for remedial measures"],
    14: [AVOID_AUSPICIOUS, "Good for Shiva worship"],
    15: ["Satyanarayan Puja", "Pitru Karma", "Full moon rituals"],
    30: ["Pitru Tarpan", "Ancestor rituals", "Meditation"]
}


class PanchangaService:
    """Panchanga (Hindu Calendar) Service"""
    
    def __init__(self):
        """Initialize Panchanga service"""
        self.api_url = settings.PANCHANGA_API_URL if hasattr(settings, 'PANCHANGA_API_URL') else None
    
    def calculate_tithi(self, date_obj: date, latitude: float = 28.6139, longitude: float = 77.2090) -> Dict[str, Any]:
        """
        Calculate Tithi for a given date
        Note: This is a simplified calculation. For precise values, use astronomical APIs
        
        Args:
            date_obj: Date to calculate for
            latitude: Location latitude (default: Delhi)
            longitude: Location longitude (default: Delhi)
            
        Returns:
            Tithi information
        """
        # Simplified tithi calculation based on lunar cycle (~29.5 days)
        # Reference new moon date (approximate)
        reference_new_moon = date(2024, 1, 11)  # Known new moon date
        
        days_since_new_moon = (date_obj - reference_new_moon).days % 30
        
        if days_since_new_moon == 0:
            tithi_num = 30  # Amavasya
        elif days_since_new_moon == 15:
            tithi_num = 15  # Purnima
        elif days_since_new_moon < 15:
            tithi_num = days_since_new_moon
        else:
            tithi_num = days_since_new_moon - 15
        
        paksha = "Shukla" if days_since_new_moon < 15 else "Krishna"
        
        tithi_name = TITHI_NAMES.get(tithi_num, ("Unknown", "Unknown"))
        
        return {
            "number": tithi_num,
            "name_sanskrit": tithi_name[0],
            "name_english": tithi_name[1],
            "paksha": paksha,
            "paksha_english": "Waxing Moon" if paksha == "Shukla" else "Waning Moon",
            "auspicious_activities": TITHI_ACTIVITIES.get(tithi_num, []),
            "is_ekadashi": tithi_num == 11,
            "is_full_moon": tithi_num == 15,
            "is_new_moon": tithi_num == 30
        }
    
    def calculate_nakshatra(self, date_obj: date) -> Dict[str, Any]:
        """
        Calculate Nakshatra for a given date
        
        Args:
            date_obj: Date to calculate for
            
        Returns:
            Nakshatra information
        """
        # Simplified calculation (actual calculation requires precise moon position)
        reference_date = date(2024, 1, 1)
        days_passed = (date_obj - reference_date).days
        
        # Moon travels through all 27 nakshatras in ~27.3 days
        nakshatra_num = (days_passed % 27) + 1
        
        nakshatra_name = NAKSHATRA_NAMES.get(nakshatra_num, ("Unknown", "Unknown"))
        
        # Nakshatra qualities
        qualities = {
            1: "Swift, beginning",
            2: "Restraint, discipline",
            3: "Sharp, fiery",
            4: "Growth, creation",
            5: "Seeking, searching",
            6: "Transformation",
            7: "Return, restoration",
            8: "Nourishment",
            9: "Clinging, embracing",
            10: "Majesty, ancestors",
            11: "Creative, enjoyment",
            12: "Healing, patronage",
            13: "Skill, hands",
            14: "Brightness, beauty",
            15: "Independence",
            16: "Achievement",
            17: "Devotion, friendship",
            18: "Excellence, seniority",
            19: "Root, foundation",
            20: "Invincibility",
            21: "Universal, ultimate",
            22: "Learning, listening",
            23: "Wealth, music",
            24: "Healing, hundred medicines",
            25: "Burning, heat",
            26: "Warrior, protection",
            27: "Prosperity, nourishment"
        }
        
        return {
            "number": nakshatra_num,
            "name_english": nakshatra_name[0],
            "name_sanskrit": nakshatra_name[1],
            "quality": qualities.get(nakshatra_num, ""),
            "pada": ((days_passed % 4) + 1),  # Simplified pada calculation
            "lord": self._get_nakshatra_lord(nakshatra_num)
        }
    
    def _get_nakshatra_lord(self, nakshatra_num: int) -> str:
        """Get ruling deity/planet for nakshatra"""
        lords = {
            1: "Ashwini Kumaras",
            2: "Yama",
            3: "Agni",
            4: "Brahma",
            5: "Soma",
            6: "Rudra",
            7: "Aditi",
            8: "Brihaspati",
            9: "Nagas",
            10: "Pitris",
            11: "Bhaga",
            12: "Aryaman",
            13: "Surya",
            14: "Tvashtar",
            15: "Vayu",
            16: "Indra-Agni",
            17: "Mitra",
            18: "Indra",
            19: "Nirrti",
            20: "Apas",
            21: "Vishvadevas",
            22: "Vishnu",
            23: "Vasus",
            24: "Varuna",
            25: "Aja Ekapada",
            26: "Ahir Budhnya",
            27: "Pushan"
        }
        return lords.get(nakshatra_num, "Unknown")
    
    def calculate_rahu_kalam(self, date_obj: date) -> Dict[str, Any]:
        """
        Calculate Rahu Kalam (inauspicious period) for a given date
        
        Rahu Kalam varies by day of week:
        Sunday: 4:30 PM - 6:00 PM
        Monday: 7:30 AM - 9:00 AM
        Tuesday: 3:00 PM - 4:30 PM
        Wednesday: 12:00 PM - 1:30 PM
        Thursday: 1:30 PM - 3:00 PM
        Friday: 10:30 AM - 12:00 PM
        Saturday: 9:00 AM - 10:30 AM
        """
        # Get day of week (0=Monday, 6=Sunday)
        weekday = date_obj.weekday()
        
        # Rahu Kalam periods (approximate for 6 AM sunrise, 6 PM sunset)
        rahu_periods = {
            0: ("07:30", "09:00"),  # Monday
            1: ("15:00", "16:30"),  # Tuesday
            2: ("12:00", "13:30"),  # Wednesday
            3: ("13:30", "15:00"),  # Thursday
            4: ("10:30", "12:00"),  # Friday
            5: ("09:00", "10:30"),  # Saturday
            6: ("16:30", "18:00"),  # Sunday
        }
        
        start, end = rahu_periods[weekday]
        
        return {
            "start": start,
            "end": end,
            "duration_minutes": 90,
            "warning": "Avoid starting new activities during Rahu Kalam"
        }
    
    def get_daily_panchanga(self, date_obj: date, latitude: float = 28.6139, longitude: float = 77.2090) -> Dict[str, Any]:
        """
        Get complete daily Panchanga
        
        Args:
            date_obj: Date to get panchanga for
            latitude: Location latitude
            longitude: Location longitude
            
        Returns:
            Complete Panchanga information
        """
        try:
            tithi = self.calculate_tithi(date_obj, latitude, longitude)
            nakshatra = self.calculate_nakshatra(date_obj)
            rahu_kalam = self.calculate_rahu_kalam(date_obj)
            
            # Calculate other elements (simplified)
            days_passed = (date_obj - date(2024, 1, 1)).days
            yoga_num = (days_passed % 27) + 1
            karana_num = ((days_passed * 2) % 11) + 1
            
            # Check for festivals
            festivals_today = self.get_festivals_for_date(date_obj)
            
            # Calculate sunrise/sunset (simplified - actual calculation needs location)
            sunrise = "06:15"
            sunset = "18:30"
            
            return {
                "date": date_obj.isoformat(),
                "day_of_week": date_obj.strftime("%A"),
                "day_of_week_hindi": self._get_hindi_day(date_obj.weekday()),
                "sunrise": sunrise,
                "sunset": sunset,
                "tithi": tithi,
                "nakshatra": nakshatra,
                "yoga": {
                    "number": yoga_num,
                    "name": list(Yoga)[yoga_num - 1].name.replace("_", " ").title()
                },
                "karana": {
                    "number": karana_num,
                    "name": list(Karana)[karana_num - 1].name.title()
                },
                "rahu_kalam": rahu_kalam,
                "festivals": festivals_today,
                "muhurat": self.get_auspicious_muhurat(date_obj),
                "inauspicious_periods": {
                    "rahu_kalam": rahu_kalam,
                    "yamagandam": self._calculate_yamagandam(date_obj),
                    "gulika_kalam": self._calculate_gulika_kalam(date_obj)
                }
            }
        except Exception as e:
            logger.error(f"Panchanga calculation error: {e}", exc_info=True)
            raise ExternalServiceError(
                service_name="Panchanga",
                details={"error": str(e)}
            )
    
    def _get_hindi_day(self, weekday: int) -> str:
        """Get Hindi name for day of week"""
        days = {
            0: "सोमवार",  # Monday
            1: "मंगलवार",  # Tuesday
            2: "बुधवार",  # Wednesday
            3: "गुरुवार",  # Thursday
            4: "शुक्रवार",  # Friday
            5: "शनिवार",  # Saturday
            6: "रविवार",  # Sunday
        }
        return days.get(weekday, "")
    
    def _calculate_yamagandam(self, date_obj: date) -> Dict[str, Any]:
        """Calculate Yamagandam period"""
        weekday = date_obj.weekday()
        periods = {
            0: ("10:30", "12:00"),  # Monday
            1: ("09:00", "10:30"),  # Tuesday
            2: ("07:30", "09:00"),  # Wednesday
            3: ("06:00", "07:30"),  # Thursday
            4: ("15:00", "16:30"),  # Friday
            5: ("13:30", "15:00"),  # Saturday
            6: ("12:00", "13:30"),  # Sunday
        }
        start, end = periods[weekday]
        return {"start": start, "end": end}
    
    def _calculate_gulika_kalam(self, date_obj: date) -> Dict[str, Any]:
        """Calculate Gulika Kalam period"""
        weekday = date_obj.weekday()
        periods = {
            0: ("13:30", "15:00"),  # Monday
            1: ("12:00", "13:30"),  # Tuesday
            2: ("10:30", "12:00"),  # Wednesday
            3: ("09:00", "10:30"),  # Thursday
            4: ("07:30", "09:00"),  # Friday
            5: ("06:00", "07:30"),  # Saturday
            6: ("15:00", "16:30"),  # Sunday
        }
        start, end = periods[weekday]
        return {"start": start, "end": end}
    
    def get_auspicious_muhurat(self, date_obj: date = None) -> List[Dict[str, Any]]:
        """Get auspicious muhurat timings for a date
        
        Args:
            date_obj: Optional date parameter for future date-specific calculations
        """
        # Simplified muhurat calculation
        # Future enhancement: Calculate based on sunrise/sunset for specific date
        _ = date_obj  # Reserved for future date-specific calculations
        muhurats = [
            {
                "name": "Brahma Muhurat",
                "start": "04:30",
                "end": "05:18",
                "good_for": ["Meditation", "Spiritual practices", "Study"],
                "quality": "Most auspicious"
            },
            {
                "name": "Abhijit Muhurat",
                "start": "11:45",
                "end": "12:33",
                "good_for": ["Starting new ventures", "Important meetings", "Travel"],
                "quality": "Highly auspicious"
            },
            {
                "name": "Vijaya Muhurat",
                "start": "14:00",
                "end": "14:48",
                "good_for": ["Victory", "Competitions", "Legal matters"],
                "quality": "Auspicious"
            }
        ]
        
        return muhurats
    
    def get_festivals_for_date(self, date_obj: date) -> List[Dict[str, Any]]:
        """Get festivals for a specific date"""
        festivals = []
        for festival in MAJOR_FESTIVALS:
            if festival.get("day") == date_obj.day and festival.get("month") == date_obj.month:
                festivals.append({
                    "name": festival["name"],
                    "description": festival["description"]
                })
        return festivals
    
    def get_upcoming_festivals(self, count: int = 10) -> List[Dict[str, Any]]:
        """Get upcoming festivals"""
        today = date.today()
        upcoming = []
        
        for festival in MAJOR_FESTIVALS:
            if "day" in festival:
                festival_date = date(today.year, festival["month"], festival["day"])
                if festival_date < today:
                    festival_date = date(today.year + 1, festival["month"], festival["day"])
                
                upcoming.append({
                    "name": festival["name"],
                    "date": festival_date.isoformat(),
                    "description": festival["description"],
                    "days_away": (festival_date - today).days
                })
        
        # Sort by date and return requested count
        upcoming.sort(key=lambda x: x["days_away"])
        return upcoming[:count]
    
    def get_ekadashi_dates(self, year: int) -> List[Dict[str, Any]]:
        """Get all Ekadashi dates for a year"""
        ekadashis = []
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        current = start_date
        while current <= end_date:
            tithi = self.calculate_tithi(current)
            if tithi["number"] == 11:
                ekadashis.append({
                    "date": current.isoformat(),
                    "paksha": tithi["paksha"],
                    "name": f"{tithi['paksha']} Ekadashi"
                })
            current += timedelta(days=1)
        
        return ekadashis
    
    def is_auspicious_for(self, date_obj: date, activity: str) -> Dict[str, Any]:
        """
        Check if a date is auspicious for a specific activity
        
        Args:
            date_obj: Date to check
            activity: Activity type (e.g., 'marriage', 'grihapravesh', 'travel')
        """
        tithi = self.calculate_tithi(date_obj)
        nakshatra = self.calculate_nakshatra(date_obj)
        rahu_kalam = self.calculate_rahu_kalam(date_obj)
        
        # Activities to avoid on certain tithis
        inauspicious_tithis = {
            "marriage": [4, 8, 9, 14, 30],
            "travel": [4, 8, 9, 14],
            "grihapravesh": [4, 8, 9, 14, 30],
            "business": [4, 8, 9, 14],
            "purchase": [4, 8, 9, 14, 30]
        }
        
        is_auspicious = True
        reasons = []
        recommendations = []
        
        # Check tithi
        bad_tithis = inauspicious_tithis.get(activity.lower(), [])
        if tithi["number"] in bad_tithis:
            is_auspicious = False
            reasons.append(f"Tithi ({tithi['name_sanskrit']}) is not favorable for {activity}")
        else:
            reasons.append(f"Tithi ({tithi['name_sanskrit']}) is favorable")
        
        # Check for Rahu Kalam
        recommendations.append(f"Avoid starting between {rahu_kalam['start']} - {rahu_kalam['end']} (Rahu Kalam)")
        
        # Auspicious nakshtras for different activities
        auspicious_nakshatras = {
            "marriage": [4, 7, 8, 11, 12, 13, 22, 27],  # Rohini, Punarvasu, Pushya, etc.
            "travel": [1, 5, 7, 13, 15, 22, 27],
            "grihapravesh": [2, 4, 7, 8, 11, 12, 13, 22],
            "business": [1, 4, 7, 8, 13, 15, 22, 27],
            "purchase": [1, 4, 7, 8, 13, 15, 22]
        }
        
        good_nakshatras = auspicious_nakshatras.get(activity.lower(), [])
        if nakshatra["number"] in good_nakshatras:
            reasons.append(f"Nakshatra ({nakshatra['name_english']}) is auspicious for {activity}")
        elif good_nakshatras:
            reasons.append(f"Nakshatra ({nakshatra['name_english']}) is neutral for {activity}")
        
        return {
            "date": date_obj.isoformat(),
            "activity": activity,
            "is_auspicious": is_auspicious,
            "tithi": tithi["name_sanskrit"],
            "nakshatra": nakshatra["name_english"],
            "reasons": reasons,
            "recommendations": recommendations,
            "rahu_kalam": rahu_kalam,
            "muhurat": self.get_auspicious_muhurat(date_obj)
        }


# Create singleton instance
panchanga_service = PanchangaService()
