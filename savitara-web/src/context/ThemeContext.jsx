import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Theme Context
const ThemeContext = createContext();

// ============================================
// SAVITARA DESIGN SYSTEM - Modern UI Palette
// ============================================

// Core Brand Colors - Saffron Scale
const SAFFRON = {
  50: '#FFF8F0',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#F97316', // Primary Saffron
  600: '#EA580C',
  700: '#C2410C',
  800: '#9A3412',
  900: '#7C2D12',
};

// Amber Accents
const AMBER = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
};

// Light Theme - Warm, Inviting, Spiritual
const lightColors = {
  mode: 'light',
  primary: {
    main: SAFFRON[500],
    light: SAFFRON[400],
    dark: SAFFRON[600],
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: AMBER[600],
    light: AMBER[500],
    dark: AMBER[700],
    contrastText: '#FFFFFF',
  },
  background: {
    default: '#FAFAF9', // Stone-50
    paper: '#FFFFFF',
    card: '#FFFFFF',
    navbar: 'rgba(255, 255, 255, 0.8)',
    gradient: `linear-gradient(135deg, ${SAFFRON[50]} 0%, #FFFFFF 50%, ${AMBER[50]} 100%)`,
    header: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 50%, ${AMBER[600]} 100%)`,
  },
  text: {
    primary: '#1C1917', // Stone-900
    secondary: '#57534E', // Stone-600
    disabled: '#A8A29E',
  },
  border: {
    light: '#E8E8E8',
    main: '#D0D0D0',
  },
  action: {
    hover: 'rgba(249, 115, 22, 0.08)',
    selected: 'rgba(249, 115, 22, 0.12)',
  },
};

// Dark Theme - Rich, Mystical, Modern with Saffron accents
const darkColors = {
  mode: 'dark',
  primary: {
    main: SAFFRON[400],
    light: SAFFRON[300],
    dark: SAFFRON[500],
    contrastText: '#18181B',
  },
  secondary: {
    main: AMBER[400],
    light: AMBER[300],
    dark: AMBER[500],
    contrastText: '#18181B',
  },
  background: {
    default: '#0C0A09', // Rich Warm Black
    paper: '#1C1917', // Stone-900
    card: '#1C1917',
    navbar: 'rgba(28, 25, 23, 0.8)',
    gradient: `linear-gradient(135deg, #1C1917 0%, #0C0A09 50%, #1C1917 100%)`,
    header: `linear-gradient(135deg, ${SAFFRON[700]} 0%, ${SAFFRON[800]} 50%, #1C1917 100%)`,
  },
  text: {
    primary: '#FAFAF9', // Stone-50
    secondary: '#A8A29E', // Stone-400
    disabled: '#57534E',
  },
  border: {
    light: '#333333',
    main: '#444444',
  },
  action: {
    hover: 'rgba(251, 146, 60, 0.12)',
    selected: 'rgba(251, 146, 60, 0.16)',
  },
};

// Create MUI theme based on mode
const createAppTheme = (mode) => {
  const colors = mode === 'dark' ? darkColors : lightColors;
  const isDark = mode === 'dark';
  
  return createTheme({
    palette: {
      mode,
      primary: colors.primary,
      secondary: colors.secondary,
      background: {
        default: colors.background.default,
        paper: colors.background.paper,
      },
      text: colors.text,
      success: {
        main: '#22C55E',
        light: '#4ADE80',
        dark: '#16A34A',
      },
      warning: {
        main: '#FACC15',
        light: '#FDE047',
        dark: '#EAB308',
      },
      error: {
        main: '#EF4444',
        light: '#F87171',
        dark: '#DC2626',
      },
      // Custom palette extensions
      saffron: SAFFRON,
      amber: AMBER,
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h1: { fontFamily: '"Poppins", sans-serif', fontWeight: 700, letterSpacing: '-0.025em' },
      h2: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.025em' },
      h3: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h4: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontFamily: '"Poppins", sans-serif', fontWeight: 500 },
      h6: { fontFamily: '"Poppins", sans-serif', fontWeight: 500 },
      button: { fontFamily: '"Inter", sans-serif', fontWeight: 600, letterSpacing: '0.01em' },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      'none',
      isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
      isDark ? '0 4px 6px -1px rgba(0,0,0,0.4)' : '0 4px 6px -1px rgba(0,0,0,0.1)',
      isDark ? '0 10px 15px -3px rgba(0,0,0,0.4)' : '0 10px 15px -3px rgba(0,0,0,0.1)',
      isDark ? '0 20px 25px -5px rgba(0,0,0,0.4)' : '0 20px 25px -5px rgba(0,0,0,0.1)',
      isDark ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(0,0,0,0.25)',
      ...Array(19).fill('none'),
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundImage: colors.background.gradient,
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
          },
          '::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '::-webkit-scrollbar-track': {
            background: isDark ? '#1C1917' : '#F5F5F4',
          },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? SAFFRON[700] : SAFFRON[300],
            borderRadius: '4px',
            '&:hover': {
              background: isDark ? SAFFRON[600] : SAFFRON[400],
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
            padding: '8px 20px',
            fontWeight: 600,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 100%)`,
            boxShadow: `0 4px 14px ${isDark ? 'rgba(249, 115, 22, 0.4)' : 'rgba(249, 115, 22, 0.25)'}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${SAFFRON[400]} 0%, ${SAFFRON[500]} 100%)`,
              boxShadow: `0 6px 20px ${isDark ? 'rgba(249, 115, 22, 0.5)' : 'rgba(249, 115, 22, 0.35)'}`,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(28, 25, 23, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: isDark 
                ? '0 20px 40px -10px rgba(249, 115, 22, 0.15)'
                : '0 20px 40px -10px rgba(249, 115, 22, 0.12)',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: isDark 
              ? '0 4px 30px rgba(249, 115, 22, 0.15)'
              : '0 4px 30px rgba(249, 115, 22, 0.15)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'}`,
          },
        },
      },
    },
  });
};

// Theme Provider Component
export const ThemeContextProvider = ({ children }) => {
  // Initialize from localStorage - Default to light mode always
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('savitara-theme');
    // Return saved mode if exists, otherwise always default to light
    return savedMode || 'light';
  });

  // Save to localStorage when mode changes
  useEffect(() => {
    localStorage.setItem('savitara-theme', mode);
    
    // Update document class for global CSS
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const savedMode = localStorage.getItem('savitara-theme');
      if (!savedMode) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const themeColors = mode === 'dark' ? darkColors : lightColors;

  const value = {
    mode,
    toggleTheme,
    isDark: mode === 'dark',
    isLight: mode === 'light',
    colors: themeColors,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeContextProvider');
  }
  return context;
};

export default ThemeContext;
