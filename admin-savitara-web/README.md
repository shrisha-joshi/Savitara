# Savitara Admin Dashboard

Next.js web application for Savitara platform administration.

## Features

- **Dashboard Analytics:**
  - User growth charts
  - Revenue trends
  - Booking statistics
  - Real-time metrics

- **User Management:**
  - Search and filter users
  - Suspend/unsuspend accounts
  - View user details

- **Acharya Verification:**
  - Review pending verification requests
  - Approve or reject Acharya applications
  - View credentials and experience

- **Review Moderation:**
  - Approve/reject user reviews
  - Content moderation
  - Maintain platform quality

- **Broadcast Notifications:**
  - Send push notifications to all users
  - Target specific user roles
  - Announcement management

## Setup

### Prerequisites
- Node.js 18+
- Backend API running

### Installation

1. Install dependencies:
```bash
cd admin-web
npm install
```

2. Create `.env.local` file:
```bash
cp .env.example .env.local
```

3. Configure environment variables:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

### Running the App

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Access the dashboard at: http://localhost:3001

## Project Structure

```
admin-web/
├── pages/
│   ├── _app.js              # App wrapper with theme
│   ├── index.js             # Dashboard page
│   ├── users.js             # User management
│   ├── verifications.js     # Acharya verification
│   ├── reviews.js           # Review moderation
│   ├── broadcast.js         # Broadcast notifications
│   └── login.js             # Login page
├── src/
│   ├── components/
│   │   └── Layout.js        # Main layout with sidebar
│   ├── context/
│   │   └── AuthContext.js   # Authentication context
│   ├── hoc/
│   │   └── withAuth.js      # Auth HOC for protected routes
│   └── services/
│       └── api.js           # API service layer
├── styles/
│   └── globals.css          # Global styles
└── package.json
```

## Technologies

- **Next.js 14** (React framework)
- **Material-UI (MUI)** (Component library)
- **Recharts** (Data visualization)
- **Axios** (HTTP client)
- **date-fns** (Date utilities)

## Authentication

Admin users must have `role: "admin"` in the backend. Google OAuth integration is required for production deployment.

## API Integration

All API calls are handled through `src/services/api.js` with:
- Automatic JWT token management
- Request/response interceptors
- Error handling and redirects

## Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy

# Or any Node.js hosting platform
npm start
```

## Security

- Protected routes with `withAuth` HOC
- Admin role verification
- Secure token storage
- API request authentication
