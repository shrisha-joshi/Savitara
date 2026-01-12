import Constants from 'expo-constants';

export const API_CONFIG = {
  baseURL: Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';
export const RAZORPAY_KEY_ID = Constants.expoConfig?.extra?.razorpayKeyId || '';
