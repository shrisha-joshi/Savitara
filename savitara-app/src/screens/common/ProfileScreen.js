import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Avatar, Button, Divider } from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';

const ProfileScreen = () => {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Image 
          size={80} 
          source={{ uri: user?.profile_picture || 'https://via.placeholder.com/150' }}
        />
        <List.Item
          title={user?.full_name}
          description={user?.email}
          style={styles.profileInfo}
        />
      </View>
      
      <Divider />
      
      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item
          title="Phone"
          description={user?.phone_number}
          left={props => <List.Icon {...props} icon="phone" />}
        />
        <List.Item
          title="Location"
          description={user?.location}
          left={props => <List.Icon {...props} icon="map-marker" />}
        />
        <List.Item
          title="Role"
          description={user?.role === 'grihasta' ? 'Grihasta (User)' : 'Acharya (Provider)'}
          left={props => <List.Icon {...props} icon="account-circle" />}
        />
      </List.Section>
      
      <Divider />
      
      <List.Section>
        <List.Subheader>Settings</List.Subheader>
        <List.Item
          title="Edit Profile"
          left={props => <List.Icon {...props} icon="pencil" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
        <List.Item
          title="Notifications"
          left={props => <List.Icon {...props} icon="bell" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
        <List.Item
          title="Privacy & Security"
          left={props => <List.Icon {...props} icon="shield-check" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
        <List.Item
          title="Help & Support"
          left={props => <List.Icon {...props} icon="help-circle" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
      </List.Section>
      
      <Button 
        mode="outlined" 
        onPress={logout}
        style={styles.logoutButton}
        textColor="#FF6B35"
      >
        Logout
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  logoutButton: {
    margin: 20,
    borderColor: '#FF6B35',
  },
});

export default ProfileScreen;
