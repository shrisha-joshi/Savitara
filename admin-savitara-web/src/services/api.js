import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Admin APIs
export const adminAPI = {
  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),
  
  // Analytics
  getUserGrowth: (params) => api.get('/admin/analytics/user-growth', { params }),
  getRevenue: (params) => api.get('/admin/analytics/revenue', { params }),
  getBookingStats: () => api.get('/admin/analytics/booking-stats'),
  
  // User Management
  searchUsers: (params) => api.get('/admin/users', { params }),
  suspendUser: (userId, reason) => api.post(`/admin/users/${userId}/suspend`, { reason }),
  unsuspendUser: (userId) => api.post(`/admin/users/${userId}/unsuspend`),
  
  // Acharya Verification
  getPendingVerifications: () => api.get('/admin/acharyas/pending-verification'),
  verifyAcharya: (acharyaId) => api.post(`/admin/acharyas/${acharyaId}/verify`),
  rejectAcharya: (acharyaId, reason) => api.post(`/admin/acharyas/${acharyaId}/reject`, { reason }),
  
  // Review Moderation
  getPendingReviews: () => api.get('/admin/reviews/pending'),
  approveReview: (reviewId) => api.post(`/admin/reviews/${reviewId}/approve`),
  rejectReview: (reviewId, reason) => api.post(`/admin/reviews/${reviewId}/reject`, { reason }),
  
  // Platform Reviews
  getPlatformReviews: (params) => api.get('/admin/reviews/platform', { params }),
  
  // Notifications
  sendBroadcast: (data) => api.post('/admin/notifications/broadcast', data),
};

// Auth APIs
export const authAPI = {
  googleLogin: (idToken) => api.post('/auth/google', { id_token: idToken }),
};

export default api;
