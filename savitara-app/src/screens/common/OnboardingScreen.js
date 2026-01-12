import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, RadioButton, Text } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';

const OnboardingScreen = () => {
  const { refreshUser } = useAuth();
  const [role, setRole] = useState('grihasta');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: '',
    location: '',
    languages: [],
    specializations: [],
    experience_years: '',
    hourly_rate: '',
    bio: '',
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (role === 'grihasta') {
        await userAPI.onboardGrihasta({
          phone_number: formData.phone_number,
          location: formData.location,
          preferred_languages: formData.languages,
        });
      } else {
        await userAPI.onboardAcharya({
          phone_number: formData.phone_number,
          location: formData.location,
          languages: formData.languages,
          specializations: formData.specializations,
          experience_years: parseInt(formData.experience_years),
          hourly_rate: parseFloat(formData.hourly_rate),
          bio: formData.bio,
        });
      }
      
      await refreshUser();
    } catch (error) {
      console.error('Onboarding failed:', error);
      alert(error.response?.data?.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Complete Your Profile
      </Text>
      
      <View style={styles.roleSelector}>
        <Text variant="bodyLarge">I am a:</Text>
        <RadioButton.Group onValueChange={setRole} value={role}>
          <View style={styles.radioItem}>
            <RadioButton value="grihasta" />
            <Text>Grihasta (User seeking services)</Text>
          </View>
          <View style={styles.radioItem}>
            <RadioButton value="acharya" />
            <Text>Acharya (Service provider)</Text>
          </View>
        </RadioButton.Group>
      </View>
      
      <TextInput
        label="Phone Number *"
        value={formData.phone_number}
        onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
        style={styles.input}
        keyboardType="phone-pad"
      />
      
      <TextInput
        label="Location *"
        value={formData.location}
        onChangeText={(text) => setFormData({ ...formData, location: text })}
        style={styles.input}
      />
      
      <TextInput
        label="Languages (comma separated) *"
        value={formData.languages.join(', ')}
        onChangeText={(text) => setFormData({ ...formData, languages: text.split(',').map(s => s.trim()) })}
        style={styles.input}
      />
      
      {role === 'acharya' && (
        <>
          <TextInput
            label="Specializations (comma separated) *"
            value={formData.specializations.join(', ')}
            onChangeText={(text) => setFormData({ ...formData, specializations: text.split(',').map(s => s.trim()) })}
            style={styles.input}
          />
          
          <TextInput
            label="Experience (years) *"
            value={formData.experience_years}
            onChangeText={(text) => setFormData({ ...formData, experience_years: text })}
            style={styles.input}
            keyboardType="numeric"
          />
          
          <TextInput
            label="Hourly Rate (₹) *"
            value={formData.hourly_rate}
            onChangeText={(text) => setFormData({ ...formData, hourly_rate: text })}
            style={styles.input}
            keyboardType="numeric"
          />
          
          <TextInput
            label="Bio *"
            value={formData.bio}
            onChangeText={(text) => setFormData({ ...formData, bio: text })}
            style={styles.input}
            multiline
            numberOfLines={4}
          />
        </>
      )}
      
      <Button 
        mode="contained" 
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Complete Profile
      </Button>
    </ScrollView>
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
  roleSelector: {
    marginBottom: 20,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#FF6B35',
  },
});

export default OnboardingScreen;
