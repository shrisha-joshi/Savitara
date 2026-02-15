import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth'

// Validate required Firebase environment variables
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  throw new Error('Missing VITE_FIREBASE_API_KEY environment variable')
}
if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  throw new Error('Missing VITE_FIREBASE_PROJECT_ID environment variable')
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Auth
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Add scopes for additional user info
googleProvider.addScope('email')
googleProvider.addScope('profile')

// Check for redirect result - No-op for Popup flow
export const checkRedirectResult = async () => {
  return null
}

// Sign in with Google using Popup (Simpler and more reliable than redirect)
export const signInWithGoogle = async () => {
  try {
    console.log('🔄 Starting Google Sign-In with popup...')
    const result = await signInWithPopup(auth, googleProvider)
    
    // Get the Google ID Token (required for backend verification)
    // The backend uses google.oauth2.verify_oauth2_token which expects a Google OIDC token
    const credential = GoogleAuthProvider.credentialFromResult(result)
    const googleIdToken = credential?.idToken
    
    if (!googleIdToken) {
       console.warn("No Google ID Token found in credential, falling back to Firebase ID Token (Backend might reject this if not configured for Firebase verification)")
    }

    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
      idToken: googleIdToken || await result.user.getIdToken()
    }
  } catch (error) {
    console.error('❌ Google sign-in error:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    // Provide user-friendly error messages
    let errorMessage
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Sign-in cancelled by user.'
        break
      case 'auth/popup-blocked':
        errorMessage = 'Sign-in popup blocked. Please allow popups for this site.'
        break
      case 'auth/operation-not-allowed':
        errorMessage = 'Google Sign-In is not enabled. Please contact support.'
        break
      case 'auth/unauthorized-domain':
        errorMessage = 'This domain is not authorized for Google Sign-In.'
        break
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection.'
        break
      default:
        errorMessage = error.message || 'Google sign-in failed. Please try again.'
    }
    
    const enhancedError = new Error(errorMessage)
    enhancedError.code = error.code
    enhancedError.originalError = error
    throw enhancedError
  }
}

// Sign out from Firebase
export const firebaseSignOut = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Sign out error:', error)
    throw error
  }
}

// Listen to auth state changes
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback)
}

// Initialize Firebase Cloud Messaging
let messaging = null
try {
  messaging = getMessaging(app)
} catch (error) {
  console.error('Firebase messaging initialization failed:', error)
}

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  if (!messaging) {
    console.warn('Firebase messaging not available')
    return null
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      })
      return token
    } else {
      console.log('Notification permission denied')
      return null
    }
  } catch (error) {
    console.error('Error getting notification permission:', error)
    return null
  }
}

// Listen for foreground messages
export const onMessageListener = (callback) => {
  if (!messaging) {
    console.warn('Firebase messaging not available')
    return () => {}
  }

  return onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload)
    callback(payload)
  })
}

export default app
