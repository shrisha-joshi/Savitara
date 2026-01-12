# 🚀 Savitara Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites Check
```powershell
# Check Python version (need 3.11+)
python --version

# Check if MongoDB is running
mongod --version

# Check if Redis is running
redis-cli ping
```

### Step 1: Install Dependencies (2 minutes)
```powershell
cd d:\Savitara\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Configure Environment (1 minute)
```powershell
# Copy environment template
copy .env.example .env

# Edit .env with your credentials
notepad .env
```

**Minimum required settings:**
```env
SECRET_KEY=your-secret-key-min-32-chars
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=savitara
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=your-jwt-secret-key-min-32-chars

# Get these from Google Cloud Console
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# For testing, use Razorpay test keys
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-test-secret
```

### Step 3: Start Server (30 seconds)
```powershell
# Activate virtual environment
.\venv\Scripts\activate

# Start FastAPI server
uvicorn app.main:app --reload
```

### Step 4: Test API (1 minute)
Open browser: `http://localhost:8000/api/docs`

Try the health check endpoint:
```
GET http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "components": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

## 🧪 Testing Google OAuth (Local Development)

### 1. Setup Google OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Savitara Dev"
3. Enable "Google+ API"
4. Configure OAuth consent screen:
   - User type: External
   - App name: Savitara
   - Scopes: email, profile, openid
5. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8000/auth/callback`
6. Copy Client ID and Secret to `.env`

### 2. Test Authentication Flow

Use this test HTML page (save as `test-auth.html`):

```html
<!DOCTYPE html>
<html>
<head>
    <title>Savitara Auth Test</title>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
    <h1>Test Google OAuth</h1>
    <div id="g_id_onload"
         data-client_id="YOUR_GOOGLE_CLIENT_ID"
         data-callback="handleCredentialResponse">
    </div>
    <div class="g_id_signin" data-type="standard"></div>
    
    <script>
        function handleCredentialResponse(response) {
            console.log("ID Token:", response.credential);
            
            // Send to backend
            fetch('http://localhost:8000/api/v1/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_token: response.credential,
                    role: 'grihasta'
                })
            })
            .then(res => res.json())
            .then(data => {
                console.log('Backend response:', data);
                alert('Login successful! Check console for tokens.');
            })
            .catch(err => {
                console.error('Error:', err);
                alert('Login failed. Check console.');
            });
        }
    </script>
</body>
</html>
```

Replace `YOUR_GOOGLE_CLIENT_ID` with your actual client ID.

### 3. Test with cURL

```bash
# First, get Google ID token from test-auth.html

# Then test API:
curl -X POST http://localhost:8000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "YOUR_GOOGLE_ID_TOKEN",
    "role": "grihasta"
  }'
```

## 📝 Common Tasks

### Create Test Data

```python
# Create test MongoDB data
python scripts/create_test_data.py
```

### Reset Database

```powershell
# Connect to MongoDB
mongosh

# Switch to Savitara database
use savitara

# Drop all collections
db.dropDatabase()

# Restart API (indexes will be recreated)
```

### Check Logs

```powershell
# Application logs
Get-Content logs/app.log -Tail 50 -Wait

# MongoDB logs
mongod --dbpath data/db --logpath logs/mongodb.log

# Redis logs
redis-server --loglevel debug
```

### Run SonarQube Analysis

```powershell
# Install SonarScanner
# Download from: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/

# Run analysis
sonar-scanner.bat
```

## 🐛 Troubleshooting

### "ModuleNotFoundError: No module named 'app'"
```powershell
# Make sure you're in backend directory
cd d:\Savitara\backend

# Activate virtual environment
.\venv\Scripts\activate

# Reinstall requirements
pip install -r requirements.txt
```

### "Connection refused" to MongoDB
```powershell
# Start MongoDB service
net start MongoDB

# Or start manually
mongod --dbpath="C:\data\db"
```

### "Connection refused" to Redis
```powershell
# Start Redis (if installed via WSL)
wsl redis-server

# Or use Docker
docker run -p 6379:6379 redis:alpine
```

### Google OAuth "redirect_uri_mismatch"
1. Check authorized redirect URIs in Google Console
2. Add: `http://localhost:8000/auth/callback`
3. Add: `http://localhost:8000` (for testing)

### "Invalid signature" on Razorpay webhook
1. Use Razorpay test mode keys
2. Verify webhook secret matches `.env`
3. Test with Razorpay webhook tool

## 📚 API Testing Guide

### Using Swagger UI

1. Go to `http://localhost:8000/api/docs`
2. Click "Authorize" button
3. Get access token from login endpoint
4. Enter: `Bearer YOUR_ACCESS_TOKEN`
5. Test endpoints

### Using Postman

1. Import API collection (generate from OpenAPI):
   - Export from: `http://localhost:8000/openapi.json`
2. Setup environment variables:
   ```
   base_url: http://localhost:8000
   access_token: (set after login)
   ```
3. Test flows:
   - Authentication
   - User onboarding
   - Search Acharyas
   - Create booking
   - Payment verification

### Sample API Flows

#### Flow 1: Grihasta Registration & Booking

```bash
# 1. Google Login
POST /api/v1/auth/google
{
  "id_token": "google_token_here",
  "role": "grihasta"
}

# Save access_token from response

# 2. Complete Onboarding
POST /api/v1/users/grihasta/onboarding
Authorization: Bearer {access_token}
{
  "name": "Rajesh Kumar",
  "phone": "+919876543210",
  "location": {
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India"
  },
  "parampara": "Shaiva"
}

# 3. Search Acharyas
GET /api/v1/users/acharyas?city=Mumbai&specialization=Vedanta
Authorization: Bearer {access_token}

# 4. Create Booking
POST /api/v1/bookings
Authorization: Bearer {access_token}
{
  "acharya_id": "507f1f77bcf86cd799439011",
  "pooja_id": "507f1f77bcf86cd799439012",
  "booking_type": "with_samagri",
  "date": "2026-02-01",
  "time": "10:00",
  "location": {
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India"
  }
}
```

## 🎯 Next Steps

1. **Test all endpoints** using Swagger UI
2. **Create sample data** for development
3. **Start mobile app** development
4. **Integrate payment gateway** (Razorpay test mode)
5. **Setup Firebase** for notifications

## 📞 Support

- Documentation: See `README.md` and `PROGRESS.md`
- Issues: Create GitHub issue
- Email: dev@savitara.com

---

Happy Coding! 🙏
