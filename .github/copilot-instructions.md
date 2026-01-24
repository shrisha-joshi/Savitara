# Savitara Platform - AI Coding Agent Instructions

## Project Overview
Savitara is a spiritual consultation platform connecting Grihastas (users) with Acharyas (Hindu spiritual guides). It's a **production-ready multi-platform system** with 4 frontend apps (2 mobile, 2 web) and 1 FastAPI backend.

**Key Stack:** FastAPI + MongoDB + Redis | React Native (Expo) | Next.js | React + Vite

## Architecture & Data Flow

### Service Boundaries
- **Backend (`backend/`)**: Single FastAPI app (port 8000) with 44 REST endpoints across 8 routers (`/api/v1/{auth,users,bookings,chat,reviews,admin,analytics,wallet,panchanga}`)
- **Savitara App (`savitara-app/`)**: React Native + Expo - main user/Acharya mobile app (25+ screens)
- **Savitara Web (`savitara-web/`)**: React + Vite - responsive web version for users
- **Admin Web (`admin-savitara-web/`)**: Next.js - admin dashboard (port 3001)
- **Admin App (`admin-savitara-app/`)**: React Native - mobile admin interface

### Critical Data Flow
1. **Auth**: Google OAuth → JWT tokens (access + refresh) → stored in AsyncStorage/localStorage
2. **Bookings**: Request → Payment (Razorpay) → OTP verification → Attendance confirmation → Review
3. **Real-time**: WebSocket connections managed via `websocket_manager.py` for chat and live updates
4. **Database**: MongoDB collections: `users`, `bookings`, `chats`, `reviews`, `payments`, `wallet_transactions`, `notifications`

### Why This Structure?
- **Monolith API**: Single backend simplifies deployment, auth, and cross-feature queries vs. microservices overhead
- **Dual Apps**: Native mobile (Expo) for performance + web (React/Next.js) for SEO and accessibility
- **MongoDB**: Document model fits dynamic user profiles (Acharyas have specializations, Grihastas have booking history)

## Development Workflows

### Starting Services
```bash
# Backend (always start first)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Mobile Apps (Expo)
cd savitara-app  # or admin-savitara-app
npm install
npx expo start

# Web Apps
cd savitara-web && npm install && npm run dev  # Port 3000
cd admin-savitara-web && npm install && npm run dev  # Port 3001
```

### Testing
```bash
# Backend tests (requires MongoDB + Redis running)
cd backend
pytest tests/ -v --cov=app

# Load testing
locust -f tests/load/locustfile.py --host=http://localhost:8000
```

### Database Setup
MongoDB connection is async via Motor. **Critical**: Indexes are created on startup in [`db/connection.py`](backend/app/db/connection.py#L88). Never query without appropriate indexes (check `create_indexes()` method).

## Project-Specific Conventions

### Backend Patterns
1. **Async Everything**: All database operations use `async/await` with Motor. Never use blocking `pymongo`.
2. **Dependency Injection**: Auth uses FastAPI dependencies: `current_user = Depends(get_current_user)`. See [`core/security.py`](backend/app/core/security.py) for auth dependencies.
3. **Error Handling**: Custom exceptions in [`core/exceptions.py`](backend/app/core/exceptions.py). Use `SavitaraException` subclasses, not raw `HTTPException`.
4. **Services Layer**: Business logic in `services/` (e.g., [`payment_service.py`](backend/app/services/payment_service.py) for Razorpay). Controllers in `api/v1/` should be thin.
5. **Pydantic Models**: Database models in [`models/database.py`](backend/app/models/database.py) use custom `PyObjectId` for MongoDB `_id` handling.

### Frontend Patterns
1. **Context API**: All apps use Context for state (no Redux). See [`AuthContext.js`](savitara-app/src/context/AuthContext.js) - handles token refresh, role-based rendering.
2. **API Calls**: Centralized in `services/api.js`. Always use token interceptors. Example:
   ```javascript
   // services/api.js handles token refresh automatically
   await api.post('/bookings', bookingData);
   ```
3. **Navigation**: React Navigation with role-based stacks. Acharya/Grihasta see different home screens despite same app binary.
4. **Environment**: Use `.env` files. Never commit keys. Check [`.env.example`](backend/.env.example) for required vars.

### Security Requirements
- **CORS**: Configured in [`main.py`](backend/app/main.py#L30). Never use wildcard `*` in production.
- **Rate Limiting**: Redis-backed limiter in [`middleware/rate_limit.py`](backend/app/middleware/rate_limit.py). Apply to auth endpoints.
- **Secrets**: Use `settings` from [`core/config.py`](backend/app/core/config.py). Never hardcode credentials.
- **SonarQube**: Code includes SonarQube compliance comments (e.g., `# SonarQube: S6437`). Maintain these patterns.

## Integration Points

### External Services
1. **Razorpay**: Payment gateway. Integration in [`services/payment_service.py`](backend/app/services/payment_service.py). Use test keys in dev (test_xxx).
2. **Firebase**: Push notifications via FCM. Config in [`services/notification_service.py`](backend/app/services/notification_service.py). Requires `firebase-key.json`.
3. **Google OAuth**: Auth flow in [`api/v1/auth.py`](backend/app/api/v1/auth.py). Mobile uses `expo-auth-session`, web uses standard OAuth2 flow.
4. **Elasticsearch**: Optional search service in [`services/search_service.py`](backend/app/services/search_service.py). Gracefully degrades if unavailable.

### Cross-Component Communication
- **Mobile ↔ Backend**: REST APIs + WebSockets. Token in `Authorization: Bearer <token>` header.
- **Admin ↔ Backend**: Same API, different endpoints (`/admin/*` require admin role check).
- **Real-time Chat**: WebSocket connections at `/ws/chat/{user_id}`. Managed by [`websocket_manager.py`](backend/app/services/websocket_manager.py).

## Common Pitfalls & Solutions

1. **MongoDB ObjectId**: Use `PyObjectId` type in Pydantic models, not raw `ObjectId`. Convert with `str(obj_id)` when serializing.
2. **Token Expiry**: Access tokens expire in 60 min. Frontend must handle 401 → refresh token → retry pattern (implemented in `api.js`).
3. **Enum Validation**: BookingStatus/UserRole are Pydantic enums. Use `.value` to get string: `booking.status.value == "completed"`.
4. **Async Context**: FastAPI endpoints are async, but startup logic in [`main.py lifespan`](backend/app/main.py#L54) handles service init. Don't block the event loop.
5. **CORS Issues**: If frontend can't reach backend, check `ALLOWED_ORIGINS` in `.env`. Must include exact origin (http://localhost:3000).

## File Structure Quick Reference
- API endpoints: [`backend/app/api/v1/*.py`](backend/app/api/v1/)
- Database models: [`backend/app/models/database.py`](backend/app/models/database.py)
- Business logic: [`backend/app/services/`](backend/app/services/)
- Auth logic: [`backend/app/core/security.py`](backend/app/core/security.py)
- Mobile screens: [`savitara-app/src/screens/`](savitara-app/src/screens/)
- Admin pages: [`admin-savitara-web/pages/`](admin-savitara-web/pages/)

## Documentation Resources
- [`MASTER_README.md`](MASTER_README.md): Complete system overview
- [`API_TESTING_GUIDE.md`](API_TESTING_GUIDE.md): Postman collection and endpoint examples
- [`DEPLOYMENT.md`](DEPLOYMENT.md): Production deployment steps
- [`QUICK_START_CHECKLIST.md`](QUICK_START_CHECKLIST.md): 30-minute setup guide

## Key Decisions & Trade-offs
- **Why Expo?** Faster iteration than bare React Native, acceptable for this use case despite larger bundle size
- **Why MongoDB?** Flexible schema for varying Acharya profiles (some have 5 specializations, others 20)
- **Why monolith?** Team size and deployment complexity favor single backend over microservices
- **Why JWT?** Stateless auth scales better than sessions for mobile clients with intermittent connectivity
