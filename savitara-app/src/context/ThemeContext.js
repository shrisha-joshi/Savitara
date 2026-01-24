/**
 * Theme Context for Dark Mode Support
 * Provides theme state management across the app
 */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MD3LightTheme,
  MD3DarkTheme,
} from 'react-native-paper';
import PropTypes from 'prop-types';

const THEME_STORAGE_KEY = 'theme_preference';

// Savitara brand colors
const brandColors = {
  primary: '#FF6B35',        // Saffron orange (Hindu spiritual)
  primaryDark: '#E55A2B',
  primaryLight: '#FF8B5C',
  secondary: '#8B4513',      // Sandalwood brown
  accent: '#FFD700',         // Gold (auspicious)
  spiritual: '#9932CC',      // Divine purple
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

// Light theme configuration
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brandColors.primary,
    primaryContainer: '#FFE4D6',
    secondary: brandColors.secondary,
    secondaryContainer: '#F5E6D3',
    tertiary: brandColors.spiritual,
    tertiaryContainer: '#E8D0F5',
    
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F5',
    background: '#FAFAFA',
    
    error: brandColors.error,
    errorContainer: '#FFCDD2',
    
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#4A2600',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#3E2415',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#2D1240',
    
    onSurface: '#1C1B1F',
    onSurfaceVariant: '#49454F',
    onBackground: '#1C1B1F',
    
    outline: '#79747E',
    outlineVariant: '#CAC4D0',
    
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    inversePrimary: '#FFB59B',
    
    elevation: {
      level0: 'transparent',
      level1: '#F7F2F9',
      level2: '#F2ECF4',
      level3: '#EDE7EF',
      level4: '#EBE5ED',
      level5: '#E8E0E8',
    },
    
    // Custom Savitara colors
    saffron: brandColors.primary,
    gold: brandColors.accent,
    divine: brandColors.spiritual,
    success: brandColors.success,
    warning: brandColors.warning,
    
    // Card and UI colors
    card: '#FFFFFF',
    cardBorder: '#E0E0E0',
    divider: '#E0E0E0',
    placeholder: '#9E9E9E',
    disabled: '#BDBDBD',
    
    // Text colors
    textPrimary: '#1C1B1F',
    textSecondary: '#49454F',
    textTertiary: '#79747E',
    textInverse: '#FFFFFF',
  },
  roundness: 12,
};

// Dark theme configuration
const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FFB59B',       // Lighter saffron for dark mode
    primaryContainer: '#7A3300',
    secondary: '#D4A574',     // Lighter sandalwood
    secondaryContainer: '#5C3D2E',
    tertiary: '#D8A9F0',      // Lighter purple
    tertiaryContainer: '#4A2166',
    
    surface: '#1C1B1F',
    surfaceVariant: '#2B2930',
    background: '#121212',
    
    error: '#F2B8B5',
    errorContainer: '#8C1D18',
    
    onPrimary: '#5C2000',
    onPrimaryContainer: '#FFE4D6',
    onSecondary: '#3E2415',
    onSecondaryContainer: '#F5E6D3',
    onTertiary: '#2D1240',
    onTertiaryContainer: '#E8D0F5',
    
    onSurface: '#E6E1E5',
    onSurfaceVariant: '#CAC4D0',
    onBackground: '#E6E1E5',
    
    outline: '#938F99',
    outlineVariant: '#49454F',
    
    inverseSurface: '#E6E1E5',
    inverseOnSurface: '#313033',
    inversePrimary: '#FF6B35',
    
    elevation: {
      level0: 'transparent',
      level1: '#232127',
      level2: '#28262B',
      level3: '#2D2B30',
      level4: '#2F2D32',
      level5: '#322F35',
    },
    
    // Custom Savitara colors
    saffron: '#FFB59B',
    gold: '#FFD54F',
    divine: '#D8A9F0',
    success: '#81C784',
    warning: '#FFB74D',
    
    // Card and UI colors
    card: '#1E1E1E',
    cardBorder: '#2C2C2C',
    divider: '#2C2C2C',
    placeholder: '#757575',
    disabled: '#616161',
    
    // Text colors
    textPrimary: '#E6E1E5',
    textSecondary: '#CAC4D0',
    textTertiary: '#938F99',
    textInverse: '#1C1B1F',
  },
  roundness: 12,
};

// Context type
const ThemeContext = createContext({
  theme: lightTheme,
  isDarkMode: false,
  themePreference: 'system', // 'light', 'dark', 'system'
  toggleTheme: () => {},
  setThemePreference: () => {},
  colors: lightTheme.colors,
});

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [isLoading, setIsLoading] = useState(true);
  
  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);
  
  const loadThemePreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedPreference) {
        setThemePreference(savedPreference);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveThemePreference = async (preference) => {
    try {
      setThemePreference(preference);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };
  
  const toggleTheme = () => {
    const newPreference = isDarkMode ? 'light' : 'dark';
    saveThemePreference(newPreference);
  };
  
  // Determine if dark mode based on preference and system setting
  const isDarkMode = useMemo(() => {
    if (themePreference === 'system') {
      return systemColorScheme === 'dark';
    }
    return themePreference === 'dark';
  }, [themePreference, systemColorScheme]);
  
  // Select theme based on dark mode
  const theme = useMemo(() => {
    return isDarkMode ? darkTheme : lightTheme;
  }, [isDarkMode]);
  
  const value = useMemo(() => ({
    theme,
    isDarkMode,
    themePreference,
    toggleTheme,
    setThemePreference: saveThemePreference,
    colors: theme.colors,
  }), [theme, isDarkMode, themePreference]);
  
  if (isLoading) {
    return null; // Or a loading component
  }
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Styled components helper
export const createThemedStyles = (styleCreator) => {
  return () => {
    const { colors, isDarkMode } = useTheme();
    return useMemo(() => styleCreator(colors, isDarkMode), [colors, isDarkMode]);
  };
};

// Export themes for direct usage
export { lightTheme, darkTheme, brandColors };

export default ThemeContext;
