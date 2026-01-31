import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext();

// ============================================
// SAVITARA DESIGN SYSTEM - Modern UI Palette
// Inspired by shadcn/ui + aceternity aesthetics
// ============================================

// Core Brand Colors
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

// Light Theme - Warm, Inviting, Professional
const lightPalette = {
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
    default: '#FAFAF9', // Warm stone-50
    paper: '#FFFFFF',
    gradient: `linear-gradient(135deg, ${SAFFRON[50]} 0%, #FFFFFF 50%, ${AMBER[50]} 100%)`,
    card: 'rgba(255, 255, 255, 0.8)',
    header: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 50%, ${AMBER[600]} 100%)`,
    sidebar: '#FFFFFF',
  },
  text: {
    primary: '#1C1917', // Stone-900
    secondary: '#57534E', // Stone-600
    disabled: '#A8A29E', // Stone-400
  },
  divider: 'rgba(28, 25, 23, 0.08)',
  action: {
    hover: alpha(SAFFRON[500], 0.08),
    selected: alpha(SAFFRON[500], 0.12),
    focus: alpha(SAFFRON[500], 0.12),
  },
  success: {
    main: '#16A34A',
    light: '#22C55E',
    dark: '#15803D',
  },
  warning: {
    main: '#EAB308',
    light: '#FACC15',
    dark: '#CA8A04',
  },
  error: {
    main: '#DC2626',
    light: '#EF4444',
    dark: '#B91C1C',
  },
  info: {
    main: '#0EA5E9',
    light: '#38BDF8',
    dark: '#0284C7',
  },
};

// Dark Theme - Rich, Elegant, Modern with Saffron accents
const darkPalette = {
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
    default: '#0C0A09', // Rich warm black
    paper: '#1C1917', // Stone-900
    gradient: `linear-gradient(135deg, #1C1917 0%, #0C0A09 50%, #1C1917 100%)`,
    card: 'rgba(28, 25, 23, 0.6)',
    header: `linear-gradient(135deg, ${SAFFRON[700]} 0%, ${SAFFRON[800]} 50%, #1C1917 100%)`,
    sidebar: '#1C1917',
  },
  text: {
    primary: '#FAFAF9', // Stone-50
    secondary: '#A8A29E', // Stone-400
    disabled: '#57534E', // Stone-600
  },
  divider: 'rgba(250, 250, 249, 0.08)',
  action: {
    hover: alpha(SAFFRON[400], 0.12),
    selected: alpha(SAFFRON[400], 0.16),
    focus: alpha(SAFFRON[400], 0.16),
  },
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
  info: {
    main: '#38BDF8',
    light: '#7DD3FC',
    dark: '#0EA5E9',
  },
};

const createAppTheme = (mode) => {
  const palette = mode === 'dark' ? darkPalette : lightPalette;
  const isDark = mode === 'dark';
  
  return createTheme({
    palette,
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h1: { fontFamily: '"Poppins", sans-serif', fontWeight: 700, letterSpacing: '-0.025em' },
      h2: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.025em' },
      h3: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h4: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, letterSpacing: '-0.02em' },
      h5: { fontFamily: '"Poppins", sans-serif', fontWeight: 500, letterSpacing: '-0.015em' },
      h6: { fontFamily: '"Poppins", sans-serif', fontWeight: 500, letterSpacing: '-0.015em' },
      body1: { fontFamily: '"Inter", sans-serif', lineHeight: 1.6 },
      body2: { fontFamily: '"Inter", sans-serif', lineHeight: 1.5 },
      button: { fontFamily: '"Inter", sans-serif', fontWeight: 600, letterSpacing: '0.01em' },
      caption: { fontFamily: '"Inter", sans-serif', letterSpacing: '0.02em' },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      'none',
      isDark 
        ? '0 1px 2px rgba(0,0,0,0.3)' 
        : '0 1px 2px rgba(0,0,0,0.05)',
      isDark 
        ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)' 
        : '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
      isDark 
        ? '0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3)' 
        : '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      isDark 
        ? '0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.3)' 
        : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      isDark 
        ? '0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.3)' 
        : '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
      ...Array(19).fill(isDark 
        ? '0 25px 50px -12px rgba(0,0,0,0.5)' 
        : '0 25px 50px -12px rgba(0,0,0,0.25)')
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          'html, body': {
            scrollBehavior: 'smooth',
          },
          body: {
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundImage: palette.background.gradient,
            backgroundAttachment: 'fixed',
            minHeight: '100vh',
          },
          '::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '::-webkit-scrollbar-track': {
            background: isDark ? '#1C1917' : '#F5F5F4',
            borderRadius: '4px',
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
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
            padding: '8px 20px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            boxShadow: isDark 
              ? `0 4px 14px ${alpha(SAFFRON[500], 0.3)}`
              : `0 4px 14px ${alpha(SAFFRON[500], 0.25)}`,
            '&:hover': {
              boxShadow: isDark 
                ? `0 6px 20px ${alpha(SAFFRON[500], 0.4)}`
                : `0 6px 20px ${alpha(SAFFRON[500], 0.35)}`,
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${SAFFRON[400]} 0%, ${SAFFRON[500]} 100%)`,
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
              backgroundColor: alpha(palette.primary.main, 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: palette.background.card,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: isDark 
                ? `0 20px 40px -10px ${alpha(SAFFRON[500], 0.15)}`
                : `0 20px 40px -10px ${alpha(SAFFRON[500], 0.12)}`,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: isDark 
              ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)' 
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          },
          elevation2: {
            boxShadow: isDark 
              ? '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2)' 
              : '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.background.sidebar,
            backgroundImage: isDark 
              ? `linear-gradient(180deg, ${alpha(SAFFRON[900], 0.3)} 0%, transparent 100%)`
              : `linear-gradient(180deg, ${alpha(SAFFRON[50], 0.8)} 0%, transparent 100%)`,
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: palette.background.header,
            backgroundColor: 'transparent',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${alpha('#FFFFFF', isDark ? 0.1 : 0.2)}`,
            boxShadow: isDark 
              ? `0 4px 30px ${alpha(SAFFRON[500], 0.15)}`
              : `0 4px 30px ${alpha(SAFFRON[500], 0.2)}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            padding: '16px',
          },
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? alpha(SAFFRON[900], 0.3) : alpha(SAFFRON[50], 0.8),
            color: isDark ? SAFFRON[300] : SAFFRON[700],
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? alpha(SAFFRON[500], 0.08) : alpha(SAFFRON[500], 0.04),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: 8,
          },
          colorPrimary: {
            background: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 100%)`,
          },
          colorSuccess: {
            background: isDark 
              ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
              : 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)',
          },
          colorWarning: {
            background: isDark 
              ? 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)'
              : 'linear-gradient(135deg, #FDE047 0%, #FACC15 100%)',
          },
          colorError: {
            background: isDark 
              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
              : 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark ? alpha(SAFFRON[500], 0.2) : alpha(SAFFRON[500], 0.15),
          },
          bar: {
            borderRadius: 4,
            background: `linear-gradient(90deg, ${SAFFRON[500]} 0%, ${AMBER[500]} 100%)`,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${isDark ? alpha(SAFFRON[400], 0.3) : alpha(SAFFRON[500], 0.2)}`,
          },
          colorDefault: {
            background: `linear-gradient(135deg, ${SAFFRON[500]} 0%, ${SAFFRON[600]} 100%)`,
            color: '#FFFFFF',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            margin: '2px 8px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&.Mui-selected': {
              backgroundColor: isDark ? alpha(SAFFRON[500], 0.2) : alpha(SAFFRON[500], 0.12),
              borderLeft: `3px solid ${SAFFRON[500]}`,
              '&:hover': {
                backgroundColor: isDark ? alpha(SAFFRON[500], 0.25) : alpha(SAFFRON[500], 0.16),
              },
            },
            '&:hover': {
              backgroundColor: isDark ? alpha(SAFFRON[500], 0.1) : alpha(SAFFRON[500], 0.06),
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            color: isDark ? SAFFRON[400] : SAFFRON[600],
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            background: `linear-gradient(90deg, ${SAFFRON[500]} 0%, ${AMBER[500]} 100%)`,
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            '&.Mui-selected': {
              color: isDark ? SAFFRON[400] : SAFFRON[600],
              fontWeight: 600,
            },
          },
        },
      },
      MuiTextField: {
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
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#292524' : '#1C1917',
            color: '#FAFAF9',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          },
          arrow: {
            color: isDark ? '#292524' : '#1C1917',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
          standardSuccess: {
            backgroundColor: isDark ? alpha('#22C55E', 0.15) : alpha('#22C55E', 0.1),
            border: `1px solid ${alpha('#22C55E', 0.3)}`,
          },
          standardWarning: {
            backgroundColor: isDark ? alpha('#FACC15', 0.15) : alpha('#FACC15', 0.1),
            border: `1px solid ${alpha('#FACC15', 0.3)}`,
          },
          standardError: {
            backgroundColor: isDark ? alpha('#EF4444', 0.15) : alpha('#EF4444', 0.1),
            border: `1px solid ${alpha('#EF4444', 0.3)}`,
          },
          standardInfo: {
            backgroundColor: isDark ? alpha('#38BDF8', 0.15) : alpha('#38BDF8', 0.1),
            border: `1px solid ${alpha('#38BDF8', 0.3)}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isDark ? alpha(SAFFRON[500], 0.15) : alpha(SAFFRON[500], 0.1),
              transform: 'scale(1.05)',
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: SAFFRON[500],
              '&:hover': {
                backgroundColor: alpha(SAFFRON[500], 0.1),
              },
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: SAFFRON[500],
            },
          },
        },
      },
    },
  });
};

export function ThemeContextProvider({ children }) {
  const [mode, setMode] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('admin-theme');
    if (savedMode) {
      setMode(savedMode);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('admin-theme', mode);
    }
  }, [mode, mounted]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const value = {
    mode,
    toggleTheme,
    isDark: mode === 'dark',
    isLight: mode === 'light',
  };

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeContextProvider');
  }
  return context;
};

export default ThemeContext;
