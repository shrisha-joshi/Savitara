import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

// In a real app, require/import the image properly
// import emptyStateImage from '../../assets/images/empty_state_gods.png'; 

const EmptyState = ({ message = "No records found.", description = "The Gods are waiting for your action." }) => {
  return (
    <View style={styles.container}>
      <View style={styles.illustrationPlaceholder}>
         {/* Placeholder for illustration */}
         <Text style={{fontSize: 40}}>🌤️</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  illustrationPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: colors.surface,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.l,
  },
  message: {
    fontSize: typography.size.l,
    fontWeight: 'bold', // converted from string '700' to avoid potential type issues if using TS later, though JS is fine
    color: colors.textPrimary,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.size.m,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default EmptyState;
