# Hindu Spiritual Services Feature - Complete Implementation

## Overview
Complete marketplace system for Hindu spiritual services (rituals, ceremonies, pujas) with 3 booking options, admin management, and muhurta integration.

## Architecture

### Backend (FastAPI)
- **Models**: [`backend/app/models/services.py`](backend/app/models/services.py)
  - Service model with categories, pricing, muhurta requirements
  - ServiceBooking model with 3 booking types
  
- **Catalog**: [`backend/app/models/services_catalog.py`](backend/app/models/services_catalog.py)
  - 15 authentic Hindu services pre-configured
  - Life ceremonies, worship rituals, remedial services, ancestral rites
  
- **APIs**: 
  - User endpoints: [`backend/app/api/v1/services.py`](backend/app/api/v1/services.py)
  - Admin endpoints: [`backend/app/api/v1/admin_services.py`](backend/app/api/v1/admin_services.py)

### Web (React + Vite)
- **Services List**: [`savitara-web/src/pages/Services.jsx`](savitara-web/src/pages/Services.jsx)
  - Grid view with search and category filters
  - Responsive design
  
- **Service Detail**: [`savitara-web/src/pages/ServiceDetail.jsx`](savitara-web/src/pages/ServiceDetail.jsx)
  - Complete service information
  - 3 booking options with modal form
  - Pricing calculator with fees and taxes

### Mobile (React Native + Expo)
- **Services Screen**: [`savitara-app/src/screens/common/ServicesScreen.js`](savitara-app/src/screens/common/ServicesScreen.js)
  - Native mobile list with horizontal category filters
  - Search functionality
  
- **Service Detail**: [`savitara-app/src/screens/common/ServiceDetailScreen.js`](savitara-app/src/screens/common/ServiceDetailScreen.js)
  - Scrollable detail view
  - Booking modal with full form
  
- **Navigation**: Updated [`savitara-app/src/navigation/AppNavigator.js`](savitara-app/src/navigation/AppNavigator.js)
  - Added Services tab to Grihasta navigation
  - Stack navigation for detail screen

### Admin (Next.js)
- **Management UI**: [`admin-savitara-web/pages/services.js`](admin-savitara-web/pages/services.js)
  - Services catalog management (edit pricing, activate/deactivate)
  - Service bookings dashboard
  - Status management for bookings

## Features

### Service Categories
1. **Life Ceremonies** (`life_ceremonies`)
   - Namkaran (Naming), Griha Pravesh (House Warming), Vivaha (Wedding), Upanayana (Sacred Thread), Mundan (First Haircut), Annaprashan (First Food)

2. **Worship & Puja** (`worship_puja`)
   - Ganesh Puja, Satyanarayan Puja, Lakshmi Puja, Rudrabhishek

3. **Remedial Services** (`remedial_services`)
   - Navagraha Puja (Planetary Remedies), Vastu Shanti (Architectural Correction)

4. **Ancestral Rites** (`ancestral_rites`)
   - Shradh (Ancestral Rites)

5. **Special Occasions** (`special_occasions`)
   - Festival celebrations, special events

### Three Booking Options

#### 1. Muhurta Consultation Only (₹99 - ₹499)
**Purpose**: Get auspicious timing consultation only
**Includes**:
- Detailed muhurta analysis
- Best dates and timings
- Things to avoid
- 30-min consultation call
- Written muhurta report

**Flow**: 
1. User selects service and "Muhurta Consultation"
2. Fills booking form (date preference, venue, contact)
3. System creates booking with `status: pending`
4. User redirected to Acharya selection page
5. After selecting Acharya, proceed with consultation

**Note**: Payment gateway integration pending - currently creates booking and redirects to Acharya selection.

#### 2. Full Service Package (₹2,100 - ₹15,000+)
**Purpose**: Complete service organized by platform
**Platform Provides**:
- Experienced Acharya assignment
- All puja materials (samagri)
- Muhurta calculation and selection
- Setup and arrangement
- Full ritual performance
- Post-ritual guidance

**Customer Provides**:
- Venue (home/temple)
- Basic facilities (water, electricity)
- Family participation

**Flow**:
1. User selects service and "Full Service Package"
2. Fills booking form with venue details
3. System calculates total (base + 10% platform fee + 18% GST)
4. Redirects to payment gateway
5. After payment, admin assigns Acharya
6. Booking confirmed

#### 3. Custom Acharya Selection (₹1,500 - ₹10,000+)
**Purpose**: Choose your preferred Acharya
**Customer Arranges**:
- All puja materials (samagri list provided)
- Venue setup
- Additional requirements

**Platform Provides**:
- Acharya booking and coordination
- Muhurta guidance (if needed)
- Quality assurance

**Flow**:
1. User selects service and "Choose Your Acharya"
2. Redirected to Acharya search page
3. Selects preferred Acharya
4. Fills booking form
5. Proceeds to payment
6. Direct booking with selected Acharya

### Muhurta Integration
**Levels**:
- `mandatory`: Must have muhurta (e.g., Griha Pravesh, Vivaha)
- `recommended`: Better with muhurta (e.g., Ganesh Puja)
- `not_required`: No specific timing (e.g., general consultations)

**Data in Catalog**:
- Best tithis (lunar days)
- Best nakshatras (constellations)
- Days to avoid
- Ideal time slots

**Note**: Full panchanga integration for automated muhurta calculation is in roadmap. Currently, Acharyas manually provide muhurta consultation.

## API Endpoints

### User Endpoints (`/api/v1/services`)
```
GET    /services                    - List all services (with search, category filter)
GET    /services/categories         - Get categories with service counts
GET    /services/{service_id}       - Get service details
POST   /services/{service_id}/booking - Create service booking
GET    /services/bookings/my-bookings - Get user's service bookings
GET    /services/bookings/{booking_id} - Get booking details
POST   /services/bookings/{booking_id}/cancel - Cancel booking
```

### Admin Endpoints (`/api/v1/admin/services`)
```
POST   /admin/services              - Create new service
PUT    /admin/services/{service_id} - Update service
DELETE /admin/services/{service_id} - Soft delete (deactivate)
GET    /admin/services/bookings/all - Get all bookings
PATCH  /admin/services/bookings/{booking_id}/status - Update booking status
POST   /admin/services/bookings/{booking_id}/assign-acharya - Assign Acharya
```

## Database Schema

### `services` Collection
```javascript
{
  _id: ObjectId,
  name_english: "Griha Pravesh",
  name_sanskrit: "गृह प्रवेश",
  category: "life_ceremonies",
  icon: "🏠",
  short_description: "House warming ceremony...",
  full_description: "Detailed explanation...",
  importance: "Why it's important...",
  benefits: "Benefits of this ritual...",
  requirements: ["Items needed"],
  duration: "2-3 hours",
  
  // Muhurta
  muhurta_required: "mandatory",
  muhurta_details: {
    best_tithis: ["Pratipada", "Panchami"],
    best_nakshatras: ["Ashwini", "Rohini"],
    avoid_days: ["Amavasya", "Krishna Paksha"]
  },
  
  // Pricing (3 booking types)
  muhurta_consultation_price: 299,
  full_service_base_price: 5100,
  custom_acharya_base_price: 3500,
  
  // Responsibilities
  platform_provides: ["Acharya", "Materials", "Setup"],
  customer_provides: ["Venue", "Facilities"],
  
  // Metadata
  is_active: true,
  total_bookings: 0,
  average_rating: 0.0,
  popularity_score: 0,
  created_at: ISODate,
  updated_at: ISODate
}
```

### `service_bookings` Collection
```javascript
{
  _id: ObjectId,
  service_id: ObjectId,
  user_id: ObjectId,
  booking_type: "muhurta_consultation" | "full_service" | "custom_acharya",
  
  selected_date: "2026-03-15",
  selected_time_slot: "morning" | "afternoon" | "evening",
  
  muhurta_details: {
    selected_tithi: "Panchami",
    selected_nakshatra: "Rohini",
    exact_timing: "07:30 AM - 09:00 AM"
  },
  
  acharya_id: ObjectId (null for platform-assigned),
  is_platform_assigned: true,
  
  venue_address: {
    line1: "123 Main St",
    line2: "Near Temple",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001"
  },
  
  contact_number: "9876543210",
  alternate_number: "9876543211",
  special_requests: "Need to complete before 10 AM",
  
  // Pricing
  base_price: 5100,
  platform_fee: 510,  // 10%
  taxes: 1009.8,      // 18% GST
  total_amount: 6619.8,
  
  // Status
  status: "pending" | "confirmed" | "completed" | "cancelled",
  payment_status: "pending" | "paid" | "refunded",
  
  admin_notes: "Assigned Pandit Sharma",
  cancelled_at: ISODate,
  cancellation_reason: "User reason",
  confirmed_at: ISODate,
  completed_at: ISODate,
  
  created_at: ISODate,
  updated_at: ISODate
}
```

## Pricing Structure
All prices calculated as:
```
Base Price (service-specific)
+ Platform Fee (10% of base)
+ GST (18% of base + platform fee)
= Total Amount
```

Example for Full Service at ₹5,100:
- Base: ₹5,100
- Platform Fee: ₹510
- GST: ₹1,009.80
- **Total: ₹6,619.80**

## Setup Instructions

### 1. Backend Setup
Services are auto-initialized on app startup via [`backend/app/db/init_services.py`](backend/app/db/init_services.py):

```bash
cd backend
python -m uvicorn app.main:app --reload
# Services collection will be created with 15 default services
```

### 2. Web Frontend
```bash
cd savitara-web
npm install
npm run dev
# Access services at http://localhost:3000/services
```

### 3. Mobile App
```bash
cd savitara-app
npm install
npx expo start
# Navigate to Services tab
```

### 4. Admin Panel
```bash
cd admin-savitara-web
npm install
npm run dev
# Access services management at http://localhost:3001/services
```

## Usage Workflows

### User Journey (Grihasta)
1. Navigate to Services page (Web: `/services`, Mobile: Services tab)
2. Browse or search for service (e.g., "Griha Pravesh")
3. View service details (description, benefits, requirements, muhurta timing)
4. Select booking option:
   - **Muhurta Only**: Book consultation → Select Acharya → Get timing
   - **Full Service**: Fill form → Pay → Admin assigns Acharya → Confirmed
   - **Custom Acharya**: Search Acharyas → Select → Fill form → Pay → Confirmed

### Admin Journey
1. Login to admin panel
2. Navigate to Services page
3. **Manage Services**:
   - Edit service details (name, description)
   - Update pricing for all 3 booking types
   - Activate/deactivate services
4. **Manage Bookings**:
   - View all service bookings
   - Update booking status (pending → confirmed → completed)
   - Assign Acharya for full service bookings
   - Handle cancellations

## Testing

### Test Service Booking (Postman)
```bash
# 1. Get all services
GET http://localhost:8000/api/v1/services

# 2. Get service detail
GET http://localhost:8000/api/v1/services/{service_id}

# 3. Create booking
POST http://localhost:8000/api/v1/services/{service_id}/booking
Headers: Authorization: Bearer {token}
Body:
{
  "booking_type": "full_service",
  "selected_date": "2026-03-15",
  "selected_time_slot": "morning",
  "venue_address": {
    "line1": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "contact_number": "9876543210"
}
```

### Test Admin Operations
```bash
# 1. Update service pricing
PUT http://localhost:8000/api/v1/admin/services/{service_id}
Headers: Authorization: Bearer {admin_token}
Body:
{
  "muhurta_consultation_price": 399,
  "full_service_base_price": 6000
}

# 2. Update booking status
PATCH http://localhost:8000/api/v1/admin/services/bookings/{booking_id}/status
Headers: Authorization: Bearer {admin_token}
Body:
{
  "new_status": "confirmed",
  "admin_notes": "Assigned Pandit Sharma"
}
```

## Roadmap / Future Enhancements

### Phase 2 (Pending Implementation)
1. **Payment Gateway Integration**
   - Razorpay integration for service bookings
   - Payment success/failure handling
   - Refund processing for cancellations

2. **Automated Muhurta Calculation**
   - Integration with existing panchanga service
   - Auto-suggest best dates for next 30 days
   - Real-time muhurta availability checker

3. **Acharya Matching Algorithm**
   - Auto-assign best Acharya based on:
     - Service specialization
     - Location proximity
     - Availability
     - Ratings

4. **Service Customization**
   - Allow users to customize service requirements
   - Dynamic pricing based on customizations
   - Add-on services (e.g., photography, catering)

5. **Review & Rating System**
   - Service-specific reviews (separate from Acharya reviews)
   - Photo/video uploads
   - Verified booking reviews

6. **Notifications**
   - Booking confirmations via email/SMS
   - Reminder before service date
   - Acharya assignment notifications
   - Status change alerts

7. **Advanced Admin Features**
   - Analytics dashboard (popular services, revenue)
   - Bulk service operations
   - Service templates
   - Seasonal pricing

### Phase 3 (Long-term)
1. **Video Consultation for Muhurta** (if needed in future)
2. **Multi-language Support** (Hindi, regional languages)
3. **Subscription Packages** (monthly puja services)
4. **Live Streaming** (for remote participation)

## Known Limitations
1. **Muhurta Consultation Flow**: Creates booking but doesn't fully integrate with Acharya selection flow yet. User must manually navigate to search Acharyas.
2. **Payment**: Currently redirects to payment screen but Razorpay integration needs completion for service bookings.
3. **Acharya Assignment**: For full service bookings, admin must manually assign Acharya - no auto-assignment yet.
4. **Mobile Payment**: Payment screen in mobile app needs service booking support.

## Files Modified/Created
**Backend**:
- ✅ `backend/app/models/services.py` (NEW)
- ✅ `backend/app/models/services_catalog.py` (NEW)
- ✅ `backend/app/api/v1/services.py` (NEW)
- ✅ `backend/app/api/v1/admin_services.py` (NEW)
- ✅ `backend/app/db/init_services.py` (NEW)
- ✅ `backend/app/main.py` (UPDATED - added routers)

**Web**:
- ✅ `savitara-web/src/pages/Services.jsx` (NEW)
- ✅ `savitara-web/src/pages/Services.css` (NEW)
- ✅ `savitara-web/src/pages/ServiceDetail.jsx` (NEW)
- ✅ `savitara-web/src/pages/ServiceDetail.css` (NEW)
- ✅ `savitara-web/src/App.jsx` (UPDATED - added routes)

**Mobile**:
- ✅ `savitara-app/src/screens/common/ServicesScreen.js` (NEW)
- ✅ `savitara-app/src/screens/common/ServiceDetailScreen.js` (NEW)
- ✅ `savitara-app/src/navigation/AppNavigator.js` (UPDATED - added Services tab)

**Admin**:
- ✅ `admin-savitara-web/pages/services.js` (NEW)
- ✅ `admin-savitara-web/styles/AdminServices.module.css` (NEW)
- ✅ `admin-savitara-web/src/components/Layout.js` (UPDATED - added Services menu)

## Support
For questions or issues:
- Check API logs: `backend/logs/`
- MongoDB collections: `services`, `service_bookings`
- Test with Postman collection (API_TESTING_GUIDE.md)
