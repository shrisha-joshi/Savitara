import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { authAPI, userAPI } from '../services/api';
import { GOOGLE_CLIENT_ID } from '../config/api.config';

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
      const [accessToken, userData] = await AsyncStorage.multiGet(['accessToken', 'user']);
      
      if (accessToken[1] && userData[1]) {
        setUser(JSON.parse(userData[1]));
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
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
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await userAPI.getProfile();
      const userData = response.data;
      
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
    isOnboarded: user?.onboarding_completed || false,
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
