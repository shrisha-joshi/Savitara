import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, RadioButton, Text, Menu, TouchableRipple, Divider } from 'react-native-paper';
import CascadingLocationSelect from '../../components/CascadingLocationSelect';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';

const OnboardingScreen = () => {
  const { refreshUser } = useAuth();
  const [role, setRole] = useState('grihasta');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: {
      city: '',
      state: '',
      country: 'India'
    },
    parampara: '',
    preferences: {},
    // Acharya specific fields
    gotra: '',
    languages: [],
    specializations: [],
    experience_years: '',
    study_place: '',
    bio: '',
  });

  const handleLocationChange = (location) => {
    setFormData({
      ...formData,
      location: {
        ...formData.location,
        ...location
      }
    });
  };

  const handlePhoneChange = (phone) => {
    setFormData({ ...formData, phone });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (role === 'grihasta') {
        await userAPI.onboardGrihasta({
          name: formData.name,
          phone: formData.phone,
          location: formData.location,
          parampara: formData.parampara,
          preferences: formData.preferences || {}
        });
      } else {
        await userAPI.onboardAcharya({
          name: formData.name,
          phone: formData.phone,
          location: formData.location,
          parampara: formData.parampara,
          gotra: formData.gotra,
          experience_years: Number.parseInt(formData.experience_years, 10) || 0,
          study_place: formData.study_place,
          specializations: formData.specializations,
          languages: formData.languages,
          bio: formData.bio || ''
        });
      }
      
      await refreshUser();
    } catch (error) {
      console.error('Onboarding failed:', error);
      alert(error.response?.data?.detail || error.response?.data?.message || 'Onboarding failed');
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
        label="Full Name *"
        value={formData.name}
        onChangeText={(text) => setFormData({ ...formData, name: text })}
        style={styles.input}
      />
      
      <CascadingLocationSelect
        country={formData.location.country}
        state={formData.location.state}
        city={formData.location.city}
        phone={formData.phone}
        onLocationChange={handleLocationChange}
        onPhoneChange={handlePhoneChange}
        required
        style={styles.input}
      />
      
      <TextInput
        label="Parampara (Spiritual Tradition) *"
        value={formData.parampara}
        onChangeText={(text) => setFormData({ ...formData, parampara: text })}
        style={styles.input}
        placeholder="e.g., Shaiva, Vaishnava, Shakta"
      />
      
      {role === 'grihasta' && (
        <TextInput
          label="Preferred Language"
          value={formData.preferences?.preferred_language || ''}
          onChangeText={(text) => setFormData({ 
            ...formData, 
            preferences: { ...formData.preferences, preferred_language: text } 
          })}
          style={styles.input}
        />
      )}
      
      {role === 'acharya' && (
        <>
          <TextInput
            label="Gotra *"
            value={formData.gotra}
            onChangeText={(text) => setFormData({ ...formData, gotra: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Languages (comma separated) *"
            value={formData.languages.join(', ')}
            onChangeText={(text) => setFormData({ 
              ...formData, 
              languages: text.split(',').map(s => s.trim()).filter(Boolean) 
            })}
            style={styles.input}
            placeholder="e.g., Sanskrit, Hindi, English"
          />
          
          <TextInput
            label="Specializations (comma separated) *"
            value={formData.specializations.join(', ')}
            onChangeText={(text) => setFormData({ 
              ...formData, 
              specializations: text.split(',').map(s => s.trim()).filter(Boolean) 
            })}
            style={styles.input}
            placeholder="e.g., Vedic Rituals, Astrology"
          />
          
          <TextInput
            label="Experience (years) *"
            value={formData.experience_years}
            onChangeText={(text) => setFormData({ ...formData, experience_years: text })}
            style={styles.input}
            keyboardType="numeric"
          />
          
          <TextInput
            label="Study Place *"
            value={formData.study_place}
            onChangeText={(text) => setFormData({ ...formData, study_place: text })}
            style={styles.input}
            placeholder="Where you studied"
          />
          
          <TextInput
            label="Bio *"
            value={formData.bio}
            onChangeText={(text) => setFormData({ ...formData, bio: text })}
            style={styles.input}
            multiline
            numberOfLines={4}
            placeholder="Brief description about yourself"
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
  menu: {
    marginTop: 50,
    maxWidth: '90%',
  },
  button: {
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: '#FF6B35',
  },
});

export default OnboardingScreen;
