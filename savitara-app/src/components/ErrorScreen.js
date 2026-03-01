/**
 * ErrorScreen — full-screen error state with retry button.
 * Use when a data-fetch fails and the screen has nothing to show.
 *
 * Props:
 *   message  {string}     Human-readable error text
 *   onRetry  {function}   Called when the user taps "Retry"
 *   style    {object}     Extra style for the outer container
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text } from 'react-native-paper';
import { BRAND } from '../constants/theme';

const ErrorScreen = ({ message = 'Something went wrong. Please try again.', onRetry, style }) => (
  <View style={[styles.container, style]}>
    <MaterialCommunityIcons
      name="alert-circle-outline"
      size={64}
      color={BRAND.error}
      style={styles.icon}
    />
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <Button
        mode="contained"
        onPress={onRetry}
        buttonColor={BRAND.primary}
        style={styles.button}
      >
        Retry
      </Button>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: BRAND.background,
  },
  icon: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 16,
  },
});

export default ErrorScreen;
