// Savitara Platform - Unified Theme Configuration
// Inspired by Hindu spirituality - Dark Saffron, Gold, Deep Blues

export const colors = {
  // Primary Colors - Dark Saffron/Orange
  primary: {
    main: '#E65C00',      // Dark Saffron/Orange - Primary CTAs, buttons
    light: '#FF8533',     // Medium Saffron
    dark: '#CC5200',      // Deeper Saffron
    contrast: '#FFFFFF',  // Text on primary
  },
  
  // Secondary Colors
  secondary: {
    main: '#2B3A67',      // Royal Blue - Headers, trust elements
    light: '#3D4F8A',     // Light Royal Blue
    dark: '#1A2440',      // Dark Royal Blue
    contrast: '#FFFFFF',
  },
  
  // Accent Colors
  accent: {
    gold: '#FFD700',      // Gold - Ratings, premium, highlights
    goldLight: '#FFE44D',
    goldDark: '#CCB000',
    maroon: '#800020',    // Maroon - Traditional accent
    cream: '#FFF5E6',     // Warm cream with orange tint
    saffron: '#E65C00',   // Dark Saffron for emphasis
  },
  
  // Status Colors
  success: {
    main: '#34C759',      // Emerald Green
    light: '#A8E6CF',
    dark: '#2DA44E',
  },
  warning: {
    main: '#FFC107',      // Amber
    light: '#FFE082',
    dark: '#FFA000',
  },
  error: {
    main: '#DC143C',      // Crimson
    light: '#FF6B6B',
    dark: '#C41230',
  },
  
  // Neutral Colors
  background: {
    default: '#FFF5E6',   // Light cream with orange tint
    paper: '#FFFFFF',     // White cards
    dark: '#1A2233',      // Dark mode bg
    gradient: 'linear-gradient(135deg, #E65C00 0%, #FFD700 100%)',
    hero: 'linear-gradient(135deg, #CC5200 0%, #E65C00 50%, #FF8533 100%)',
  },
  
  // Text Colors
  text: {
    primary: '#1A2233',   // Dark blue - main text
    secondary: '#6B7A90', // Grey - secondary text
    disabled: '#B0B0B0',
    light: '#FFFFFF',
  },
  
  // Border Colors
  border: {
    light: '#E8E8E8',
    main: '#D0D0D0',
    dark: '#B0B0B0',
  },
};

export const typography = {
  // Typography Standard:
  // - brand: Samarkan - ONLY for "Savitara" company name
  // - heading: Poppins - section titles, headers (weights: 500-700)
  // - body: Inter - all body text, UI elements (gold standard for apps)
  fontFamily: {
    brand: '"Samarkan", "Times New Roman", serif',  // ONLY for "Savitara" brand name
    heading: '"Poppins", sans-serif',               // Section titles, headers
    body: '"Inter", -apple-system, sans-serif',     // Body text, UI (primary)
    primary: '"Poppins", sans-serif',               // Alias for heading
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
};

export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',   // Circular
};

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  glow: '0 0 20px rgba(255, 153, 51, 0.4)',
  goldGlow: '0 0 20px rgba(255, 215, 0, 0.5)',
};

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '300ms ease-in-out',
  slow: '500ms ease-in-out',
  bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// MUI Theme Override
export const muiTheme = {
  palette: {
    primary: {
      main: colors.primary.main,
      light: colors.primary.light,
      dark: colors.primary.dark,
      contrastText: colors.primary.contrast,
    },
    secondary: {
      main: colors.secondary.main,
      light: colors.secondary.light,
      dark: colors.secondary.dark,
      contrastText: colors.secondary.contrast,
    },
    success: {
      main: colors.success.main,
      light: colors.success.light,
      dark: colors.success.dark,
    },
    warning: {
      main: colors.warning.main,
      light: colors.warning.light,
      dark: colors.warning.dark,
    },
    error: {
      main: colors.error.main,
      light: colors.error.light,
      dark: colors.error.dark,
    },
    background: {
      default: colors.background.default,
      paper: colors.background.paper,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
  },
  typography: {
    fontFamily: typography.fontFamily.primary,
    h1: { fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize['5xl'] },
    h2: { fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize['4xl'] },
    h3: { fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize['3xl'] },
    h4: { fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize['2xl'] },
    h5: { fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.xl },
    h6: { fontWeight: typography.fontWeight.medium, fontSize: typography.fontSize.lg },
    body1: { fontSize: typography.fontSize.base },
    body2: { fontSize: typography.fontSize.sm },
  },
  shape: {
    borderRadius: parseInt(borderRadius.lg),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.lg,
          textTransform: 'none',
          fontWeight: typography.fontWeight.semibold,
          padding: '12px 24px',
          transition: transitions.normal,
        },
        contained: {
          boxShadow: shadows.md,
          '&:hover': {
            boxShadow: shadows.lg,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.xl,
          boxShadow: shadows.md,
          transition: transitions.normal,
          '&:hover': {
            boxShadow: shadows.lg,
            transform: 'translateY(-4px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: borderRadius.lg,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.md,
        },
      },
    },
  },
};

// Export theme object for easy imports
const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  muiTheme,
};

export default theme;