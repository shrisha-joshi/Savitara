import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api.config';

const api = axios.create(API_CONFIG);

// Request interceptor for adding auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await axios.post(
          `${API_CONFIG.baseURL}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        
        const { access_token } = response.data;
        await AsyncStorage.setItem('accessToken', access_token);
        
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        throw refreshError;
      }
    }
    
    throw error;
  }
);

// Auth APIs
export const authAPI = {
  googleLogin: (idToken) => api.post('/auth/google', { id_token: idToken }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  onboardGrihasta: (data) => api.post('/users/grihasta/onboarding', data),
  onboardAcharya: (data) => api.post('/users/acharya/onboarding', data),
  searchAcharyas: (params) => api.get('/users/acharyas/search', { params }),
  getAcharya: (id) => api.get(`/users/acharyas/${id}`),
};

// Booking APIs
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getMyBookings: (params) => api.get('/bookings/my', { params }),
  getAcharyaBookings: (params) => api.get('/bookings/acharya', { params }),
  getBooking: (id) => api.get(`/bookings/${id}`),
  startBooking: (id, otp) => api.post(`/bookings/${id}/start`, { otp }),
  confirmAttendance: (id, data) => api.post(`/bookings/${id}/attendance`, data),
};

// Chat APIs
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (conversationId, params) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, data) => api.post(`/chat/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId) => api.post(`/chat/conversations/${conversationId}/read`),
  getOpenChat: () => api.get('/chat/open'),
  postOpenMessage: (data) => api.post('/chat/open/messages', data),
};

// Review APIs
export const reviewAPI = {
  create: (data) => api.post('/reviews', data),
  getAcharyaReviews: (acharyaId, params) => api.get(`/reviews/acharya/${acharyaId}`, { params }),
  getPlatformReviews: (params) => api.get('/reviews/platform', { params }),
  getMyReviews: () => api.get('/reviews/my'),
};

export default api;
