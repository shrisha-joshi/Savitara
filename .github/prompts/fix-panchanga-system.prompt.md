---
mode: agent
description: >
  Fix and fully implement the Savitara Panchanga system: dual Panchanga type support
  (Lunar/Chandramana & Solar/Souramana), accurate location-based calculations, user
  profile location approval flow, consistent bilingual output, and correct
  timezone-aware timings across chat and bookings.
applyTo: "**"
---

# Fix & Enhance the Panchanga System

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

## Validation Checklist

After implementing all changes, verify:

- [ ] `GET /panchanga/today?latitude=13.0827&longitude=80.2707&panchanga_type=solar` returns
  Tamil Nadu solar month name (Souramana) in `data.month_name`.
- [ ] `GET /panchanga/today?latitude=19.0760&longitude=72.8777&panchanga_type=lunar` returns
  correct Tithi for Mumbai's timezone (IST, not UTC offset).
- [ ] `GET /panchanga/today` (authenticated, user has Bengaluru coordinates saved) auto-uses
  `latitude=12.97`, `longitude=77.59` without query params.
- [ ] Panchanga response always contains both `name` and `name_sa` for Tithi, Nakshatra, Yoga,
  Karana.
- [ ] Chat timestamps in the mobile app show the correct local time for a user in `Asia/Kolkata`
  versus a user in `America/New_York` receiving the same message.
- [ ] Profile location update + confirmation flow stores `latitude`, `longitude`, `timezone` in
  the user document; `location_approved` is `true` only after confirmation button click.
- [ ] PanchangaWidget labels correctly reflect `"Chandramana"` or `"Souramana"` based on user
  preference.
- [ ] No existing tests break; run `pytest tests/ -v` in `backend/`.

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Panchanga API routes | `backend/app/api/v1/panchanga.py` |
| Panchanga business logic | `backend/app/services/panchanga_service.py` |
| Database models (Location, User) | `backend/app/models/database.py` |
| User profile API | `backend/app/api/v1/users.py` |
| Mobile Panchanga widget | `savitara-app/src/components/PanchangaWidget.js` |
| Web Panchanga widget | `savitara-web/src/components/PanchangaWidget.jsx` |
| Web Panchanga page | `savitara-web/src/pages/Panchanga.jsx` |
| Mobile chat screen | `savitara-app/src/screens/chat/ConversationScreen.js` |
| Mobile chat list | `savitara-app/src/screens/chat/ChatListScreen.js` |
| Mobile booking screen | `savitara-app/src/screens/acharya/BookingRequestsScreen.js` |
| Auth context (user object) | `savitara-app/src/context/AuthContext.js` |
| Backend settings | `backend/app/core/config.py` |

---

## Anti-Patterns — Do NOT Do These

- Do **not** hardcode `"Asia/Kolkata"` anywhere except as a documented last-resort fallback when
  both location and device timezone are unavailable.
- Do **not** compute Tithi or Nakshatra using `days % 27` or `days % 30` arithmetic — these are
  incorrect and produce wrong values within a few months of any reference date.
- Do **not** show a raw UTC ISO string to the user in any chat or booking display.
- Do **not** call `navigator.geolocation` or `expo-location` without an explicit user action; this
  is both a security requirement and an Android/iOS permission-model requirement.
- Do **not** store location coordinates that the user has not confirmed (`location_approved: false`).
