import React from 'react';
import PropTypes from 'prop-types';
import { StyleSheet, ScrollView, Text } from 'react-native';
import { Card, Button, Avatar, Divider, List } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const BullhornIcon = (props) => <List.Icon {...props} icon="bullhorn" />;
const ChartIcon = (props) => <List.Icon {...props} icon="chart-line" />;
const CogIcon = (props) => <List.Icon {...props} icon="cog" />;

function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={80}
            label={user?.name?.charAt(0) || 'A'}
            style={styles.avatar}
          />
          <Text style={styles.title}>{user?.name}</Text>
          <Text style={styles.text}>{user?.email}</Text>
          <Text style={styles.role}>Admin</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="Broadcast Notifications"
            description="Send notifications to users"
            left={BullhornIcon}
            onPress={() => navigation.navigate('Broadcast')}
          />
          <Divider />
          <List.Item
            title="Platform Analytics"
            description="View detailed analytics"
            left={ChartIcon}
            onPress={() => navigation.navigate('Dashboard')}
          />
          <Divider />
          <List.Item
            title="Settings"
            description="App settings and preferences"
            left={CogIcon}
            onPress={() => {}}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>About Admin App</Text>
          <Text style={styles.info}>Version 1.0.0</Text>
          <Text style={styles.info}>
            Mobile admin interface for Savitara platform management
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleLogout}
        icon="logout"
        buttonColor="#F44336"
        style={styles.logoutButton}
      >
        Logout
      </Button>
    </ScrollView>
  );
}

ProfileScreen.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
  }).isRequired,
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileCard: {
    margin: 16,
  },
  profileContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    backgroundColor: '#FF6B35',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
  role: {
    color: '#FF6B35',
    fontWeight: 'bold',
    marginTop: 4,
    fontSize: 14,
  },
  card: {
    margin: 16,
    marginTop: 0,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  info: {
    marginTop: 8,
    color: '#757575',
    fontSize: 14,
  },
  logoutButton: {
    margin: 16,
  },
});
