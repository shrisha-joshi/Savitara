import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as SecureStore from 'expo-secure-store';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import api from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || '';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const useGoogleAuth = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim() !== '' && GOOGLE_CLIENT_ID !== 'your-google-client-id';
  
  const [, response, promptAsync] = Google.useAuthRequest(
    useGoogleAuth ? {
      expoClientId: GOOGLE_CLIENT_ID,
      iosClientId: GOOGLE_CLIENT_ID,
      androidClientId: GOOGLE_CLIENT_ID,
      webClientId: GOOGLE_CLIENT_ID,
    } : {
      expoClientId: 'dummy-client-id',
      iosClientId: 'dummy-client-id',
      androidClientId: 'dummy-client-id',
      webClientId: 'dummy-client-id',
    }
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleLogin(response.authentication.idToken);
    }
  }, [response]);

  const checkAuth = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (accessToken && refreshToken) {
        const apiResponse = await api.get('/users/me');
        if (apiResponse.data.role === 'admin') {
          setUser(apiResponse.data);
        } else {
          await logout();
          setError('Access denied. Admin role required.');
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      setLoading(true);
      setError(null);
      
      const apiResponse = await api.post('/auth/google', { id_token: idToken });
      const { access_token, refresh_token, user: userData } = apiResponse.data;

      if (userData.role !== 'admin') {
        setError('Access denied. Admin role required.');
        return;
      }

      await SecureStore.setItemAsync('accessToken', access_token);
      await SecureStore.setItemAsync('refreshToken', refresh_token);
      setUser(userData);
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    if (!useGoogleAuth) {
      setError('Google Client ID not configured. Please update .env file.');
      return;
    }
    promptAsync();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setUser(null);
    }
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  }), [user, loading, error]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
