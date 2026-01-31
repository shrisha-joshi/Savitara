/**
 * Savitara Platform - Typography Configuration
 * 
 * Typography Standard (consistent across all platforms):
 * - Brand Name: Samarkan - ONLY for "Savitara" company name (Sanskrit-style decorative)
 * - Headings: Poppins - section titles, headers (weights: 500-700)
 * - Body Text: Inter - all body text, UI elements (gold standard for apps)
 * 
 * WHY THIS STRUCTURE:
 * 1. Samarkan creates instant brand recognition (Indo-calligraphic style)
 * 2. Inter is designed specifically for screens - highly readable at small sizes
 * 3. Poppins adds visual interest to headings without sacrificing readability
 * 
 * IMPORTANT RULES:
 * - Never use Samarkan for body text (readability collapses)
 * - Use font weights (400/500/600/700) instead of different fonts for hierarchy
 * - Test at 14-16px minimum for body text
 */

// Font family definitions
export const fonts = {
  // Brand font - ONLY for "Savitara" company name
  brand: {
    fontFamily: 'Poppins_700Bold',
    // Using Poppins Bold as brand font (Samarkan.otf not available)
    fallback: 'serif',
  },
  
  // Heading font - section titles, headers, important labels
  heading: {
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
    fallback: 'System',
  },
  
  // Body font - all other text (primary UI font)
  body: {
    light: 'Inter_300Light',
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    fallback: 'System',
  },
};

// Typography scale (consistent sizing)
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
};

// Font weights
export const fontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

// Line heights
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

// Pre-built text styles for common use cases
export const textStyles = {
  // Brand name style - ONLY use for "Savitara"
  brandName: {
    fontFamily: fonts.brand.fontFamily,
    letterSpacing: 2,
  },
  
  // Heading styles
  h1: {
    fontFamily: fonts.heading.bold,
    fontSize: fontSize['4xl'],
    lineHeight: lineHeight.tight,
  },
  h2: {
    fontFamily: fonts.heading.semibold,
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight.tight,
  },
  h3: {
    fontFamily: fonts.heading.semibold,
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight.normal,
  },
  h4: {
    fontFamily: fonts.heading.medium,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.normal,
  },
  
  // Body text styles
  bodyLarge: {
    fontFamily: fonts.body.regular,
    fontSize: fontSize.lg,
    lineHeight: lineHeight.relaxed,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: fontSize.base,
    lineHeight: lineHeight.normal,
  },
  bodySmall: {
    fontFamily: fonts.body.regular,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
  },
  
  // UI element styles
  button: {
    fontFamily: fonts.body.semibold,
    fontSize: fontSize.base,
    letterSpacing: 0.5,
  },
  caption: {
    fontFamily: fonts.body.regular,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.normal,
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: fontSize.sm,
    letterSpacing: 0.25,
  },
};

// Fonts to load with expo-font
// NOTE: Download Samarkan.otf from https://www.cdnfonts.com/samarkan.font
// and place in assets/fonts/Samarkan.otf
export const fontsToLoad = {
  // Inter and Poppins are loaded via @expo-google-fonts packages
  // Samarkan needs to be downloaded manually (see TYPOGRAPHY_STANDARDS.md)
};

export default {
  fonts,
  fontSize,
  fontWeight,
  lineHeight,
  textStyles,
};
