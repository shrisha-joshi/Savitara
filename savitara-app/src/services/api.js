/**
 * Savitara App – API Client
 * Storage adapter: AsyncStorage (React Native)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api.config';
import { createApiClient } from './createApiClient';

const api = createApiClient({
  baseURL: API_CONFIG.baseURL,
  getToken:   () => AsyncStorage.getItem('accessToken'),
  getRefresh: () => AsyncStorage.getItem('refreshToken'),
  setToken:   (t) => AsyncStorage.setItem('accessToken', t),
  setRefresh: (t) => AsyncStorage.setItem('refreshToken', t),
  clearAuth:  () => AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']),
});

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
  updateGrihastaProfile: (data) => api.put('/users/grihasta/profile', data),
  updateAcharyaProfile: (data) => api.put('/users/acharya/profile', data),
  onboardGrihasta: (data) => api.post('/users/grihasta/onboarding', data),
  onboardAcharya: (data) => api.post('/users/acharya/onboarding', data),
  searchAcharyas: (params) => api.get('/users/acharyas/search', { params }),
  getAcharya: (id) => api.get(`/users/acharyas/${id}`),
};

// Booking APIs
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getMyBookings: (params) => api.get('/bookings/my-bookings', { params }),
  getAcharyaBookings: (params) => api.get('/bookings/my-bookings', { params }),
  getBooking: (id) => api.get(`/bookings/${id}`),
  updateBookingStatus: (id, data) => api.put(`/bookings/${id}/status`, data),
  createPaymentOrder: (id) => api.post(`/bookings/${id}/create-payment-order`),
  verifyPayment: (id, data) => api.post(`/bookings/${id}/payment/verify`, data),
  startBooking: (id, otp) => api.post(`/bookings/${id}/start`, { otp }),
  confirmAttendance: (id, data) => api.post(`/bookings/${id}/attendance`, data),
  referBooking: (bookingId, newAcharyaId, notes) => api.put(`/bookings/${bookingId}/refer`, { new_acharya_id: newAcharyaId, notes }),
  fetchAcharyas: async () => {
    const res = await api.get('/users/acharyas/search', { params: { limit: 100 } });
    return res.data?.data?.profiles || [];
  },
};

// Chat APIs
export const chatAPI = {
  getConversations: (params) => api.get('/chat/conversations', { params }),
  getMessages: (conversationId, params) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  // Backend: POST /chat/messages with { receiver_id, content }
  sendMessage: (data) => api.post('/chat/messages', data),
  // Backend: GET /chat/conversations then mark read on message fetch
  markAsRead: (conversationId) => api.get(`/chat/conversations/${conversationId}/messages?page=1&limit=1`),
  getOpenChat: (params) => api.get('/chat/open-chat', { params }),
  verifyConversation: (recipientId) => api.post('/chat/verify-conversation', { recipient_id: recipientId }),
  getUnreadCount: () => api.get('/chat/unread-count'),
  deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
  
  // Reactions
  addReaction: (messageId, emoji) => api.post(`/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId, emoji) => api.delete(`/messages/${messageId}/reactions/${emoji}`),
  getReactions: (messageId) => api.get(`/messages/${messageId}/reactions`),
  
  // Conversation settings
  pinConversation: (conversationId) => api.post(`/chat/conversations/${conversationId}/pin`),
  archiveConversation: (conversationId) => api.post(`/chat/conversations/${conversationId}/archive`),
  muteConversation: (conversationId, data) => api.patch(`/chat/conversations/${conversationId}/settings`, data),
  deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
  
  // Message forwarding
  forwardMessage: (messageId, data) => api.post(`/messages/${messageId}/forward`, data),
};

// Review APIs
export const reviewAPI = {
  create: (data) => api.post('/reviews', data),
  getAcharyaReviews: (acharyaId, params) => api.get(`/reviews/acharya/${acharyaId}`, { params }),
  getPlatformReviews: (params) => api.get('/reviews/platform', { params }),
  getMyReviews: () => api.get('/reviews/my'),
};

export default api;
