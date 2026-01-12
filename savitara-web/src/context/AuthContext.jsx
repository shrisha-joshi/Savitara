import { createContext, useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
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
      const response = await api.get('/users/me')
      setUser(response.data)
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
      
      if (!userData.onboarded) {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
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

  const loginWithGoogle = async (credential) => {
    try {
      const response = await api.post('/auth/google', {
        token: credential
      })

      const { access_token, refresh_token, user: userData } = response.data

      localStorage.setItem('accessToken', access_token)
      localStorage.setItem('refreshToken', refresh_token)
      
      setUser(userData)
      
      if (!userData.onboarded) {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }

      toast.success('Login successful!')
    } catch (error) {
      console.error('Login failed:', error)
      toast.error(error.response?.data?.detail || 'Login failed')
      throw error
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API failed:', error)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
      navigate('/login')
      toast.info('Logged out successfully')
    }
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

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    updateUser,
    refreshUserData,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
