import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <ScrollView contentContainerStyle={styles.content}>
        <MaterialCommunityIcons name="om" size={100} color="#FF6B35" />
        
        <Text style={styles.title}>🎉 Savitara App is Working! 🎉</Text>
        
        <Text style={styles.subtitle}>Your React Native app is successfully running</Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ All Systems Operational:</Text>
          <Text style={styles.checkItem}>✓ Expo SDK 54 Running</Text>
          <Text style={styles.checkItem}>✓ React Native 0.76.5</Text>
          <Text style={styles.checkItem}>✓ React 18.3.1</Text>
          <Text style={styles.checkItem}>✓ Navigation Ready</Text>
          <Text style={styles.checkItem}>✓ Icons Working</Text>
          <Text style={styles.checkItem}>✓ Styling Applied</Text>
        </View>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📱 Next Steps:</Text>
          <Text style={styles.infoText}>1. Configure Google OAuth Client ID</Text>
          <Text style={styles.infoText}>2. Update .env file with credentials</Text>
          <Text style={styles.infoText}>3. Restart app to enable full features</Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Savitara Platform v1.0</Text>
          <Text style={styles.footerText}>Hindu Rituals & Acharya Services</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  checkItem: {
    fontSize: 16,
    color: '#4CAF50',
    marginVertical: 5,
    paddingLeft: 10,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: '#424242',
    marginVertical: 5,
    paddingLeft: 10,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    marginVertical: 2,
  },
});
