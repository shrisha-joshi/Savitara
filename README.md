# Savitara - Spiritual Platform

Complete end-to-end spiritual consultation platform connecting Grihastas (users) with Acharyas (spiritual guides) for authentic Hindu rituals and consultations.

## 🌟 Features

### For Grihastas (Users)
- Browse and search verified Acharyas by specialization, location, and rating
- Book services with flexible scheduling
- Secure Razorpay payment integration
- Real-time chat with Acharyas
- OTP-based service verification
- Two-way attendance confirmation
- Review and rating system
- Referral rewards program

### For Acharyas (Service Providers)
- Profile management with verification
- Availability and service management
- Booking requests handling
- OTP verification for service start
- Earnings tracking
- Chat with Grihastas
- Review management

### For Admins
- Comprehensive analytics dashboard
- User growth and revenue trends
- Acharya verification workflow
- Review moderation
- User management (suspend/unsuspend)
- Broadcast notifications
- Platform overview metrics

## 🏗️ Architecture

### Backend API (FastAPI + MongoDB)
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** MongoDB (async Motor)
- **Cache:** Redis
- **Authentication:** Google OAuth 2.0 + JWT
- **Payment:** Razorpay
- **Notifications:** Firebase Cloud Messaging
- **Security:** bcrypt, rate limiting, CORS

**API Endpoints:** 44 REST endpoints across 6 routers
- `/api/v1/auth` - Authentication (4 endpoints)
- `/api/v1/users` - User management (6 endpoints)
- `/api/v1/bookings` - Booking lifecycle (6 endpoints)
- `/api/v1/chat` - Messaging (6 endpoints)
- `/api/v1/reviews` - Review system (8 endpoints)
- `/api/v1/admin` - Admin operations (10 endpoints)

### Mobile App (React Native + Expo)
- **Framework:** React Native with Expo 50
- **UI:** React Native Paper (Material Design)
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **State:** Context API
- **Chat:** Gifted Chat
- **Auth:** expo-auth-session (Google OAuth)
- **Notifications:** expo-notifications
- **Platforms:** iOS, Android, Web

**Screens:** 25+ screens
- Authentication (Login, Onboarding)
- Grihasta: Home, Search, Booking, Chat, Profile
- Acharya: Dashboard, Requests, Earnings, Management
- Shared: Chat, Profile, Settings

### Admin Dashboard (Next.js)
- **Framework:** Next.js 14
- **UI:** Material-UI (MUI)
- **Charts:** Recharts
- **State:** Context API
- **Pages:** Dashboard, Users, Verifications, Reviews, Broadcast

## 📁 Project Structure

```
savitara/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/            # API endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── bookings.py
│   │   │   ├── chat.py
│   │   │   ├── reviews.py
│   │   │   └── admin.py
│   │   ├── core/              # Configuration
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── exceptions.py
│   │   ├── models/            # Data models
│   │   │   └── database.py
│   │   ├── schemas/           # Request/response schemas
│   │   │   └── requests.py
│   │   ├── services/          # Business logic
│   │   │   ├── payment_service.py
│   │   │   └── notification_service.py
│   │   └── main.py            # App entry
│   ├── requirements.txt
│   └── README.md
│
├── mobile-app/                 # React Native Mobile
│   ├── src/
│   │   ├── screens/           # UI screens
│   │   │   ├── auth/
│   │   │   ├── grihasta/
│   │   │   ├── acharya/
│   │   │   ├── chat/
│   │   │   └── common/
│   │   ├── navigation/        # App navigation
│   │   ├── services/          # API calls
│   │   ├── context/           # State management
│   │   └── config/            # Configuration
│   ├── App.js
│   ├── package.json
│   └── README.md
│
└── admin-web/                  # Next.js Admin Dashboard
    ├── pages/                  # Next.js pages
    │   ├── index.js           # Dashboard
    │   ├── users.js
    │   ├── verifications.js
    │   ├── reviews.js
    │   ├── broadcast.js
    │   └── login.js
    ├── src/
    │   ├── components/        # Reusable components
    │   ├── context/           # Auth context
    │   ├── services/          # API service
    │   └── hoc/               # Higher-order components
    ├── package.json
    └── README.md
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+
- Expo CLI (for mobile app)
- Google OAuth credentials
- Razorpay account
- Firebase project (for notifications)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Configure .env (see backend/.env.example)
# Add MongoDB URI, Redis URL, Google OAuth credentials, etc.

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will run at: http://localhost:8000
API Docs: http://localhost:8000/docs

### 2. Mobile App Setup

```bash
cd mobile-app

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure .env with backend URL and credentials

# Start Expo development server
npm start

# Run on iOS: npm run ios
# Run on Android: npm run android
```

### 3. Admin Dashboard Setup

```bash
cd admin-web

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Configure backend API URL

# Run development server
npm run dev
```

Admin dashboard will run at: http://localhost:3001

## 🔧 Configuration

### Backend (.env)
```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/savitara

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Razorpay
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Mobile App (.env)
```bash
API_BASE_URL=http://localhost:8000/api/v1
GOOGLE_CLIENT_ID=your-google-client-id
RAZORPAY_KEY_ID=your-razorpay-key-id
```

### Admin Dashboard (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## 🧪 Testing

### Backend
```bash
cd backend
# Run tests (when implemented)
pytest tests/
```

### Mobile App
```bash
cd mobile-app
npm test
```

### Admin Dashboard
```bash
cd admin-web
npm test
```

## 📊 Database Schema

### Collections
- **users** - User accounts (Grihasta, Acharya, Admin)
- **bookings** - Service bookings
- **conversations** - Chat conversations
- **messages** - Chat messages
- **reviews** - User reviews
- **referrals** - Referral tracking
- **notifications** - Push notifications
- **panchanga_events** - Hindu calendar events

**Indexes:** 30+ indexes for optimal query performance

## 🔐 Security Features

- Google OAuth 2.0 authentication
- JWT token-based authorization (access + refresh tokens)
- bcrypt password hashing (12 rounds)
- Rate limiting (100 requests/minute per IP)
- CORS protection
- Input validation with Pydantic
- SonarQube compliance
- Secure payment signature verification (HMAC-SHA256)

## 📱 Mobile App Features

### Grihasta Screens (12)
1. Login with Google
2. Onboarding (profile setup)
3. Home (featured Acharyas)
4. Search Acharyas (filters: specialization, rating, price)
5. Acharya Details
6. Booking (calendar, time, duration)
7. Payment (Razorpay integration)
8. My Bookings (filter by status)
9. Booking Details (OTP, attendance)
10. Chat List
11. Conversation (real-time messaging)
12. Profile & Settings

### Acharya Screens (10)
1. Dashboard (stats, earnings)
2. Booking Requests
3. Manage Availability
4. Manage Services
5. Start Booking (OTP verification)
6. Confirm Attendance
7. Earnings Tracker
8. Reviews
9. Chat
10. Profile & Settings

## 🌐 Admin Dashboard Pages

1. **Dashboard** - Analytics overview with charts
2. **Users** - Search, suspend/unsuspend users
3. **Verifications** - Approve/reject Acharya applications
4. **Reviews** - Moderate user reviews
5. **Broadcast** - Send push notifications
6. **Login** - Admin authentication

## 📦 Dependencies

### Backend (Python)
- fastapi - Web framework
- uvicorn - ASGI server
- motor - Async MongoDB driver
- redis - Redis client
- pydantic - Data validation
- python-jose - JWT handling
- passlib - Password hashing
- google-auth - Google OAuth
- razorpay - Payment gateway
- firebase-admin - Push notifications
- slowapi - Rate limiting

### Mobile App (JavaScript)
- react-native - Mobile framework
- expo - Development platform
- react-navigation - Navigation
- react-native-paper - UI components
- axios - HTTP client
- expo-auth-session - OAuth
- expo-notifications - Push notifications
- react-native-gifted-chat - Chat interface
- react-native-calendars - Date picker

### Admin Dashboard (JavaScript)
- next - React framework
- @mui/material - UI components
- recharts - Data visualization
- axios - HTTP client
- date-fns - Date utilities

## 🚢 Deployment

### Backend (FastAPI)
```bash
# Docker deployment
docker build -t savitara-backend .
docker run -p 8000:8000 savitara-backend

# Or deploy to:
# - AWS EC2 / ECS
# - Google Cloud Run
# - Heroku
# - DigitalOcean
```

### Mobile App
```bash
# Build for production
cd mobile-app

# Android
eas build --platform android

# iOS
eas build --platform ios

# Submit to stores
eas submit
```

### Admin Dashboard
```bash
# Build and deploy
cd admin-web
npm run build

# Deploy to Vercel
vercel deploy

# Or any Node.js hosting
npm start
```

## 📝 API Documentation

Interactive API documentation available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Team

Developed for connecting traditional Hindu spiritual guides with seekers.

## 📞 Support

For issues and questions:
- Backend issues: See [backend/README.md](backend/README.md)
- Mobile app: See [mobile-app/README.md](mobile-app/README.md)
- Admin dashboard: See [admin-web/README.md](admin-web/README.md)

## 🗺️ Roadmap

### Phase 1 (Completed)
- ✅ Backend API (44 endpoints)
- ✅ Mobile app (25+ screens)
- ✅ Admin dashboard (6 pages)
- ✅ Authentication & authorization
- ✅ Booking system
- ✅ Payment integration
- ✅ Chat functionality
- ✅ Review system

### Phase 2 (Future)
- ⏳ Real-time WebSocket chat
- ⏳ Video consultation
- ⏳ Panchanga integration
- ⏳ Advanced analytics
- ⏳ Multi-language support
- ⏳ Email notifications
- ⏳ SMS notifications
- ⏳ Advanced search filters

## 🎯 Key Metrics

- **API Endpoints:** 44
- **Mobile Screens:** 25+
- **Admin Pages:** 6
- **Database Collections:** 8
- **Database Indexes:** 30+
- **Backend Files:** 23
- **Mobile Components:** 25+
- **Admin Components:** 9

---

Made with ❤️ for preserving and promoting traditional Hindu spiritual practices.
