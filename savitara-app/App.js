import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/i18n';
import ErrorBoundary from './src/components/ErrorBoundary';
import NotificationService from './src/services/notifications';
import WebSocketService from './src/services/websocket';

const AppContent = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize services
    NotificationService.initialize();

    const userId = user?.id || user?._id;
    if (userId) {
      WebSocketService.connect(userId);
    }
  }, [user]);

  return (
    <ErrorBoundary>
      <AppNavigator />
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AuthProvider>
          <AppContent />
          <StatusBar style="auto" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
