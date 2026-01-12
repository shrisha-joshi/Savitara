import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { login, loading, error } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="shield-account" size={100} color="#FF6B35" />
      </View>
      
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>🕉 Admin Savitara</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Admin Access Only</Text>
          
          {error && (
            <Text variant="bodyMedium" style={styles.error}>{error}</Text>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={login}
              loading={loading}
              disabled={loading}
              icon="google"
              style={styles.button}
            >
              Sign in with Google
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  buttonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#FF6B35',
    width: '100%',
  },
  error: {
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 10,
  },
});
