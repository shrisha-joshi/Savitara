import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Linking } from 'react-native';
import { 
  List, Avatar, Button, Divider, TextInput, Portal, Dialog, 
  Text, Card, IconButton, Chip, ActivityIndicator 
} from 'react-native-paper';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import CascadingLocationSelect from '../../components/CascadingLocationSelect';

const ProfileScreen = () => {
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    location: { city: '', state: '', country: 'India' },
    parampara: '',
    gotra: '',
    languages: [],
    specializations: [],
    experience_years: '',
    study_place: '',
    bio: '',
    preferences: {}
  });

  // Load user data when component mounts or user changes
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      // Fetch complete user profile from API
      const response = await userAPI.getProfile();
      const userData = response.data?.data || response.data || {};
      const profileData = userData.profile || {};
      
      setEditData({
        name: profileData.name || user?.full_name || '',
        phone: profileData.phone || user?.phone_number || '',
        location: profileData.location || { 
          city: user?.city || '', 
          state: user?.state || '', 
          country: 'India' 
        },
        parampara: profileData.parampara || '',
        gotra: profileData.gotra || '',
        languages: profileData.languages || [],
        specializations: profileData.specializations || [],
        experience_years: profileData.experience_years?.toString() || '',
        study_place: profileData.study_place || '',
        bio: profileData.bio || '',
        preferences: profileData.preferences || {}
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Fallback to user object
      setEditData({
        name: user?.full_name || '',
        phone: user?.phone_number || '',
        location: { 
          city: user?.city || '', 
          state: user?.state || '', 
          country: 'India' 
        },
        parampara: user?.parampara || '',
        gotra: user?.gotra || '',
        languages: user?.languages || [],
        specializations: user?.specializations || [],
        experience_years: user?.experience_years?.toString() || '',
        study_place: user?.study_place || '',
        bio: user?.bio || '',
        preferences: user?.preferences || {}
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPermission = async () => {
    try {
      setLocationLoading(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use this feature. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (address) {
        setEditData(prev => ({
          ...prev,
          location: {
            city: address.city || prev.location.city,
            state: address.region || prev.location.state,
            country: address.country || 'India',
            coordinates: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }
          }
        }));
        
        Alert.alert('Success', 'Location updated successfully!');
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again or enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      if (user?.role === 'grihasta') {
        await userAPI.updateGrihastaProfile({
          name: editData.name,
          phone: editData.phone,
          location: editData.location,
          parampara: editData.parampara,
          preferences: editData.preferences
        });
      } else {
        await userAPI.updateAcharyaProfile({
          name: editData.name,
          phone: editData.phone,
          location: editData.location,
          parampara: editData.parampara,
          gotra: editData.gotra,
          experience_years: Number.parseInt(editData.experience_years, 10) || 0,
          study_place: editData.study_place,
          specializations: editData.specializations,
          languages: editData.languages,
          bio: editData.bio
        });
      }
      
      await refreshUser();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isEditing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Image 
          size={80} 
          source={{ uri: user?.profile_picture || 'https://via.placeholder.com/150' }}
        />
        <View style={styles.headerInfo}>
          <Text variant="headlineSmall">{user?.full_name || 'User'}</Text>
          <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
          <Chip 
            mode="outlined" 
            style={styles.roleChip}
            icon={user?.role === 'acharya' ? 'account-star' : 'account'}
          >
            {user?.role === 'grihasta' ? 'Grihasta' : 'Acharya'}
          </Chip>
        </View>
      </View>

      {!isEditing ? (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Basic Information</Text>
              <Divider style={styles.divider} />
              
              <List.Item
                title="Full Name"
                description={editData.name || 'Not set'}
                left={props => <List.Icon {...props} icon="account" />}
              />
              <List.Item
                title="Phone"
                description={editData.phone || 'Not set'}
                left={props => <List.Icon {...props} icon="phone" />}
              />
              <List.Item
                title="Location"
                description={`${editData.location.city}, ${editData.location.state}, ${editData.location.country}`}
                left={props => <List.Icon {...props} icon="map-marker" />}
              />
              <List.Item
                title="Parampara"
                description={editData.parampara || 'Not set'}
                left={props => <List.Icon {...props} icon="flower" />}
              />
            </Card.Content>
          </Card>

          {user?.role === 'acharya' && (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>Acharya Details</Text>
                <Divider style={styles.divider} />
                
                <List.Item
                  title="Gotra"
                  description={editData.gotra || 'Not set'}
                  left={props => <List.Icon {...props} icon="family-tree" />}
                />
                <List.Item
                  title="Languages"
                  description={editData.languages.join(', ') || 'Not set'}
                  left={props => <List.Icon {...props} icon="translate" />}
                />
                <List.Item
                  title="Specializations"
                  description={editData.specializations.join(', ') || 'Not set'}
                  left={props => <List.Icon {...props} icon="star" />}
                />
                <List.Item
                  title="Experience"
                  description={`${editData.experience_years} years` || 'Not set'}
                  left={props => <List.Icon {...props} icon="calendar" />}
                />
                <List.Item
                  title="Study Place"
                  description={editData.study_place || 'Not set'}
                  left={props => <List.Icon {...props} icon="school" />}
                />
                <List.Item
                  title="Bio"
                  description={editData.bio || 'Not set'}
                  left={props => <List.Icon {...props} icon="text" />}
                  numberOfLines={3}
                />
              </Card.Content>
            </Card>
          )}

          <Button 
            mode="contained" 
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
            icon="pencil"
          >
            Edit Profile
          </Button>

          <Button 
            mode="outlined" 
            onPress={logout}
            style={styles.logoutButton}
            textColor="#FF6B35"
            icon="logout"
          >
            Logout
          </Button>
        </>
      ) : (
        <View style={styles.editForm}>
          <Text variant="headlineSmall" style={styles.editTitle}>Edit Profile</Text>
          
          <TextInput
            label="Full Name *"
            value={editData.name}
            onChangeText={(text) => setEditData({ ...editData, name: text })}
            style={styles.input}
            mode="outlined"
          />

          <View style={styles.locationRow}>
            <Button
              mode="contained"
              onPress={handleLocationPermission}
              loading={locationLoading}
              disabled={locationLoading}
              style={styles.locationButton}
              icon="map-marker"
            >
              {locationLoading ? 'Getting Location...' : 'Use Current Location'}
            </Button>
          </View>

          <CascadingLocationSelect
            country={editData.location.country}
            state={editData.location.state}
            city={editData.location.city}
            phone={editData.phone}
            onLocationChange={(loc) => setEditData({ ...editData, location: { ...editData.location, ...loc } })}
            onPhoneChange={(phone) => setEditData({ ...editData, phone })}
            required
            style={styles.input}
          />

          <TextInput
            label="Parampara (Spiritual Tradition) *"
            value={editData.parampara}
            onChangeText={(text) => setEditData({ ...editData, parampara: text })}
            style={styles.input}
            mode="outlined"
            placeholder="e.g., Shaiva, Vaishnava, Shakta"
          />

          {user?.role === 'acharya' && (
            <>
              <TextInput
                label="Gotra *"
                value={editData.gotra}
                onChangeText={(text) => setEditData({ ...editData, gotra: text })}
                style={styles.input}
                mode="outlined"
              />
              
              <TextInput
                label="Languages (comma separated) *"
                value={editData.languages.join(', ')}
                onChangeText={(text) => setEditData({ 
                  ...editData, 
                  languages: text.split(',').map(s => s.trim()).filter(Boolean) 
                })}
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Sanskrit, Hindi, English"
              />
              
              <TextInput
                label="Specializations (comma separated) *"
                value={editData.specializations.join(', ')}
                onChangeText={(text) => setEditData({ 
                  ...editData, 
                  specializations: text.split(',').map(s => s.trim()).filter(Boolean) 
                })}
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Vedic Rituals, Astrology"
              />
              
              <TextInput
                label="Experience (years) *"
                value={editData.experience_years}
                onChangeText={(text) => setEditData({ ...editData, experience_years: text })}
                style={styles.input}
                mode="outlined"
                keyboardType="numeric"
              />
              
              <TextInput
                label="Study Place *"
                value={editData.study_place}
                onChangeText={(text) => setEditData({ ...editData, study_place: text })}
                style={styles.input}
                mode="outlined"
                placeholder="Where you studied"
              />
              
              <TextInput
                label="Bio *"
                value={editData.bio}
                onChangeText={(text) => setEditData({ ...editData, bio: text })}
                style={styles.input}
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder="Brief description about yourself"
              />
            </>
          )}

          <View style={styles.buttonRow}>
            <Button 
              mode="outlined" 
              onPress={() => {
                setIsEditing(false);
                loadUserData();
              }}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button 
              mode="contained" 
              onPress={handleSave}
              loading={loading}
              disabled={loading}
              style={styles.saveButton}
            >
              Save Changes
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  email: {
    color: '#666',
    marginTop: 4,
  },
  roleChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 8,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  divider: {
    marginBottom: 8,
  },
  editButton: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#FF6B35',
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    borderColor: '#FF6B35',
  },
  editForm: {
    padding: 16,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  editTitle: {
    marginBottom: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  locationRow: {
    marginBottom: 16,
  },
  locationButton: {
    backgroundColor: '#4CAF50',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 0.48,
    borderColor: '#999',
  },
  saveButton: {
    flex: 0.48,
    backgroundColor: '#FF6B35',
  },
});

export default ProfileScreen;
