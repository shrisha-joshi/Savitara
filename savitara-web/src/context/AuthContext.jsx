import { createContext, useState, useContext, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { signInWithGoogle as firebaseGoogleSignIn, firebaseSignOut } from '../services/firebase'
import { toast } from 'react-toastify'

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
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')

    if (!accessToken || !refreshToken) {
      setLoading(false)
      return
    }

    try {
      const response = await api.get('/auth/me')
      // Extract user data from StandardResponse format
      const userData = response.data.data || response.data
      setUser(userData)
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    } finally {
      setLoading(false)
    }
  }

  const loginWithEmail = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { access_token, refresh_token, user: userData } = response.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      
      setUser(userData)
      
      if (userData.onboarded) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }

      toast.success('Login successful!')
    } catch (error) {
      console.error('Login failed:', error)
      toast.error(error.response?.data?.detail || 'Login failed')
      throw error
    }
  }

  const registerWithEmail = async (data) => {
    try {
      const response = await api.post('/auth/register', data)
      const { access_token, refresh_token, user: userData } = response.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      
      setUser(userData)
      navigate('/onboarding')
      toast.success('Registration successful!')
    } catch (error) {
      console.error('Registration failed:', error)
      toast.error(error.response?.data?.detail || 'Registration failed')
      throw error
    }
  }

  // Updated to use Firebase Google Sign-In
  const loginWithGoogle = async (legacyCredential = null) => {
    try {
      let idToken

      // If called with a credential (legacy @react-oauth/google), use it
      if (legacyCredential) {
        idToken = legacyCredential
      } else {
        // Use Firebase Google Sign-In
        const result = await firebaseGoogleSignIn()
        idToken = result.idToken
      }

      // Send token to backend with correct field name and role
      const response = await api.post('/auth/google', {
        id_token: idToken,  // Backend expects 'id_token', not 'token'
        role: 'grihasta'    // Default role for user app
      })

      const { data } = response.data // Backend returns StandardResponse with data field
      const { access_token, refresh_token, user: userData } = data
      
      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      
      setUser(userData)
      
      // Check if user needs onboarding
      // Backend logic: "requires_onboarding": not (user.onboarded and profile_exists)
      // Frontend decides navigation based on this
      if (userData.requires_onboarding || userData.is_new_user) {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }

      toast.success('Login successful!')
    } catch (error) {
      console.error('Login failed:', error)
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Login failed')
      throw error
    }
  }

  const logout = async () => {
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
    setUser(null)
    navigate('/login')
    toast.info('Logged out successfully')
  }

  const updateUser = (userData) => {
    setUser(userData)
  }

  const refreshUserData = async () => {
    try {
      const response = await api.get('/users/me')
      setUser(response.data)
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }

  const value = useMemo(() => ({
    user,
    loading,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    updateUser,
    refreshUserData,
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
}
