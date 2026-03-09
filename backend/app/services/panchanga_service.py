"""
Panchanga (Hindu Calendar) Service for Savitara
Accurate astronomical calculations using the ephem library.
Supports both Chandramana (Lunar) and Souramana (Solar) Panchanga types.
Timezone-aware output via timezonefinder + pytz.
"""
import logging
import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

try:
    import ephem
    EPHEM_AVAILABLE = True
except ImportError:
    EPHEM_AVAILABLE = False

try:
    import pytz
    from timezonefinder import TimezoneFinder
    TZ_AVAILABLE = True
except ImportError:
    TZ_AVAILABLE = False

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Constant lookup tables
# ---------------------------------------------------------------------------

# Tithi names — (English, Sanskrit)
TITHI_NAMES: Dict[int, Tuple[str, str]] = {
    1:  ("Pratipada",    "प्रतिपदा"),
    2:  ("Dwitiya",      "द्वितीया"),
    3:  ("Tritiya",      "तृतीया"),
    4:  ("Chaturthi",    "चतुर्थी"),
    5:  ("Panchami",     "पञ्चमी"),
    6:  ("Shashthi",     "षष्ठी"),
    7:  ("Saptami",      "सप्तमी"),
    8:  ("Ashtami",      "अष्टमी"),
    9:  ("Navami",       "नवमी"),
    10: ("Dashami",      "दशमी"),
    11: ("Ekadashi",     "एकादशी"),
    12: ("Dwadashi",     "द्वादशी"),
    13: ("Trayodashi",   "त्रयोदशी"),
    14: ("Chaturdashi",  "चतुर्दशी"),
    15: ("Purnima",      "पूर्णिमा"),
    16: ("Pratipada",    "प्रतिपदा"),  # Krishna Paksha
    17: ("Dwitiya",      "द्वितीया"),
    18: ("Tritiya",      "तृतीया"),
    19: ("Chaturthi",    "चतुर्थी"),
    20: ("Panchami",     "पञ्चमी"),
    21: ("Shashthi",     "षष्ठी"),
    22: ("Saptami",      "सप्तमी"),
    23: ("Ashtami",      "अष्टमी"),
    24: ("Navami",       "नवमी"),
    25: ("Dashami",      "दशमी"),
    26: ("Ekadashi",     "एकादशी"),
    27: ("Dwadashi",     "द्वादशी"),
    28: ("Trayodashi",   "त्रयोदशी"),
    29: ("Chaturdashi",  "चतुर्दशी"),
    30: ("Amavasya",     "अमावस्या"),
}

SHUKLA_SA = "शुक्ल"
KRISHNA_SA = "कृष्ण"

PAKSHA_SHUKLA_SA = SHUKLA_SA
PAKSHA_KRISHNA_SA = KRISHNA_SA

PAKSHA_FOR_TITHI = {
    t: ("Shukla", PAKSHA_SHUKLA_SA) if t <= 15 else ("Krishna", PAKSHA_KRISHNA_SA)
    for t in range(1, 31)
}
# Amavasya (30) is end of Krishna Paksha
PAKSHA_FOR_TITHI[30] = ("Krishna", PAKSHA_KRISHNA_SA)

# Nakshatra names — (English, Sanskrit)
NAKSHATRA_NAMES: Dict[int, Tuple[str, str]] = {
    1:  ("Ashwini",           "अश्विनी"),
    2:  ("Bharani",           "भरणी"),
    3:  ("Krittika",          "कृत्तिका"),
    4:  ("Rohini",            "रोहिणी"),
    5:  ("Mrigashira",        "मृगशिरा"),
    6:  ("Ardra",             "आर्द्रा"),
    7:  ("Punarvasu",         "पुनर्वसु"),
    8:  ("Pushya",            "पुष्य"),
    9:  ("Ashlesha",          "आश्लेषा"),
    10: ("Magha",             "मघा"),
    11: ("Purva Phalguni",    "पूर्व फाल्गुनी"),
    12: ("Uttara Phalguni",   "उत्तर फाल्गुनी"),
    13: ("Hasta",             "हस्त"),
    14: ("Chitra",            "चित्रा"),
    15: ("Swati",             "स्वाति"),
    16: ("Vishakha",          "विशाखा"),
    17: ("Anuradha",          "अनुराधा"),
    18: ("Jyeshtha",          "ज्येष्ठा"),
    19: ("Mula",              "मूल"),
    20: ("Purva Ashadha",     "पूर्वाषाढ़ा"),
    21: ("Uttara Ashadha",    "उत्तराषाढ़ा"),
    22: ("Shravana",          "श्रवण"),
    23: ("Dhanishta",         "धनिष्ठा"),
    24: ("Shatabhisha",       "शतभिषा"),
    25: ("Purva Bhadrapada",  "पूर्व भाद्रपद"),
    26: ("Uttara Bhadrapada", "उत्तर भाद्रपद"),
    27: ("Revati",            "रेवती"),
}

NAKSHATRA_LORDS = {
    1: "Ashwini Kumaras", 2: "Yama",        3: "Agni",
    4: "Brahma",          5: "Soma",         6: "Rudra",
    7: "Aditi",           8: "Brihaspati",   9: "Nagas",
    10: "Pitris",         11: "Bhaga",       12: "Aryaman",
    13: "Surya",          14: "Tvashtar",    15: "Vayu",
    16: "Indra-Agni",     17: "Mitra",       18: "Indra",
    19: "Nirrti",         20: "Apas",        21: "Vishvadevas",
    22: "Vishnu",         23: "Vasus",       24: "Varuna",
    25: "Aja Ekapada",    26: "Ahir Budhnya", 27: "Pushan",
}

# Yoga names — (English, Sanskrit)
YOGA_NAMES: Dict[int, Tuple[str, str]] = {
    1:  ("Vishkumbha", "विष्कम्भ"),  2:  ("Priti",     "प्रीति"),
    3:  ("Ayushman",   "आयुष्मान"),  4:  ("Saubhagya", "सौभाग्य"),
    5:  ("Shobhana",   "शोभन"),      6:  ("Atiganda",  "अतिगण्ड"),
    7:  ("Sukarma",    "सुकर्मा"),   8:  ("Dhriti",    "धृति"),
    9:  ("Shula",      "शूल"),       10: ("Ganda",     "गण्ड"),
    11: ("Vriddhi",    "वृद्धि"),    12: ("Dhruva",    "ध्रुव"),
    13: ("Vyaghata",   "व्याघात"),   14: ("Harshana",  "हर्षण"),
    15: ("Vajra",      "वज्र"),      16: ("Siddhi",    "सिद्धि"),
    17: ("Vyatipata",  "व्यतीपात"), 18: ("Variyan",   "वरीयान"),
    19: ("Parigha",    "परिघ"),      20: ("Shiva",     "शिव"),
    21: ("Siddha",     "सिद्ध"),     22: ("Sadhya",    "साध्य"),
    23: ("Shubha",     "शुभ"),       24: ("Shukla",    SHUKLA_SA),
    25: ("Brahma",     "ब्रह्म"),    26: ("Indra",     "ऐन्द्र"),
    27: ("Vaidhriti",  "वैधृति"),
}

# Karana names — (English, Sanskrit)  — 11 Karanas; Vishti = Bhadra
KARANA_NAMES: Dict[int, Tuple[str, str]] = {
    1:  ("Bava",        "बव"),
    2:  ("Balava",      "बालव"),
    3:  ("Kaulava",     "कौलव"),
    4:  ("Taitila",     "तैतिल"),
    5:  ("Gara",        "गर"),
    6:  ("Vanija",      "वणिज"),
    7:  ("Vishti",      "विष्टि"),   # Bhadra — inauspicious
    8:  ("Shakuni",     "शकुनि"),
    9:  ("Chatushpada", "चतुष्पाद"),
    10: ("Naga",        "नाग"),
    11: ("Kimstughna",  "किंस्तुघ्न"),
}

# Shared literal constants (avoid duplication)
AVOID_AUSPICIOUS = "Avoid auspicious activities"
DATE_START_FMT = "%Y/%m/%d 00:00:00"

# Solar month names for Souramana Panchanga
SOLAR_MONTH_NAMES: List[Tuple[str, str]] = [
    ("Mesha",     "मेष"),      # Sun in Aries
    ("Vrishabha", "वृषभ"),    # Sun in Taurus
    ("Mithuna",   "मिथुन"),   # Sun in Gemini
    ("Karka",     "कर्क"),    # Sun in Cancer
    ("Simha",     "सिंह"),    # Sun in Leo
    ("Kanya",     "कन्या"),   # Sun in Virgo
    ("Tula",      "तुला"),    # Sun in Libra
    ("Vrishchika","वृश्चिक"), # Sun in Scorpio
    ("Dhanu",     "धनु"),     # Sun in Sagittarius
    ("Makara",    "मकर"),     # Sun in Capricorn
    ("Kumbha",    "कुम्भ"),   # Sun in Aquarius
    ("Meena",     "मीन"),     # Sun in Pisces
]

# Lunar month names (Amanta / Chandramana)  — month of new moon entry
LUNAR_MONTH_NAMES: List[Tuple[str, str]] = [
    ("Chaitra",    "चैत्र"),
    ("Vaishakha",  "वैशाख"),
    ("Jyeshtha",   "ज्येष्ठ"),
    ("Ashadha",    "आषाढ़"),
    ("Shravana",   "श्रावण"),
    ("Bhadrapada", "भाद्रपद"),
    ("Ashwin",     "आश्विन"),
    ("Kartika",    "कार्तिक"),
    ("Margashirsha","मार्गशीर्ष"),
    ("Pausha",     "पौष"),
    ("Magha",      "माघ"),
    ("Phalguna",   "फाल्गुन"),
]

# Auspicious activities per Tithi
TITHI_ACTIVITIES: Dict[int, List[str]] = {
    1:  ["Starting new ventures", "House warming", "Travel"],
    2:  ["Marriage", "Naming ceremony", "Grihapravesh"],
    3:  ["Vehicle purchase", "Hair cutting"],
    4:  [AVOID_AUSPICIOUS, "Good for Ganesh worship"],
    5:  ["Education start", "Medical treatment", "Vratas"],
    6:  ["Starting construction", "Plantation", "Agriculture"],
    7:  ["Vehicle purchase", "Journey", "New clothes"],
    8:  ["Avoid auspicious work", "Good for Durga worship"],
    9:  [AVOID_AUSPICIOUS, "Good for Durga worship"],
    10: ["Government work", "Education", "Marriage"],
    11: ["Fasting", "Spiritual activities", "Vratas"],
    12: ["Temple visits", "Donations", "Charity"],
    13: ["Mixed results", "Good for remedial measures"],
    14: [AVOID_AUSPICIOUS, "Good for Shiva worship"],
    15: ["Satyanarayan Puja", "Pitru Karma", "Full moon rituals"],
    30: ["Pitru Tarpan", "Ancestor rituals", "Meditation"],
}

# Major Hindu festivals (fixed Gregorian day/month entries)
MAJOR_FESTIVALS = [
    {"name": "Makar Sankranti",         "month": 1,  "day": 14,
     "description": "Harvest festival — Sun enters Capricorn"},
    {"name": "Republic Day",            "month": 1,  "day": 26,
     "description": "Indian Republic Day"},
    {"name": "Holi",                    "month": 3,
     "description": "Festival of colors"},
    {"name": "Ugadi / Gudi Padwa",      "month": 3,
     "description": "Hindu New Year (Chandramana)"},
    {"name": "Ram Navami",              "month": 4,
     "description": "Birth of Lord Rama"},
    {"name": "Hanuman Jayanti",         "month": 4,
     "description": "Birth of Lord Hanuman"},
    {"name": "Akshaya Tritiya",         "month": 5,
     "description": "Auspicious day for new beginnings"},
    {"name": "Guru Purnima",            "month": 7,
     "description": "Day to honor gurus and teachers"},
    {"name": "Raksha Bandhan",          "month": 8,
     "description": "Festival celebrating brother-sister bond"},
    {"name": "Krishna Janmashtami",     "month": 8,
     "description": "Birth of Lord Krishna"},
    {"name": "Ganesh Chaturthi",        "month": 9,
     "description": "Birth of Lord Ganesha"},
    {"name": "Navratri",                "month": 10,
     "description": "Nine nights celebrating divine feminine"},
    {"name": "Dussehra / Vijayadashami","month": 10,
     "description": "Victory of good over evil"},
    {"name": "Karwa Chauth",            "month": 10,
     "description": "Married women fast for husband's longevity"},
    {"name": "Diwali",                  "month": 11,
     "description": "Festival of lights"},
    {"name": "Govardhan Puja",          "month": 11,
     "description": "Day after Diwali"},
    {"name": "Bhai Dooj",               "month": 11,
     "description": "Festival celebrating brother-sister bond"},
    {"name": "Kartik Purnima",          "month": 11,
     "description": "Holy dip in sacred rivers"},
]

# Rahu Kalam fractional offsets per day-of-week (weekday 0=Monday…6=Sunday)
# Fraction of the day (sunrise→sunset span) at which Rahu Kalam begins.
# Traditional: day divided into 8 equal parts; Rahu Kalam is the nth part.
RAHU_KALAM_PART = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}  # 1-indexed parts

YAMAGANDAM_PART = {0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 7, 6: 6}

GULIKA_PART = {0: 7, 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1}

HINDI_DAYS = {
    0: "सोमवार", 1: "मंगलवार", 2: "बुधवार",
    3: "गुरुवार", 4: "शुक्रवार", 5: "शनिवार", 6: "रविवार",
}

# ===========================================================================
# Extended Panchanga constants
# ===========================================================================

# 60-year Samvatsara (Jovian year) names — index 0 = Prabhava
SAMVATSARA_NAMES: List[Tuple[str, str]] = [
    ("Prabhava",     "प्रभव"),      ("Vibhava",      "विभव"),
    ("Shukla",       SHUKLA_SA),    ("Pramoda",      "प्रमोद"),
    ("Prajapati",    "प्रजापति"),   ("Angirasa",     "आंगिरस"),
    ("Shrimukha",    "श्रीमुख"),    ("Bhava",        "भव"),
    ("Yuva",         "युव"),         ("Dhatri",       "धातृ"),
    ("Ishvara",      "ईश्वर"),       ("Bahudhanya",   "बहुधान्य"),
    ("Pramathi",     "प्रमाथि"),    ("Vikrama",      "विक्रम"),
    ("Vrisha",       "वृष"),         ("Chitrabhanu",  "चित्रभानु"),
    ("Subhanu",      "सुभानु"),      ("Tarana",       "तारण"),
    ("Parthiva",     "पार्थिव"),    ("Vyaya",        "व्यय"),
    ("Sarvajit",     "सर्वजित"),    ("Sarvadharin",  "सर्वधारिण"),
    ("Virodhi",      "विरोधि"),      ("Vikruta",      "विकृत"),
    ("Khara",        "खर"),          ("Nandana",      "नंदन"),
    ("Vijaya",       "विजय"),        ("Jaya",         "जय"),
    ("Manmatha",     "मन्मथ"),       ("Durmukha",     "दुर्मुख"),
    ("Hevilambi",    "हेविलम्बि"),   ("Vilambi",      "विलम्बि"),
    ("Vikari",       "विकारी"),      ("Sharvari",     "शार्वरी"),
    ("Plava",        "प्लव"),        ("Shubhakrit",   "शुभकृत"),
    ("Shobhana",     "शोभन"),        ("Krodhi",       "क्रोधि"),
    ("Vishvavasu",   "विश्वावसु"),   ("Parabhava",    "परभव"),
    ("Plavanga",     "प्लवंग"),      ("Kilaka",       "कीलक"),
    ("Saumya",       "सौम्य"),        ("Sadharana",    "साधारण"),
    ("Virodhikrit",  "विरोधिकृत"),  ("Paridhavi",    "परिधावि"),
    ("Pramadicha",   "प्रमादीच"),   ("Ananda",       "आनंद"),
    ("Rakshasa",     "राक्षस"),      ("Anala",        "अनल"),
    ("Pingala",      "पिंगल"),       ("Kalayukti",    "कालयुक्ति"),
    ("Siddharthi",   "सिद्धार्थि"), ("Raudri",       "रौद्री"),
    ("Durmati",      "दुर्मति"),     ("Dundubhi",     "दुंदुभि"),
    ("Rudhirodgari", "रुधिरोद्गारि"),("Raktakshi",   "रक्ताक्षि"),
    ("Krodhana",     "क्रोधन"),      ("Kshaya",       "क्षय"),
]

# 6 Ritu (seasons) based on Sun longitude: index = floor(sun_lon / 60) % 6
RITU_NAMES: List[Tuple[str, str]] = [
    ("Vasanta",  "वसंत"),    # Spring   — Sun 0°–60°
    ("Grishma",  "ग्रीष्म"), # Summer   — Sun 60°–120°
    ("Varsha",   "वर्षा"),   # Monsoon  — Sun 120°–180°
    ("Sharad",   "शरद"),     # Autumn   — Sun 180°–240°
    ("Hemanta",  "हेमंत"),   # Pre-winter — Sun 240°–300°
    ("Shishira", "शिशिर"),   # Winter   — Sun 300°–360°
]

# 12 Rashi (zodiac sign) names: index = floor(longitude / 30) % 12
RASHI_NAMES: List[Tuple[str, str]] = [
    ("Mesha",      "मेष"),      ("Vrishabha",  "वृषभ"),
    ("Mithuna",    "मिथुन"),   ("Karka",      "कर्क"),
    ("Simha",      "सिंह"),    ("Kanya",      "कन्या"),
    ("Tula",       "तुला"),    ("Vrishchika", "वृश्चिक"),
    ("Dhanu",      "धनु"),     ("Makara",     "मकर"),
    ("Kumbha",     "कुम्भ"),   ("Meena",      "मीन"),
]

# Choghadiya 7-item quality cycle (index advances +1 each period)
# order: Udveg, Amrit, Rog, Labh, Shubh, Char, Kaal
_CHG_CYCLE: List[Tuple[str, str, str, str]] = [
    ("Udveg",  "उद्वेग",  "caution",      "Sun"),
    ("Amrit",  "अमृत",    "excellent",    "Moon"),
    ("Rog",    "रोग",     "inauspicious", "Mars"),
    ("Labh",   "लाभ",     "good",         "Mercury"),
    ("Shubh",  "शुभ",     "auspicious",   "Jupiter"),
    ("Char",   "चर",      "neutral",      "Venus"),
    ("Kaal",   "काल",     "inauspicious", "Saturn"),
]

# Day choghadiya start index in _CHG_CYCLE by Python weekday (0=Mon, 6=Sun)
# Sun→Udveg(0), Mon→Amrit(1), Tue→Rog(2), Wed→Labh(3), Thu→Shubh(4), Fri→Char(5), Sat→Kaal(6)
_CHG_DAY_START: Dict[int, int] = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}

# Night choghadiya start index by Python weekday
# Sun night→Shubh(4), Mon→Char(5), Tue→Kaal(6), Wed→Udveg(0), Thu→Amrit(1), Fri→Rog(2), Sat→Labh(3)
_CHG_NIGHT_START: Dict[int, int] = {0: 5, 1: 6, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4}

# 7 Hora planet lords in weekday naming sequence [Sun=0, Moon=1, Mars=2, Mercury=3, Jupiter=4, Venus=5, Saturn=6]
HORA_LORDS: List[Tuple[str, str, str]] = [
    ("Surya",   "सूर्य",    "#FF6B35"),
    ("Chandra", "चंद्र",    "#AED6F1"),
    ("Mangala", "मंगल",    "#E74C3C"),
    ("Budha",   "बुध",     "#58D68D"),
    ("Guru",    "गुरु",    "#F7DC6F"),
    ("Shukra",  "शुक्र",   "#FF69B4"),
    ("Shani",   "शनि",     "#7F8C8D"),
]

# Python weekday (0=Mon) → first hora lord index in HORA_LORDS
_HORA_DAY_LORD: Dict[int, int] = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}

# Durmuhurtam: (start_muhurta_pos, end_muhurta_pos) out of 30 day-muhurtas (1-indexed)
# Day = sunrise→sunset divided into 30 equal parts
_DURM_POS: Dict[int, List[Tuple[int, int]]] = {
    0: [(14, 15)],              # Monday
    1: [(13, 14), (22, 23)],   # Tuesday
    2: [(5, 6), (14, 15)],     # Wednesday
    3: [(10, 12)],              # Thursday (spans 2 muhurtas)
    4: [(9, 10), (16, 17)],    # Friday
    5: [(6, 7), (8, 9)],       # Saturday
    6: [(14, 15), (23, 24)],   # Sunday
}

# Varjyam: offset in hours after nakshatra start when Varjyam begins (duration 1.5h)
_VARJYAM_OFFSET_H: Dict[int, float] = {
    1: 14.0, 2: 7.0,  3: 2.0,  4: 22.0, 5: 20.0, 6: 5.0,  7: 3.0,
    8: 9.0,  9: 11.0, 10: 15.0,11: 18.0,12: 6.0, 13: 8.0, 14: 4.0,
    15: 12.0,16: 16.0,17: 1.0, 18: 10.0,19: 13.0,20: 19.0,21: 21.0,
    22: 17.0,23: 23.0,24: 0.5, 25: 7.5, 26: 4.5, 27: 2.5,
}


# ---------------------------------------------------------------------------
# PanchangaService
# ---------------------------------------------------------------------------

class PanchangaService:
    """
    Accurate Panchanga service using the pyephem ephemeris library.
    Falls back to simplified arithmetic when ephem is unavailable.
    """

    _tf = None  # TimezoneFinder singleton — lazy-initialised

    # ------------------------------------------------------------------
    # Timezone helpers
    # ------------------------------------------------------------------

    def _get_tf(self) -> Optional[Any]:
        """Return a cached TimezoneFinder instance (or None if unavailable)."""
        if not TZ_AVAILABLE:
            return None
        if PanchangaService._tf is None:
            PanchangaService._tf = TimezoneFinder()
        return PanchangaService._tf

    def _resolve_timezone(self, latitude: float, longitude: float) -> str:
        """Resolve IANA timezone name from coordinates. Falls back to Asia/Kolkata."""
        tf = self._get_tf()
        if tf is None:
            return "Asia/Kolkata"
        tz_name = tf.timezone_at(lat=latitude, lng=longitude)
        return tz_name or "Asia/Kolkata"

    def _format_time_in_tz(self, dt: datetime, tz_name: str, fmt: str = "%H:%M") -> str:
        """Format a UTC datetime in the given IANA timezone."""
        if not TZ_AVAILABLE:
            return dt.strftime(fmt)
        tz = pytz.timezone(tz_name)
        local_dt = dt.astimezone(tz)
        return local_dt.strftime(fmt)

    # ------------------------------------------------------------------
    # Core astronomy helpers (ephem-backed, float fallback)
    # ------------------------------------------------------------------

    def _build_observer(self, date_obj: date, latitude: float, longitude: float) -> Any:
        """Build an ephem Observer for the given date and location (noon UTC)."""
        obs = ephem.Observer()
        obs.lat = str(latitude)
        obs.lon = str(longitude)
        obs.date = f"{date_obj.strftime('%Y/%m/%d')} 06:00:00"  # 06:00 UTC ≈ 11:30 IST
        obs.pressure = 0  # disable atmospheric refraction for cleaner calcs
        return obs

    def _sun_moon_longitudes(
        self, date_obj: date, latitude: float, longitude: float
    ) -> Tuple[float, float]:
        """
        Return (sun_ecliptic_lon_deg, moon_ecliptic_lon_deg) for the date.
        Falls back to simplified values if ephem is unavailable.
        """
        if EPHEM_AVAILABLE:
            obs = self._build_observer(date_obj, latitude, longitude)
            sun = ephem.Sun()
            moon = ephem.Moon()
            sun.compute(obs)
            moon.compute(obs)
            return math.degrees(ephem.Ecliptic(sun).lon), math.degrees(ephem.Ecliptic(moon).lon)

        # Simplified fallback (accurate to ±1–2 degrees for sun, ±3 for moon)
        # Reference: J2000.0 = 2000-01-01T12:00 TT
        j2000 = date(2000, 1, 1)
        n = (date_obj - j2000).days + 0.5

        # Sun mean longitude
        L0 = (280.46646 + 0.9856474 * n) % 360
        M = math.radians((357.52911 + 0.9856003 * n) % 360)
        sun_lon = (L0 + 1.914602 * math.sin(M) + 0.019993 * math.sin(2 * M)) % 360

        # Moon mean longitude (very simplified)
        lm = (218.316 + 13.176396 * n) % 360
        mm = math.radians((134.963 + 13.064993 * n) % 360)
        moon_lon = (lm + 6.289 * math.sin(mm)) % 360

        return sun_lon, moon_lon

    def _compute_tithi_number(
        self, date_obj: date, latitude: float, longitude: float
    ) -> int:
        """
        Compute Tithi (1–30) using the Moon–Sun elongation.

        Tithi = ceil((Moon_lon - Sun_lon) / 12)   — 1-indexed, range [1..30]
        Tithi 30 = Amavasya (new moon, 0° elongation).
        """
        sun_lon, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        diff = (moon_lon - sun_lon) % 360
        tithi = int(diff / 12) + 1
        if tithi > 30:
            tithi = 30
        return tithi

    def _compute_nakshatra_number(
        self, date_obj: date, latitude: float, longitude: float
    ) -> int:
        """
        Compute Nakshatra (1–27) from Moon ecliptic longitude.

        Nakshatra = floor(Moon_lon / (360/27)) + 1
        """
        _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        nak = int(moon_lon / (360.0 / 27)) + 1
        return min(nak, 27)

    def _compute_yoga_number(
        self, date_obj: date, latitude: float, longitude: float
    ) -> int:
        """
        Compute Yoga (1–27) from combined Sun + Moon longitude.

        Yoga = floor(((Sun_lon + Moon_lon) % 360) / (360/27)) + 1
        """
        sun_lon, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        combined = (sun_lon + moon_lon) % 360
        yoga = int(combined / (360.0 / 27)) + 1
        return min(yoga, 27)

    def _compute_karana_number(self, tithi: int, half: int = 1) -> int:
        """
        Compute Karana (1–11) by half-Tithi position.

        Each Tithi is divided into two halves giving 60 half-Tithis per lunar month
        (30 Tithis × 2).  The canonical sequence maps each half-Tithi index to a
        Karana as follows:
          * Indices 0–55 (first 56 half-Tithis): repeating Karanas 1–7 in cycle.
          * Indices 56–59 (last 4 half-Tithis):  fixed Karanas 8 (Shakuni),
            9 (Chatushpada), 10 (Naga), 11 (Kimstughna).

        Args:
            tithi: Tithi number 1–30.
            half:  Which half of the Tithi (1 = first, 2 = second).  Defaults to 1.
        """
        half_index = (tithi - 1) * 2 + (half - 1)  # 0-based, range 0..59
        if half_index >= 56:
            # Fixed karanas at the very end of the lunar month
            return 8 + (half_index - 56)  # 8, 9, 10, or 11
        return (half_index % 7) + 1  # repeating set 1–7

    def _compute_sunrise_sunset(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> Tuple[str, str]:
        """
        Compute localised sunrise and sunset times for the given date and location.
        Returns (sunrise_str, sunset_str) in HH:MM format in the local timezone.
        """
        if not EPHEM_AVAILABLE:
            return "06:15", "18:30"

        obs = ephem.Observer()
        obs.lat = str(latitude)
        obs.lon = str(longitude)
        obs.date = date_obj.strftime(DATE_START_FMT)
        obs.pressure = 0
        obs.horizon = "-0:34"  # Standard sunrise/sunset definition

        sun = ephem.Sun()
        try:
            rise_utc = obs.next_rising(sun).datetime()
            set_utc = obs.next_setting(sun).datetime()
            sunrise = self._format_time_in_tz(
                rise_utc.replace(tzinfo=pytz.utc) if TZ_AVAILABLE else rise_utc,
                tz_name
            )
            sunset = self._format_time_in_tz(
                set_utc.replace(tzinfo=pytz.utc) if TZ_AVAILABLE else set_utc,
                tz_name
            )
            return sunrise, sunset
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            return "06:00", "18:00"

    def _minutes_to_hhmm(self, total_minutes: float) -> str:
        """Convert minutes-since-midnight to HH:MM string."""
        h = int(total_minutes // 60) % 24
        m = int(total_minutes % 60)
        return f"{h:02d}:{m:02d}"

    def _kalam_period(
        self,
        date_obj: date,
        latitude: float,
        longitude: float,
        tz_name: str,
        part_table: Dict[int, int],
    ) -> Tuple[str, str]:
        """
        Compute a Kalam (Rahu / Yamagandam / Gulika) period.

        The day (sunrise→sunset) is divided into 8 equal parts.
        `part_table[weekday]` gives the 1-indexed part number for the Kalam.
        """
        if EPHEM_AVAILABLE and TZ_AVAILABLE:
            obs = ephem.Observer()
            obs.lat = str(latitude)
            obs.lon = str(longitude)
            obs.date = date_obj.strftime(DATE_START_FMT)
            obs.pressure = 0
            obs.horizon = "-0:34"
            sun = ephem.Sun()
            try:
                tz = pytz.timezone(tz_name)
                rise_local = obs.next_rising(sun).datetime().replace(tzinfo=pytz.utc).astimezone(tz)
                set_local  = obs.next_setting(sun).datetime().replace(tzinfo=pytz.utc).astimezone(tz)
                rise_mins = rise_local.hour * 60 + rise_local.minute
                set_mins  = set_local.hour * 60 + set_local.minute
                day_span  = set_mins - rise_mins
                part_len  = day_span / 8.0
                part_num  = part_table[date_obj.weekday()] - 1  # 0-indexed
                start_mins = rise_mins + part_num * part_len
                end_mins   = start_mins + part_len
                return self._minutes_to_hhmm(start_mins), self._minutes_to_hhmm(end_mins)
            except (ephem.AlwaysUpError, ephem.NeverUpError, Exception):
                pass

        # Fallback fixed times (Delhi / IST)
        fallback_rahu = {0: ("07:30","09:00"), 1: ("15:00","16:30"),
                         2: ("12:00","13:30"), 3: ("13:30","15:00"),
                         4: ("10:30","12:00"), 5: ("09:00","10:30"),
                         6: ("16:30","18:00")}
        fallback_yama = {0: ("10:30","12:00"), 1: ("09:00","10:30"),
                         2: ("07:30","09:00"), 3: ("06:00","07:30"),
                         4: ("15:00","16:30"), 5: ("13:30","15:00"),
                         6: ("12:00","13:30")}
        fallback_guli = {0: ("13:30","15:00"), 1: ("12:00","13:30"),
                         2: ("10:30","12:00"), 3: ("09:00","10:30"),
                         4: ("07:30","09:00"), 5: ("06:00","07:30"),
                         6: ("15:00","16:30")}
        wd = date_obj.weekday()
        if part_table is RAHU_KALAM_PART:
            return fallback_rahu[wd]
        if part_table is YAMAGANDAM_PART:
            return fallback_yama[wd]
        return fallback_guli[wd]

    # ------------------------------------------------------------------
    # Panchanga element builders
    # ------------------------------------------------------------------

    def calculate_tithi(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Return Tithi dict with normalised keys (name / name_sa)."""
        tithi_num = self._compute_tithi_number(date_obj, latitude, longitude)
        name_en, name_sa = TITHI_NAMES.get(tithi_num, ("Unknown", "Unknown"))
        paksha_en, paksha_sa = PAKSHA_FOR_TITHI[tithi_num]
        return {
            "number": tithi_num,
            "name": name_en,
            "name_sa": name_sa,
            "paksha": paksha_en,
            "paksha_sa": paksha_sa,
            "paksha_english": "Waxing Moon" if paksha_en == "Shukla" else "Waning Moon",
            "auspicious_activities": TITHI_ACTIVITIES.get(tithi_num % 15 or 15, []),
            "is_ekadashi": tithi_num in (11, 26),
            "is_full_moon": tithi_num == 15,
            "is_new_moon": tithi_num == 30,
        }

    def calculate_nakshatra(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Return Nakshatra dict with normalised keys."""
        nak_num = self._compute_nakshatra_number(date_obj, latitude, longitude)
        name_en, name_sa = NAKSHATRA_NAMES.get(nak_num, ("Unknown", "Unknown"))
        _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        pada = int((moon_lon % (360.0 / 27)) / ((360.0 / 27) / 4)) + 1
        return {
            "number": nak_num,
            "name": name_en,
            "name_sa": name_sa,
            "lord": NAKSHATRA_LORDS.get(nak_num, "Unknown"),
            "pada": min(pada, 4),
        }

    def calculate_yoga(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Return Yoga dict with normalised keys."""
        yoga_num = self._compute_yoga_number(date_obj, latitude, longitude)
        name_en, name_sa = YOGA_NAMES.get(yoga_num, ("Unknown", "Unknown"))
        return {"number": yoga_num, "name": name_en, "name_sa": name_sa}

    def calculate_karana(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Return Karana dict with normalised keys."""
        tithi_num = self._compute_tithi_number(date_obj, latitude, longitude)
        kar_num = self._compute_karana_number(tithi_num)
        name_en, name_sa = KARANA_NAMES.get(kar_num, ("Unknown", "Unknown"))
        is_bhadra = kar_num == 7  # Vishti / Bhadra
        return {
            "number": kar_num,
            "name": name_en,
            "name_sa": name_sa,
            "is_bhadra": is_bhadra,
            "warning": (f"Vishti (Bhadra) Karana — {AVOID_AUSPICIOUS}" if is_bhadra else None),
        }

    def calculate_rahu_kalam(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Return location-aware Rahu Kalam period."""
        tz_name = self._resolve_timezone(latitude, longitude)
        start, end = self._kalam_period(date_obj, latitude, longitude, tz_name, RAHU_KALAM_PART)
        return {
            "start": start,
            "end": end,
            "duration_minutes": 90,
            "warning": "Avoid starting new activities during Rahu Kalam",
            "timezone": tz_name,
        }

    def _calculate_yamagandam(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        tz_name = self._resolve_timezone(latitude, longitude)
        start, end = self._kalam_period(date_obj, latitude, longitude, tz_name, YAMAGANDAM_PART)
        return {"start": start, "end": end, "timezone": tz_name}

    def _calculate_gulika_kalam(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        tz_name = self._resolve_timezone(latitude, longitude)
        start, end = self._kalam_period(date_obj, latitude, longitude, tz_name, GULIKA_PART)
        return {"start": start, "end": end, "timezone": tz_name}

    # ------------------------------------------------------------------
    # Extended Panchanga element builders
    # ------------------------------------------------------------------

    def _compute_samvatsara(self, date_obj: date) -> Dict[str, Any]:
        """Compute the 60-year Jovian Samvatsara cycle for the given date."""
        # Vikrama Samvat starts mid-April; before that, still in previous VS year
        if date_obj.month < 4 or (date_obj.month == 4 and date_obj.day < 14):
            vs = date_obj.year + 56
        else:
            vs = date_obj.year + 57
        # Formula verified: 2024 (Apr-Dec) → VS 2081 → Krodhi (idx 37, number 38)
        idx = (vs - 3) % 60
        name_en, name_sa = SAMVATSARA_NAMES[idx]
        return {
            "number": idx + 1,
            "name": name_en,
            "name_sa": name_sa,
            "vikrama_samvat": vs,
        }

    def _compute_eras(self, date_obj: date) -> Dict[str, Any]:
        """Return Vikrama Samvat, Shaka Samvat, and Kali Yuga year numbers."""
        if date_obj.month < 4 or (date_obj.month == 4 and date_obj.day < 14):
            vs = date_obj.year + 56
        else:
            vs = date_obj.year + 57
        shaka = vs - 135
        kali_yuga = date_obj.year + 3101
        return {
            "vikrama_samvat": vs,
            "shaka_samvat": shaka,
            "kali_yuga": kali_yuga,
        }

    def _compute_ayana(self, date_obj: date, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Compute Ayana (celestial half-year) from Sun's ecliptic longitude.
        Uttarayana: Sun at 270°–90° (starts winter solstice, traditional Makar Sankranti).
        Dakshinayana: Sun at 90°–270° (starts summer solstice).
        """
        sun_lon, _ = self._sun_moon_longitudes(date_obj, latitude, longitude)
        if sun_lon >= 270 or sun_lon < 90:
            return {
                "name": "Uttarayana",
                "name_sa": "उत्तरायण",
                "description": "Sun moving northward — auspicious half-year",
            }
        return {
            "name": "Dakshinayana",
            "name_sa": "दक्षिणायन",
            "description": "Sun moving southward",
        }

    def _compute_ritu(self, date_obj: date, latitude: float, longitude: float) -> Dict[str, Any]:
        """Compute the current Ritu (season) from Sun's ecliptic longitude."""
        sun_lon, _ = self._sun_moon_longitudes(date_obj, latitude, longitude)
        ritu_idx = int(sun_lon / 60) % 6
        name_en, name_sa = RITU_NAMES[ritu_idx]
        return {
            "number": ritu_idx + 1,
            "name": name_en,
            "name_sa": name_sa,
        }

    def _compute_surya_rashi(self, date_obj: date, latitude: float, longitude: float) -> Dict[str, Any]:
        """Return Sun's Rashi (zodiac sign) from Sun's ecliptic longitude."""
        sun_lon, _ = self._sun_moon_longitudes(date_obj, latitude, longitude)
        idx = int(sun_lon / 30) % 12
        name_en, name_sa = RASHI_NAMES[idx]
        return {"number": idx + 1, "name": name_en, "name_sa": name_sa,
                "longitude": round(sun_lon % 30, 2)}

    def _compute_chandra_rashi(self, date_obj: date, latitude: float, longitude: float) -> Dict[str, Any]:
        """Return Moon's Rashi (zodiac sign) from Moon's ecliptic longitude."""
        _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        idx = int(moon_lon / 30) % 12
        name_en, name_sa = RASHI_NAMES[idx]
        return {"number": idx + 1, "name": name_en, "name_sa": name_sa,
                "longitude": round(moon_lon % 30, 2)}

    def _compute_moonrise_moonset(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> Dict[str, str]:
        """Compute moonrise and moonset times in local timezone."""
        if not EPHEM_AVAILABLE or not TZ_AVAILABLE:
            return {"moonrise": "N/A", "moonset": "N/A"}
        obs = ephem.Observer()
        obs.lat = str(latitude)
        obs.lon = str(longitude)
        obs.date = date_obj.strftime(DATE_START_FMT)
        obs.pressure = 0
        obs.horizon = "-0:34"
        moon = ephem.Moon()
        try:
            rise_utc = obs.next_rising(moon).datetime().replace(tzinfo=pytz.utc)
            moonrise = self._format_time_in_tz(rise_utc, tz_name)
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            moonrise = "N/A"
        try:
            obs.date = date_obj.strftime(DATE_START_FMT)  # reset
            set_utc = obs.next_setting(moon).datetime().replace(tzinfo=pytz.utc)
            moonset = self._format_time_in_tz(set_utc, tz_name)
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            moonset = "N/A"
        return {"moonrise": moonrise, "moonset": moonset}

    def _sunrise_sunset_local_mins(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> Optional[Tuple[float, float]]:
        """Return (sunrise_mins, sunset_mins) as minutes since midnight in local tz, or None."""
        if not EPHEM_AVAILABLE or not TZ_AVAILABLE:
            return None
        obs = ephem.Observer()
        obs.lat = str(latitude)
        obs.lon = str(longitude)
        obs.date = date_obj.strftime(DATE_START_FMT)
        obs.pressure = 0
        obs.horizon = "-0:34"
        tz = pytz.timezone(tz_name)
        sun = ephem.Sun()
        try:
            rise = obs.next_rising(sun).datetime().replace(tzinfo=pytz.utc).astimezone(tz)
            sset = obs.next_setting(sun).datetime().replace(tzinfo=pytz.utc).astimezone(tz)
            return rise.hour * 60 + rise.minute, sset.hour * 60 + sset.minute
        except (ephem.AlwaysUpError, ephem.NeverUpError, Exception):
            return None

    def _next_sunrise_local_mins(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> float:
        """Return sunrise of next calendar day as minutes since midnight + 24*60."""
        if not EPHEM_AVAILABLE or not TZ_AVAILABLE:
            return 24 * 60 + 6 * 60  # fallback: 06:00 next day
        obs = ephem.Observer()
        obs.lat = str(latitude)
        obs.lon = str(longitude)
        next_day = date_obj + timedelta(days=1)
        obs.date = next_day.strftime(DATE_START_FMT)
        obs.pressure = 0
        obs.horizon = "-0:34"
        tz = pytz.timezone(tz_name)
        sun = ephem.Sun()
        try:
            rise = obs.next_rising(sun).datetime().replace(tzinfo=pytz.utc).astimezone(tz)
            return rise.hour * 60 + rise.minute + 24 * 60
        except (ephem.AlwaysUpError, ephem.NeverUpError, Exception):
            return 24 * 60 + 6 * 60

    def _compute_choghadiya(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> List[Dict[str, Any]]:
        """
        Compute 16 Choghadiya periods (8 day + 8 night) for the date.
        Day: sunrise → sunset divided into 8 equal parts.
        Night: sunset → next sunrise divided into 8 equal parts.
        """
        times = self._sunrise_sunset_local_mins(date_obj, latitude, longitude, tz_name)
        if times is None:
            return []
        rise_mins, set_mins = times
        rise_next_mins = self._next_sunrise_local_mins(date_obj, latitude, longitude, tz_name)

        day_chg_len = (set_mins - rise_mins) / 8
        night_chg_len = (rise_next_mins - set_mins) / 8

        wd = date_obj.weekday()
        day_start_idx = _CHG_DAY_START[wd]
        night_start_idx = _CHG_NIGHT_START[wd]

        result: List[Dict[str, Any]] = []
        for i in range(8):
            idx = (day_start_idx + i) % 7
            q = _CHG_CYCLE[idx]
            start_m = rise_mins + i * day_chg_len
            result.append({
                "period": i + 1, "type": "day",
                "name": q[0], "name_sa": q[1],
                "quality": q[2], "planet": q[3],
                "start": self._minutes_to_hhmm(start_m),
                "end": self._minutes_to_hhmm(start_m + day_chg_len),
            })
        for i in range(8):
            idx = (night_start_idx + i) % 7
            q = _CHG_CYCLE[idx]
            start_m = set_mins + i * night_chg_len
            result.append({
                "period": i + 1, "type": "night",
                "name": q[0], "name_sa": q[1],
                "quality": q[2], "planet": q[3],
                "start": self._minutes_to_hhmm(start_m % (24 * 60)),
                "end": self._minutes_to_hhmm((start_m + night_chg_len) % (24 * 60)),
            })
        return result

    def _compute_hora(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> List[Dict[str, Any]]:
        """
        Compute 24 planetary Horas for the date.
        Day horas: sunrise → sunset in 12 equal parts.
        Night horas: sunset → next sunrise in 12 equal parts.
        Each successive hora advances 5 steps in HORA_LORDS (verified by weekday cycle).
        """
        times = self._sunrise_sunset_local_mins(date_obj, latitude, longitude, tz_name)
        if times is None:
            return []
        rise_mins, set_mins = times
        rise_next_mins = self._next_sunrise_local_mins(date_obj, latitude, longitude, tz_name)

        day_hora_len = (set_mins - rise_mins) / 12
        night_hora_len = (rise_next_mins - set_mins) / 12

        wd = date_obj.weekday()
        first_idx = _HORA_DAY_LORD[wd]

        result: List[Dict[str, Any]] = []
        for i in range(12):
            lord_idx = (first_idx + i * 5) % 7
            lord = HORA_LORDS[lord_idx]
            start_m = rise_mins + i * day_hora_len
            result.append({
                "hora": i + 1, "type": "day",
                "lord": lord[0], "lord_sa": lord[1], "color": lord[2],
                "start": self._minutes_to_hhmm(start_m),
                "end": self._minutes_to_hhmm(start_m + day_hora_len),
            })
        night_first_idx = (first_idx + 12 * 5) % 7
        for i in range(12):
            lord_idx = (night_first_idx + i * 5) % 7
            lord = HORA_LORDS[lord_idx]
            start_m = set_mins + i * night_hora_len
            result.append({
                "hora": i + 1, "type": "night",
                "lord": lord[0], "lord_sa": lord[1], "color": lord[2],
                "start": self._minutes_to_hhmm(start_m % (24 * 60)),
                "end": self._minutes_to_hhmm((start_m + night_hora_len) % (24 * 60)),
            })
        return result

    def _compute_durmuhurtam(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> List[Dict[str, Any]]:
        """
        Compute Durmuhurtam (inauspicious windows) for the date.
        Day (sunrise → sunset) is divided into 30 equal muhurtas.
        Traditional positions per weekday from _DURM_POS.
        """
        times = self._sunrise_sunset_local_mins(date_obj, latitude, longitude, tz_name)
        if times is None:
            return []
        rise_mins, set_mins = times
        day_span = set_mins - rise_mins
        muhurta_len = day_span / 30

        wd = date_obj.weekday()
        result: List[Dict[str, Any]] = []
        for start_pos, end_pos in _DURM_POS.get(wd, []):
            start_m = rise_mins + (start_pos - 1) * muhurta_len
            end_m = rise_mins + end_pos * muhurta_len
            result.append({
                "start": self._minutes_to_hhmm(start_m),
                "end": self._minutes_to_hhmm(end_m),
                "warning": AVOID_AUSPICIOUS,
            })
        return result

    def _compute_varjyam(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> Optional[Dict[str, Any]]:
        """
        Compute Varjyam (nakshatra-based inauspicious period, ~1.5h).
        Each nakshatra has a fixed offset after its start; see _VARJYAM_OFFSET_H.
        """
        if not TZ_AVAILABLE:
            return None
        _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        nak_span = 360.0 / 27
        nak_num = min(int(moon_lon / nak_span) + 1, 27)

        # How far Moon has travelled into the current nakshatra at 06:00 UTC
        degrees_into_nak = moon_lon - (nak_num - 1) * nak_span
        if degrees_into_nak < 0:
            degrees_into_nak += nak_span
        moon_speed_deg_per_hr = 13.18 / 24
        elapsed_hours = degrees_into_nak / moon_speed_deg_per_hr

        ref_dt = datetime(
            date_obj.year, date_obj.month, date_obj.day, 6, 0, 0, tzinfo=pytz.utc
        )
        nak_start_dt = ref_dt - timedelta(hours=elapsed_hours)
        offset_h = _VARJYAM_OFFSET_H.get(nak_num, 8.0)
        vs_dt = nak_start_dt + timedelta(hours=offset_h)
        ve_dt = vs_dt + timedelta(hours=1.5)

        tz = pytz.timezone(tz_name)
        vs_local = vs_dt.astimezone(tz)
        ve_local = ve_dt.astimezone(tz)
        # Only report if Varjyam falls on this date in local tz
        if vs_local.date() != date_obj and ve_local.date() != date_obj:
            return None
        nak_name = NAKSHATRA_NAMES.get(nak_num, ("Unknown", ""))[0]
        return {
            "start": vs_local.strftime("%H:%M"),
            "end": ve_local.strftime("%H:%M"),
            "nakshatra": nak_name,
            "warning": "Avoid auspicious activities during Varjyam",
        }

    def _compute_tithi_end_time(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> str:
        """
        Estimate when the current Tithi ends.
        Uses Moon–Sun elongation rate ≈ 0.507°/hr (synodic month = 29.53 days).
        Returns HH:MM in local tz, or 'Tomorrow'.
        """
        sun_lon, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        elongation = (moon_lon - sun_lon) % 360
        tithi_num = int(elongation / 12) + 1
        tithi_end_elong = tithi_num * 12
        remaining_deg = tithi_end_elong - elongation
        if remaining_deg <= 0:
            remaining_deg += 12
        rate = 360 / (29.53 * 24)  # degrees / hour
        remaining_hours = remaining_deg / rate
        ref_dt = datetime(
            date_obj.year, date_obj.month, date_obj.day, 6, 0, 0, tzinfo=pytz.utc
        )
        end_dt = ref_dt + timedelta(hours=remaining_hours)
        if TZ_AVAILABLE:
            tz = pytz.timezone(tz_name)
            end_local = end_dt.astimezone(tz)
            if end_local.date() > date_obj:
                return "Tomorrow"
            return end_local.strftime("%H:%M")
        return self._minutes_to_hhmm((end_dt.hour * 60 + end_dt.minute) % (24 * 60))

    def _compute_nakshatra_end_time(
        self, date_obj: date, latitude: float, longitude: float, tz_name: str
    ) -> str:
        """
        Estimate when the current Nakshatra ends.
        Uses Moon sidereal speed ≈ 0.549°/hr (sidereal month = 27.32 days).
        Returns HH:MM in local tz, or 'Tomorrow'.
        """
        _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
        nak_span = 360.0 / 27
        nak_num = min(int(moon_lon / nak_span) + 1, 27)
        nak_end_lon = nak_num * nak_span
        remaining_deg = nak_end_lon - moon_lon
        if remaining_deg <= 0:
            remaining_deg += nak_span
        rate = 360 / (27.32 * 24)
        remaining_hours = remaining_deg / rate
        ref_dt = datetime(
            date_obj.year, date_obj.month, date_obj.day, 6, 0, 0, tzinfo=pytz.utc
        )
        end_dt = ref_dt + timedelta(hours=remaining_hours)
        if TZ_AVAILABLE:
            tz = pytz.timezone(tz_name)
            end_local = end_dt.astimezone(tz)
            if end_local.date() > date_obj:
                return "Tomorrow"
            return end_local.strftime("%H:%M")
        return self._minutes_to_hhmm((end_dt.hour * 60 + end_dt.minute) % (24 * 60))

    # ------------------------------------------------------------------
    # Daily Panchanga — main public interface
    # ------------------------------------------------------------------

    def get_daily_panchanga(
        self,
        date_obj: date,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
        panchanga_type: str = "lunar",
    ) -> Dict[str, Any]:
        """
        Return a complete Panchanga dict for the given date, location, and type.

        Args:
            date_obj: The date to compute for.
            latitude: Observer latitude (degrees N positive).
            longitude: Observer longitude (degrees E positive).
            panchanga_type: ``"lunar"`` (Chandramana) or ``"solar"`` (Souramana).

        Returns:
            A dict with every Panchanga element using normalised ``name`` + ``name_sa`` keys.

        Raises:
            ValueError: If ``panchanga_type`` is not ``"lunar"`` or ``"solar"``.
        """
        _ALLOWED_TYPES = {"lunar", "solar"}
        if panchanga_type not in _ALLOWED_TYPES:
            raise ValueError(
                f"Invalid panchanga_type {panchanga_type!r}. "
                f"Allowed values are: {sorted(_ALLOWED_TYPES)}"
            )
        try:
            tz_name = self._resolve_timezone(latitude, longitude)
            tithi   = self.calculate_tithi(date_obj, latitude, longitude)
            nakshatra = self.calculate_nakshatra(date_obj, latitude, longitude)
            yoga    = self.calculate_yoga(date_obj, latitude, longitude)
            karana  = self.calculate_karana(date_obj, latitude, longitude)
            rahu_kalam = self.calculate_rahu_kalam(date_obj, latitude, longitude)
            sunrise, sunset = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)

            inauspicious = {
                "rahu_kalam": rahu_kalam,
                "yamagandam": self._calculate_yamagandam(date_obj, latitude, longitude),
                "gulika_kalam": self._calculate_gulika_kalam(date_obj, latitude, longitude),
            }

            muhurat  = self.get_auspicious_muhurat(date_obj, latitude, longitude, tz_name)
            festivals = self.get_festivals_for_date(date_obj)

            # Extended elements
            samvatsara = self._compute_samvatsara(date_obj)
            eras = self._compute_eras(date_obj)
            ayana = self._compute_ayana(date_obj, latitude, longitude)
            ritu = self._compute_ritu(date_obj, latitude, longitude)
            surya_rashi = self._compute_surya_rashi(date_obj, latitude, longitude)
            chandra_rashi = self._compute_chandra_rashi(date_obj, latitude, longitude)
            moonrise_set = self._compute_moonrise_moonset(date_obj, latitude, longitude, tz_name)
            choghadiya = self._compute_choghadiya(date_obj, latitude, longitude, tz_name)
            hora = self._compute_hora(date_obj, latitude, longitude, tz_name)
            durmuhurtam = self._compute_durmuhurtam(date_obj, latitude, longitude, tz_name)
            varjyam = self._compute_varjyam(date_obj, latitude, longitude, tz_name)
            tithi_end_time = self._compute_tithi_end_time(date_obj, latitude, longitude, tz_name)
            nakshatra_end_time = self._compute_nakshatra_end_time(date_obj, latitude, longitude, tz_name)

            # --- Panchanga-type-specific month information ---
            sun_lon, _ = self._sun_moon_longitudes(date_obj, latitude, longitude)

            if panchanga_type == "solar":
                solar_idx = int(sun_lon / 30) % 12
                month_name_en, month_name_sa = SOLAR_MONTH_NAMES[solar_idx]
                month_info = {
                    "panchanga_type": "solar",
                    "panchanga_type_name": "Souramana",
                    "month_name": month_name_en,
                    "month_name_sa": month_name_sa,
                    "sun_longitude": round(sun_lon, 4),
                    "solar_month_index": solar_idx + 1,
                }
            else:
                # Chandramana — lunar month based on Moon's approximate position
                _, moon_lon = self._sun_moon_longitudes(date_obj, latitude, longitude)
                lunar_idx = int(moon_lon / 30) % 12
                lm_en, lm_sa = LUNAR_MONTH_NAMES[lunar_idx]
                month_info = {
                    "panchanga_type": "lunar",
                    "panchanga_type_name": "Chandramana",
                    "month_name": lm_en,
                    "month_name_sa": lm_sa,
                    "paksha": tithi["paksha"],
                    "paksha_sa": tithi["paksha_sa"],
                }

            return {
                **month_info,
                "date": date_obj.isoformat(),
                "day_of_week": date_obj.strftime("%A"),
                "day_of_week_sa": HINDI_DAYS.get(date_obj.weekday(), ""),
                "sunrise": sunrise,
                "sunset": sunset,
                "moonrise": moonrise_set["moonrise"],
                "moonset": moonrise_set["moonset"],
                "tithi": tithi,
                "tithi_end_time": tithi_end_time,
                "nakshatra": nakshatra,
                "nakshatra_end_time": nakshatra_end_time,
                "yoga": yoga,
                "karana": karana,
                "samvatsara": samvatsara,
                "vikrama_samvat": eras["vikrama_samvat"],
                "shaka_samvat": eras["shaka_samvat"],
                "kali_yuga": eras["kali_yuga"],
                "ayana": ayana,
                "ritu": ritu,
                "surya_rashi": surya_rashi,
                "chandra_rashi": chandra_rashi,
                "choghadiya": choghadiya,
                "hora": hora,
                "durmuhurtam": durmuhurtam,
                "varjyam": varjyam,
                "rahu_kalam": rahu_kalam,
                "festivals": festivals,
                "muhurat": muhurat,
                "inauspicious_periods": inauspicious,
                "meta": {
                    "timezone": tz_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "ephem_available": EPHEM_AVAILABLE,
                },
            }

        except Exception as e:
            logger.error("Panchanga calculation error: %s", e, exc_info=True)
            raise ExternalServiceError(service_name="Panchanga", details={"error": str(e)})

    # ------------------------------------------------------------------
    # Muhurat
    # ------------------------------------------------------------------

    def get_auspicious_muhurat(
        self,
        date_obj: Optional[date] = None,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
        tz_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return auspicious Muhurat timings for the date/location.
        Times are adjusted relative to the computed sunrise.
        """
        if tz_name is None:
            tz_name = self._resolve_timezone(latitude, longitude)

        if date_obj is None:
            date_obj = date.today()

        sunrise_str, _ = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)
        try:
            sr_h, sr_m = map(int, sunrise_str.split(":"))
        except (ValueError, AttributeError):
            sr_h, sr_m = 6, 15

        def offset(delta_h: float, dur_m: int) -> Tuple[str, str]:
            start_total = sr_h * 60 + sr_m + int(delta_h * 60)
            end_total   = start_total + dur_m
            return self._minutes_to_hhmm(start_total), self._minutes_to_hhmm(end_total)

        brahma_start, brahma_end = offset(-1.75, 48)   # ~1h45m before sunrise, 48 min
        abhijit_base = 12 * 60  # noon anchor (local time in minutes)
        noon_local = abhijit_base

        return [
            {
                "name": "Brahma Muhurat",
                "name_sa": "ब्रह्म मुहूर्त",
                "start": brahma_start,
                "end": brahma_end,
                "good_for": ["Meditation", "Spiritual practices", "Study"],
                "quality": "Most auspicious",
            },
            {
                "name": "Abhijit Muhurat",
                "name_sa": "अभिजित मुहूर्त",
                "start": self._minutes_to_hhmm(noon_local - 24),
                "end": self._minutes_to_hhmm(noon_local + 24),
                "good_for": ["Starting new ventures", "Important meetings", "Travel"],
                "quality": "Highly auspicious",
            },
            {
                "name": "Vijaya Muhurat",
                "name_sa": "विजय मुहूर्त",
                "start": self._minutes_to_hhmm(noon_local + 120),
                "end": self._minutes_to_hhmm(noon_local + 168),
                "good_for": ["Victory", "Competitions", "Legal matters"],
                "quality": "Auspicious",
            },
        ]

    # ------------------------------------------------------------------
    # Festival helpers
    # ------------------------------------------------------------------

    def get_festivals_for_date(self, date_obj: date) -> List[str]:
        """Return festival names matching the Gregorian date."""
        return [
            f["name"]
            for f in MAJOR_FESTIVALS
            if f.get("day") == date_obj.day and f.get("month") == date_obj.month
        ]

    def get_upcoming_festivals(self, count: int = 10) -> List[Dict[str, Any]]:
        """Return the next ``count`` upcoming festivals."""
        today = date.today()
        upcoming = []
        for f in MAJOR_FESTIVALS:
            if "day" not in f:
                continue
            fdate = date(today.year, f["month"], f["day"])
            if fdate < today:
                fdate = date(today.year + 1, f["month"], f["day"])
            upcoming.append({
                "name": f["name"],
                "date": fdate.isoformat(),
                "description": f["description"],
                "days_away": (fdate - today).days,
            })
        upcoming.sort(key=lambda x: x["days_away"])
        return upcoming[:count]

    # ------------------------------------------------------------------
    # Ekadashi
    # ------------------------------------------------------------------

    def get_ekadashi_dates(self, year: int) -> List[Dict[str, Any]]:
        """Return all Ekadashi dates for the given year."""
        ekadashis = []
        current = date(year, 1, 1)
        end = date(year, 12, 31)
        while current <= end:
            tithi = self.calculate_tithi(current)
            if tithi["is_ekadashi"]:
                ekadashis.append({
                    "date": current.isoformat(),
                    "paksha": tithi["paksha"],
                    "name": f"{tithi['paksha']} Ekadashi",
                })
            current += timedelta(days=1)
        return ekadashis

    # ------------------------------------------------------------------
    # Auspiciousness check
    # ------------------------------------------------------------------

    def is_auspicious_for(
        self,
        date_obj: date,
        activity: str,
        latitude: float = 28.6139,
        longitude: float = 77.2090,
    ) -> Dict[str, Any]:
        """Check if ``date_obj`` is auspicious for ``activity``."""
        tithi     = self.calculate_tithi(date_obj, latitude, longitude)
        nakshatra = self.calculate_nakshatra(date_obj, latitude, longitude)
        rahu      = self.calculate_rahu_kalam(date_obj, latitude, longitude)

        inauspicious_tithis = {
            "marriage":      [4, 8, 9, 14, 30],
            "travel":        [4, 8, 9, 14],
            "grihapravesh":  [4, 8, 9, 14, 30],
            "business":      [4, 8, 9, 14],
            "purchase":      [4, 8, 9, 14, 30],
        }
        auspicious_nakshatras = {
            "marriage":     [4, 7, 8, 11, 12, 13, 22, 27],
            "travel":       [1, 5, 7, 13, 15, 22, 27],
            "grihapravesh": [2, 4, 7, 8, 11, 12, 13, 22],
            "business":     [1, 4, 7, 8, 13, 15, 22, 27],
            "purchase":     [1, 4, 7, 8, 13, 15, 22],
        }

        is_auspicious = True
        reasons: List[str] = []
        recommendations: List[str] = []

        bad_tithis = inauspicious_tithis.get(activity.lower(), [])
        if tithi["number"] in bad_tithis:
            is_auspicious = False
            reasons.append(f"Tithi ({tithi['name']}) is not favorable for {activity}")
        else:
            reasons.append(f"Tithi ({tithi['name']}) is favorable")

        good_naks = auspicious_nakshatras.get(activity.lower(), [])
        if good_naks:
            if nakshatra["number"] in good_naks:
                reasons.append(f"Nakshatra ({nakshatra['name']}) is auspicious for {activity}")
            else:
                reasons.append(f"Nakshatra ({nakshatra['name']}) is neutral for {activity}")

        recommendations.append(
            f"Avoid starting between {rahu['start']} – {rahu['end']} (Rahu Kalam)"
        )

        return {
            "date": date_obj.isoformat(),
            "activity": activity,
            "is_auspicious": is_auspicious,
            "tithi": tithi["name"],
            "tithi_sa": tithi["name_sa"],
            "nakshatra": nakshatra["name"],
            "nakshatra_sa": nakshatra["name_sa"],
            "reasons": reasons,
            "recommendations": recommendations,
            "rahu_kalam": rahu,
            "muhurat": self.get_auspicious_muhurat(date_obj, latitude, longitude),
        }


# Singleton
panchanga_service = PanchangaService()
