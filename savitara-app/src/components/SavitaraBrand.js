/**
 * SavitaraBrand Component
 * 
 * Renders the "Savitara" brand name with the official Samarkan font.
 * 
 * USAGE RULES:
 * - Use ONLY for displaying the "Savitara" company name
 * - Never use Samarkan font for other text (readability collapses)
 * - Pairs well with Inter/Poppins for surrounding text
 * 
 * NOTE: Requires Samarkan.otf in assets/fonts/
 * Download from: https://www.cdnfonts.com/samarkan.font
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Brand colors
const BRAND_COLORS = {
  saffron: '#E65C00',       // Primary brand color (dark saffron)
  saffronLight: '#FF8533',
  gold: '#FFD700',
  white: '#FFFFFF',
};

const SavitaraBrand = ({
  variant = 'default',  // 'default' | 'white' | 'gold' | 'gradient'
  size = 'medium',      // 'small' | 'medium' | 'large' | 'xlarge'
  withOm = false,       // Show ॐ symbol above
  withTagline = false,  // Show tagline below
  style = {},
}) => {
  const sizeStyles = {
    small: { fontSize: 20, omSize: 14, taglineSize: 10 },
    medium: { fontSize: 32, omSize: 20, taglineSize: 12 },
    large: { fontSize: 48, omSize: 28, taglineSize: 14 },
    xlarge: { fontSize: 64, omSize: 36, taglineSize: 16 },
  };

  const colorStyles = {
    default: { color: BRAND_COLORS.saffron },
    white: { color: BRAND_COLORS.white },
    gold: { color: BRAND_COLORS.gold },
  };

  const { fontSize, omSize, taglineSize } = sizeStyles[size];
  const colorStyle = colorStyles[variant] || colorStyles.default;

  // Uses Samarkan font loaded at app level (App.js)
  // Falls back to serif if not loaded
  const brandFontFamily = 'Samarkan';

  return (
    <View style={[styles.container, style]}>
      {/* Om Symbol */}
      {withOm && (
        <Text style={[styles.om, { fontSize: omSize, color: BRAND_COLORS.gold }]}>
          ॐ
        </Text>
      )}

      {/* Brand Name */}
      <Text
        style={[
          styles.brandName,
          { fontFamily: brandFontFamily, fontSize },
          colorStyle,
        ]}
      >
        Savitara
      </Text>

      {/* Tagline */}
      {withTagline && (
        <Text
          style={[
            styles.tagline,
            { fontSize: taglineSize },
            variant === 'white' ? { color: 'rgba(255,255,255,0.8)' } : { color: '#6B7A90' },
          ]}
        >
          Divine Connections • Sacred Services
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  om: {
    marginBottom: -4,
    opacity: 0.9,
  },
  brandName: {
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  tagline: {
    marginTop: 8,
    letterSpacing: 2,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
});

export default SavitaraBrand;
