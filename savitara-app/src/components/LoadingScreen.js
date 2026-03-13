/**
 * LoadingScreen — full-screen centered loading indicator.
 * Use instead of <Text>Loading...</Text> everywhere.
 *
 * Props:
 *   text  {string}  Optional label shown below the spinner (default: none)
 *   style {object}  Extra style for the outer container
 */
import React from 'react';
import PropTypes from 'prop-types';
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
    alignItems: 'center',
    backgroundColor: BRAND.background,
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    color: '#666',
    fontSize: 15,
    marginTop: 12,
  },
});

export default LoadingScreen;

LoadingScreen.propTypes = {
  text: PropTypes.string,
  style: PropTypes.object,
};
