# Savitara Backend API

Spiritual platform connecting Grihastas (householders) with Acharyas (spiritual scholars) for traditional Hindu rituals, consultations, and Panchanga services.

## 🏗️ Tech Stack

- **FastAPI** - Modern Python web framework
- **MongoDB** - NoSQL database with Motor async driver
- **Redis** - Caching and rate limiting
- **Google OAuth** - Secure authentication
- **Razorpay** - Payment gateway integration
- **Firebase** - Push notifications
- **SonarQube** - Code quality and security scanning

## 📋 Prerequisites

- Python 3.11+
- MongoDB 6.0+
- Redis 7.0+
- Google Cloud Platform account (OAuth credentials)
- Razorpay account (API keys)
- Firebase project (Admin SDK credentials)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd d:\Savitara\backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
copy .env.example .env
```

Required environment variables:

```env
# Application
APP_NAME=Savitara API
API_VERSION=1.0.0
APP_ENV=development
DEBUG=true
SECRET_KEY=your-secret-key-here

# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=savitara
REDIS_URL=redis://localhost:6379/0

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret

# Firebase
FIREBASE_CREDENTIALS_PATH=./firebase-key.json

# JWT
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 3. Run Database Migrations

MongoDB indexes are created automatically on application startup. To manually trigger:

```bash
python -c "from app.db.connection import DatabaseManager; import asyncio; asyncio.run(DatabaseManager.create_indexes())"
```

### 4. Start Development Server

```bash
uvicorn app.main:app --reload --port 8000
```

API will be available at: `http://localhost:8000`

Interactive docs: `http://localhost:8000/api/docs`

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/v1/auth/google`
Authenticate with Google OAuth and get JWT tokens.

**Request:**
```json
{
  "id_token": "Google_ID_token_here",
  "role": "grihasta"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "role": "grihasta",
      "is_new_user": true
    }
  }
}
```

#### POST `/api/v1/auth/refresh`
Refresh access token.

#### GET `/api/v1/auth/me`
Get current user information (requires authentication).

### User Endpoints

#### POST `/api/v1/users/grihasta/onboarding`
Complete Grihasta onboarding questionnaire.

#### POST `/api/v1/users/acharya/onboarding`
Complete Acharya onboarding (requires admin verification).

#### GET `/api/v1/users/profile`
Get current user's profile.

#### PUT `/api/v1/users/profile`
Update user profile.

#### GET `/api/v1/users/acharyas`
Search Acharyas with filters (city, specialization, language, rating).

#### GET `/api/v1/users/acharyas/{acharya_id}`
Get detailed Acharya profile.

### Booking Endpoints

#### POST `/api/v1/bookings`
Create new booking with payment.

#### POST `/api/v1/bookings/{booking_id}/payment/verify`
Verify Razorpay payment signature.

#### POST `/api/v1/bookings/{booking_id}/start`
Start booking with OTP verification (Acharya only).

#### POST `/api/v1/bookings/{booking_id}/attendance/confirm`
Two-way attendance confirmation.

#### GET `/api/v1/bookings/my-bookings`
Get user's bookings (Grihasta or Acharya).

#### GET `/api/v1/bookings/{booking_id}`
Get booking details.

## 🔒 Security Features (SonarQube Compliant)

### Implemented Security Rules

- **S6437**: No hardcoded credentials (environment variables)
- **S5659**: Strong password hashing with bcrypt (12 rounds)
- **S4790**: Rate limiting with Redis (DoS protection)
- **S5122**: Proper CORS configuration
- **S2095**: Resource management (database connections)
- **S4502**: Webhook signature verification (Razorpay)
- **S1192**: No string duplication
- **S2068**: No passwords in code

### Authentication Flow

1. User authenticates via Google OAuth
2. Backend verifies Google ID token
3. JWT tokens generated (access + refresh)
4. Tokens used for subsequent API calls
5. Role-based access control (RBAC)

### Two-Way Attendance Confirmation

Both Grihasta and Acharya must confirm attendance within 24 hours:
- Prevents fraudulent payment claims
- Ensures both parties attended
- Payment released only after both confirmations

## 🧪 Testing

Run tests with pytest:

```bash
pytest tests/ -v
```

Run with coverage:

```bash
pytest tests/ --cov=app --cov-report=html
```

## 📊 Code Quality

### SonarQube Analysis

```bash
sonar-scanner
```

Configuration in `sonar-project.properties`.

### Linting

```bash
# Flake8
flake8 app/ --max-line-length=120

# Black (formatting)
black app/

# isort (import sorting)
isort app/
```

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py          # Authentication endpoints
│   │       ├── users.py         # User management
│   │       ├── bookings.py      # Booking system
│   │       └── __init__.py
│   ├── core/
│   │   ├── config.py            # Configuration management
│   │   ├── security.py          # JWT, hashing, RBAC
│   │   └── exceptions.py        # Custom exceptions
│   ├── db/
│   │   └── connection.py        # MongoDB connection
│   ├── middleware/
│   │   └── rate_limit.py        # Rate limiting
│   ├── models/
│   │   └── database.py          # Pydantic models
│   ├── schemas/
│   │   └── requests.py          # API schemas
│   ├── services/                # Business logic (TODO)
│   ├── utils/                   # Utilities (TODO)
│   └── main.py                  # FastAPI app
├── tests/                       # Test suite (TODO)
├── .env.example                 # Environment template
├── .gitignore                   # Git exclusions
├── requirements.txt             # Python dependencies
├── sonar-project.properties     # SonarQube config
└── README.md                    # This file
```

## 🔄 Development Workflow

### Phase 1: Foundation ✅
- [x] Project structure
- [x] Configuration management
- [x] Security layer (JWT, bcrypt)
- [x] Database connection
- [x] Models and schemas
- [x] Authentication API
- [x] User management API
- [x] Booking API

### Phase 2: Core Features (In Progress)
- [ ] Chat system
- [ ] Review system
- [ ] Admin dashboard API
- [ ] Panchanga integration
- [ ] Payment webhook handlers
- [ ] Notification service

### Phase 3: Advanced Features
- [ ] Real-time chat (WebSocket)
- [ ] Video consultations
- [ ] Analytics dashboard
- [ ] Recommendation engine
- [ ] Multi-language support

## 🐛 Common Issues

### MongoDB Connection Failed
- Ensure MongoDB is running: `mongod --version`
- Check connection string in `.env`
- Verify network access

### Redis Connection Failed
- Ensure Redis is running: `redis-cli ping`
- Check Redis URL in `.env`

### Google OAuth Error
- Verify `GOOGLE_CLIENT_ID` matches your OAuth app
- Ensure redirect URIs are configured in Google Console
- Check token expiration

### Payment Verification Failed
- Verify Razorpay webhook signature
- Check `RAZORPAY_KEY_SECRET` in `.env`
- Test with Razorpay test mode first

## 📝 API Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2026-01-01T12:00:00Z"
}
```

Error responses:

```json
{
  "error_code": "AUTH_001",
  "message": "Invalid credentials",
  "details": {},
  "status_code": 401
}
```

## 🚦 Rate Limiting

Default rate limits:
- **Authentication**: 10 requests/minute
- **General API**: 60 requests/minute
- **Admin API**: 100 requests/minute

Exceeded limits return `429 Too Many Requests`.

## 📧 Support

- **Email**: dev@savitara.com
- **Documentation**: https://docs.savitara.com
- **Issues**: https://github.com/savitara/backend/issues

## 📄 License

Proprietary - All rights reserved © 2026 Savitara

---

Built with ❤️ by the Savitara Team
