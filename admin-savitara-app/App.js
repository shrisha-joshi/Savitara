import React, { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

// Typography Standard:
// - Brand: Samarkan - ONLY for "Savitara" company name  
// - Headings: Poppins (weights: 500-700)
// - Body: Inter (gold standard for UI)
const theme = {
  colors: {
    primary: '#E65C00',       // Dark Saffron (brand color)
    secondary: '#2B3A67',     // Royal Blue
    background: '#FFF5E6',    // Light cream
    surface: '#FFFFFF',
    error: '#F44336',
    text: '#1A2233',
    onSurface: '#1A2233',
    disabled: '#BDBDBD',
    placeholder: '#757575',
  },
  fonts: {
    // Configure Paper fonts (will use system fonts as fallback)
    regular: { fontFamily: 'Inter_400Regular', fontWeight: 'normal' },
    medium: { fontFamily: 'Inter_500Medium', fontWeight: 'normal' },
    bold: { fontFamily: 'Inter_700Bold', fontWeight: 'normal' },
    heavy: { fontFamily: 'Poppins_700Bold', fontWeight: 'normal' },
  },
};

export default function App() {
  // Load typography fonts
  const [fontsLoaded] = useFonts({
    // Samarkan - ONLY for "Savitara" brand name
    Samarkan: require('./assets/fonts/Samarkan.otf'),
    // Inter - Primary body font
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Poppins - Heading font
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E65C00" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
  },
});
