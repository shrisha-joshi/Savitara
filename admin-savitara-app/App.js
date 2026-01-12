import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const theme = {
  colors: {
    primary: '#FF6B35',
    secondary: '#004E89',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    error: '#F44336',
    text: '#000000',
    onSurface: '#000000',
    disabled: '#BDBDBD',
    placeholder: '#757575',
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}
