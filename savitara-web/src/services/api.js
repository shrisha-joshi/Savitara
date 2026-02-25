/**
 * Savitara Web – API Client
 * Storage adapter: localStorage (browser)
 */
import { toast } from 'react-toastify'
import { createApiClient } from './createApiClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'

const api = createApiClient({
  baseURL: API_BASE_URL,
  getToken:   () => Promise.resolve(localStorage.getItem(TOKEN_KEY)),
  getRefresh: () => Promise.resolve(localStorage.getItem(REFRESH_KEY)),
  setToken:   (t) => { localStorage.setItem(TOKEN_KEY, t); return Promise.resolve() },
  setRefresh: (t) => { localStorage.setItem(REFRESH_KEY, t); return Promise.resolve() },
  clearAuth: () => {
    ;['accessToken', 'refreshToken', 'user'].forEach((k) => localStorage.removeItem(k))
    return Promise.resolve()
  },
  onAuthFailure: () => { globalThis.location.href = '/login' },
})

// HTTP status-code toast notifications (separate concern from auth refresh)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 403) toast.error('Access denied')
    else if (status === 404) toast.error('Resource not found')
    else if (status >= 500) toast.error('Server error. Please try again later.')
    throw error
  }
)

export default api
