import React from 'react';
import PropTypes from 'prop-types';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';

// Main screens
import DashboardScreen from '../screens/DashboardScreen';
import UsersScreen from '../screens/UsersScreen';
import VerificationsScreen from '../screens/VerificationsScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import BroadcastScreen from '../screens/BroadcastScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab bar icons
const DashboardIcon = ({ color, size }) => (
  <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
);
DashboardIcon.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

const UsersIcon = ({ color, size }) => (
  <MaterialCommunityIcons name="account-group" color={color} size={size} />
);
UsersIcon.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

const VerificationsIcon = ({ color, size }) => (
  <MaterialCommunityIcons name="check-decagram" color={color} size={size} />
);
VerificationsIcon.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

const ReviewsIcon = ({ color, size }) => (
  <MaterialCommunityIcons name="star" color={color} size={size} />
);
ReviewsIcon.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

const MoreIcon = ({ color, size }) => (
  <MaterialCommunityIcons name="menu" color={color} size={size} />
);
MoreIcon.propTypes = {
  color: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#757575',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FF6B35',
        },
        headerTintColor: '#FFF',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tab.Screen
        name="Users"
        component={UsersScreen}
        options={{
          tabBarIcon: UsersIcon,
        }}
      />
      <Tab.Screen
        name="Verifications"
        component={VerificationsScreen}
        options={{
          tabBarIcon: VerificationsIcon,
        }}
      />
      <Tab.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{
          tabBarIcon: ReviewsIcon,
        }}
      />
      <Tab.Screen
        name="More"
        component={ProfileScreen}
        options={{
          tabBarIcon: MoreIcon,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Broadcast" component={BroadcastScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
