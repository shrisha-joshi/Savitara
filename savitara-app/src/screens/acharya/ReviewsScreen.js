import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

const ReviewsScreen = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        My Reviews
      </Text>
      <Text variant="bodyMedium">
        Feature coming soon: View all reviews from Grihastas
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
  },
});

export default ReviewsScreen;
