import { initializeApp } from 'firebase/app'
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

// Validate required Firebase environment variables — M28 fix: graceful degradation instead of crashing
let firebaseAvailable = true
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('Missing VITE_FIREBASE_API_KEY – Firebase features will be disabled')
  firebaseAvailable = false
}
if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  console.warn('Missing VITE_FIREBASE_PROJECT_ID – Firebase features will be disabled')
  firebaseAvailable = false
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase (only if config is available)
const app = firebaseAvailable ? initializeApp(firebaseConfig) : null

// Initialize Firebase Auth
export const auth = app ? getAuth(app) : null
export const googleProvider = app ? (() => { const p = new GoogleAuthProvider(); p.addScope('email'); p.addScope('profile'); return p })() : null

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
