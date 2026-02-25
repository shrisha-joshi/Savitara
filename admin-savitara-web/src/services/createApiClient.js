/**
 * createApiClient - Shared axios factory with standardised interceptors
 * -----------------------------------------------------------------------
 * Eliminates duplicated interceptor boilerplate across all 4 frontend apps.
 *
 * @param {object} opts
 * @param {string}   opts.baseURL        - API base URL
 * @param {Function} opts.getToken       - () => Promise<string|null>  access token getter
 * @param {Function} opts.getRefresh     - () => Promise<string|null>  refresh token getter
 * @param {Function} opts.setToken       - (token: string) => Promise<void>
 * @param {Function} opts.setRefresh     - (token: string) => Promise<void>
 * @param {Function} opts.clearAuth      - () => Promise<void>  called on irrecoverable 401
 * @param {Function} [opts.onAuthFailure]- optional callback after clearAuth (e.g. redirect)
 */

import axios from 'axios';

export function createApiClient({
  baseURL,
  getToken,
  getRefresh,
  setToken,
  setRefresh,
  clearAuth,
  onAuthFailure = () => {},
}) {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  // ── Request interceptor ────────────────────────────────────────────────
  client.interceptors.request.use(
    async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // ── Response interceptor with queued refresh ───────────────────────────
  let isRefreshing = false;
  let failedQueue = [];

  const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) =>
      error ? prom.reject(error) : prom.resolve(token)
    );
    failedQueue = [];
  };

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status !== 401 || originalRequest._retry) {
        throw error;
      }

      // Queue concurrent requests while a refresh is in flight
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefresh();
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = data;

        await setToken(access_token);
        if (newRefreshToken) await setRefresh(newRefreshToken);

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearAuth();
        onAuthFailure();
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
  );

  return client;
}
