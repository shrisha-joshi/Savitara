# Test Firebase Google Auth (Run in browser console on http://localhost:3000)

# Step 1: Check if Firebase is initialized
console.log('Firebase Auth:', window.firebase ? 'Loaded' : 'Not loaded')

# Step 2: Try initiating Google Sign-In
# This should trigger the redirect flow
try {
  # The signup button should call loginWithGoogle from AuthContext
  console.log('Click the "Sign in with Google" button and watch this console')
} catch (error) {
  console.error('Error:', error.message)
}

# Expected flow:
# 1. Click Sign in with Google
# 2. Redirect to Google OAuth
# 3. User signs in
# 4. Redirect back with auth code
# 5. Firebase gets ID token
# 6. Frontend sends token to backend
# 7. Backend verifies token (this requires GOOGLE_CLIENT_SECRET to match Firebase project)

# Common issues:
# - "auth/operation-not-allowed": Google Sign-In not enabled in Firebase Console
# - "auth/unauthorized-domain": localhost not in authorized domains list
# - Network error: Backend not reachable
# - 401 from backend: Token verification failed (wrong client ID or secret)
