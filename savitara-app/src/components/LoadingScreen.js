/**
 * LoadingScreen — full-screen centered loading indicator.
 * Use instead of <Text>Loading...</Text> everywhere.
 *
 * Props:
 *   text  {string}  Optional label shown below the spinner (default: none)
 *   style {object}  Extra style for the outer container
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { BRAND } from '../constants/theme';

const LoadingScreen = ({ text, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator animating size="large" color={BRAND.primary} />
    {text ? <Text style={styles.text}>{text}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.background,
  },
  text: {
    marginTop: 12,
    color: '#666',
    fontSize: 15,
  },
});

export default LoadingScreen;
