/**
 * Admin Savitara App – API Client
 * Storage adapter: expo-secure-store (React Native, encrypted)
 */
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createApiClient } from './createApiClient';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000/api/v1';

const api = createApiClient({
  baseURL:    API_BASE_URL,
  getToken:   () => SecureStore.getItemAsync('accessToken'),
  getRefresh: () => SecureStore.getItemAsync('refreshToken'),
  setToken:   (t) => SecureStore.setItemAsync('accessToken', t),
  setRefresh: (t) => SecureStore.setItemAsync('refreshToken', t),
  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  },
});

export default api;

