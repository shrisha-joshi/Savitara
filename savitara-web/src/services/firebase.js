import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult,
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

// Check for redirect result on page load (for redirect flow)
export const checkRedirectResult = async () => {
  try {
    console.log('🔍 Checking for redirect result...')
    const result = await getRedirectResult(auth)
    if (result) {
      console.log('✅ Got redirect result, user:', result.user.email)
      const idToken = await result.user.getIdToken()
      return {
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        },
        idToken
      }
    }
    console.log('📭 No redirect result found')
    return null
  } catch (error) {
    console.error('❌ Redirect result error:', error)
    throw error
  }
}

// Sign in with Google using redirect (more reliable than popup)
export const signInWithGoogle = async () => {
  try {
    console.log('🔄 Starting Google Sign-In with redirect...')
    // Use redirect flow - this will navigate away from the page
    await signInWithRedirect(auth, googleProvider)
    // This line won't be reached - page will redirect to Google
    return null
  } catch (error) {
    console.error('❌ Google sign-in error:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    // Provide user-friendly error messages
    let errorMessage
    
    switch (error.code) {
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
