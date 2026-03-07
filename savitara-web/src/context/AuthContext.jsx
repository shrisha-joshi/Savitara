import PropTypes from 'prop-types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../services/api'
import { checkRedirectResult, signInWithGoogle as firebaseGoogleSignIn, firebaseSignOut } from '../services/firebase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

/**
 * Pure module-level helper — extracts error categorization from registerWithEmail
 * to keep the useCallback's cognitive complexity within the allowed limit.
 */
function categorizeRegistrationError(error, backendMessage) {
  let errorMessage = 'We could not create your account. Please try again.'
  let errorDetails = ''

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    errorMessage = 'Unable to connect to the server'
    errorDetails = 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.'
  } else if (error.response?.status === 409) {
    errorMessage = 'An account with this email already exists'
    errorDetails = 'If this is your email, please sign in instead. If you forgot your password, use the "Forgot Password" option on the sign-in page.'
  } else if (error.response?.status === 400) {
    const msg = backendMessage.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists')) {
      errorMessage = 'An account with this email already exists'
      errorDetails = 'Please sign in with this email. If you forgot your password, use the password reset option.'
    } else if (msg.includes('password')) {
      errorMessage = 'Password does not meet requirements'
      errorDetails = 'Your password must be at least 8 characters long and include uppercase letters, lowercase letters, and numbers.'
    } else if (msg.includes('email')) {
      errorMessage = 'Invalid email address'
      errorDetails = 'Please enter a valid email address in the format: name@domain.com'
    } else {
      errorMessage = 'Invalid registration information'
      errorDetails = backendMessage || 'Please check your information and try again.'
    }
  } else if (error.response?.status === 429) {
    errorMessage = 'Too many registration attempts'
    errorDetails = 'Please wait a few minutes before trying again. This is for security purposes.'
  } else if (error.response?.status >= 500) {
    errorMessage = 'Server error occurred'
    errorDetails = 'Our servers are experiencing technical difficulties. Please try again in a few minutes.'
  } else if (backendMessage) {
    errorMessage = backendMessage
  }

  return { errorMessage, errorDetails }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'))
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for redirect result first (for Google OAuth)
        // Catch errors here to ensure we always proceed to checkAuth
        await handleRedirectResult().catch(e => console.warn('Redirect check failed:', e))
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        // Always run checkAuth to ensure loading completes
        // checkAuth guarantees setLoading(false) in its finally block
        await checkAuth()
      }
    }

    initAuth()
  }, [])

  /**
   * WCAG Compliant: Handle Google OAuth redirect result
   * Provides clear feedback during OAuth flow
   */
  const handleRedirectResult = async () => {
    try {
      const result = await checkRedirectResult()
      if (result?.idToken) {
        console.log('Processing Google redirect result...')
        toast.info('Completing your Google sign-in...')
        
        // Send token to backend
        const response = await api.post('/auth/google', {
          id_token: result.idToken,
          role: 'grihasta'
        })

        const { data } = response.data
        const { access_token, refresh_token, user: userData } = data
        
        localStorage.setItem('accessToken', access_token)
        localStorage.setItem('refreshToken', refresh_token)
        setToken(access_token)
        
        setUser(userData)
        
        // Navigate based on onboarding status
        if (userData.onboarded || userData.onboarding_completed) {
          navigate('/')
        } else {
          navigate('/onboarding')
        }

        toast.success('Successfully signed in with Google!')
      }
    } catch (error) {
      console.error('Redirect result error:', error)
      
      // WCAG: Provide specific, actionable error messages
      let errorMessage = 'Google sign-in failed'
      let errorDetails = ''
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server'
        errorDetails = 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.'
      } else if (error.response?.status === 401) {
        errorMessage = 'Google authentication failed'
        errorDetails = 'We could not verify your Google account. Please try signing in again or use email sign-in instead.'
      } else if (error.response?.status === 403) {
        errorMessage = 'Your account has been suspended'
        errorDetails = 'Please contact support at support@savitara.com for assistance.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error occurred'
        errorDetails = 'Our servers are experiencing technical difficulties. Please try again in a few minutes or use email sign-in instead.'
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      }
      
      toast.error(
        <div>
          <strong>{errorMessage}</strong>
          {errorDetails && <div style={{ marginTop: '8px', fontSize: '0.9em' }}>{errorDetails}</div>}
        </div>,
        { autoClose: 8000 }
      )
    }
  }

  const checkAuth = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')

      if (!accessToken || !refreshToken) {
        return
      }

      const response = await api.get('/auth/me')
      // Extract user data from StandardResponse format
      const userData = response.data.data || response.data
      setUser(userData)
    } catch (error) {
      console.error('Auth check failed:', error)
      try {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        setToken(null)
      } catch (storageError) {
        // Storage operations may fail in private browsing mode
        console.warn('Failed to clear tokens from storage:', storageError)
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  /**
   * WCAG Compliant: Login with Email
   * Provides clear, actionable error messages that explain:
   * - What went wrong
   * - Why it happened
   * - What the user can do next
   */
  const loginWithEmail = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      // Backend returns StandardResponse: { success, data: {...}, message }
      const { access_token, refresh_token, user: userData } = response.data.data || response.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      setToken(access_token)
      
      setUser(userData)
      
      // Navigate based on onboarding status - Home after login
      if (userData.onboarded || userData.onboarding_completed) {
        const from = location.state?.from?.pathname || '/'
        const search = location.state?.from?.search || ''
        navigate(`${from}${search}`, { replace: true })
      } else {
        navigate('/onboarding', { replace: true })
      }

      toast.success('Welcome back! You have successfully signed in.')
    } catch (error) {
      console.error('Login failed:', error)
      
      // WCAG: Provide specific, actionable error messages
      let errorMessage = 'We could not sign you in. Please try again.'
      let errorDetails = ''
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server'
        errorDetails = 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.'
      } else if (error.response?.status === 401) {
        errorMessage = 'Incorrect email or password'
        errorDetails = 'Please check your credentials and try again. If you forgot your password, use the "Forgot Password" option.'
      } else if (error.response?.status === 403) {
        errorMessage = 'Your account has been suspended'
        errorDetails = 'Please contact support at support@savitara.com for assistance.'
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many login attempts'
        errorDetails = 'Please wait a few minutes before trying again. This is for your account security.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error occurred'
        errorDetails = 'Our servers are experiencing technical difficulties. Please try again in a few minutes.'
      } else if (error.response?.data?.message) {
        // Use backend message if available
        errorMessage = error.response.data.message
      }
      
      // WCAG: Display both main error and details if available
      toast.error(
        <div>
          <strong>{errorMessage}</strong>
          {errorDetails && <div style={{ marginTop: '8px', fontSize: '0.9em' }}>{errorDetails}</div>}
        </div>,
        { autoClose: 8000 } // Longer display time for detailed errors
      )
      throw error
    }
  }, [navigate, location])

  /**
   * WCAG Compliant: Register with Email
   * Now returns { requiresVerification: true, userId, email } instead of logging in directly.
   * The caller must show an OTP input and call verifyEmailOtp to complete signup.
   */
  const registerWithEmail = useCallback(async (data) => {
    try {
      const response = await api.post('/auth/register', data)
      const responseData = response.data.data || response.data

      // New flow: backend sends OTP and returns user_id. No tokens yet.
      if (responseData.requires_email_verification) {
        toast.info('A verification code has been sent to your email address.')
        return {
          requiresVerification: true,
          userId: responseData.user_id,
          email: responseData.email,
        }
      }

      // Fallback for backwards-compat if backend returns tokens directly (should not happen)
      const { access_token, refresh_token, user: userData } = responseData
      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      setToken(access_token)
      setUser(userData)
      navigate('/onboarding')
      toast.success('Account created successfully! Please complete your profile to get started.')
      return { requiresVerification: false }
    } catch (error) {
      console.error('Registration failed:', error)

      const responseData = error.response?.data
      const backendMessage =
        (typeof responseData?.message === 'string' && responseData.message) ||
        (typeof responseData?.detail === 'string' && responseData.detail) ||
        (Array.isArray(responseData?.detail)
          ? responseData.detail
              .map((item) => item?.msg || item?.message || '')
              .filter(Boolean)
              .join(', ')
          : '')
      
      const { errorMessage, errorDetails } = categorizeRegistrationError(error, backendMessage)
      
      toast.error(
        <div>
          <strong>{errorMessage}</strong>
          {errorDetails && <div style={{ marginTop: '8px', fontSize: '0.9em' }}>{errorDetails}</div>}
        </div>,
        { autoClose: 8000 }
      )
      throw error
    }
  }, [navigate])

  /**
   * Resend email verification OTP (for use on the verification step screen)
   */
  const sendEmailOtp = useCallback(async (email) => {
    try {
      await api.post('/auth/email/send-otp', { email })
      toast.info('A new verification code has been sent to your email.')
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to resend verification code.'
      toast.error(msg)
      throw error
    }
  }, [])

  /**
   * Verify email OTP — on success the backend returns tokens and we log the user in.
   */
  const verifyEmailOtp = useCallback(async (email, otp) => {
    try {
      const response = await api.post('/auth/email/verify-otp', { email, otp })
      const { access_token, refresh_token, user: userData } = response.data.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      setToken(access_token)
      setUser(userData)

      toast.success('Email verified! Welcome to Savitara.')
      navigate('/onboarding', { replace: true })
    } catch (error) {
      const msg = error.response?.data?.detail || 'Invalid or expired verification code.'
      toast.error(msg)
      throw error
    }
  }, [navigate])

  /**
   * WCAG Compliant: Google Sign-In with Popup
   * Provides clear, actionable feedback throughout the authentication process
   */
  const loginWithGoogle = useCallback(async (legacyCredential = null) => {
    try {
      let idToken = null;
      if (legacyCredential) {
        idToken = legacyCredential;
      } else {
        const result = await firebaseGoogleSignIn();
        idToken = result?.idToken;
      }
      
      if (!idToken) {
        toast.error('Google sign-in was cancelled or failed. Please try again or use email sign-in.');
        setLoading(false);
        return;
      }
      
      const response = await api.post('/auth/google', {
        id_token: idToken,
        role: 'grihasta'
      });
      
      const { data } = response.data;
      const { access_token, refresh_token, user: userData } = data;
      
      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('refreshToken', refresh_token);
      setToken(access_token);
      setUser(userData);
      
      if (userData.onboarded || userData.onboarding_completed) {
        const from = location.state?.from?.pathname || '/';
        const search = location.state?.from?.search || '';
        navigate(`${from}${search}`, { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
      
      toast.success('Successfully signed in with Google!');
    } catch (error) {
      console.error('Google login failed:', error);
      
      // WCAG: Provide specific, actionable error messages
      let errorMessage = 'Google sign-in failed';
      let errorDetails = '';
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server';
        errorDetails = 'Please check your internet connection and try again. If the problem persists, try using email sign-in instead.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled';
        errorDetails = 'You closed the Google sign-in window. Please try again if you wish to continue.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up blocked by browser';
        errorDetails = 'Please allow pop-ups for this site in your browser settings and try again, or use email sign-in instead.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in cancelled';
        errorDetails = 'Only one sign-in window can be open at a time. Please close any other sign-in windows and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Google authentication failed';
        errorDetails = 'We could not verify your Google account. Please try again or use email sign-in instead.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Your account has been suspended';
        errorDetails = 'Please contact support at support@savitara.com for assistance.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error occurred';
        errorDetails = 'Our servers are experiencing technical difficulties. Please try again in a few minutes or use email sign-in instead.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(
        <div>
          <strong>{errorMessage}</strong>
          {errorDetails && <div style={{ marginTop: '8px', fontSize: '0.9em' }}>{errorDetails}</div>}
        </div>,
        { autoClose: 8000 }
      );
      throw error;
    }
  }, [navigate, location])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API failed:', error)
    }
    
    // Also sign out from Firebase
    try {
      await firebaseSignOut()
    } catch (error) {
      console.error('Firebase sign out failed:', error)
    }
    
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setUser(null)
    navigate('/login')
    toast.info('Logged out successfully')
  }, [navigate])

  const updateUser = useCallback((userData) => {
    setUser(userData)
  }, [])

  const refreshUserData = useCallback(async () => {
    try {
      const response = await api.get('/auth/me')
      // Handle StandardResponse format from backend
      const userData = response.data.data || response.data
      setUser(userData)
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }, [])

  const value = useMemo(() => ({
    user,
    token,
    loading,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendEmailOtp,
    verifyEmailOtp,
    logout,
    updateUser,
    refreshUserData,
  }), [user, token, loading, loginWithGoogle, loginWithEmail, registerWithEmail, sendEmailOtp, verifyEmailOtp, logout, updateUser, refreshUserData])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
