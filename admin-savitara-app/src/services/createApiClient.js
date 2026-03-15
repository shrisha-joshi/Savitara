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

function randomHex(length) {
  const bytes = Math.ceil(length / 2);
  if (globalThis.crypto?.getRandomValues) {
    const array = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }

  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += Math.floor(Math.random() * 16).toString(16);
  }
  return value;
}

function parseTraceparent(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const match = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(headerValue.trim());
  if (!match) return null;
  return {
    version: match[1].toLowerCase(),
    traceId: match[2].toLowerCase(),
    spanId: match[3].toLowerCase(),
    traceFlags: match[4].toLowerCase(),
  };
}

function buildTraceparent(traceId, spanId, traceFlags = '01') {
  return `00-${traceId}-${spanId}-${traceFlags}`;
}

export function createApiClient({
  baseURL,
  getToken,
  getRefresh,
  setToken,
  setRefresh,
  clearAuth,
  onAuthFailure = () => {},
}) {
  let traceContext = null;

  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  // ── Request interceptor ────────────────────────────────────────────────
  client.interceptors.request.use(
    async (config) => {
      const activeTraceId = traceContext?.traceId || randomHex(32);
      const traceFlags = traceContext?.traceFlags || '01';
      const requestSpanId = randomHex(16);

      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      config.headers.traceparent = buildTraceparent(activeTraceId, requestSpanId, traceFlags);
      if (traceContext?.tracestate) {
        config.headers.tracestate = traceContext.tracestate;
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
    (response) => {
      const nextTraceparent = response?.headers?.traceparent;
      const parsed = parseTraceparent(nextTraceparent);
      if (parsed) {
        traceContext = {
          traceId: parsed.traceId,
          traceFlags: parsed.traceFlags,
          tracestate: response?.headers?.tracestate || traceContext?.tracestate || null,
        };
      }
      return response;
    },
    async (error) => {
      const nextTraceparent = error?.response?.headers?.traceparent;
      const parsed = parseTraceparent(nextTraceparent);
      if (parsed) {
        traceContext = {
          traceId: parsed.traceId,
          traceFlags: parsed.traceFlags,
          tracestate: error?.response?.headers?.tracestate || traceContext?.tracestate || null,
        };
      }

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
