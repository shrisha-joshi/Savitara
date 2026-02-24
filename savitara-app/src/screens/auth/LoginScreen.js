import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, SegmentedButtons, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errorHandler';

const LoginScreen = () => {
  const { login, loginWithEmail, registerWithEmail, loading, error } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('grihasta');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    let isValid = true;
    let tempErrors = {};

    // Email validation
    if (!email) {
      tempErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password validation
    if (!password) {
      tempErrors.password = 'Password is required';
      isValid = false;
    } else if (mode === 'register') {
      if (password.length < 8) {
        tempErrors.password = 'Password must be at least 8 characters';
        isValid = false;
      } else if (!/(?=.*[a-z])/.test(password)) {
        tempErrors.password = 'Password must contain at least one lowercase letter';
        isValid = false;
      } else if (!/(?=.*[A-Z])/.test(password)) {
        tempErrors.password = 'Password must contain at least one uppercase letter';
        isValid = false;
      } else if (!/(?=.*[0-9])/.test(password)) {
        tempErrors.password = 'Password must contain at least one number';
        isValid = false;
      }
    }

    // Name validation (only for register)
    if (mode === 'register' && !name.trim()) {
      tempErrors.name = 'Full name is required';
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleEmailAuth = async () => {
    if (!validate()) return;
    
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
        <View style={styles.errorContainer}>
           <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#B00020" style={styles.errorIcon} />
           <Text style={styles.errorText} variant="bodySmall">{getErrorMessage(error)}</Text>
        </View>
      )}

      <View style={styles.form}>
        {mode === 'register' && (
          <>
            <TextInput
              label="Full Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({...errors, name: null});
              }}
              mode="outlined"
              style={styles.input}
              error={!!errors.name}
            />
            {errors.name && <HelperText type="error" visible={true}>{errors.name}</HelperText>}
            
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
          onChangeText={(text) => {
             setEmail(text);
             if (errors.email) setErrors({...errors, email: null});
          }}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          error={!!errors.email}
        />
        {errors.email && <HelperText type="error" visible={true}>{errors.email}</HelperText>}

        <TextInput
          label="Password"
          value={password}
          onChangeText={(text) => {
             setPassword(text);
             if (errors.password) setErrors({...errors, password: null});
          }}
          mode="outlined"
          secureTextEntry={!showPassword}
          right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
          style={styles.input}
          error={!!errors.password}
        />
        {errors.password && <HelperText type="error" visible={true}>{errors.password}</HelperText>}
        {mode === 'register' && !errors.password && (
            <HelperText type="info" visible={true}>
              Min. 8 characters with uppercase, lowercase & number
            </HelperText>
        )}

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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F8CACA',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#B00020',
    flex: 1,
    flexWrap: 'wrap',
  },
});

export default LoginScreen;
