// Design System Tokens
// Unifies UI across Mobile and Web
// Phase 3 Foundation

export const colors = {
  // Brand Colors
  primary: '#FF9933', // Saffron
  primaryDark: '#D87A20',
  secondary: '#8B0000', // Deep Red (Spiritual)
  secondaryLight: '#B22222',
  accent: '#FFD700', // Gold

  // UI Colors
  background: '#FFFFFF',
  surface: '#FFF8F0', // Light Cream (Warmth)
  surfaceDark: '#F3E5F5', // Light Purple
  
  // Status
  error: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  info: '#2563EB',

  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textOnPrimary: '#FFFFFF',
  textDisabled: '#9CA3AF',

  // Borders & Dividers
  border: '#E5E7EB',
  divider: '#F3F4F6',
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  screenPadding: 16,
};

export const typography = {
  fontFamily: {
    primary: 'System', 
    heading: 'System',
    script: 'Sanskrit', // Placeholder for custom fonts
  },
  size: {
    xs: 12,
    s: 14,
    m: 16,
    l: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  lineHeight: {
    s: 20,
    m: 24,
    l: 30,
    xl: 36,
  },
  weight: {
    regular: '400',
    medium: '500',
    bold: '700',
    extrabold: '800',
  },
};

export const shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
};

export const borderRadius = {
  s: 4,
  m: 8,
  l: 16,
  xl: 24,
  round: 9999,
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
};