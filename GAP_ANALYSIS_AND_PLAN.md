# Gap Analysis & Implementation Plan

## 1. System Status Overview

### Backend (`backend/`)
**Status: ✅ Production Ready**
- **Auth**: Complete (JWT, OAuth, Role-based).
- **Users**: Complete (Onboarding, Profiles, Search with Elasticsearch/Mongo fallback).
- **Bookings**: Complete (Creation, Conflict Checks, Attendance).
- **Admin**: Complete (Analytics, Verification).
- **Infrastructure**: robust `main.py` with middleware, rate limiting, and caching.

### Frontend - User App (`savitara-web/`)
**Status: ⚠️ Partial / Construction Mode**
- **Auth**: ✅ Complete (Login, Register, OTP).
- **Home**: ✅ Styling Complete.
- **Search**: ❌ **MISSING** (File exists but empty).
- **Booking Flow**: ❌ **MISSING** (Files exist but empty).
- **Payment**: ❌ **MISSING** (UI logic missing).

### Frontend - Admin Web (`admin-savitara-web/`)
**Status: ⚠️ UI Only**
- **Dashboard**: UI updated, but data integration needs verification.
- **User Management**: UI exists, backend endpoints exist.

## 2. Identified Gaps (Critical)

The following core user journeys are impossible in the current Frontend state:
1. **Find an Acharya**: `SearchAcharyas.jsx` is a placeholder.
2. **View Acharya Details**: `AcharyaProfile.jsx` is likely a placeholder or basic.
3. **Book a Pooja**: `CreateBooking.jsx` is a placeholder.

## 3. Implementation Plan (Execute in Order)

### Phase 1: Discovery (Search & Listing)
- [ ] **Implement `SearchAcharyas.jsx`**:
    - Connect to `GET /api/v1/users/acharyas`.
    - Add filters (City, Language, Specialization).
    - Display results in Grid/List view with "Book Now" buttons.

### Phase 2: Details & Selection
- [ ] **Implement `AcharyaProfile.jsx`**:
    - Connect to `GET /api/v1/users/acharyas/{id}`.
    - Show Bio, Specializations, and **List of Poojas**.
    - Show Reviews.

### Phase 3: Booking Transaction
- [ ] **Implement `CreateBooking.jsx`**:
    - Form to select Date/Time.
    - Call `POST /api/v1/bookings`.
    - Handle success/failure states.

### Phase 4: Dashboard & History
- [ ] **Implement `MyBookings.jsx`**:
    - Connect to `GET /api/v1/bookings/my-bookings` (need to verify endpoint name).

## 4. Next Steps
Refining `savitara-web` is the highest priority to enable end-to-end testing.
