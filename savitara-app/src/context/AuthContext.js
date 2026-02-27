import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config/api.config';
import { authAPI, userAPI } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only initialize Google auth if client ID is configured
  const useGoogleAuth = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim() !== '' && GOOGLE_CLIENT_ID !== 'your-google-client-id';
  
  const googleConfig = {
    androidClientId: useGoogleAuth ? GOOGLE_CLIENT_ID : 'dummy-client-id.apps.googleusercontent.com',
    expoClientId: useGoogleAuth ? GOOGLE_CLIENT_ID : 'dummy-client-id.apps.googleusercontent.com',
    webClientId: useGoogleAuth ? GOOGLE_CLIENT_ID : 'dummy-client-id.apps.googleusercontent.com',
  };
  
  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleLogin(response.authentication.idToken);
    }
  }, [response]);

  const loadUser = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const userData = await AsyncStorage.getItem('user');
      
      if (accessToken && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err) {
      console.error('Failed to load user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.googleLogin(idToken);
      const { access_token, refresh_token, user: userData } = response.data;
      
      await AsyncStorage.multiSet([
        ['accessToken', access_token],
        ['refreshToken', refresh_token],
        ['user', JSON.stringify(userData)],
      ]);
      
      setUser(userData);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    if (!useGoogleAuth) {
      setError('Google Client ID not configured. Please update .env file with your Google OAuth Client ID.');
      return;
    }
    try {
      setError(null);
      await promptAsync();
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate Google Sign-In. Please try again.');
    }
  };

  const loginWithEmail = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.login(email, password);
      const { access_token, refresh_token, user: userData } = response.data.data;
      
      await AsyncStorage.multiSet([
        ['accessToken', access_token],
        ['refreshToken', refresh_token],
        ['user', JSON.stringify(userData)],
      ]);
      
      setUser(userData);
      return userData; // Return user data for navigation decision
    } catch (err) {
      // Handle specific error messages from backend
      const errorMessage = err.response?.data?.detail || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (data) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.register(data);
      const { access_token, refresh_token, user: userData } = response.data.data;
      
      await AsyncStorage.multiSet([
        ['accessToken', access_token],
        ['refreshToken', refresh_token],
        ['user', JSON.stringify(userData)],
      ]);
      
      setUser(userData);
      return userData; // Return user data for navigation decision
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout API failed:', err);
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await AsyncStorage.removeItem('user');
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await userAPI.getProfile();
      // Handle StandardResponse format from backend
      const userData = response.data.data || response.data;
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    login,
    loginWithEmail,
    registerWithEmail,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    // Support both field names for compatibility
    isOnboarded: user?.onboarded || user?.onboarding_completed || false,
    userRole: user?.role,
  }), [user, loading, error, login, logout, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
