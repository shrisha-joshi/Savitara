# Testing Guide for Savitara Platform

## Testing Strategy

### 1. Backend Testing

#### Unit Tests
```bash
cd backend
pytest tests/unit/ -v --cov=app
```

#### Integration Tests
```bash
pytest tests/integration/ -v
```

#### API Tests (using Swagger UI)
1. Navigate to http://localhost:8000/docs
2. Test each endpoint with sample data
3. Verify responses and status codes

#### Load Testing
```bash
# Install locust
pip install locust

# Run load tests
locust -f backend/tests/load/locustfile.py --host=http://localhost:8000
```

### 2. Mobile App Testing

#### Unit Tests
```bash
cd mobile-app
npm test
```

#### E2E Tests (using Detox)
```bash
# Install detox
npm install -g detox-cli

# Build and test
detox build --configuration ios.sim.debug
detox test --configuration ios.sim.debug
```

#### Manual Testing Checklist

**Authentication Flow:**
- [ ] Google OAuth login works
- [ ] Token refresh works
- [ ] Logout clears session
- [ ] Onboarding for Grihasta
- [ ] Onboarding for Acharya

**Grihasta Features:**
- [ ] View featured Acharyas
- [ ] Search and filter Acharyas
- [ ] View Acharya details
- [ ] Create booking with calendar
- [ ] Payment flow (test mode)
- [ ] View booking list
- [ ] View booking details with OTP
- [ ] Chat with Acharya
- [ ] Confirm attendance
- [ ] Submit review

**Acharya Features:**
- [ ] View dashboard with stats
- [ ] View booking requests
- [ ] Start booking with OTP
- [ ] Confirm attendance
- [ ] View earnings
- [ ] Chat with Grihasta
- [ ] View reviews
- [ ] Manage availability
- [ ] Manage services

**Edge Cases:**
- [ ] Handle network errors
- [ ] Handle expired tokens
- [ ] Handle invalid OTP
- [ ] Handle payment failures
- [ ] Handle empty states

### 3. Admin Dashboard Testing

#### Component Tests
```bash
cd admin-web
npm test
```

#### Manual Testing Checklist

**Dashboard:**
- [ ] View statistics cards
- [ ] User growth chart loads
- [ ] Revenue chart loads
- [ ] Real-time data updates

**User Management:**
- [ ] Search users
- [ ] View user details
- [ ] Suspend user
- [ ] Unsuspend user

**Acharya Verification:**
- [ ] View pending verifications
- [ ] Approve Acharya
- [ ] Reject Acharya with reason
- [ ] Notifications sent

**Review Moderation:**
- [ ] View pending reviews
- [ ] Approve review
- [ ] Reject review with reason

**Broadcast:**
- [ ] Send notification to all users
- [ ] Send to Grihastas only
- [ ] Send to Acharyas only
- [ ] Verify notifications received

## Test Data

### Test Users

**Grihasta (User):**
```json
{
  "email": "grihasta@test.com",
  "full_name": "Test Grihasta",
  "phone_number": "+919876543210",
  "location": "Mumbai, Maharashtra"
}
```

**Acharya (Provider):**
```json
{
  "email": "acharya@test.com",
  "full_name": "Pandit Test Sharma",
  "phone_number": "+919876543211",
  "location": "Varanasi, UP",
  "specializations": ["Vedic Rituals", "Vivaha", "Namkaran"],
  "experience_years": 10,
  "hourly_rate": 500
}
```

**Admin:**
```json
{
  "email": "admin@savitara.com",
  "full_name": "Admin User",
  "role": "admin"
}
```

### Test Payments

**Razorpay Test Card:**
- Card Number: 4111 1111 1111 1111
- CVV: Any 3 digits
- Expiry: Any future date
- Result: Success

**Razorpay Test Card (Failure):**
- Card Number: 4000 0000 0000 0002
- Result: Payment failed

## Automated Testing Scripts

### API Health Check
```bash
#!/bin/bash
curl -f http://localhost:8000/health || exit 1
echo "✅ Backend health check passed"
```

### Database Connection Test
```bash
#!/bin/bash
cd backend
python -c "from app.db.connection import get_db; import asyncio; asyncio.run(get_db())" && echo "✅ Database connection successful"
```

### Mobile App Build Test
```bash
#!/bin/bash
cd mobile-app
npm run build || exit 1
echo "✅ Mobile app build successful"
```

## Performance Benchmarks

### Backend
- Average response time: < 200ms
- 95th percentile: < 500ms
- Requests per second: > 100
- Database queries: < 50ms

### Mobile App
- App launch time: < 3s
- Screen transitions: < 100ms
- API calls: < 1s
- Image loading: < 500ms

### Admin Dashboard
- Page load time: < 2s
- Chart rendering: < 500ms
- Table filtering: < 100ms

## Bug Reporting

### Template
```markdown
**Title:** Brief description

**Environment:**
- Platform: iOS/Android/Web/Backend
- Version: 1.0.0
- Device: iPhone 14 Pro / Pixel 7

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Screenshots:**
Attach screenshots/videos

**Logs:**
Attach relevant logs
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run backend tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ -v

  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run mobile tests
        run: |
          cd mobile-app
          npm install
          npm test

  admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run admin tests
        run: |
          cd admin-web
          npm install
          npm test
```
