import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

const SettingsScreen = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Settings</Text>
      <Text>Settings content coming soon...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
});

export default SettingsScreen;
