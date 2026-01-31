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
  // Dashboard Analytics - matches /admin/dashboard/analytics
  getDashboard: () => api.get('/admin/dashboard/analytics'),
  
  // Analytics - these use the main dashboard/analytics endpoint
  getUserGrowth: (params) => api.get('/admin/dashboard/analytics', { params }),
  getRevenue: (params) => api.get('/admin/dashboard/analytics', { params }),
  getBookingStats: () => api.get('/admin/dashboard/analytics'),
  
  // User Management - matches /admin/users/search
  searchUsers: (params) => api.get('/admin/users/search', { params }),
  suspendUser: (userId, reason) => api.post(`/admin/users/${userId}/suspend`, null, { params: { reason } }),
  unsuspendUser: (userId) => api.post(`/admin/users/${userId}/unsuspend`),
  
  // Acharya Verification - matches /admin/acharyas/pending and /admin/acharyas/{id}/verify
  getPendingVerifications: () => api.get('/admin/acharyas/pending'),
  verifyAcharya: (acharyaId) => api.post(`/admin/acharyas/${acharyaId}/verify`, null, { params: { action: 'approve' } }),
  rejectAcharya: (acharyaId, reason) => api.post(`/admin/acharyas/${acharyaId}/verify`, null, { params: { action: 'reject', notes: reason } }),
  
  // Review Moderation - matches /admin/reviews/pending and /admin/reviews/{id}/moderate
  getPendingReviews: () => api.get('/admin/reviews/pending'),
  approveReview: (reviewId) => api.post(`/admin/reviews/${reviewId}/moderate`, null, { params: { action: 'approve' } }),
  rejectReview: (reviewId, reason) => api.post(`/admin/reviews/${reviewId}/moderate`, null, { params: { action: 'reject', notes: reason } }),
  
  // Platform Reviews
  getPlatformReviews: (params) => api.get('/admin/reviews/platform', { params }),
  
  // Notifications
  sendBroadcast: (data) => api.post('/admin/notifications/broadcast', data),
  getNotificationHistory: (params) => api.get('/admin/notifications/history', { params }),
  
  // Content Management
  getTestimonials: () => api.get('/admin/content/testimonials'),
  createTestimonial: (data) => api.post('/admin/content/testimonials', data),
  updateTestimonial: (id, data) => api.put(`/admin/content/testimonials/${id}`, data),
  toggleTestimonial: (id, data) => api.patch(`/admin/content/testimonials/${id}/toggle`, data),
  deleteTestimonial: (id) => api.delete(`/admin/content/testimonials/${id}`),
  
  getAnnouncements: () => api.get('/admin/content/announcements'),
  createAnnouncement: (data) => api.post('/admin/content/announcements', data),
  updateAnnouncement: (id, data) => api.put(`/admin/content/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/content/announcements/${id}`),
  
  // Admin Management (Super Admin only)
  listAdmins: () => api.get('/admin/auth/admins'),
  addAdmin: (data) => api.post('/admin/auth/add-admin', data),
  removeAdmin: (email) => api.delete('/admin/auth/remove-admin', { data: { email } }),
};

// Admin Auth APIs (Email/Password based)
export const adminAuthAPI = {
  login: (email, password) => api.post('/admin/auth/login', { email, password }),
  checkEmail: (email) => api.post('/admin/auth/check-email', { email, password: '' }),
  setupPassword: (email, password, confirmPassword) => 
    api.post('/admin/auth/setup-password', { 
      email, 
      password, 
      confirm_password: confirmPassword 
    }),
  initSuperAdmin: () => api.post('/admin/auth/init-super-admin'),
};

// Auth APIs (kept for backwards compatibility)
export const authAPI = {
  googleLogin: (idToken) => api.post('/auth/google', { id_token: idToken }),
};

export default api;
