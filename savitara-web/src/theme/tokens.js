// Shared Design Tokens for Web
// Aligned with Mobile App tokens for consistency

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
  xs: '4px',
  s: '8px',
  m: '16px',
  l: '24px',
  xl: '32px',
  xxl: '48px',
  screenPadding: '16px',
};

export const typography = {
  fontFamily: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  size: {
    xs: '0.75rem',
    s: '0.875rem',
    m: '1rem',
    l: '1.25rem',
    xl: '1.5rem',
    xxl: '2rem',
    hero: '2.5rem',
  },
  weight: {
    regular: 400,
    medium: 500,
    bold: 700,
  },
};

export const shadows = {
  small: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  large: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
};

export const breakpoints = {
  mobile: '600px',
  tablet: '900px',
  desktop: '1200px',
};

export const mediaQueries = {
  mobile: `@media (max-width: ${breakpoints.mobile})`,
  tablet: `@media (max-width: ${breakpoints.tablet})`,
  desktop: `@media (min-width: ${breakpoints.desktop})`,
};

export default {
  colors,
  spacing,
  typography,
  shadows,
  breakpoints,
  mediaQueries,
};