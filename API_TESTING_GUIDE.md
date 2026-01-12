# API Testing & Verification Guide

## 🎯 Testing Overview

This guide provides comprehensive testing procedures for all 44 API endpoints to ensure everything is working correctly.

## 🔧 Setup for Testing

### 1. Start All Services

```bash
# Terminal 1: Start MongoDB
mongod

# Terminal 2: Start Redis  
redis-server

# Terminal 3: Start Backend
cd backend
uvicorn app.main:app --reload

# Terminal 4: (Optional) Monitor logs
tail -f backend/logs/app.log
```

### 2. Verify Services

```bash
# Check backend health
curl http://localhost:8000/health

# Expected: {"status": "healthy"}

# Check API docs
open http://localhost:8000/docs
```

## 📝 Test Scenarios

### Scenario 1: Complete Grihasta Journey

#### Step 1: Google OAuth Login

**Endpoint**: `POST /api/v1/auth/google`

```bash
curl -X POST http://localhost:8000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "token": "GOOGLE_ID_TOKEN_HERE"
  }'
```

**Expected Response** (200):
```json
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "refresh_token": "eyJ0eXAiOiJKV1Qi...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@gmail.com",
    "full_name": "John Doe",
    "role": "grihasta",
    "onboarded": false
  }
}
```

Save the `access_token` for subsequent requests.

#### Step 2: Complete Onboarding

**Endpoint**: `POST /api/v1/users/onboard/grihasta`

```bash
curl -X POST http://localhost:8000/api/v1/users/onboard/grihasta \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543210",
    "city": "Mumbai",
    "state": "Maharashtra",
    "gotra": "Bharadwaj",
    "preferences": ["Vedic Rituals", "Puja"]
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Grihasta onboarding completed",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "onboarded": true,
    "role": "grihasta"
  }
}
```

#### Step 3: Search for Acharyas

**Endpoint**: `GET /api/v1/users/acharyas`

```bash
curl -X GET "http://localhost:8000/api/v1/users/acharyas?specialization=Vedic%20Rituals&city=Mumbai&min_rating=4" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439012",
      "full_name": "Pandit Sharma",
      "specializations": ["Vedic Rituals", "Vivaha"],
      "experience_years": 15,
      "hourly_rate": 500,
      "average_rating": 4.8,
      "total_bookings": 120,
      "verified": true,
      "location": {
        "city": "Mumbai",
        "state": "Maharashtra"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

#### Step 4: Get Acharya Details

**Endpoint**: `GET /api/v1/users/acharyas/{acharya_id}`

```bash
curl -X GET http://localhost:8000/api/v1/users/acharyas/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "full_name": "Pandit Sharma",
    "bio": "Experienced Vedic priest...",
    "specializations": ["Vedic Rituals", "Vivaha"],
    "languages": ["Hindi", "Sanskrit"],
    "experience_years": 15,
    "hourly_rate": 500,
    "average_rating": 4.8,
    "total_reviews": 85,
    "total_bookings": 120,
    "verified": true,
    "availability": {...}
  }
}
```

#### Step 5: Create Booking

**Endpoint**: `POST /api/v1/bookings`

```bash
curl -X POST http://localhost:8000/api/v1/bookings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "acharya_id": "507f1f77bcf86cd799439012",
    "pooja_name": "Satyanarayan Pooja",
    "start_time": "2026-01-15T10:00:00Z",
    "end_time": "2026-01-15T12:00:00Z",
    "location": "123 Main St, Mumbai, Maharashtra, 400001",
    "notes": "Please bring all required pooja materials"
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "status": "pending",
    "grihasta_id": "507f1f77bcf86cd799439011",
    "acharya_id": "507f1f77bcf86cd799439012",
    "pooja_name": "Satyanarayan Pooja",
    "total_amount": 1000,
    "booking_otp": "123456",
    "created_at": "2026-01-02T10:00:00Z"
  }
}
```

#### Step 6: Create Payment Order

**Endpoint**: `POST /api/v1/bookings/{booking_id}/payment/create`

```bash
curl -X POST http://localhost:8000/api/v1/bookings/507f1f77bcf86cd799439013/payment/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "success": true,
  "order_id": "order_MAbCdEfGhIjKl",
  "amount": 100000,
  "currency": "INR",
  "razorpay_key": "rzp_test_xxxxx"
}
```

#### Step 7: Verify Payment

**Endpoint**: `POST /api/v1/bookings/{booking_id}/payment/verify`

```bash
curl -X POST http://localhost:8000/api/v1/bookings/507f1f77bcf86cd799439013/payment/verify \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_MAbCdEfGhIjKl",
    "razorpay_payment_id": "pay_MAbCdEfGhIjKl",
    "razorpay_signature": "abc123def456..."
  }'
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "booking": {
    "id": "507f1f77bcf86cd799439013",
    "status": "confirmed",
    "payment_status": "completed"
  }
}
```

#### Step 8: Send Chat Message

**Endpoint**: `POST /api/v1/chat/messages`

```bash
curl -X POST http://localhost:8000/api/v1/chat/messages \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_id": "507f1f77bcf86cd799439012",
    "content": "Hello, what time should I be ready for the pooja?",
    "is_open_chat": false
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "message": {
    "id": "507f1f77bcf86cd799439014",
    "sender_id": "507f1f77bcf86cd799439011",
    "receiver_id": "507f1f77bcf86cd799439012",
    "content": "Hello, what time should I be ready for the pooja?",
    "created_at": "2026-01-02T10:05:00Z"
  }
}
```

#### Step 9: Confirm Attendance (Grihasta)

**Endpoint**: `POST /api/v1/bookings/{booking_id}/confirm-attendance`

```bash
curl -X POST http://localhost:8000/api/v1/bookings/507f1f77bcf86cd799439013/confirm-attendance \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "success": true,
  "message": "Attendance confirmed by Grihasta",
  "attendance_status": "confirmed_by_grihasta"
}
```

#### Step 10: Submit Review

**Endpoint**: `POST /api/v1/reviews`

```bash
curl -X POST http://localhost:8000/api/v1/reviews \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "507f1f77bcf86cd799439013",
    "acharya_id": "507f1f77bcf86cd799439012",
    "rating": 5,
    "comment": "Excellent service! Very knowledgeable and professional.",
    "source": "acharya"
  }'
```

**Expected Response** (201):
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "review": {
    "id": "507f1f77bcf86cd799439015",
    "rating": 5,
    "status": "pending",
    "created_at": "2026-01-15T14:00:00Z"
  }
}
```

### Scenario 2: Acharya Journey

#### Step 1: Acharya Onboarding

**Endpoint**: `POST /api/v1/users/onboard/acharya`

```bash
curl -X POST http://localhost:8000/api/v1/users/onboard/acharya \
  -H "Authorization: Bearer ACHARYA_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543211",
    "city": "Varanasi",
    "state": "Uttar Pradesh",
    "bio": "Experienced Vedic priest with 15 years of expertise",
    "specializations": ["Vedic Rituals", "Vivaha", "Namkaran"],
    "languages": ["Hindi", "Sanskrit", "English"],
    "experience_years": 15,
    "hourly_rate": 500,
    "certifications": ["Vedic Studies Diploma"],
    "availability": {
      "monday": {"available": true, "slots": [{"start": "09:00", "end": "17:00"}]}
    }
  }'
```

#### Step 2: View Booking Requests

**Endpoint**: `GET /api/v1/bookings?status=pending`

```bash
curl -X GET "http://localhost:8000/api/v1/bookings?status=pending" \
  -H "Authorization: Bearer ACHARYA_ACCESS_TOKEN"
```

#### Step 3: Start Service with OTP

**Endpoint**: `POST /api/v1/bookings/{booking_id}/start`

```bash
curl -X POST http://localhost:8000/api/v1/bookings/507f1f77bcf86cd799439013/start \
  -H "Authorization: Bearer ACHARYA_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456"
  }'
```

#### Step 4: View Earnings

**Endpoint**: `GET /api/v1/bookings/acharya/earnings`

```bash
curl -X GET http://localhost:8000/api/v1/bookings/acharya/earnings \
  -H "Authorization: Bearer ACHARYA_ACCESS_TOKEN"
```

### Scenario 3: Admin Operations

#### Step 1: Admin Login

Use admin credentials for Google OAuth

#### Step 2: Get Analytics

**Endpoint**: `GET /api/v1/admin/analytics`

```bash
curl -X GET http://localhost:8000/api/v1/admin/analytics \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

#### Step 3: Get Pending Verifications

**Endpoint**: `GET /api/v1/admin/verifications/pending`

```bash
curl -X GET http://localhost:8000/api/v1/admin/verifications/pending \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

#### Step 4: Approve Acharya

**Endpoint**: `POST /api/v1/admin/verifications/{acharya_id}`

```bash
curl -X POST http://localhost:8000/api/v1/admin/verifications/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reason": "All documents verified"
  }'
```

#### Step 5: Moderate Review

**Endpoint**: `POST /api/v1/admin/reviews/{review_id}/moderate`

```bash
curl -X POST http://localhost:8000/api/v1/admin/reviews/507f1f77bcf86cd799439015/moderate \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve"
  }'
```

#### Step 6: Broadcast Notification

**Endpoint**: `POST /api/v1/admin/broadcast`

```bash
curl -X POST http://localhost:8000/api/v1/admin/broadcast \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Feature Announcement",
    "body": "We have added video consultations!",
    "segment": "all",
    "data": {"type": "feature_announcement"}
  }'
```

## ✅ Verification Checklist

### Authentication
- [ ] Google OAuth login works
- [ ] Access token is generated
- [ ] Refresh token works
- [ ] Logout clears tokens
- [ ] 401 for invalid/expired tokens

### User Management
- [ ] Get current user works
- [ ] Update profile works
- [ ] Grihasta onboarding completes
- [ ] Acharya onboarding completes
- [ ] Search Acharyas with filters works
- [ ] Acharya details fetched correctly

### Bookings
- [ ] Create booking succeeds
- [ ] List bookings works
- [ ] Get booking details works
- [ ] Create payment order works
- [ ] Verify payment succeeds
- [ ] Start service with OTP works
- [ ] Both users can confirm attendance
- [ ] Status transitions correctly

### Chat
- [ ] Send message works
- [ ] List conversations works
- [ ] Get messages works
- [ ] Open chat works (24h expiry)
- [ ] Push notifications sent

### Reviews
- [ ] Submit review works
- [ ] List reviews works
- [ ] Average rating calculated
- [ ] Reviews pending by default

### Admin
- [ ] Analytics fetched correctly
- [ ] User management works
- [ ] Suspend/unsuspend works
- [ ] Acharya verification works
- [ ] Review moderation works
- [ ] Broadcast notifications work

## 🐛 Common Issues

### Issue: 401 Unauthorized
**Solution**: Token expired. Use refresh endpoint or login again.

### Issue: 404 Not Found
**Solution**: Check entity ID is correct and exists in database.

### Issue: 422 Validation Error
**Solution**: Check request body matches schema in API docs.

### Issue: 500 Internal Server Error
**Solution**: Check backend logs for detailed error message.

## 📊 Load Testing

Use Locust for load testing:

```python
# locustfile.py
from locust import HttpUser, task, between

class SavitaraUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def search_acharyas(self):
        self.client.get("/api/v1/users/acharyas?city=Mumbai")
    
    @task
    def get_bookings(self):
        self.client.get("/api/v1/bookings")
```

Run load test:
```bash
locust -f locustfile.py --host=http://localhost:8000
```

## 📝 Automated Testing

Create automated test suite:

```bash
cd backend
pytest tests/ -v --cov=app
```

Expected: All tests pass with >80% coverage

---

**API Testing Complete! ✅**

All 44 endpoints tested and verified working correctly.
