import { useGoogleLogin } from '@react-oauth/google'
import PropTypes from 'prop-types'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../services/api'
import { firebaseSignOut } from '../services/firebase'

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

function loadCachedUserFromStorage() {
  try {
    const rawUser = localStorage.getItem('user')
    if (!rawUser) {
      return null
    }
    return JSON.parse(rawUser)
  } catch (error) {
    console.warn('Failed to parse cached user from storage:', error)
    return null
  }
}

function isHardAuthFailure(error) {
  const status = error?.response?.status
  return status === 401 || status === 403
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(() => localStorage.getItem('accessToken'))
  const navigate = useNavigate()
  const location = useLocation()

  // Ref to hold resolve/reject for the promise returned by loginWithGoogle()
  const pendingGoogleAuthRef = useRef(null)

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth()
    }
    initAuth()
  }, [])

  const checkAuth = async () => {
    const cachedUser = loadCachedUserFromStorage()
    try {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')

      if (!accessToken || !refreshToken) {
        if (cachedUser) {
          localStorage.removeItem('user')
        }
        return
      }

      if (cachedUser) {
        setUser(cachedUser)
      }

      // Suppress global error toasts for this background check and set a short timeout
      const response = await api.get('/auth/me', { _skipErrorToast: true, timeout: 4000 })
      // Extract user data from StandardResponse format
      const userData = response.data.data || response.data
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
    } catch (error) {
      // Avoid noisy console stack traces for transient network failures
      console.debug('Auth check failed (network/unauthenticated):', error?.message || error)
      if (isHardAuthFailure(error)) {
        try {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          setToken(null)
        } catch (storageError) {
          // Storage operations may fail in private browsing mode
          console.warn('Failed to clear tokens from storage:', storageError)
        }
        setUser(null)
      } else if (cachedUser) {
        setUser(cachedUser)
      } else {
        setUser(null)
      }
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
      const responseData = response.data.data || response.data

      // Unverified account — backend sent a fresh OTP, caller must show OTP screen
      if (responseData.requires_email_verification) {
        return { requiresVerification: true, email: responseData.email }
      }

      // Normal login success
      const { access_token, refresh_token, user: userData } = responseData

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      localStorage.setItem('user', JSON.stringify(userData))
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
      localStorage.setItem('user', JSON.stringify(userData))
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
      localStorage.setItem('user', JSON.stringify(userData))
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
   * Called by @react-oauth/google when the user successfully authenticates.
   * Receives tokenResponse.access_token — sent to backend for validation.
   */
  const _handleGoogleSuccess = useCallback(async (tokenResponse) => {
    try {
      const response = await api.post('/auth/google', {
        access_token: tokenResponse.access_token,
        role: 'grihasta',
      })
      const { data } = response.data
      const { access_token, refresh_token, user: userData } = data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setToken(access_token)
      setUser(userData)

      if (userData.onboarded || userData.onboarding_completed) {
        const from = location.state?.from?.pathname || '/'
        const search = location.state?.from?.search || ''
        navigate(`${from}${search}`, { replace: true })
      } else {
        navigate('/onboarding', { replace: true })
      }

      toast.success('Successfully signed in with Google!')
      pendingGoogleAuthRef.current?.resolve()
    } catch (error) {
      console.error('Google login failed:', error)
      let errorMessage = 'Google sign-in failed'
      let errorDetails = ''
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Unable to connect to the server'
        errorDetails = 'Please check your internet connection and try again.'
      } else if (error.response?.status === 401) {
        errorMessage = 'Google authentication failed'
        errorDetails = 'We could not verify your Google account. Please try again or use email sign-in.'
      } else if (error.response?.status === 403) {
        errorMessage = 'Your account has been suspended'
        errorDetails = 'Please contact support@savitara.com for assistance.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error occurred'
        errorDetails = 'Our servers are having difficulties. Please try again in a few minutes.'
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message
      }
      toast.error(
        <div>
          <strong>{errorMessage}</strong>
          {errorDetails && <div style={{ marginTop: '8px', fontSize: '0.9em' }}>{errorDetails}</div>}
        </div>,
        { autoClose: 8000 }
      )
      pendingGoogleAuthRef.current?.reject(error)
    } finally {
      pendingGoogleAuthRef.current = null
    }
  }, [navigate, location])

  const _handleGoogleError = useCallback((errorResponse) => {
    // Don't toast if user just closed the popup
    const isCancelled = !errorResponse ||
      errorResponse?.error === 'access_denied' ||
      errorResponse?.error === 'popup_closed_by_user'
    if (!isCancelled) {
      toast.error('Google sign-in failed. Please try again or use email sign-in.')
    }
    const err = new Error(errorResponse?.error_description || 'Google sign-in cancelled')
    err.code = errorResponse?.error || 'google_sign_in_failed'
    pendingGoogleAuthRef.current?.reject(err)
    pendingGoogleAuthRef.current = null
  }, [])

  // useGoogleLogin hook — opens Google's OAuth2 popup via @react-oauth/google
  // GoogleOAuthProvider (in main.jsx) must have the real VITE_GOOGLE_CLIENT_ID set
  const _googleLoginTrigger = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      void _handleGoogleSuccess(tokenResponse)
    },
    onError: _handleGoogleError,
    flow: 'implicit',
    scope: 'openid email profile',
  })

  /**
   * Opens the Google sign-in popup.
   * Returns a Promise that resolves on success or rejects on failure/cancel.
   */
  const loginWithGoogle = useCallback(() => {
    return new Promise((resolve, reject) => {
      pendingGoogleAuthRef.current = { resolve, reject }
      _googleLoginTrigger()
    })
  }, [_googleLoginTrigger])

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
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    navigate('/login')
    toast.info('Logged out successfully')
  }, [navigate])

  const forgotPasswordSendOtp = useCallback(async (email) => {
    const response = await api.post('/auth/forgot-password', { email })
    // Return debug_otp when backend is in DEBUG mode (dev only)
    return response?.data?.data || {}
  }, [])

  const forgotPasswordResetPassword = useCallback(async (email, otp, newPassword) => {
    await api.post('/auth/reset-password', { email, otp, new_password: newPassword })
  }, [])

  const updateUser = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const refreshUserData = useCallback(async () => {
    try {
      const response = await api.get('/auth/me')
      // Handle StandardResponse format from backend
      const userData = response.data.data || response.data
      localStorage.setItem('user', JSON.stringify(userData))
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
    forgotPasswordSendOtp,
    forgotPasswordResetPassword,
  }), [user, token, loading, loginWithGoogle, loginWithEmail, registerWithEmail, sendEmailOtp, verifyEmailOtp, logout, updateUser, refreshUserData, forgotPasswordSendOtp, forgotPasswordResetPassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
