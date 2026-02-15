# Google OAuth Login Debugging Guide

## Current Status
✅ All services running (Backend, Savitara Web, Admin Web)  
✅ MongoDB connected  
✅ Environment files present  

## Issue: Google OAuth Login Not Working

### Potential Causes Checklist

#### 1. Firebase Configuration Issues
**Location**: `savitara-web\.env`

Check if all Firebase credentials are valid:
```
VITE_FIREBASE_API_KEY=AIzaSyABhtSIIz-mjMqArISDtnUAsPsv9eYD2c8
VITE_FIREBASE_AUTH_DOMAIN=savitara-90a1c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=savitara-90a1c
```

**Action**: Verify in Firebase Console that:
- Project ID matches
- Google Sign-In is enabled in Authentication > Sign-in providers
- Authorized domains include `localhost`

#### 2. Backend Google OAuth Configuration
**Location**: `backend\.env`

```
GOOGLE_CLIENT_ID=721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=(EMPTY - THIS IS THE PROBLEM!)
```

**⚠️ CRITICAL ISSUE**: `GOOGLE_CLIENT_SECRET` is empty!

**Why this matters**:
- Firebase uses this to initialize Firebase Auth
- Without it, Firebase Auth will fail silently or with cryptic errors

**How to fix**:
1. Go to Google Cloud Console (https://console.cloud.google.com)
2. Select project "savitara-demo"
3. Navigate to: APIs & Services > Credentials
4. Find OAuth 2.0 Client ID: `721505591338-taf2n131m50se50pvuo9s1hk3oilmhuv`
5. Copy the Client Secret
6. Update `backend\.env` with the secret

#### 3. OAuth Consent Screen
Check that the OAuth consent screen is properly configured:
- App name: Savitara
- Support email set
- Authorized domains include your domain
- Scopes: email, profile, openid

#### 4. CORS Configuration
**Location**: `backend\.env`

```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:8081,http://localhost:19006
```

✅ Looks correct - includes frontend ports

#### 5. Frontend-Backend Communication
The flow should be:
1. User clicks "Sign in with Google" on frontend
2. Firebase initiates Google Sign-In (redirect or popup)
3. User authenticates with Google
4. Firebase returns ID token
5. Frontend sends ID token to backend `/api/v1/auth/google`
6. Backend verifies token with Google
7. Backend creates/updates user and returns JWT tokens

**Checkpoint locations**:
- Frontend: `savitara-web\src\context\AuthContext.jsx` (loginWithGoogle function)
- Frontend: `savitara-web\src\services\firebase.js` (signInWithGoogle function)
- Backend: `backend\app\api\v1\auth.py` (google_login endpoint)

### Manual Testing Steps

1. **Open Browser Console** (F12)
   - Go to http://localhost:3000
   - Check for any Firebase initialization errors
   - Look for network errors

2. **Check Firebase Console**
   - Go to https://console.firebase.google.com/project/savitara-90a1c
   - Verify Google Sign-In is enabled
   - Check "Authorized domains" includes localhost

3. **Check Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Verify OAuth credentials are valid
   - Check Authorized JavaScript origins include http://localhost:3000
   - Check Authorized redirect URIs include Firebase auth domain

4. **Test Login Flow**
   - Click "Sign in with Google"
   - Watch Network tab for these requests:
     - Firebase Auth API calls
     - POST to `/api/v1/auth/google`
   - Check Console tab for error messages

5. **Backend Logs**
   - Watch terminal running backend
   - Look for token verification errors
   - Check for 401/403 responses

6. **Browser Storage**
   - After successful login, check LocalStorage for:
     - accessToken
     - refreshToken

### Quick Fixes

#### Fix 1: Restart Frontend with Cleared Cache
```powershell
cd savitara-web
Remove-Item -Path node_modules\.vite -Recurse -Force
npm run dev
```

#### Fix 2: Test with Direct API Call
```powershell
# Get a test token from Firebase and test backend directly
Invoke-WebRequest -Uri http://localhost:8000/api/v1/auth/google `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"id_token":"test_token","role":"grihasta"}' `
  -UseBasicParsing
```

#### Fix 3: Enable Detailed Firebase Logging
Add to `savitara-web\src\services\firebase.js`:
```javascript
import { setLogLevel } from 'firebase/app'
setLogLevel('debug')
```

### Common Error Messages and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Firebase: Error (auth/operation-not-allowed)" | Google Sign-In not enabled in Firebase | Enable in Firebase Console > Authentication > Sign-in method |
| "Firebase: Error (auth/unauthorized-domain)" | Domain not authorized | Add localhost to authorized domains |
| "Firebase: Error (auth/invalid-api-key)" | Invalid Firebase API key | Check .env file and Firebase project settings |
| "Network Error" when posting to backend | Backend not running or CORS | Check backend is running and CORS config |
| "Invalid Google token" from backend | Token verification failed | Check GOOGLE_CLIENT_ID matches in backend and Firebase |
| 401 Unauthorized | Token expired or invalid | Check token is being sent in Authorization header |

### Current Action Plan

1. ✅ Verify all services are running  
2. 🔄 Get Google Client Secret from Google Cloud Console  
3. ⏳ Update backend .env with client secret  
4. ⏳ Restart backend  
5. ⏳ Test Google login flow  
6. ⏳ Fix any remaining issues  

