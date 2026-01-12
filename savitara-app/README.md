# Savitara Mobile App

React Native mobile application for the Savitara spiritual platform.

## Features

- **Google OAuth Authentication**
- **Grihasta Features:**
  - Browse and search Acharyas
  - Book services with calendar
  - Secure Razorpay payment integration
  - Real-time chat with Acharyas
  - View booking history and details
  - Attendance confirmation
  - Write reviews

- **Acharya Features:**
  - Dashboard with booking statistics
  - Manage availability and services
  - Handle booking requests
  - Start bookings with OTP verification
  - Confirm attendance
  - Track earnings
  - Chat with Grihastas

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Studio (for Android development)

### Installation

1. Install dependencies:
```bash
cd mobile-app
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
API_BASE_URL=http://your-backend-url:8000/api/v1
GOOGLE_CLIENT_ID=your-google-client-id
RAZORPAY_KEY_ID=your-razorpay-key-id
```

### Running the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Project Structure

```
mobile-app/
├── App.js                      # Main app entry point
├── src/
│   ├── config/
│   │   └── api.config.js       # API configuration
│   ├── context/
│   │   └── AuthContext.js      # Authentication context
│   ├── navigation/
│   │   └── AppNavigator.js     # App navigation setup
│   ├── screens/
│   │   ├── auth/               # Authentication screens
│   │   ├── grihasta/           # Grihasta user screens
│   │   ├── acharya/            # Acharya provider screens
│   │   ├── chat/               # Chat screens
│   │   └── common/             # Shared screens
│   └── services/
│       └── api.js              # API service layer
└── package.json
```

## API Integration

All API calls are handled through the `src/services/api.js` service layer with:
- Automatic JWT token management
- Token refresh on expiry
- Request/response interceptors
- Error handling

## Technologies

- **React Native** with Expo 50
- **React Navigation** (Stack + Bottom Tabs)
- **React Native Paper** (Material Design UI)
- **Axios** (HTTP client)
- **expo-auth-session** (Google OAuth)
- **expo-notifications** (Push notifications)
- **react-native-gifted-chat** (Chat interface)
- **react-native-calendars** (Date picker)
- **react-native-ratings** (Star ratings)

## Build for Production

```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## Notes

- Razorpay SDK integration is pending (payment flow simulated)
- Push notifications require Firebase setup
- Logo and splash screen assets need to be added
- Backend API must be running for full functionality
