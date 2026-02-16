import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
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
    // ============================================
    // TYPOGRAPHY SCALE - Design System Compliant
    // Base: 16px, Scale follows 4px grid
    // ============================================
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      fontSize: 16, // Base size
      h1: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '3rem', // 48px
        fontWeight: 700, 
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
        '@media (max-width:600px)': {
          fontSize: '2.25rem', // 36px on mobile
        }
      },
      h2: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '2.25rem', // 36px
        fontWeight: 600, 
        lineHeight: 1.25,
        letterSpacing: '-0.025em',
        '@media (max-width:600px)': {
          fontSize: '1.75rem', // 28px on mobile
        }
      },
      h3: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '1.75rem', // 28px
        fontWeight: 600, 
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
        '@media (max-width:600px)': {
          fontSize: '1.5rem', // 24px on mobile
        }
      },
      h4: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '1.5rem', // 24px
        fontWeight: 600, 
        lineHeight: 1.35,
        letterSpacing: '-0.02em' 
      },
      h5: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '1.25rem', // 20px
        fontWeight: 500,
        lineHeight: 1.4
      },
      h6: { 
        fontFamily: '"Poppins", sans-serif', 
        fontSize: '1.125rem', // 18px
        fontWeight: 500,
        lineHeight: 1.45
      },
      body1: { 
        fontSize: '1rem', // 16px
        lineHeight: 1.6,
        fontWeight: 400
      },
      body2: { 
        fontSize: '0.875rem', // 14px
        lineHeight: 1.5,
        fontWeight: 400
      },
      caption: { 
        fontSize: '0.75rem', // 12px
        lineHeight: 1.4,
        fontWeight: 400
      },
      button: { 
        fontFamily: '"Inter", sans-serif', 
        fontSize: '1rem', // 16px
        fontWeight: 600, 
        letterSpacing: '0.01em',
        textTransform: 'none'
      },
      overline: {
        fontSize: '0.75rem', // 12px
        fontWeight: 700,
        letterSpacing: '0.125em', // 2px
        textTransform: 'uppercase',
        lineHeight: 1.6
      }
    },
    // ============================================
    // SPACING SYSTEM - 4px Grid
    // Usage: theme.spacing(2) = 8px, theme.spacing(4) = 16px
    // ============================================
    spacing: 4, // Base unit: 4px
    // ============================================
    // BREAKPOINTS - Mobile First
    // ============================================
    breakpoints: {
      values: {
        xs: 0,      // Mobile portrait
        sm: 600,    // Mobile landscape / Tablet portrait
        md: 960,    // Tablet landscape
        lg: 1280,   // Desktop
        xl: 1920    // Large desktop
      }
    },
    // ============================================
    // SHAPE & BORDER RADIUS
    // ============================================
    shape: {
      borderRadius: 12, // Default: 12px
    },
    // ============================================
    // SHADOWS - 3-Level System (sm, md, lg)
    // Design System: shadow-sm (2), shadow-md (8), shadow-lg (20)
    // ============================================
    shadows: [
      'none',
      // [1] Minimal - rarely used
      isDark ? '0 1px 2px 0 rgba(0,0,0,0.3)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
      // [2] Small - Cards at rest (shadow-sm)
      isDark ? '0 2px 8px 0 rgba(0,0,0,0.25)' : '0 2px 8px 0 rgba(0,0,0,0.08)',
      // [3-7] Rarely used
      isDark ? '0 4px 12px -2px rgba(0,0,0,0.3)' : '0 4px 12px -2px rgba(0,0,0,0.1)',
      isDark ? '0 6px 16px -4px rgba(0,0,0,0.35)' : '0 6px 16px -4px rgba(0,0,0,0.12)',
      isDark ? '0 8px 20px -4px rgba(0,0,0,0.4)' : '0 8px 20px -4px rgba(0,0,0,0.14)',
      isDark ? '0 10px 24px -4px rgba(0,0,0,0.45)' : '0 10px 24px -4px rgba(0,0,0,0.16)',
      isDark ? '0 12px 28px -8px rgba(0,0,0,0.5)' : '0 12px 28px -8px rgba(0,0,0,0.18)',
      // [8] Medium - Hover, Modals (shadow-md)
      isDark ? '0 8px 24px -4px rgba(249,115,22,0.3)' : '0 8px 24px -4px rgba(0,0,0,0.12)',
      // [9-19] Higher elevations
      ...new Array(11).fill('none'),
      // [20] Large - Floating elements (shadow-lg)
      isDark ? '0 20px 40px -8px rgba(249,115,22,0.25)' : '0 20px 40px -8px rgba(0,0,0,0.16)',
      ...new Array(4).fill('none'),
    ],
    // ============================================
    // COMPONENT OVERRIDES - Design System Alignment
    // ============================================
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundImage: colors.background.gradient,
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
            // Respect reduced motion preference
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              animation: 'none',
              '& *': {
                transition: 'none !important',
                animation: 'none !important',
              }
            }
          },
          // Custom scrollbar styling
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
            transition: 'background 0.2s',
            '&:hover': {
              background: isDark ? SAFFRON[600] : SAFFRON[400],
            },
          },
          // Focus visible for accessibility
          '*:focus-visible': {
            outline: `2px solid ${SAFFRON[500]}`,
            outlineOffset: '2px',
          }
        },
      },
      // ========================================
      // BUTTONS - Primary, Secondary, Tertiary
      // ========================================
      MuiButton: {
        defaultProps: {
          disableElevation: false,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: '1rem',
            padding: '10px 24px',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:focus-visible': {
              outline: `2px solid ${SAFFRON[500]}`,
              outlineOffset: '2px',
            }
          },
          // Size variants
          sizeSmall: {
            padding: '6px 16px',
            fontSize: '0.875rem',
            height: '32px',
          },
          sizeMedium: {
            padding: '10px 24px',
            fontSize: '1rem',
            height: '40px',
          },
          sizeLarge: {
            padding: '14px 32px',
            fontSize: '1.125rem',
            height: '48px',
          },
          // Primary Button
          containedPrimary: {
            background: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 100%)`,
            boxShadow: `0 4px 14px ${isDark ? 'rgba(249, 115, 22, 0.4)' : 'rgba(249, 115, 22, 0.25)'}`,
            color: '#FFFFFF',
            '&:hover': {
              background: `linear-gradient(135deg, ${SAFFRON[400]} 0%, ${SAFFRON[500]} 100%)`,
              boxShadow: `0 8px 20px ${isDark ? 'rgba(249, 115, 22, 0.5)' : 'rgba(249, 115, 22, 0.35)'}`,
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'translateY(0)',
              boxShadow: `0 2px 8px ${isDark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.2)'}`,
            },
            '&:disabled': {
              background: isDark ? '#333' : '#E0E0E0',
              color: isDark ? '#666' : '#999',
              boxShadow: 'none',
            }
          },
          // Outlined Button (Secondary)
          outlined: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
              transform: 'translateY(-1px)',
            }
          },
          outlinedPrimary: {
            borderColor: SAFFRON[500],
            color: SAFFRON[600],
            '&:hover': {
              borderColor: SAFFRON[600],
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(249, 115, 22, 0.08)',
            }
          },
          // Text Button (Tertiary)
          text: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.08)',
            }
          }
        },
      },
      // ========================================
      // CARDS - Glassmorphism Effect
      // ========================================
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(28, 25, 23, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
            boxShadow: isDark ? '0 2px 8px 0 rgba(0,0,0,0.25)' : '0 2px 8px 0 rgba(0,0,0,0.08)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: isDark 
                ? '0 20px 40px -8px rgba(249, 115, 22, 0.25)'
                : '0 20px 40px -8px rgba(0, 0, 0, 0.12)',
              borderColor: isDark ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.2)',
            },
          },
        },
      },
      // ========================================
      // APP BAR / NAVIGATION
      // ========================================
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(28, 25, 23, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            boxShadow: isDark 
              ? '0 4px 30px rgba(249, 115, 22, 0.15)' 
              : '0 4px 30px rgba(249, 115, 22, 0.08)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
          },
        },
      },
      // ========================================
      // INPUTS - Text Fields
      // ========================================
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'all 0.2s',
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: SAFFRON[400],
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: SAFFRON[500],
                borderWidth: '2px',
              },
            },
          },
        },
      },
      // ========================================
      // PAPER - Elevated sections
      // ========================================
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: 12,
          },
          elevation1: {
            boxShadow: isDark ? '0 2px 8px 0 rgba(0,0,0,0.25)' : '0 2px 8px 0 rgba(0,0,0,0.08)',
          },
          elevation2: {
            boxShadow: isDark ? '0 8px 24px -4px rgba(249,115,22,0.3)' : '0 8px 24px -4px rgba(0,0,0,0.12)',
          },
          elevation3: {
            boxShadow: isDark ? '0 20px 40px -8px rgba(249,115,22,0.25)' : '0 20px 40px -8px rgba(0,0,0,0.16)',
          },
        },
      },
      // ========================================
      // CHIP - Tags, Badges
      // ========================================
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
          colorPrimary: {
            backgroundColor: isDark ? SAFFRON[700] : SAFFRON[100],
            color: isDark ? SAFFRON[50] : SAFFRON[800],
          },
        },
      },
      // ========================================
      // DIVIDER - Section separators
      // ========================================
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        },
      },
      // ========================================
      // TOOLTIP
      // ========================================
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1C1917' : '#0C0A09',
            color: '#FAFAF9', // Always light text for readability
            fontSize: '0.875rem',
            padding: '8px 12px',
            borderRadius: 8,
            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.25)',
          },
          arrow: {
            color: isDark ? '#1C1917' : '#0C0A09',
          },
        },
      },
    },
  });
};

// Theme Provider Component
export const ThemeContextProvider = ({ children }) => {
  // Initialize from localStorage - Default to system
  const [themePreference, setThemePreference] = useState(() => {
    const savedPref = localStorage.getItem('savitara-theme-preference');
    return savedPref || 'system';
  });

  const [systemMode, setSystemMode] = useState(() => {
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Determine actual mode based on preference
  const mode = themePreference === 'system' ? systemMode : themePreference;

  // Save preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('savitara-theme-preference', themePreference);
    
    // Update document class for global CSS  
    document.documentElement.dataset.theme = mode;
  }, [themePreference, mode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setThemePreference((prevPref) => (prevPref === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (newMode) => {
    if (['light', 'dark', 'system'].includes(newMode)) {
      setThemePreference(newMode);
    }
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const themeColors = useMemo(
    () => (mode === 'dark' ? darkColors : lightColors),
    [mode]
  );

  const value = useMemo(
    () => ({
      mode,
      themePreference,
      toggleTheme,
      setThemeMode,
      isDark: mode === 'dark',
      isLight: mode === 'light',
      colors: themeColors,
    }),
    [mode, themePreference, themeColors]
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

ThemeContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
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
