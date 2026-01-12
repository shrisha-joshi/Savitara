# Savitara Platform - Complete Project Structure

## 🏗️ Architecture Overview

```
Savitara/
├── backend/                    # FastAPI Backend API (Port 8000)
├── mobile-app/                 # React Native Mobile App (iOS/Android)
├── web-app/                    # React Web App - savitara.com (Port 3000)
├── admin-web/                  # Next.js Admin Dashboard - admin.savitara.com (Port 3001)
├── docker-compose.yml          # Multi-container orchestration
├── deploy.py                   # Deployment automation script
├── setup.sh                    # Linux/Mac setup script
├── setup.bat                   # Windows setup script
└── README.md                   # Main documentation
```

## 📱 Platform Components

### 1. **Backend API** (`backend/`)
- **Technology**: FastAPI, Python 3.11+
- **Database**: MongoDB (async Motor driver)
- **Cache**: Redis
- **Port**: 8000
- **Purpose**: Centralized API for all platforms
- **Deployment**: AWS EC2/ECS, Google Cloud Run, Heroku

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py           # Google OAuth authentication
│   │       ├── users.py          # User management, Acharya onboarding
│   │       ├── bookings.py       # Booking lifecycle, payments
│   │       ├── chat.py           # Real-time messaging
│   │       ├── reviews.py        # Review system
│   │       ├── admin.py          # Admin operations
│   │       └── analytics.py      # Analytics & reporting
│   ├── core/
│   │   ├── config.py             # Settings management
│   │   ├── security.py           # JWT, auth dependencies
│   │   └── exceptions.py         # Custom exceptions
│   ├── db/
│   │   ├── connection.py         # MongoDB connection
│   │   └── indexes.py            # Database indexes
│   ├── models/
│   │   └── database.py           # Pydantic models
│   ├── schemas/
│   │   └── requests.py           # Request/Response schemas
│   ├── services/
│   │   ├── payment_service.py    # Razorpay integration
│   │   └── notification_service.py # Firebase Cloud Messaging
│   ├── middleware/
│   │   └── rate_limit.py         # Rate limiting
│   └── main.py                   # FastAPI application
├── tests/
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── load/                     # Load tests (Locust)
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment variables template
├── Dockerfile                    # Container definition
└── README.md                     # Backend documentation
```

### 2. **Mobile App** (`mobile-app/`)
- **Technology**: React Native, Expo 50
- **Platform**: iOS, Android
- **UI Library**: React Native Paper (Material Design)
- **Purpose**: Main user interface for Grihasta & Acharya
- **Deployment**: App Store, Google Play Store

```
mobile-app/
├── src/
│   ├── context/
│   │   └── AuthContext.js        # Authentication state management
│   ├── navigation/
│   │   └── AppNavigator.js       # Navigation setup (Stack + Tabs)
│   ├── screens/
│   │   ├── common/
│   │   │   ├── OnboardingScreen.js      # User onboarding
│   │   │   ├── ProfileScreen.js         # Profile management
│   │   │   └── LoginScreen.js           # Google OAuth login
│   │   ├── grihasta/
│   │   │   ├── HomeScreen.js            # Featured Acharyas
│   │   │   ├── SearchAcharyasScreen.js  # Search & filter
│   │   │   ├── AcharyaDetailsScreen.js  # Acharya profile
│   │   │   ├── BookingScreen.js         # Create booking
│   │   │   ├── PaymentScreen.js         # Razorpay payment
│   │   │   ├── MyBookingsScreen.js      # Booking list
│   │   │   ├── BookingDetailsScreen.js  # Booking details
│   │   │   └── ReviewScreen.js          # Submit review
│   │   ├── acharya/
│   │   │   ├── DashboardScreen.js       # Stats & overview
│   │   │   ├── BookingRequestsScreen.js # Manage requests
│   │   │   ├── StartBookingScreen.js    # OTP verification
│   │   │   ├── AttendanceConfirmScreen.js # Confirm attendance
│   │   │   ├── EarningsScreen.js        # Revenue tracking
│   │   │   └── ReviewsScreen.js         # View reviews
│   │   └── chat/
│   │       ├── ChatListScreen.js        # Conversation list
│   │       └── ConversationScreen.js    # Chat interface
│   ├── services/
│   │   └── api.js                # API client with token management
│   └── App.js                    # Root component
├── assets/
│   ├── icon.png                  # App icon (1024x1024)
│   ├── splash.png                # Splash screen
│   └── adaptive-icon.png         # Android adaptive icon
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
├── .env.example                  # Environment variables
└── README.md                     # Mobile app documentation
```

### 3. **Web App** (`web-app/`) - **NEW**
- **Technology**: React 18, Vite, Material-UI
- **Domain**: savitara.com
- **Port**: 3000
- **Purpose**: Web interface for Grihasta & Acharya users
- **Deployment**: Vercel, Netlify, AWS S3 + CloudFront

```
web-app/
├── src/
│   ├── components/
│   │   ├── Layout.jsx            # Main layout with header/footer
│   │   ├── Navbar.jsx            # Navigation bar
│   │   ├── Footer.jsx            # Footer
│   │   ├── AcharyaCard.jsx       # Acharya listing card
│   │   ├── BookingCard.jsx       # Booking summary card
│   │   └── ReviewCard.jsx        # Review display card
│   ├── pages/
│   │   ├── Home.jsx              # Landing page
│   │   ├── Login.jsx             # Google OAuth login
│   │   ├── Onboarding.jsx        # User onboarding
│   │   ├── grihasta/
│   │   │   ├── Dashboard.jsx     # Grihasta dashboard
│   │   │   ├── SearchAcharyas.jsx # Search Acharyas
│   │   │   ├── AcharyaProfile.jsx # Acharya details
│   │   │   ├── CreateBooking.jsx  # Booking form
│   │   │   ├── Payment.jsx        # Payment processing
│   │   │   ├── MyBookings.jsx     # Booking management
│   │   │   ├── BookingDetails.jsx # Booking view
│   │   │   └── SubmitReview.jsx   # Review form
│   │   ├── acharya/
│   │   │   ├── Dashboard.jsx      # Acharya dashboard
│   │   │   ├── Bookings.jsx       # Manage bookings
│   │   │   ├── StartService.jsx   # OTP entry
│   │   │   ├── Earnings.jsx       # Revenue analytics
│   │   │   ├── Reviews.jsx        # View reviews
│   │   │   └── Settings.jsx       # Profile settings
│   │   ├── chat/
│   │   │   ├── Conversations.jsx  # Chat list
│   │   │   └── Chat.jsx           # Chat interface
│   │   └── Profile.jsx            # User profile
│   ├── context/
│   │   └── AuthContext.jsx        # Auth state management
│   ├── services/
│   │   ├── api.js                 # API client
│   │   └── firebase.js            # Firebase config
│   ├── hooks/
│   │   ├── useAuth.js             # Auth hook
│   │   └── useApi.js              # API hook
│   ├── utils/
│   │   ├── constants.js           # App constants
│   │   └── helpers.js             # Utility functions
│   ├── App.jsx                    # Root component
│   └── main.jsx                   # Entry point
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── index.html
├── vite.config.js                 # Vite configuration
├── package.json
├── .env.example
└── README.md
```

### 4. **Admin Dashboard** (`admin-web/`)
- **Technology**: Next.js 14, Material-UI
- **Domain**: admin.savitara.com
- **Port**: 3001
- **Purpose**: Admin operations & analytics
- **Deployment**: Vercel, Netlify

```
admin-web/
├── pages/
│   ├── index.js                  # Dashboard (Analytics)
│   ├── login.js                  # Admin login
│   ├── users.js                  # User management
│   ├── verifications.js          # Acharya verification queue
│   ├── reviews.js                # Review moderation
│   ├── broadcast.js              # Push notifications
│   └── _app.js                   # App wrapper
├── src/
│   ├── components/
│   │   ├── Layout.js             # Admin layout
│   │   ├── StatCard.js           # Statistics card
│   │   ├── UserTable.js          # User data table
│   │   ├── VerificationCard.js   # Verification request card
│   │   └── ReviewCard.js         # Review moderation card
│   ├── context/
│   │   └── AuthContext.js        # Auth state
│   ├── services/
│   │   └── api.js                # API client
│   └── utils/
│       └── constants.js          # Constants
├── public/
├── package.json
├── next.config.js
├── .env.local.example
├── Dockerfile
└── README.md
```

## 🌐 Deployment Architecture

### Local Development
```
┌─────────────────────────────────────────────────────────┐
│                    Developer Machine                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Backend API          Mobile App         Web App        │
│  localhost:8000       Expo Go            localhost:3000 │
│                       iOS/Android                        │
│                                                          │
│  Admin Dashboard                                         │
│  localhost:3001                                          │
│                                                          │
│  MongoDB              Redis                              │
│  localhost:27017      localhost:6379                     │
└─────────────────────────────────────────────────────────┘
```

### Production Deployment
```
┌─────────────────────────────────────────────────────────┐
│                     Cloud Infrastructure                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Backend API                                             │
│  ├── AWS EC2/ECS                                         │
│  ├── Google Cloud Run                                    │
│  └── api.savitara.com                                    │
│                                                          │
│  Web App                                                 │
│  ├── Vercel/Netlify                                      │
│  ├── AWS S3 + CloudFront                                 │
│  └── savitara.com                                        │
│                                                          │
│  Admin Dashboard                                         │
│  ├── Vercel/Netlify                                      │
│  └── admin.savitara.com                                  │
│                                                          │
│  Mobile App                                              │
│  ├── App Store (iOS)                                     │
│  └── Google Play Store (Android)                         │
│                                                          │
│  Database & Cache                                        │
│  ├── MongoDB Atlas                                       │
│  └── Redis Cloud                                         │
│                                                          │
│  CDN & Security                                          │
│  ├── Cloudflare (DDoS, WAF)                              │
│  └── SSL/TLS Certificates                                │
└─────────────────────────────────────────────────────────┘
```

## 🔗 API Endpoints Structure

### Authentication
- `POST /api/v1/auth/google` - Google OAuth login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Users
- `GET /api/v1/users/me` - Current user profile
- `PUT /api/v1/users/me` - Update profile
- `POST /api/v1/users/onboard/grihasta` - Grihasta onboarding
- `POST /api/v1/users/onboard/acharya` - Acharya onboarding
- `GET /api/v1/users/acharyas` - Search Acharyas
- `GET /api/v1/users/acharyas/{id}` - Acharya details

### Bookings
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings` - List bookings
- `GET /api/v1/bookings/{id}` - Booking details
- `POST /api/v1/bookings/{id}/payment/create` - Create payment order
- `POST /api/v1/bookings/{id}/payment/verify` - Verify payment
- `POST /api/v1/bookings/{id}/start` - Start service (OTP)
- `POST /api/v1/bookings/{id}/confirm-attendance` - Confirm attendance

### Chat
- `POST /api/v1/chat/conversations` - Create conversation
- `GET /api/v1/chat/conversations` - List conversations
- `POST /api/v1/chat/messages` - Send message
- `GET /api/v1/chat/messages` - Get messages

### Reviews
- `POST /api/v1/reviews` - Submit review
- `GET /api/v1/reviews/acharya/{id}` - Acharya reviews
- `GET /api/v1/reviews/grihasta/{id}` - My reviews

### Admin
- `GET /api/v1/admin/analytics` - Dashboard analytics
- `GET /api/v1/admin/users` - User management
- `POST /api/v1/admin/users/{id}/suspend` - Suspend user
- `GET /api/v1/admin/verifications` - Verification queue
- `POST /api/v1/admin/verifications/{id}` - Approve/Reject
- `GET /api/v1/admin/reviews/pending` - Pending reviews
- `POST /api/v1/admin/reviews/{id}/moderate` - Moderate review
- `POST /api/v1/admin/broadcast` - Broadcast notification

## 🔒 Security Features

### Backend
- JWT authentication with refresh tokens
- bcrypt password hashing (12 rounds)
- Rate limiting (100 req/min per IP)
- CORS protection
- Input validation with Pydantic
- SQL injection prevention
- XSS protection
- HMAC-SHA256 payment verification

### Frontend
- HttpOnly cookies (where applicable)
- Token auto-refresh
- Secure local storage
- HTTPS enforcement
- CSP headers
- XSS sanitization

## 📊 Database Schema

### Collections
- `users` - User profiles (Grihasta, Acharya, Admin)
- `bookings` - Booking records
- `messages` - Chat messages
- `conversations` - Chat conversations
- `reviews` - Review records
- `notifications` - User notifications
- `transactions` - Payment transactions

### Indexes (30+)
- User email (unique)
- Booking status + dates
- Message timestamps
- Review ratings
- Acharya specializations
- Location-based queries

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourorg/savitara.git
cd Savitara
```

### 2. Setup All Components
```bash
# Windows
setup.bat

# Linux/Mac
chmod +x setup.sh
./setup.sh
```

### 3. Configure Environment Variables
- Copy `.env.example` files in each directory
- Fill in required credentials (MongoDB, Redis, Google OAuth, Razorpay, Firebase)

### 4. Start Development
```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Web App
cd web-app && npm run dev

# Admin Dashboard
cd admin-web && npm run dev

# Mobile App
cd mobile-app && npm start
```

### 5. Docker Deployment
```bash
docker-compose up -d
```

## 📈 Testing Strategy

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=app
```

### Frontend Tests
```bash
# Web App
cd web-app && npm test

# Admin Dashboard
cd admin-web && npm test

# Mobile App
cd mobile-app && npm test
```

### E2E Tests
```bash
# Mobile App E2E
cd mobile-app
detox build --configuration ios.sim.debug
detox test --configuration ios.sim.debug
```

## 📝 Documentation

- [Main README](README.md) - Overview & setup
- [Backend README](backend/README.md) - API documentation
- [Web App README](web-app/README.md) - Web app guide
- [Mobile App README](mobile-app/README.md) - Mobile app guide
- [Admin README](admin-web/README.md) - Admin dashboard guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [TESTING.md](TESTING.md) - Testing guide
- [CHANGELOG.md](CHANGELOG.md) - Version history

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📞 Support

- **Backend Issues**: backend-team@savitara.com
- **Frontend Issues**: frontend-team@savitara.com
- **Mobile Issues**: mobile-team@savitara.com
- **DevOps**: devops@savitara.com

## 📄 License

Proprietary - All rights reserved
