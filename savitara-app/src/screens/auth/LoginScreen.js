import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = () => {
  const { login, loginWithEmail, registerWithEmail, loading, error } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('grihasta');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailAuth = async () => {
    if (mode === 'login') {
      await loginWithEmail(email, password);
    } else {
      await registerWithEmail({ email, password, name, role });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="om" size={100} color="#FF6B35" />
      </View>
      
      <Text variant="headlineMedium" style={styles.title}>
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </Text>
      
      <Text variant="bodyMedium" style={styles.subtitle}>
        {mode === 'login' 
          ? 'Sign in to continue your spiritual journey' 
          : 'Join Savitara to connect with authentic traditions'}
      </Text>
      
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      <View style={styles.form}>
        {mode === 'register' && (
          <>
            <TextInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
            />
            <SegmentedButtons
              value={role}
              onValueChange={setRole}
              buttons={[
                { value: 'grihasta', label: 'Grihasta' },
                { value: 'acharya', label: 'Acharya' },
              ]}
              style={styles.roleSelector}
            />
          </>
        )}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={!showPassword}
          right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
          style={styles.input}
        />

        <Button 
          mode="contained" 
          onPress={handleEmailAuth}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </Button>

        <View style={styles.divider}>
          <Text variant="bodySmall">OR</Text>
        </View>

        <Button 
          mode="outlined" 
          onPress={login}
          loading={loading}
          disabled={loading}
          style={styles.googleButton}
          icon="google"
        >
          Continue with Google
        </Button>

        <Button 
          mode="text" 
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={styles.switchButton}
        >
          {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    color: '#FF6B35',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  roleSelector: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#FF6B35',
    paddingVertical: 6,
  },
  googleButton: {
    marginTop: 8,
    borderColor: '#FF6B35',
    textColor: '#FF6B35',
  },
  divider: {
    alignItems: 'center',
    marginVertical: 16,
  },
  switchButton: {
    marginTop: 16,
  },
  error: {
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default LoginScreen;
