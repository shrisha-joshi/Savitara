---
mode: agent
description: >
  Comprehensively fix and fully implement the Savitara Panchanga system: all five
  limbs (Tithi, Vara, Nakshatra, Yoga, Karana), all extended elements (Samvatsara,
  Shaka/Vikrama Samvat, Ayana, Ritu, Masa, Paksha, Chandra/Surya Rashi, moonrise/set,
  Choghadiya, Hora, Durmuhurtam, Varjyam, Abhijit Muhurta, Brahma Muhurta), dual
  Panchanga type (Chandramana / Souramana) with frontend toggle, accurate
  location-based ephemeris calculations (ephem library), user profile location
  approval flow, a full interactive Panchanga calendar component for any-day lookup,
  correct bilingual (English + Sanskrit) output, timezone-aware timings throughout
  chat and bookings, and elimination of all N/A fields.
applyTo: "**"
---

# Fix & Enhance the Panchanga System — Complete Implementation

## Context

The Savitara platform has a `PanchangaService` (`backend/app/services/panchanga_service.py`) that
performs simplified, astronomically incorrect, hard-coded calculations using a fixed reference date.
The system has the following concrete problems that must be corrected completely:

1. **No Panchanga type distinction** — India has two major calendar systems:
   - **Chandramana (Lunar)**: followed in Maharashtra, Gujarat, Karnataka, Andhra Pradesh, Telangana,
     Tamil Nadu, Kerala, Goa, and most of North India (Vaishnava tradition). Month starts on the new
     moon (Amanta) or the day after full moon (Purnimanta).
   - **Souramana (Solar)**: followed in Tamil Nadu, Kerala, West Bengal, Odisha, Assam, and northeast
     states. Month starts when the Sun enters a new zodiac sign (solar ingress / Sankranti).
   
   Users must be able to select their preferred type. The system must serve the correct Panchanga per
   their selection.

2. **Location is not applied to Panchanga** — The `PanchangaWidget` components call
   `/panchanga/today` with no `latitude`/`longitude` parameters, so all users receive the
   Delhi-default Panchanga regardless of where they are. Sunrise, sunset, Rahukalam, and other
   time-dependent elements differ by location and must be calculated from the user's coordinates.

3. **Astronomically inaccurate calculations** — Tithi and Nakshatra are computed using a simple
   modulo of days from a fixed reference date. This produces wrong values. Accurate calculations
   require ephemeris-based astronomical computations using the `ephem` library (already installable
   via pip) or integration with the `Drik Panchanga` algorithm.

4. **Incorrect and inconsistent timestamps in chat** — Message timestamps in `ConversationScreen.js`
   use raw `new Date()` without converting to the user's local timezone. This causes chat times to
   show incorrectly for users in different time zones. The user's `timezone` field exists in the
   `UserLocation` model (`backend/app/models/database.py`, line 460) but is never used to format
   displayed times.

5. **Inconsistent language in responses** — Some fields return Sanskrit names only (`name_sanskrit`),
   others return only English (`name_english`), and some return a bare `name` key. No field is
   consistent. All Panchanga response objects must have both `name` (display-ready, in the user's
   preferred language) and `name_en` / `name_sa` keys.

6. **No user location approval flow** — Users can enter a city in their profile but coordinates
   are never saved. There is no flow to request, confirm, and store GPS-derived or city-matched
   coordinates in the user document, nor to set their `panchanga_type` preference.

---

## Required Fixes — Implement Each Completely

### 1. User Profile: Add `panchanga_type` and Approved Location Fields

**File: `backend/app/models/database.py`**

- In the `Location` model add field: `timezone: Optional[str] = None`
- In the `UserProfile` / `AcharyaProfile` documents add:
  - `panchanga_type: Optional[str] = "lunar"` — values `"lunar"` or `"solar"`.
  - `location_approved: Optional[bool] = False` — true only after the user explicitly confirms
    their coordinates.

**File: `backend/app/api/v1/users.py`** (profile update endpoint)

- Accept `panchanga_type` (`"lunar"` or `"solar"`) and `location` (`{latitude, longitude, city,
  timezone}`) in the PATCH body.
- When `location_approved=true` is sent, store the `latitude`, `longitude`, and resolved `timezone`
  (use Python's `timezonefinder` library: `pip install timezonefinder`).
- Validate `panchanga_type` is one of `["lunar", "solar"]`.

---

### 2. Backend: Accurate Panchanga Calculations

**File: `backend/app/services/panchanga_service.py`**

Replace the stub arithmetic with library-backed calculations. Install `ephem` (`pip install ephem`)
for ephemeris data. The approach must be:

#### Tithi (Lunar day)
Tithi = the integer part of `(Moon's ecliptic longitude − Sun's ecliptic longitude) / 12`.
Values 1–15 are Shukla Paksha; 16–30 are Krishna Paksha (subtract 15 for the Tithi number).

```python
import ephem
import math

def _compute_tithi(self, date_obj: date, latitude: float, longitude: float) -> int:
    obs = ephem.Observer()
    obs.lat = str(latitude)
    obs.lon = str(longitude)
    obs.date = date_obj.strftime('%Y/%m/%d 00:00:00')
    sun = ephem.Sun(obs)
    moon = ephem.Moon(obs)
    sun.compute(obs)
    moon.compute(obs)
    sun_lon = math.degrees(ephem.Ecliptic(sun).lon)
    moon_lon = math.degrees(ephem.Ecliptic(moon).lon)
    diff = (moon_lon - sun_lon) % 360
    tithi = int(diff / 12) + 1
    return tithi  # 1–30; 30 = Amavasya (new moon)
```

#### Nakshatra
Nakshatra = the integer index of `Moon's ecliptic longitude / (360/27)`.

```python
def _compute_nakshatra(self, date_obj: date, latitude: float, longitude: float) -> int:
    obs = ephem.Observer()
    obs.lat = str(latitude)
    obs.lon = str(longitude)
    obs.date = date_obj.strftime('%Y/%m/%d 00:00:00')
    moon = ephem.Moon(obs)
    moon.compute(obs)
    moon_lon = math.degrees(ephem.Ecliptic(moon).lon)
    nakshatra = int(moon_lon / (360 / 27)) + 1
    return nakshatra  # 1–27
```

#### Yoga
Yoga = `((Sun_lon + Moon_lon) % 360) / (360/27)` → integer + 1.

#### Sunrise / Sunset (location-aware)
```python
def _compute_sunrise_sunset(self, date_obj: date, latitude: float, longitude: float):
    obs = ephem.Observer()
    obs.lat = str(latitude)
    obs.lon = str(longitude)
    obs.date = date_obj.strftime('%Y/%m/%d 00:00:00')
    sun = ephem.Sun()
    sunrise = ephem.localtime(obs.next_rising(sun)).strftime('%H:%M')
    sunset  = ephem.localtime(obs.next_setting(sun)).strftime('%H:%M')
    return sunrise, sunset
```

#### Panchanga Type Logic
The `get_daily_panchanga` method must accept a `panchanga_type: str = "lunar"` parameter:
- For `"lunar"` (Chandramana): Tithi and Paksha are the primary month elements. Return the normal
  Vikram Samvat / Amanta month derived from the moon's position.
- For `"solar"` (Souramana): The primary month name is the solar month (Mesha, Vrishabha … Meena)
  based on the Sun's zodiac sign:
  ```python
  solar_month_names = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
                       "Tula","Vrishchika","Dhanu","Makara","Kumbha","Meena"]
  solar_month = solar_month_names[int(sun_lon / 30)]
  ```
  Include both the solar month and the Tithi so that universal elements remain.

All **response dicts must normalise keys**:
- Replace `name_sanskrit` / `name_english` fields with `name` (English default) + `name_sa`
  (Sanskrit/regional script).
- Every Panchanga element (Tithi, Nakshatra, Yoga, Karana, Paksha) uses this pair.
- Add `panchanga_type` to the root of every `get_daily_panchanga` response so the frontend can
  display which system was used.

---

### 3. Backend: Timezone-Aware Time Formatting

**File: `backend/app/services/panchanga_service.py`**

- Install `timezonefinder` (`pip install timezonefinder`) and `pytz` (already pinned in
  `requirements.txt`).
- Add helper:
  ```python
  from timezonefinder import TimezoneFinder
  import pytz

  def _resolve_timezone(self, latitude: float, longitude: float) -> str:
      tf = TimezoneFinder()
      tz_name = tf.timezone_at(lat=latitude, lng=longitude)
      return tz_name or "Asia/Kolkata"
  ```
- All computed times (sunrise, sunset, Rahukalam start/end, Yamagandam, Gulika) must be returned
  in the timezone resolved from the supplied `latitude`/`longitude`, not hardcoded IST.
- Store the resolved timezone string in the response under `meta.timezone`.

**File: `backend/app/api/v1/panchanga.py`**

- All endpoints that currently default `latitude=28.6139` and `longitude=77.2090` must also
  accept an optional `panchanga_type: Annotated[str, Query(...)] = "lunar"` query parameter and
  forward it to `panchanga_service`.
- When `current_user` is authenticated, fetch the user's stored `location.latitude`,
  `location.longitude`, and `panchanga_type` from the database and use them **as the default
  fallback values** (only falling back to Delhi if the user has no saved location):
  ```python
  user_lat  = current_user.get("location", {}).get("latitude",  28.6139)
  user_lon  = current_user.get("location", {}).get("longitude", 77.2090)
  user_type = current_user.get("panchanga_type", "lunar")
  eff_lat   = latitude  if latitude  != 28.6139 else user_lat
  eff_lon   = longitude if longitude != 77.2090 else user_lon
  eff_type  = panchanga_type if panchanga_type != "lunar" else user_type
  ```

---

### 4. Frontend: Pass Location & Panchanga Type From User Profile

**Files:**  
- `savitara-app/src/components/PanchangaWidget.js`  
- `savitara-web/src/components/PanchangaWidget.jsx`

Both widgets call `/panchanga/today` with no query parameters. Fix them to:

1. Read the authenticated user's `location` and `panchanga_type` from the `AuthContext` (already
   available via `useAuth()` / `useContext(AuthContext)`).
2. Build the query string from those values:
   ```js
   const { user } = useAuth();
   const lat = user?.location?.latitude;
   const lon = user?.location?.longitude;
   const type = user?.panchanga_type || 'lunar';

   const params = new URLSearchParams({ panchanga_type: type });
   if (lat != null) params.set('latitude',  lat);
   if (lon != null) params.set('longitude', lon);

   const response = await api.get(`/panchanga/today?${params}`);
   ```
3. Display `data.panchanga_type` as a small label ("Chandramana" or "Souramana") so the user knows
   which system is active.
4. Normalise field access: use `tithi?.name` (after the backend normalisation), not
   `tithi?.name_sanskrit`.

---

### 5. Frontend: Location Approval Flow in Profile Screen

**Files:**  
- `savitara-app/src/screens/profile/ProfileEditScreen.js` (or equivalent)  
- `savitara-web/src/pages/Profile.jsx` (or equivalent)

Add a **"Update My Location"** section in the profile edit form:

1. A button **"Use Current Location"** that calls `navigator.geolocation.getCurrentPosition()` (web)
   or `expo-location`'s `Location.requestForegroundPermissionsAsync()` + `Location.getCurrentPositionAsync()`
   (mobile).
2. Display the resolved city name (reverse-geocode via a single `GET` to the public OpenStreetMap
   Nominatim API endpoint — no API key required):
   `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
3. Show a **"Confirm Location: [city name]"** confirmation button. Only on confirmation call the
   profile PATCH endpoint with `{ location: { latitude, longitude }, location_approved: true }`.
4. Add a **"Panchanga Type"** toggle/select with options `"Lunar (Chandramana)"` and
   `"Solar (Souramana)"` that PATCHes `{ panchanga_type: "lunar"|"solar" }`.
5. Persist changes and refresh the `AuthContext` user object so PanchangaWidget picks up the new
   values immediately.

**Do not** request location silently or without user interaction. Only call the geolocation API
when the button is clicked.

---

### 6. Chat & Booking: Timezone-Correct Timestamp Display

**File: `savitara-app/src/screens/chat/ConversationScreen.js`**

At line ~385, `new Date(msg.created_at || msg.timestamp || Date.now())` is used to construct
`createdAt`. The `GiftedChat` library respects the UTC ISO string, so this step is correct.
However the *display format* used downstream must reflect the user's timezone.

Add a utility function in `savitara-app/src/utils/dateTime.js` (create if absent):

```js
import { format, parseISO, toZonedTime } from 'date-fns-tz'; // install: npm i date-fns date-fns-tz

/**
 * Format a UTC ISO timestamp for display in the user's local timezone.
 * Falls back to device locale if no timezone is provided.
 */
export function formatLocalTime(isoString, userTimezone, fmt = 'hh:mm a') {
  if (!isoString) return '';
  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoned = toZonedTime(parseISO(isoString), tz);
  return format(zoned, fmt, { timeZone: tz });
}
```

Replace every raw `new Date(x).toLocaleTimeString(...)` and
`new Date(x).toLocaleDateString(...)` in the following files with calls to `formatLocalTime`:
- `savitara-app/src/screens/chat/ConversationScreen.js`
- `savitara-app/src/screens/chat/ChatListScreen.js`
- `savitara-app/src/screens/acharya/BookingRequestsScreen.js`
- `savitara-web/src/components/Chat.jsx` (wherever timestamps are rendered)

Pass `user?.location?.timezone ?? null` as the `userTimezone` argument. If the user has no stored
timezone, `Intl.DateTimeFormat().resolvedOptions().timeZone` gives the correct device/browser
local timezone as a safe fallback.

---

### 7. Requirements & Dependencies

Add to `backend/requirements.txt` (if not already present):
```
ephem>=4.1.5
timezonefinder>=6.2.0
```

Add to `savitara-app/package.json` devDependencies / dependencies:
```
date-fns>=3.6.0
date-fns-tz>=3.1.3
```

Add to `savitara-web/package.json` devDependencies / dependencies:
```
date-fns>=3.6.0
date-fns-tz>=3.1.3
```

---

### 8. Backend: All Extended Panchanga Elements (currently showing N/A)

**File: `backend/app/services/panchanga_service.py`**

The following elements are completely missing from the service but are essential parts of a
traditional Panchanga. Implement every one as a method and include all in `get_daily_panchanga`.

#### 8a. Samvatsara — 60-Year Cycle Name

The Hindu calendar uses a 60-year repeating cycle. Each year has a unique name used in ritual
invocations (Sankalpa). The current year (2025–26) is **Sharvari** (cycle index 36 of the 60).

```python
SAMVATSARA_NAMES = [
    "Prabhava","Vibhava","Shukla","Pramoda","Prajapati","Angirasa","Shrimukha",
    "Bhava","Yuva","Dhatu","Ishvara","Bahudhanya","Pramathi","Vikrama","Vrisha",
    "Chitrabhanu","Svabhanu","Tarana","Parthiva","Vyaya","Sarvajitu","Sarvadhari",
    "Virodhi","Vikriti","Khara","Nandana","Vijaya","Jaya","Manmatha","Durmukhi",
    "Hevilambi","Vilambi","Vikari","Sharvari","Plava","Shubhakrit","Shobhana",
    "Krodhi","Vishvavasu","Parabhava","Plavanga","Kilaka","Saumya","Sadharana",
    "Virodhakrit","Paridhari","Pramadika","Ananda","Rakshasa","Nala","Pingala",
    "Kalayukta","Siddharthi","Raudra","Durmati","Dundubhi","Rudhirodgari",
    "Raktakshi","Krodhana","Akshaya",
]

def _compute_samvatsara(self, date_obj: date) -> dict:
    """
    Compute the Samvatsara (60-year cycle name) for the given date.
    Formula: Jovian year index derived from Jupiter's ~11.86-year orbital period.
    Simplified: Kali Yuga year = Gregorian year + 3101 (approx), then (KY - 1) % 60.
    """
    # For precise Jovian cycle: use sun_lon to estimate Jupiter's passage through zodiac
    # Simplified mapping good to ±1 year:
    ky = date_obj.year + 3101
    idx = (ky - 1) % 60
    name = SAMVATSARA_NAMES[idx]
    return {"index": idx + 1, "name": name}
```

#### 8b. Shaka Samvat and Vikrama Samvat Years

Both eras are used in ritual invocations and displayed on traditional Panchangas.

```python
def _compute_eras(self, date_obj: date) -> dict:
    """
    Shaka Samvat: subtract 78 from Gregorian year; new year starts at Chaitra Shukla 1
    (around March 22). Before that date in a given year, Shaka = year - 79.
    Vikrama Samvat: add 57 to Gregorian year; new year around Chaitra Shukla 1 (March/April).
    """
    from datetime import date as _date
    # Approximate new year (Ugadi/Gudi Padwa ≈ March 22–April 12)
    new_year_approx = _date(date_obj.year, 3, 22)
    if date_obj >= new_year_approx:
        shaka = date_obj.year - 78
        vikrama = date_obj.year + 57
    else:
        shaka = date_obj.year - 79
        vikrama = date_obj.year + 56
    kali = date_obj.year + 3101  # approximate Kali Yuga year
    return {
        "shaka_samvat": shaka,
        "vikrama_samvat": vikrama,
        "kali_yuga": kali,
    }
```

#### 8c. Ayana — Sun's Directional Phase

```python
# Uttarayana: Sun moves northward — Makara Sankranti (≈Jan 14) to Karka Sankranti (≈Jul 14)
# Dakshinayana: Sun moves southward — Karka Sankranti to Makara Sankranti
# Based on ecliptic longitude of the Sun:

AYANA_MAP = [
    # (lon_start, lon_end_excl, name_en, name_sa, description)
    (270, 360, "Uttarayana", "उत्तरायण", "Sun's northward journey — auspicious period"),
    (0,   90,  "Uttarayana", "उत्तरायण", "Sun's northward journey — auspicious period"),
    (90,  270, "Dakshinayana","दक्षिणायण","Sun's southward journey"),
]

def _compute_ayana(self, sun_lon: float) -> dict:
    if sun_lon >= 270 or sun_lon < 90:
        return {"name": "Uttarayana", "name_sa": "उत्तरायण",
                "description": "Sun's northward journey (auspicious period)"}
    return {"name": "Dakshinayana", "name_sa": "दक्षिणायण",
            "description": "Sun's southward journey"}
```

#### 8d. Ritu — Season (6 seasons)

```python
RITU_NAMES = [
    ("Vasanta",  "वसन्त",  "Spring",      "Mesha–Vrishabha"),
    ("Grishma",  "ग्रीष्म", "Summer",     "Mithuna–Karka"),
    ("Varsha",   "वर्षा",  "Monsoon",     "Simha–Kanya"),
    ("Sharad",   "शरद",   "Autumn",      "Tula–Vrishchika"),
    ("Hemanta",  "हेमन्त", "Pre-Winter",  "Dhanu–Makara"),
    ("Shishira", "शिशिर", "Winter",      "Kumbha–Meena"),
]

def _compute_ritu(self, sun_lon: float) -> dict:
    solar_month = int(sun_lon / 30) % 12   # 0–11
    ritu_idx = solar_month // 2             # 0–5
    name, name_sa, season, months = RITU_NAMES[ritu_idx]
    return {"name": name, "name_sa": name_sa, "season_en": season,
            "solar_months": months, "index": ritu_idx + 1}
```

#### 8e. Chandra Rashi and Surya Rashi (Zodiac Signs)

```python
RASHI_NAMES = [
    ("Mesha",     "मेष",    "Aries"),
    ("Vrishabha", "वृषभ",  "Taurus"),
    ("Mithuna",   "मिथुन", "Gemini"),
    ("Karka",     "कर्क",  "Cancer"),
    ("Simha",     "सिंह",  "Leo"),
    ("Kanya",     "कन्या", "Virgo"),
    ("Tula",      "तुला",  "Libra"),
    ("Vrishchika","वृश्चिक","Scorpio"),
    ("Dhanu",     "धनु",   "Sagittarius"),
    ("Makara",    "मकर",   "Capricorn"),
    ("Kumbha",    "कुम्भ", "Aquarius"),
    ("Meena",     "मीन",   "Pisces"),
]

def _compute_rashi(self, ecliptic_lon: float) -> dict:
    idx = int(ecliptic_lon / 30) % 12
    name, name_sa, name_en = RASHI_NAMES[idx]
    return {"name": name, "name_sa": name_sa, "name_en": name_en, "index": idx + 1}
```

#### 8f. Moonrise and Moonset Times

```python
def _compute_moonrise_moonset(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> tuple[str, str]:
    """Return (moonrise_str, moonset_str) in HH:MM local time."""
    if not EPHEM_AVAILABLE:
        return ("20:00", "08:00")
    obs = ephem.Observer()
    obs.lat = str(latitude)
    obs.lon = str(longitude)
    obs.date = date_obj.strftime("%Y/%m/%d 00:00:00")
    obs.pressure = 0
    obs.horizon = "-0:34"
    moon = ephem.Moon()
    try:
        rise_utc = obs.next_rising(moon).datetime()
        set_utc  = obs.next_setting(moon).datetime()
        moonrise = self._format_time_in_tz(
            rise_utc.replace(tzinfo=pytz.utc) if TZ_AVAILABLE else rise_utc, tz_name)
        moonset  = self._format_time_in_tz(
            set_utc.replace(tzinfo=pytz.utc) if TZ_AVAILABLE else set_utc, tz_name)
        return moonrise, moonset
    except Exception:
        return ("N/A", "N/A")
```

#### 8g. Choghadiya — 16 Auspicious/Inauspicious Periods (8 Day + 8 Night)

Choghadiya divides the day (sunrise→sunset) and night (sunset→next sunrise) into 8 equal parts
each. Each part is ruled by one of 7 quality types in a fixed weekday sequence.

```python
# Choghadiya quality types: Amrit (best), Labh, Shubh, Char are auspicious;
# Udvega, Kaal, Rog are inauspicious.
CHOGHADIYA_QUALITIES = {
    "Amrit":  {"name_sa": "अमृत",  "quality": "auspicious", "good_for": ["All works", "Travel", "Business"]},
    "Kaal":   {"name_sa": "काल",   "quality": "inauspicious","avoid":    ["New ventures", "Travel"]},
    "Shubh":  {"name_sa": "शुभ",   "quality": "auspicious", "good_for": ["Social activities", "Marriage talks"]},
    "Rog":    {"name_sa": "रोग",   "quality": "inauspicious","avoid":    ["Health matters", "Surgery"]},
    "Udvega": {"name_sa": "उद्वेग","quality": "inauspicious","avoid":    ["Government work", "Travel"]},
    "Char":   {"name_sa": "चर",    "quality": "auspicious", "good_for": ["Travel", "Vehicle purchase"]},
    "Labh":   {"name_sa": "लाभ",   "quality": "auspicious", "good_for": ["Business", "Finance", "Education"]},
}

# Day Choghadiya sequence starting from weekday (0=Mon…6=Sun), index into qualities list:
# The first period of each weekday's DAY choghadiya:
DAY_CHOGHADIYA_START = {
    6: ["Udvega","Char","Labh","Amrit","Kaal","Shubh","Rog","Udvega"],   # Sunday
    0: ["Amrit", "Kaal","Shubh","Rog","Udvega","Char","Labh","Amrit"],   # Monday
    1: ["Rog",   "Udvega","Char","Labh","Amrit","Kaal","Shubh","Rog"],   # Tuesday
    2: ["Labh",  "Amrit","Kaal","Shubh","Rog","Udvega","Char","Labh"],   # Wednesday
    3: ["Shubh", "Rog","Udvega","Char","Labh","Amrit","Kaal","Shubh"],   # Thursday
    4: ["Char",  "Labh","Amrit","Kaal","Shubh","Rog","Udvega","Char"],   # Friday
    5: ["Kaal",  "Shubh","Rog","Udvega","Char","Labh","Amrit","Kaal"],   # Saturday
}
NIGHT_CHOGHADIYA_START = {
    6: ["Shubh","Amrit","Char","Rog","Kaal","Labh","Udvega","Shubh"],
    0: ["Char", "Rog","Kaal","Labh","Udvega","Shubh","Amrit","Char"],
    1: ["Kaal", "Labh","Udvega","Shubh","Amrit","Char","Rog","Kaal"],
    2: ["Udvega","Shubh","Amrit","Char","Rog","Kaal","Labh","Udvega"],
    3: ["Amrit","Char","Rog","Kaal","Labh","Udvega","Shubh","Amrit"],
    4: ["Rog",  "Kaal","Labh","Udvega","Shubh","Amrit","Char","Rog"],
    5: ["Labh", "Udvega","Shubh","Amrit","Char","Rog","Kaal","Labh"],
}

def _compute_choghadiya(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> list[dict]:
    """
    Return 16 Choghadiya periods (8 day + 8 night) with start/end times and quality.
    """
    sunrise_str, sunset_str = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)
    sr_h, sr_m = map(int, sunrise_str.split(":"))
    ss_h, ss_m = map(int, sunset_str.split(":"))
    sunrise_mins = sr_h * 60 + sr_m
    sunset_mins  = ss_h * 60 + ss_m
    # Next sunrise ≈ today sunrise + 24h
    next_sunrise_mins = sunrise_mins + 24 * 60

    day_duration   = (sunset_mins - sunrise_mins) / 8
    night_duration = (next_sunrise_mins - sunset_mins) / 8

    wd = date_obj.weekday()   # 0=Mon…6=Sun; python weekday() maps correctly to our dict
    day_seqs  = DAY_CHOGHADIYA_START[wd]
    night_seqs = NIGHT_CHOGHADIYA_START[wd]

    periods = []
    for i, quality_name in enumerate(day_seqs):
        start = sunrise_mins + i * day_duration
        end   = start + day_duration
        q = CHOGHADIYA_QUALITIES[quality_name]
        periods.append({
            "period": i + 1,
            "type": "day",
            "name": quality_name,
            "name_sa": q["name_sa"],
            "start": self._minutes_to_hhmm(start),
            "end":   self._minutes_to_hhmm(end),
            "quality": q["quality"],
            "good_for": q.get("good_for"),
            "avoid": q.get("avoid"),
        })
    for i, quality_name in enumerate(night_seqs):
        start = sunset_mins + i * night_duration
        end   = start + night_duration
        q = CHOGHADIYA_QUALITIES[quality_name]
        periods.append({
            "period": i + 1,
            "type": "night",
            "name": quality_name,
            "name_sa": q["name_sa"],
            "start": self._minutes_to_hhmm(start % (24 * 60)),
            "end":   self._minutes_to_hhmm(end   % (24 * 60)),
            "quality": q["quality"],
            "good_for": q.get("good_for"),
            "avoid": q.get("avoid"),
        })
    return periods
```

#### 8h. Hora — Planetary Hours

Each of the 24 hours is ruled by a planet in a traditional sequence. Hora starts at sunrise.

```python
# Day sequence starting hour from weekday:
HORA_LORDS_DAY = {
    # Key = weekday (0=Mon…6=Sun); list = 24 sequential planetary hours from sunrise
    # The ruling planet of the first Hora matches the day's lord:
    6: ["Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars",
        "Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars",
        "Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars",
        "Sun","Venus","Mercury"],   # Sunday starts with Sun
    0: ["Moon","Saturn","Jupiter","Mars","Sun","Venus","Mercury",
        "Moon","Saturn","Jupiter","Mars","Sun","Venus","Mercury",
        "Moon","Saturn","Jupiter","Mars","Sun","Venus","Mercury",
        "Moon","Saturn","Jupiter"],  # Monday starts with Moon
    1: ["Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter",
        "Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter",
        "Mars","Sun","Venus","Mercury","Moon","Saturn","Jupiter",
        "Mars","Sun","Venus"],       # Tuesday starts with Mars
    2: ["Mercury","Moon","Saturn","Jupiter","Mars","Sun","Venus",
        "Mercury","Moon","Saturn","Jupiter","Mars","Sun","Venus",
        "Mercury","Moon","Saturn","Jupiter","Mars","Sun","Venus",
        "Mercury","Moon","Saturn"],  # Wednesday starts with Mercury
    3: ["Jupiter","Mars","Sun","Venus","Mercury","Moon","Saturn",
        "Jupiter","Mars","Sun","Venus","Mercury","Moon","Saturn",
        "Jupiter","Mars","Sun","Venus","Mercury","Moon","Saturn",
        "Jupiter","Mars","Sun"],     # Thursday starts with Jupiter
    4: ["Venus","Mercury","Moon","Saturn","Jupiter","Mars","Sun",
        "Venus","Mercury","Moon","Saturn","Jupiter","Mars","Sun",
        "Venus","Mercury","Moon","Saturn","Jupiter","Mars","Sun",
        "Venus","Mercury","Moon"],   # Friday starts with Venus
    5: ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon",
        "Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon",
        "Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon",
        "Saturn","Jupiter","Mars"],  # Saturday starts with Saturn
}

def _compute_hora(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> list[dict]:
    """
    Return 24 Hora periods starting from sunrise, each 60 minutes.
    Each Hora is ruled by a planet and has traditional significance.
    """
    sunrise_str, _ = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)
    sr_h, sr_m = map(int, sunrise_str.split(":"))
    sunrise_mins = sr_h * 60 + sr_m
    wd = date_obj.weekday()
    lords = HORA_LORDS_DAY[wd]
    hours = []
    for i, lord in enumerate(lords):
        start = (sunrise_mins + i * 60) % (24 * 60)
        end   = (start + 60) % (24 * 60)
        hours.append({
            "hora": i + 1, "lord": lord,
            "start": self._minutes_to_hhmm(start),
            "end":   self._minutes_to_hhmm(end),
        })
    return hours
```

#### 8i. Durmuhurtam and Varjyam

**Durmuhurtam** — Two inauspicious 30-minute windows per day (traditional fixed offsets from
sunrise by weekday):

```python
DURMUHURTAM_OFFSETS_MIN = {
    # (start_minutes_after_sunrise, end_minutes_after_sunrise) — two slots per day
    6: [(210, 240), (690, 720)],    # Sunday
    0: [(450, 480), (690, 720)],    # Monday
    1: [(60,  90),  (690, 720)],    # Tuesday
    2: [(210, 240), (450, 480)],    # Wednesday
    3: [(120, 150), (690, 720)],    # Thursday
    4: [(330, 360), (600, 630)],    # Friday
    5: [(120, 150), (600, 630)],    # Saturday
}

def _compute_durmuhurtam(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> list[dict]:
    sunrise_str, _ = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)
    sr_h, sr_m = map(int, sunrise_str.split(":"))
    sr_mins = sr_h * 60 + sr_m
    wd = date_obj.weekday()
    slots = DURMUHURTAM_OFFSETS_MIN[wd]
    result = []
    for i, (off_start, off_end) in enumerate(slots):
        result.append({
            "slot": i + 1,
            "start": self._minutes_to_hhmm(sr_mins + off_start),
            "end":   self._minutes_to_hhmm(sr_mins + off_end),
            "warning": "Avoid important activities during Durmuhurtam",
        })
    return result
```

**Varjyam** — An inauspicious 1 hour 36 minute period determined by the Nakshatra:

```python
# Varjyam start offset in minutes from sunrise for each Nakshatra (1–27)
# Traditional values: each Nakshatra has a fixed time of day for Varjyam
VARJYAM_NAKSHATRA_OFFSETS = {
    1: 660,  2: 540,  3: 480,  4: 420,  5: 360,  6: 300,  7: 600,  8: 540,  9: 480,
    10: 420, 11: 360, 12: 300, 13: 660, 14: 600, 15: 540, 16: 480, 17: 420, 18: 360,
    19: 300, 20: 660, 21: 600, 22: 540, 23: 120, 24: 360, 25: 300, 26: 660, 27: 600,
}

def _compute_varjyam(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> dict:
    nakshatra_num = self._compute_nakshatra_number(date_obj, latitude, longitude)
    sunrise_str, _ = self._compute_sunrise_sunset(date_obj, latitude, longitude, tz_name)
    sr_h, sr_m = map(int, sunrise_str.split(":"))
    sr_mins = sr_h * 60 + sr_m
    offset  = VARJYAM_NAKSHATRA_OFFSETS.get(nakshatra_num, 420)
    start   = sr_mins + offset
    end     = start + 96   # 1h 36min = 96 min
    return {
        "start": self._minutes_to_hhmm(start % (24 * 60)),
        "end":   self._minutes_to_hhmm(end   % (24 * 60)),
        "nakshatra": nakshatra_num,
        "warning": "Avoid all important activities during Varjyam",
    }
```

#### 8j. Tithi and Nakshatra End Times

Show the user when the current Tithi and Nakshatra transitions happen during the day.

```python
def _compute_tithi_end_time(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> str:
    """
    Find approximate time when the current Tithi ends by scanning in 30-min steps.
    Returns HH:MM local time or 'Tomorrow' if it extends past midnight.
    """
    if not EPHEM_AVAILABLE:
        return "N/A"
    import pytz
    tz = pytz.timezone(tz_name)
    current_tithi = self._compute_tithi_number(date_obj, latitude, longitude)
    obs = ephem.Observer()
    obs.lat = str(latitude)
    obs.lon = str(longitude)
    obs.pressure = 0
    # Scan every 30 minutes from 00:00 to 23:30 on date_obj
    from datetime import datetime as _dt, timedelta as _td
    base_utc = _dt(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0,
                    tzinfo=pytz.utc)
    prev = current_tithi
    for step in range(1, 49):  # 48 × 30min = 24h
        t_utc = base_utc + _td(minutes=30 * step)
        obs.date = t_utc.strftime("%Y/%m/%d %H:%M:%S")
        sun  = ephem.Sun(); moon = ephem.Moon()
        sun.compute(obs);  moon.compute(obs)
        s_lon = math.degrees(ephem.Ecliptic(sun).lon)
        m_lon = math.degrees(ephem.Ecliptic(moon).lon)
        diff  = (m_lon - s_lon) % 360
        tithi = int(diff / 12) + 1
        if tithi != prev:
            t_local = t_utc.astimezone(tz)
            return t_local.strftime("%H:%M")
        prev = tithi
    return "Tomorrow"

def _compute_nakshatra_end_time(
    self, date_obj: date, latitude: float, longitude: float, tz_name: str
) -> str:
    """Find approximate time when the current Nakshatra ends (30-min steps)."""
    if not EPHEM_AVAILABLE:
        return "N/A"
    import pytz
    tz = pytz.timezone(tz_name)
    current_nak = self._compute_nakshatra_number(date_obj, latitude, longitude)
    obs = ephem.Observer()
    obs.lat = str(latitude); obs.lon = str(longitude); obs.pressure = 0
    from datetime import datetime as _dt, timedelta as _td
    base_utc = _dt(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0,
                    tzinfo=pytz.utc)
    prev = current_nak
    for step in range(1, 49):
        t_utc = base_utc + _td(minutes=30 * step)
        obs.date = t_utc.strftime("%Y/%m/%d %H:%M:%S")
        moon = ephem.Moon(); moon.compute(obs)
        m_lon = math.degrees(ephem.Ecliptic(moon).lon)
        nak = int(m_lon / (360.0 / 27)) + 1
        if nak != prev:
            t_local = t_utc.astimezone(tz)
            return t_local.strftime("%H:%M")
        prev = nak
    return "Tomorrow"
```

#### 8k. Integrate All New Elements into `get_daily_panchanga`

Update the `get_daily_panchanga` return dict to include all new fields:

```python
# Inside get_daily_panchanga, after computing sun_lon, moon_lon:
samvatsara = self._compute_samvatsara(date_obj)
eras        = self._compute_eras(date_obj)
ayana       = self._compute_ayana(sun_lon)
ritu        = self._compute_ritu(sun_lon)
surya_rashi = self._compute_rashi(sun_lon)
_, moon_lon_val = self._sun_moon_longitudes(date_obj, latitude, longitude)
chandra_rashi = self._compute_rashi(moon_lon_val)
moonrise, moonset = self._compute_moonrise_moonset(date_obj, latitude, longitude, tz_name)
choghadiya  = self._compute_choghadiya(date_obj, latitude, longitude, tz_name)
hora        = self._compute_hora(date_obj, latitude, longitude, tz_name)
durmuhurtam = self._compute_durmuhurtam(date_obj, latitude, longitude, tz_name)
varjyam     = self._compute_varjyam(date_obj, latitude, longitude, tz_name)
tithi_end   = self._compute_tithi_end_time(date_obj, latitude, longitude, tz_name)
nak_end     = self._compute_nakshatra_end_time(date_obj, latitude, longitude, tz_name)

# Add to the returned dict:
return {
    ...existing fields...,
    "samvatsara": samvatsara,
    "shaka_samvat": eras["shaka_samvat"],
    "vikrama_samvat": eras["vikrama_samvat"],
    "kali_yuga": eras["kali_yuga"],
    "ayana": ayana,
    "ritu": ritu,
    "surya_rashi": surya_rashi,
    "chandra_rashi": chandra_rashi,
    "moonrise": moonrise,
    "moonset":  moonset,
    "choghadiya": choghadiya,
    "hora": hora,
    "durmuhurtam": durmuhurtam,
    "varjyam": varjyam,
    "tithi_end_time": tithi_end,
    "nakshatra_end_time": nak_end,
}
```

---

### 9. Frontend: Fix All N/A Fields in `savitara-web/src/pages/Panchanga.jsx`

**Root cause**: The page accesses `panchanga.tithi?.name_sanskrit` and `panchanga.tithi?.name_english`
which do not exist. The backend returns `panchanga.tithi?.name` (English) and `panchanga.tithi?.name_sa`
(Sanskrit). Fix every field access:

| Old code (produces N/A) | Correct code |
|---|---|
| `panchanga.tithi?.name_sanskrit` | `panchanga.tithi?.name` |
| `panchanga.tithi?.name_english` | `panchanga.tithi?.name` |
| `panchanga.nakshatra?.name_sanskrit` | `panchanga.nakshatra?.name` |
| `panchanga.nakshatra?.name_english` | `panchanga.nakshatra?.name` |
| `panchanga.rahukala` | `panchanga.rahu_kalam?.start + ' – ' + panchanga.rahu_kalam?.end` |
| `panchanga.yamagandam` | `panchanga.inauspicious_periods?.yamagandam?.start + ' – ...'` |
| `panchanga.gulika` | `panchanga.inauspicious_periods?.gulika_kalam?.start + ' – ...'` |

**Also add** all the newly computed fields as display sections in the page:

1. **Sankalpa header row** (top of page, bilingual):
   ```
   {vikrama_samvat} Vikrama Samvat | {shaka_samvat} Shaka Samvat |
   Samvatsara: {samvatsara.name} | Ayana: {ayana.name} | Ritu: {ritu.name}
   ```

2. **Extended Panchanga grid** — add cards for: Ayana, Ritu, Masa (month name + type),
   Surya Rashi, Chandra Rashi, Moonrise/Moonset.

3. **Choghadiya table** — show all 16 periods (8 day, 8 night) in a two-column table.
   Auspicious periods in green, inauspicious in red/orange.

4. **Durmuhurtam + Varjyam** section with time ranges and warnings.

5. **Tithi/Nakshatra end times** shown below each element card.

---

### 10. Frontend: Panchanga Type Selector (Chandramana / Souramana)

**File: `savitara-web/src/pages/Panchanga.jsx`**

Add at the top of the page (below the header):

```jsx
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import { useAuth } from '../context/AuthContext'

const { user } = useAuth()
const [panchangaType, setPanchangaType] = useState(user?.panchanga_type || 'lunar')

const handleTypeChange = async (_, newType) => {
  if (!newType) return
  setPanchangaType(newType)
  await loadPanchanga(newType)  // reload Panchanga with new type
  // Optionally persist: await api.patch('/users/profile', { panchanga_type: newType })
}

// In loadPanchanga, accept `type` param and pass it:
const loadPanchanga = async (type = panchangaType) => {
  const params = new URLSearchParams({ panchanga_type: type })
  if (user?.location?.latitude)  params.set('latitude',  user.location.latitude)
  if (user?.location?.longitude) params.set('longitude', user.location.longitude)
  const response = await api.get(`/panchanga/today?${params}`)
  ...
}

// Render toggle above the main grid:
<ToggleButtonGroup
  value={panchangaType}
  exclusive
  onChange={handleTypeChange}
  aria-label="Panchanga Type"
  sx={{ mb: 3 }}
>
  <Tooltip title="Lunar calendar — followed in Maharashtra, Karnataka, Gujarat, North India">
    <ToggleButton value="lunar" aria-label="Chandramana (Lunar)">
      🌙 Chandramana (Lunar)
    </ToggleButton>
  </Tooltip>
  <Tooltip title="Solar calendar — followed in Tamil Nadu, Kerala, Bengal, Odisha">
    <ToggleButton value="solar" aria-label="Souramana (Solar)">
      ☀️ Souramana (Solar)
    </ToggleButton>
  </Tooltip>
</ToggleButtonGroup>
```

Apply the same toggle (simplified, as a `Select`) in `savitara-app/src/components/PanchangaWidget.js`.

---

### 11. Frontend: Panchanga Calendar Component for Any-Day Lookup

**File: `savitara-web/src/pages/Panchanga.jsx`** (embed in the page)  
**New file (optional): `savitara-web/src/components/PanchangaCalendar.jsx`**

Add a full month calendar view where the user can tap any day to see its Panchanga.

#### Calendar Component Specification

```jsx
// PanchangaCalendar.jsx
import { useState } from 'react'
import { Box, Grid, Typography, Paper, IconButton, CircularProgress, Chip } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         startOfWeek, addMonths, subMonths, isSameDay, isToday } from 'date-fns'
import api from '../services/api'

export default function PanchangaCalendar({ panchangaType = 'lunar', userLocation = null }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedPanchanga, setSelectedPanchanga] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cache, setCache] = useState({})  // date string → panchanga data

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })  // Sunday start
  const days       = eachDayOfInterval({ start: calStart, end: monthEnd })

  const loadDayPanchanga = async (day) => {
    const key = format(day, 'yyyy-MM-dd')
    if (cache[key]) {
      setSelectedPanchanga(cache[key])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ panchanga_type: panchangaType })
      if (userLocation?.latitude)  params.set('latitude',  userLocation.latitude)
      if (userLocation?.longitude) params.set('longitude', userLocation.longitude)
      const res = await api.get(`/panchanga/date/${key}?${params}`)
      const data = res.data?.data
      setCache(prev => ({ ...prev, [key]: data }))
      setSelectedPanchanga(data)
    } catch {
      setSelectedPanchanga(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDayClick = (day) => {
    setSelectedDate(day)
    loadDayPanchanga(day)
  }

  return (
    <Box>
      {/* Month navigation */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    aria-label="Previous month">
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          {format(currentMonth, 'MMMM yyyy')}
        </Typography>
        <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    aria-label="Next month">
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Day headers */}
      <Grid container columns={7} sx={{ mb: 1 }}>
        {daysOfWeek.map(d => (
          <Grid item xs={1} key={d}>
            <Typography variant="caption" align="center" display="block"
                         fontWeight={700} color="text.secondary">
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {/* Day cells */}
      <Grid container columns={7} spacing={0.5}>
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const todayFlag  = isToday(day)
          const inMonth    = day.getMonth() === currentMonth.getMonth()
          return (
            <Grid item xs={1} key={day.toISOString()}>
              <Paper
                onClick={() => inMonth && handleDayClick(day)}
                elevation={isSelected ? 4 : 0}
                sx={{
                  p: 1, textAlign: 'center', cursor: inMonth ? 'pointer' : 'default',
                  borderRadius: 2,
                  bgcolor: isSelected ? 'primary.main' : todayFlag ? 'primary.light' : 'transparent',
                  color:   isSelected ? 'white' : inMonth ? 'text.primary' : 'text.disabled',
                  '&:hover': inMonth ? { bgcolor: isSelected ? 'primary.dark' : 'action.hover' } : {}
                }}
              >
                <Typography variant="body2" fontWeight={todayFlag ? 700 : 400}>
                  {format(day, 'd')}
                </Typography>
              </Paper>
            </Grid>
          )
        })}
      </Grid>

      {/* Selected day Panchanga panel */}
      {loading && <Box textAlign="center" mt={3}><CircularProgress size={28} /></Box>}
      {selectedPanchanga && !loading && (
        <Paper elevation={2} sx={{ mt: 3, p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </Typography>
          <Grid container spacing={1}>
            {[
              ['Tithi',     selectedPanchanga.tithi?.name, selectedPanchanga.tithi?.name_sa],
              ['Nakshatra', selectedPanchanga.nakshatra?.name, selectedPanchanga.nakshatra?.name_sa],
              ['Yoga',      selectedPanchanga.yoga?.name, selectedPanchanga.yoga?.name_sa],
              ['Karana',    selectedPanchanga.karana?.name, selectedPanchanga.karana?.name_sa],
              ['Paksha',    selectedPanchanga.tithi?.paksha, selectedPanchanga.tithi?.paksha_sa],
              ['Masa',      selectedPanchanga.month_name, selectedPanchanga.month_name_sa],
              ['Ayana',     selectedPanchanga.ayana?.name, selectedPanchanga.ayana?.name_sa],
              ['Ritu',      selectedPanchanga.ritu?.name, selectedPanchanga.ritu?.name_sa],
            ].map(([label, value, valueSa]) => value && (
              <Grid item xs={6} sm={3} key={label}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  {valueSa && (
                    <Typography variant="caption" color="text.secondary"
                                sx={{ fontFamily: 'serif' }}>{valueSa}</Typography>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box mt={2} display="flex" gap={1} flexWrap="wrap">
            <Chip size="small" label={`Sunrise: ${selectedPanchanga.sunrise}`}
                  icon={<span>🌅</span>} />
            <Chip size="small" label={`Sunset: ${selectedPanchanga.sunset}`}
                  icon={<span>🌇</span>} />
            <Chip size="small" label={`Moonrise: ${selectedPanchanga.moonrise || 'N/A'}`}
                  icon={<span>🌙</span>} />
            {selectedPanchanga.festivals?.map(f => (
              <Chip key={f} size="small" label={f} color="primary" variant="outlined" />
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  )
}
```

**Embed in `Panchanga.jsx`**:
```jsx
import PanchangaCalendar from '../components/PanchangaCalendar'
// ...
<Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 4 }}>
  <Typography variant="h5" fontWeight={600} gutterBottom>
    Panchanga Calendar — Browse Any Day
  </Typography>
  <PanchangaCalendar
    panchangaType={panchangaType}
    userLocation={user?.location}
  />
</Paper>
```

**Also add** a `/panchanga/month/:year/:month` endpoint that returns summary Panchanga
(Tithi + Nakshatra + festivals) for all days in a month, enabling the calendar to pre-fetch:

```python
@router.get("/month/{year}/{month}", response_model=StandardResponse)
async def get_month_panchanga(
    year: int, month: int,
    latitude: float | None = None, longitude: float | None = None,
    panchanga_type: str | None = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    eff_lat, eff_lon, eff_type = _effective_params(current_user, latitude, longitude, panchanga_type)
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    results = []
    for d in range(1, days_in_month + 1):
        day = date(year, month, d)
        p = panchanga_service.get_daily_panchanga(day, eff_lat, eff_lon, eff_type)
        results.append({
            "date": day.isoformat(),
            "tithi": p["tithi"]["name"],
            "tithi_sa": p["tithi"]["name_sa"],
            "nakshatra": p["nakshatra"]["name"],
            "paksha": p["tithi"]["paksha"],
            "festivals": p["festivals"],
            "samvatsara": p.get("samvatsara", {}).get("name", ""),
        })
    return {"success": True, "message": "Month Panchanga", "data": {"month": results}}
```

---

### 12. Mobile App: PanchangaWidget.js — Chandramana/Souramana Toggle

**File: `savitara-app/src/components/PanchangaWidget.js`**

The mobile widget should also:
1. Read `user?.panchanga_type` from AuthContext (same pattern as the web widget).
2. Show a small toggle between "🌙 Chandramana" and "☀️ Souramana" within the widget header.
3. Display all five limbs (Tithi, Nakshatra, Yoga, Karana, Vara) + Paksha, Masa, Ayana, Ritu,
   Samvatsara, Shaka Samvat, sunrise/sunset, Rahu Kalam, Choghadiya (currently active period),
   and next Auspicious Muhurta.
4. Use normalized field access: `tithi?.name` (not `tithi?.name_sanskrit`).

---

### 13. Mobile App: Panchanga Screen for Any-Day Lookup

Ensure `savitara-app/src/screens/PanchangaScreen.js` (create if absent, wire navigation from
the main tabs) renders:

- A **date picker** (`@react-native-community/datetimepicker`) to choose any date.
- Full Panchanga for the selected date (all 5 limbs + extended elements from Fix 8).
- A **Chandramana / Souramana** `Switch` in the header.
- All timings (sunrise, sunset, moonrise, moonset, Rahu Kalam, Yamagandam, Gulika, Abhijit,
  Brahma Muhurta, Durmuhurtam, Varjyam, Choghadiya list).
- Language toggle (English / Sanskrit display name) applied per-element.

---

### 14. API: Add `/panchanga/month` and `/panchanga/yearly-summary` Endpoints

**File: `backend/app/api/v1/panchanga.py`**

- `/panchanga/month/{year}/{month}` — described in Fix 11 above.
- `/panchanga/yearly-summary/{year}` — returns all Ekadashi dates, festivals, Sankranti dates,
  and major Vrat dates. Used by calendar component for pre-rendering event markers.

---

## Validation Checklist

After implementing all changes, verify:

### Backend
- [ ] `GET /panchanga/today?latitude=13.0827&longitude=80.2707&panchanga_type=solar` returns
  Tamil Nadu solar month name (Souramana) in `data.month_name`, Ayana, Ritu, Samvatsara.
- [ ] `GET /panchanga/today?latitude=19.0760&longitude=72.8777&panchanga_type=lunar` returns
  correct Tithi for Mumbai's timezone (IST, not UTC offset).
- [ ] `GET /panchanga/today` (authenticated user with Bengaluru coordinates) auto-uses
  `latitude=12.97`, `longitude=77.59` without query params.
- [ ] Response contains `samvatsara.name` (e.g., "Sharvari"), `shaka_samvat` (integer),
  `vikrama_samvat` (integer), `kali_yuga` (integer).
- [ ] Response contains `ayana.name` ("Uttarayana" or "Dakshinayana").
- [ ] Response contains `ritu.name` (one of: Vasanta, Grishma, Varsha, Sharad, Hemanta, Shishira).
- [ ] Response contains `surya_rashi.name` and `chandra_rashi.name` (zodiac sign names).
- [ ] Response contains `moonrise` and `moonset` as HH:MM strings.
- [ ] Response contains `choghadiya` array of 16 items (8 day + 8 night), each with
  `name`, `name_sa`, `start`, `end`, `quality`.
- [ ] Response contains `hora` array of 24 items with planetary lords.
- [ ] Response contains `durmuhurtam` (list of time slots) and `varjyam` (single time slot).
- [ ] Response contains `tithi_end_time` and `nakshatra_end_time` as HH:MM or "Tomorrow".
- [ ] All Panchanga elements have both `name` (English) and `name_sa` (Sanskrit) — zero N/A values.
- [ ] `GET /panchanga/month/2026/3` returns 31-element array with Tithi, Nakshatra, festivals per day.
- [ ] No existing tests break: `pytest tests/ -v` passes in `backend/`.

### Frontend (Web)
- [ ] `Panchanga.jsx` shows no N/A fields — all Tithi, Nakshatra, Yoga, Karana, Paksha display.
- [ ] Inauspicious timings section shows Rahu Kalam, Yamagandam, Gulika with correct times.
- [ ] Chandramana/Souramana toggle is visible and switching it reloads Panchanga.
- [ ] Sankalpa header row shows Vikrama Samvat, Shaka Samvat, Samvatsara name, Ayana, Ritu, Masa.
- [ ] Extended cards show: Ayana, Ritu, Masa, Surya Rashi, Chandra Rashi, Moonrise/Moonset.
- [ ] Choghadiya table shows all 16 periods coloured by quality (green = auspicious, red = inauspicious).
- [ ] Durmuhurtam and Varjyam time ranges are displayed with warnings.
- [ ] Tithi and Nakshatra cards show "Ends at: HH:MM" below the name.
- [ ] Calendar component renders for the current month; clicking any day loads its Panchanga.
- [ ] Calendar shows festival dots on days with festivals.
- [ ] User's saved location from profile is used automatically.

### Frontend (Mobile)
- [ ] `PanchangaWidget.js` shows Tithi, Nakshatra, Yoga, Karana, Vara, Paksha, Masa.
- [ ] Chandramana/Souramana toggle is visible in the widget.
- [ ] Samvatsara and Shaka Samvat are displayed in the widget.
- [ ] The currently active Choghadiya period is shown.
- [ ] Panchanga screen has date picker for any-day lookup.

### Profile & Location
- [ ] Profile edit shows "Update My Location" section with "Use Current Location" button.
- [ ] Confirmation prompt shows city name before storing coordinates.
- [ ] `location_approved: true` is only set after user clicks "Confirm Location".
- [ ] Panchanga Type select shows "Lunar (Chandramana)" and "Solar (Souramana)".
- [ ] After saving, PanchangaWidget immediately reflects new user preferences.

### Chat Timestamps
- [ ] `savitara-app/src/utils/dateTime.js` exists with `formatLocalTime(isoString, tz, fmt)`.
- [ ] Chat timestamps in ConversationScreen use `formatLocalTime` with user's timezone.
- [ ] A user in `Asia/Kolkata` and a user in `America/New_York` see different local times
  for the same message.

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Panchanga API routes | `backend/app/api/v1/panchanga.py` |
| Panchanga business logic | `backend/app/services/panchanga_service.py` |
| Database models (Location, User) | `backend/app/models/database.py` |
| User profile API | `backend/app/api/v1/users.py` |
| Mobile Panchanga widget | `savitara-app/src/components/PanchangaWidget.js` |
| Mobile Panchanga screen | `savitara-app/src/screens/PanchangaScreen.js` |
| Web Panchanga widget | `savitara-web/src/components/PanchangaWidget.jsx` |
| Web Panchanga page | `savitara-web/src/pages/Panchanga.jsx` |
| Web Panchanga Calendar | `savitara-web/src/components/PanchangaCalendar.jsx` (new) |
| Mobile chat screen | `savitara-app/src/screens/chat/ConversationScreen.js` |
| Mobile chat list | `savitara-app/src/screens/chat/ChatListScreen.js` |
| Mobile booking screen | `savitara-app/src/screens/acharya/BookingRequestsScreen.js` |
| Web chat component | `savitara-web/src/components/Chat.jsx` |
| Auth context (user object) | `savitara-app/src/context/AuthContext.js` |
| Date-time utility | `savitara-app/src/utils/dateTime.js` (new) |
| Backend settings | `backend/app/core/config.py` |
| Mobile profile edit | `savitara-app/src/screens/profile/ProfileEditScreen.js` |
| Web profile page | `savitara-web/src/pages/Profile.jsx` |

---

## Requirements & All Dependencies

**`backend/requirements.txt`** (add if absent):
```
ephem>=4.1.5
timezonefinder>=6.2.0
pytz>=2024.1
```

**`savitara-app/package.json`** + **`savitara-web/package.json`**:
```json
"date-fns": ">=3.6.0",
"date-fns-tz": ">=3.1.3"
```

**`savitara-app/package.json`** (calendar date picker):
```json
"@react-native-community/datetimepicker": ">=7.0.0"
```

**`savitara-web/package.json`** (calendar):
```json
"date-fns": ">=3.6.0"
```

---

## Anti-Patterns — Do NOT Do These

- Do **not** hardcode `"Asia/Kolkata"` anywhere except as a documented last-resort fallback.
- Do **not** compute Tithi or Nakshatra using `days % 27` or `days % 30` arithmetic — these
  produce wrong values within a few months of any reference date.
- Do **not** access `tithi.name_sanskrit` or `tithi.name_english` — the correct keys are
  `tithi.name` (English) and `tithi.name_sa` (Sanskrit).
- Do **not** show a raw UTC ISO string to the user in any chat or booking display.
- Do **not** call `navigator.geolocation` or `expo-location` without an explicit user action;
  this is a security and Android/iOS permission-model requirement.
- Do **not** store location coordinates that the user has not confirmed (`location_approved: false`).
- Do **not** show N/A for any Panchanga field — every field must have a valid computed fallback.
- Do **not** use Gregorian month names for Hindu month names — use the proper Sanskrit names
  from `LUNAR_MONTH_NAMES` / `SOLAR_MONTH_NAMES` lookup tables.
- Do **not** skip the Sambatsava / era data — these are mandatory for valid Sankalpa recitation
  and are expected by Acharyas on the platform.
