# Savitara Web Application

React web application for Grihasta and Acharya users to access the Savitara platform from desktop browsers.

## 🌐 Live URL

- **Production**: https://savitara.com
- **Development**: http://localhost:3000

## 🚀 Features

### For Grihastas (Devotees)
- ✅ Search and filter verified Acharyas
- ✅ View detailed Acharya profiles
- ✅ Book spiritual services with calendar
- ✅ Secure Razorpay payment integration
- ✅ Track booking status and history
- ✅ Real-time chat with Acharyas
- ✅ Submit reviews and ratings
- ✅ Manage profile and preferences

### For Acharyas (Priests)
- ✅ Dashboard with earnings and statistics
- ✅ Manage booking requests
- ✅ OTP-based service verification
- ✅ Track revenue and transaction history
- ✅ View reviews and ratings
- ✅ Real-time chat with Grihastas
- ✅ Manage availability and services
- ✅ Profile settings and customization

### Common Features
- ✅ Google OAuth authentication
- ✅ Responsive Material-UI design
- ✅ Push notifications (Firebase)
- ✅ Auto token refresh
- ✅ Real-time updates
- ✅ SEO optimization

## 🛠️ Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) 5
- **Routing**: React Router 6
- **State Management**: Context API
- **HTTP Client**: Axios
- **Authentication**: Google OAuth
- **Notifications**: React Toastify
- **Charts**: Recharts
- **Date/Time**: date-fns
- **Real-time**: Socket.IO Client

## 📁 Project Structure

```
web-app/
├── src/
│   ├── components/
│   │   ├── Layout.jsx              # Main layout wrapper
│   │   ├── Navbar.jsx              # Navigation bar
│   │   ├── Footer.jsx              # Footer component
│   │   ├── AcharyaCard.jsx         # Acharya display card
│   │   ├── BookingCard.jsx         # Booking summary card
│   │   └── ReviewCard.jsx          # Review display card
│   ├── pages/
│   │   ├── Home.jsx                # Landing page
│   │   ├── Login.jsx               # Google OAuth login
│   │   ├── Onboarding.jsx          # User onboarding
│   │   ├── Profile.jsx             # User profile
│   │   ├── grihasta/
│   │   │   ├── Dashboard.jsx       # Grihasta dashboard
│   │   │   ├── SearchAcharyas.jsx  # Search page
│   │   │   ├── AcharyaProfile.jsx  # Acharya details
│   │   │   ├── CreateBooking.jsx   # Booking form
│   │   │   ├── Payment.jsx         # Payment processing
│   │   │   ├── MyBookings.jsx      # Booking list
│   │   │   ├── BookingDetails.jsx  # Booking view
│   │   │   └── SubmitReview.jsx    # Review form
│   │   ├── acharya/
│   │   │   ├── Dashboard.jsx       # Acharya dashboard
│   │   │   ├── Bookings.jsx        # Manage bookings
│   │   │   ├── StartService.jsx    # OTP entry
│   │   │   ├── Earnings.jsx        # Revenue analytics
│   │   │   ├── Reviews.jsx         # View reviews
│   │   │   └── Settings.jsx        # Profile settings
│   │   └── chat/
│   │       ├── Conversations.jsx   # Chat list
│   │       └── Chat.jsx            # Chat interface
│   ├── context/
│   │   └── AuthContext.jsx         # Auth state management
│   ├── services/
│   │   ├── api.js                  # API client with interceptors
│   │   └── firebase.js             # Firebase configuration
│   ├── hooks/
│   │   ├── useAuth.js              # Auth custom hook
│   │   └── useApi.js               # API custom hook
│   ├── utils/
│   │   ├── constants.js            # App constants
│   │   └── helpers.js              # Utility functions
│   ├── App.jsx                     # Root component with routes
│   └── main.jsx                    # Entry point
├── public/
│   ├── favicon.ico
│   └── logo.svg
├── index.html                      # HTML template
├── vite.config.js                  # Vite configuration
├── package.json                    # Dependencies
├── .env.example                    # Environment variables template
└── README.md                       # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend API running on port 8000
- Google OAuth credentials
- Razorpay account (test mode)
- Firebase project (for push notifications)

### Installation

1. **Navigate to web-app directory**:
```bash
cd web-app
```

2. **Install dependencies**:
```bash
npm install
# or
yarn install
```

3. **Configure environment variables**:
```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:
```env
VITE_API_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_RAZORPAY_KEY=rzp_test_your_key
VITE_FIREBASE_API_KEY=your-firebase-key
# ... other Firebase config
```

4. **Start development server**:
```bash
npm run dev
```

5. **Open browser**:
```
http://localhost:3000
```

## 🔧 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Run tests
npm test
```

### Code Style

- Use functional components with hooks
- Follow React best practices
- Use Material-UI components
- Keep components small and focused
- Use meaningful variable and function names
- Add comments for complex logic

### API Integration

All API calls go through the `api.js` service:

```javascript
import api from '../services/api'

// GET request
const response = await api.get('/users/acharyas')

// POST request
const response = await api.post('/bookings', bookingData)

// PUT request
const response = await api.put('/users/me', updateData)
```

### Authentication

Use the `useAuth` hook to access auth state:

```javascript
import { useAuth } from '../context/AuthContext'

function MyComponent() {
  const { user, logout, updateUser } = useAuth()
  
  // Access user data
  console.log(user.full_name)
  
  // Logout
  await logout()
}
```

## 📦 Building for Production

### 1. Update Environment Variables

Create `.env.production`:
```env
VITE_API_URL=https://api.savitara.com
VITE_API_BASE_URL=https://api.savitara.com/api/v1
VITE_GOOGLE_CLIENT_ID=production-client-id
# ... production credentials
```

### 2. Build

```bash
npm run build
```

Output will be in `dist/` directory.

### 3. Deploy

#### Vercel (Recommended)
```bash
npm install -g vercel
vercel deploy --prod
```

#### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### AWS S3 + CloudFront
```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

## 🔒 Security

- ✅ JWT authentication with auto-refresh
- ✅ HttpOnly cookies (where applicable)
- ✅ Secure token storage
- ✅ HTTPS enforcement in production
- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ CSRF protection

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (Cypress)
```bash
# Install Cypress
npm install --save-dev cypress

# Open Cypress
npx cypress open

# Run Cypress tests
npx cypress run
```

## 📱 Responsive Design

The app is fully responsive and works on:
- 📱 Mobile devices (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)
- 🖥️ Large screens (1440px+)

## 🌐 Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## 🐛 Troubleshooting

### Issue: Google OAuth not working
**Solution**: Make sure your Google Client ID is correctly set in `.env` and the redirect URI is whitelisted in Google Console.

### Issue: API calls failing
**Solution**: Check if the backend API is running on port 8000 and CORS is properly configured.

### Issue: Build errors
**Solution**: Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support

- **Email**: support@savitara.com
- **Documentation**: https://docs.savitara.com
- **Issues**: https://github.com/yourorg/savitara/issues

## 📄 License

Proprietary - All rights reserved

---

**Built with ❤️ for the spiritual community**
