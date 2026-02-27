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

  const handleRedirectResult = async () => {
    try {
      const result = await checkRedirectResult()
      if (result?.idToken) {
        console.log('Processing Google redirect result...')
        toast.info('Completing Google sign-in...')
        
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

        toast.success('Login successful!')
      }
    } catch (error) {
      console.error('Redirect result error:', error)
      
      let errorMessage = 'Google login failed'
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.'
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid credentials. Please try again.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.'
      }
      
      toast.error(errorMessage)
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

      toast.success('Login successful!')
    } catch (error) {
      console.error('Login failed:', error)
      // Show specific error message from backend or network error
      let errorMessage = 'Login failed'
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.'
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid email or password.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.'
      }
      
      toast.error(errorMessage)
      throw error
    }
  }, [navigate, location])

  const registerWithEmail = useCallback(async (data) => {
    try {
      const response = await api.post('/auth/register', data)
      // Backend returns StandardResponse: { success, data: {...}, message }
      const { access_token, refresh_token, user: userData } = response.data.data || response.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      setToken(access_token)
      
      setUser(userData)
      // New users always go to onboarding
      navigate('/onboarding')
      toast.success('Registration successful! Please complete your profile.')
    } catch (error) {
      console.error('Registration failed:', error)
      
      let errorMessage = 'Registration failed'
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.'
      } else if (error.response?.status === 409) {
        errorMessage = 'An account with this email already exists.'
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.'
      }
      
      toast.error(errorMessage)
      throw error
    }
  }, [navigate])

  // Updated to use Firebase Google Sign-In with Popup
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
        toast.error('No ID token received from Google.');
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
      toast.success('Login successful!');
    } catch (error) {
      console.error('Google login failed:', error);
      let errorMessage = 'Google login failed';
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      toast.error(errorMessage);
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
    logout,
    updateUser,
    refreshUserData,
  }), [user, token, loading, loginWithGoogle, loginWithEmail, registerWithEmail, logout, updateUser, refreshUserData])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
