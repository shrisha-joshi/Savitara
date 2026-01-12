import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';

const EarningsScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Earnings
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="bodyLarge">Total Earnings</Text>
          <Text variant="headlineLarge" style={styles.totalEarnings}>
            ₹0
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">This Month</Text>
          <Text variant="headlineMedium" style={styles.monthEarnings}>
            ₹0
          </Text>
        </Card.Content>
      </Card>

      <Text variant="bodyMedium" style={styles.note}>
        Feature coming soon: Detailed earnings breakdown and payment history
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 20,
    color: '#FF6B35',
  },
  card: {
    marginBottom: 15,
  },
  totalEarnings: {
    color: '#FF6B35',
    fontWeight: 'bold',
    marginTop: 10,
  },
  monthEarnings: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 10,
  },
  note: {
    marginTop: 20,
    textAlign: 'center',
    color: '#999',
  },
});

export default EarningsScreen;
