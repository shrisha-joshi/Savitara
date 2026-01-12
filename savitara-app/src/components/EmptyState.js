/**
 * Empty State Component
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';

const EmptyState = ({
  icon = 'inbox',
  title = 'No data available',
  message = 'There is nothing to display at the moment',
  actionLabel,
  onAction,
  iconSize = 64,
  iconColor = '#ccc',
}) => {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={icon}
        size={iconSize}
        color={iconColor}
        style={styles.icon}
      />
      
      <Text style={styles.title}>{title}</Text>
      
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
      
      {actionLabel && onAction && (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.button}
        >
          {actionLabel}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  button: {
    marginTop: 8,
  },
});

export default EmptyState;
