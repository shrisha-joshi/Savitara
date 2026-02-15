# Savitara Platform - Complete Testing & Deployment Guide

## ✅ System Status

**Date:** February 14, 2026  
**Status:** ALL SYSTEMS OPERATIONAL

### Services Running:
- ✅ **Backend API** (http://localhost:8000) - FastAPI + MongoDB
- ✅ **Savitara Web** (http://localhost:3000) - React + Vite
- ✅ **Admin Web** (http://localhost:3001) - Next.js
- ✅ **MongoDB** - Connected and indexed
- ⚠️ **Redis** - Using in-memory fallback (optional service)
- ⚠️ **Elasticsearch** - Disabled (optional service)

### Configuration Status:
- ✅ Backend `.env` - Configured with MongoDB, Google OAuth
- ✅ Savitara Web `.env` - Configured with Firebase and API URL
- ✅ Admin Web `.env` - Configured with API URL
- ✅ Savitara App (Mobile) `.env` - Updated API URL
- ✅ Admin App (Mobile) `.env` - Updated Google Client ID

### Database Status:
- ✅ MongoDB Connected: `savitara` database
- ✅ Collections: 21 total
- ✅ Users: 1 existing user (Grihasta)
- ✅ Indexes: 37 created successfully

---

## 🎯 COMPLETE TESTING CHECKLIST

### Phase 1: Google Authentication Testing

#### 1.1 Web Application (http://localhost:3000)

1. **Open the application:**
   ```
   Browser: http://localhost:3000
   ```

2. **Open Developer Tools (F12)**
   - Go to Console tab
   - Go to Network tab

3. **Click "Sign in with Google"**

4. **Expected Flow:**
   - Redirects to Google Sign-In
   - User selects Google account
   - Redirects back to app
   - Firebase obtains ID token
   - Frontend sends token to backend `/api/v1/auth/google`
   - Backend creates/updates user
   - Frontend receives JWT tokens
   - User is logged in

5. **Check for Errors:**

   | Error | Location | Solution |
   |-------|----------|----------|
   | `auth/operation-not-allowed` | Console | Enable Google Sign-In in [Firebase Console](https://console.firebase.google.com/project/savitara-90a1c/authentication/providers) |
   | `auth/unauthorized-domain` | Console | Add `localhost` to authorized domains in Firebase |
   | `auth/invalid-api-key` | Console | Verify `VITE_FIREBASE_API_KEY` in `savitara-web\.env` |
   | `Network Error` | Network tab | Check backend is running on port 8000 |
   | `401 Unauthorized` | Network tab | Check `GOOGLE_CLIENT_ID` matches in backend and Firebase |

#### 1.2 Mobile Application (Expo)

**NOTE:** For mobile testing, you'll need to:
1. Use actual device or emulator
2. Update API URL to your computer's IP address (not localhost)

```powershell
# Get your IP address
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

Then update `savitara-app\.env`:
```dotenv
EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api/v1
```

Start the app:
```powershell
cd savitara-app
npx expo start
```

---

### Phase 2: User Journey Testing

#### 2.1 Grihasta (User) Journey

**1. Sign Up & Onboarding:**
- [ ] Sign in with Google as Grihasta
- [ ] Complete profile (name, phone, preferences)
- [ ] Upload profile picture (optional)
- [ ] Complete onboarding wizard
- [ ] Verify redirect to home page

**2. Browse Acharyas:**
- [ ] View list of available Acharyas
- [ ] Filter by specialization, language, location
- [ ] Sort by rating, price, availability
- [ ] View empty state if no Acharyas available

**3. View Acharya Profile:**
- [ ] Click on an Acharya
- [ ] See profile details, reviews, ratings
- [ ] See available time slots
- [ ] See services offered with pricing

**4. Create Booking:**
- [ ] Select date and time slot
- [ ] Choose service/pooja type
- [ ] Enter consultation details
- [ ] Review booking summary
- [ ] Proceed to payment

**5. Payment Flow:**
- [ ] Razorpay checkout opens
- [ ] Enter test card: `4111 1111 1111 1111`
- [ ] CVV: Any 3 digits, Expiry: Any future date
- [ ] Payment succeeds
- [ ] OTP verification (if enabled)
- [ ] Booking confirmed

**6. Manage Bookings:**
- [ ] View all bookings in "My Bookings"
- [ ] See booking status (pending, confirmed, completed)
- [ ] Cancel booking (if allowed)
- [ ] View booking details

**7. Submit Review:**
- [ ] After consultation completion
- [ ] Rate Acharya (1-5 stars)
- [ ] Write review text
- [ ] Submit review
- [ ] See review on Acharya profile

**8. Wallet  & Transactions:**
- [ ] View wallet balance
- [ ] See transaction history
- [ ] Use wallet for bookings

#### 2.2 Acharya Journey

**1. Sign Up & Onboarding:**
- [ ] Sign in with Google as Acharya
- [ ] Complete profile (name, specializations, bio)
- [ ] Upload documents for KYC verification
- [ ] Set up services and pricing
- [ ] Set availability schedule
- [ ] Complete onboarding

**2. Manage Profile:**
- [ ] Edit profile information
- [ ] Update specializations
- [ ] Add/edit services
- [ ] Set pricing for each service
- [ ] Upload certificates (optional)

**3. Availability Management:**
- [ ] Set weekly availability
- [ ] Mark specific dates as unavailable
- [ ] Set time slots duration
- [ ] Update availability anytime

**4. Booking Management:**
- [ ] Receive booking notifications
- [ ] View pending bookings
- [ ] Accept booking
- [ ] Reject booking with reason
- [ ] View confirmed bookings

**5. Consultation Flow:**
- [ ] See upcoming consultations
- [ ] Start consultation (chat/call)
- [ ] Mark attendance (OTP verification)
- [ ] Complete consultation
- [ ] Mark consultation as done

**6. Earnings & Analytics:**
- [ ] View total earnings
- [ ] See booking statistics
- [ ] View monthly/weekly earnings
- [ ] Download earning reports
- [ ] View pending payouts

**7. Reviews & Ratings:**
- [ ] View all received reviews
- [ ] See average rating
- [ ] Respond to reviews (if enabled)

#### 2.3 Admin Journey

**URL:** http://localhost:3001

**1. Admin Login:**
- [ ] Go to http://localhost:3001/login
- [ ] Enter admin credentials
- [ ] Verify successful login

**2. Dashboard:**
- [ ] View key metrics (users, bookings, revenue)
- [ ] See charts and analytics
- [ ] View recent activity

**3. User Management:**
- [ ] View all users (Grihastas + Acharyas)
- [ ] Search and filter users
- [ ] View user details
- [ ] Suspend/activate users
- [ ] View user booking history

**4. Acharya Verification (KYC):**
- [ ] See pending verification requests
- [ ] View submitted documents
- [ ] Approve/reject verification
- [ ] Add verification notes

**5. Booking Management:**
- [ ] View all bookings
- [ ] Filter by status, date, user
- [ ] View booking details
- [ ] Resolve disputes
- [ ] Issue refunds

**6. Content Management:**
- [ ] Manage testimonials
- [ ] Update homepage content
- [ ] Manage FAQ section
- [ ] Upload media files

**7. Coupon & Voucher Management:**
- [ ] Create discount coupons
- [ ] Set validity and usage limits
- [ ] Deactivate coupons
- [ ] View coupon usage analytics

**8. Analytics & Reports:**
- [ ] Revenue reports
- [ ] User growth analytics
- [ ] Popular services
- [ ] Geographic distribution
- [ ] Export reports (CSV/PDF)

**9. Audit Logs:**
- [ ] View system audit logs
- [ ] Filter by action type
- [ ] See user activity logs
- [ ] Export logs

---

### Phase 3: Edge Case Testing

#### 3.1 Authentication Edge Cases
- [ ] Try logging in with non-existent email
- [ ] Try Google sign-in with cancelled flow
- [ ] Test token expiry (wait 60 minutes)
- [ ] Test refresh token flow
- [ ] Log out and verify token removal
- [ ] Try accessing protected pages after logout

#### 3.2 Booking Edge Cases
- [ ] Try booking unavailable slot
- [ ] Try booking in past date
- [ ] Try booking without payment
- [ ] Cancel payment mid-flow
- [ ] Submit duplicate booking
- [ ] Try booking when Acharya is offline

#### 3.3 Payment Edge Cases
- [ ] Use invalid/expired card
- [ ] Cancel payment midway
- [ ] Close Razorpay popup
- [ ] Test payment with insufficient wallet balance
- [ ] Try payment with expired session

#### 3.4 Form Validation
- [ ] Submit empty forms
- [ ] Enter invalid email formats
- [ ] Enter invalid phone numbers
- [ ] Upload oversized files
- [ ] Upload unsupported file types
- [ ] Enter special characters in text fields

#### 3.5 Concurrent Operations
- [ ] Two users booking same slot simultaneously
- [ ] Acharya updating profile while user views it
- [ ] Multiple logins from same account
- [ ] Simultaneous booking cancellations

---

### Phase 4: Performance Testing

#### 4.1 Load Testing
```powershell
cd backend
locust -f tests\load\locustfile.py --host=http://localhost:8000
```
- [ ] Open http://localhost:8089
- [ ] Set users: 10-50
- [ ] Spawn rate: 5
- [ ] Run for 5 minutes
- [ ] Check response times < 500ms
- [ ] Check error rate < 1%

#### 4.2 Stress Testing
- [ ] Rapid navigation between pages
- [ ] Quick succession of API calls
- [ ] Upload multiple large files
- [ ] Scroll through large lists
- [ ] Check for memory leaks

---

### Phase 5: Security Testing

#### 5.1 Authentication Security
- [ ] Try accessing `/api/v1/auth/me` without token
- [ ] Try using expired token
- [ ] Try using malformed token
- [ ] Verify CORS restrictions
- [ ] Check password hashing (bcrypt)

#### 5.2 Authorization Security
- [ ] Grihasta trying to access Acharya endpoints
- [ ] Non-admin trying to access admin endpoints
- [ ] User trying to modify other user's data
- [ ] Try SQL injection in forms
- [ ] Try XSS in text fields

#### 5.3 Data Privacy
- [ ] Verify passwords are not logged
- [ ] Check sensitive data encryption
- [ ] Verify PII is properly masked
- [ ] Check audit logs don't expose sensitive info

---

## 🐛 KNOWN ISSUES & SOLUTIONS

### Issue 1: Google Sign-In Redirect Loop

**Symptoms:** After Google sign-in, keeps redirecting back to login page

**Solution:**
1. Clear browser cookies and localStorage
2. Check if Firebase redirect URI is correct
3. Verify `GOOGLE_CLIENT_ID` matches across all configs
4. Try incognito/private browsing mode

### Issue 2: Backend Connection Failed

**Symptoms:** "Network Error" or "Cannot connect to server"

**Solution:**
1. Verify backend is running: `http://localhost:8000/health`
2. Check CORS settings in `backend\.env`:
   ```
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```
3. For mobile: Use computer's IP, not localhost
4. Check firewall isn't blocking port 8000

### Issue 3: Payment Fails

**Symptoms:** Razorpay checkout fails or doesn't open

**Solution:**
1. Verify test keys in `backend\.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=xxx
   ```
2. Use Razorpay test card: `4111 1111 1111 1111`
3. Check backend logs for Razorpay API errors
4. Verify Razorpay account is in test mode

### Issue 4: Database Connection Error

**Symptoms:** "Failed to connect to MongoDB"

**Solution:**
1. Check MongoDB URL in `backend\.env`
2. Verify MongoDB Atlas credentials
3. Check IP whitelist in MongoDB Atlas
4. Ensure network allows MongoDB connections

### Issue 5: Mobile App Can't Connect

**Symptoms:** API calls fail from Expo app

**Solution:**
1. Use computer's IP address, not localhost:
   ```powershell
   ipconfig  # Windows
   ifconfig  # Mac/Linux
   ```
2. Update `savitara-app\.env`:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api/v1
   ```
3. Ensure phone and computer on same network
4. Check firewall allows inbound on port 8000

---

## 📊 QUALITY METRICS

### Target Metrics:
- **API Response Time:** < 500ms (p95)
- **Page Load Time:** < 2s
- **Error Rate:** < 0.1%
- **Auth Success Rate:** > 99%
- **Payment Success Rate:** > 95%
- **Mobile Crash Rate:** < 0.5%

### Monitoring:
- Backend logs: `backend\logs\savitara.log`
- Frontend console: Browser DevTools
- API metrics: `/api/v1/analytics/metrics` (admin only)

---

## 🚀 DEPLOYMENT READINESS CHECKLIST

Before deploying to production:

### Security:
- [ ] Change all secret keys in `.env`
- [ ] Use strong JWT secrets (minimum 32 characters)
- [ ] Enable HTTPS/SSL certificates
- [ ] Update CORS to allow only production domains
- [ ] Enable rate limiting
- [ ] Set up proper firewall rules

### Database:
- [ ] MongoDB production cluster configured
- [ ] Database backups enabled (daily)
- [ ] Indexes created and optimized
- [ ] Connection pooling configured

### Services:
- [ ] Redis configured and running (for production)
- [ ] Elasticsearch configured (optional)
- [ ] Email SMTP configured
- [ ] Firebase production credentials
- [ ] Razorpay production keys
- [ ] CDN for static files

### Monitoring:
- [ ] Error tracking (Sentry/similar)
- [ ] Performance monitoring (APM)
- [ ] Uptime monitoring
- [ ] Log aggregation
- [ ] Alerting configured

### Testing:
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Security audit done

---

## 📞 SUPPORT & RESOURCES

### Documentation:
- Main README: `MASTER_README.md`
- API Documentation: http://localhost:8000/docs
- Deployment Guide: `DEPLOYMENT.md`
- Quick Start: `QUICK_START_CHECKLIST.md`

### Debugging Scripts:
- `test-system.ps1` - Test all services
- `diagnose-oauth.ps1` - Diagnose Google OAuth
- `test-api.ps1` - Test all API endpoints

### Database Scripts:
- `backend\scripts\check_db_data.py` - Check database contents
- `backend\scripts\verify_system.py` - Verify system setup

### Firebase Console:
- Project: https://console.firebase.google.com/project/savitara-90a1c
- Authentication: Enable Google Sign-In
- Add authorized domains

### Google Cloud Console:
- Project: savitara-demo
- OAuth Credentials: Configure redirect URIs

---

## ✅ FINAL VERIFICATION

Run these commands to verify everything:

```powershell
# Test all systems
.\test-system.ps1

# Test API endpoints
.\test-api.ps1

# Diagnose OAuth
.\diagnose-oauth.ps1

# Check database
cd backend
python scripts\check_db_data.py

# Run tests
pytest tests\ -v
```

**If all tests pass, your system is READY! 🎉**

Navigate to http://localhost:3000 and start using the platform.

---

**Last Updated:** February 14, 2026  
**Status:** ✅ ALL SYSTEMS OPERATIONAL
