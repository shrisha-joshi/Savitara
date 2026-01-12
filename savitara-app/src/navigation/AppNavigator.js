import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Grihasta Screens
import HomeScreen from '../screens/grihasta/HomeScreen';
import SearchAcharyasScreen from '../screens/grihasta/SearchAcharyasScreen';
import AcharyaDetailsScreen from '../screens/grihasta/AcharyaDetailsScreen';
import BookingScreen from '../screens/grihasta/BookingScreen';
import PaymentScreen from '../screens/grihasta/PaymentScreen';
import MyBookingsScreen from '../screens/grihasta/MyBookingsScreen';
import BookingDetailsScreen from '../screens/grihasta/BookingDetailsScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ConversationScreen from '../screens/chat/ConversationScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import OnboardingScreen from '../screens/common/OnboardingScreen';
import SettingsScreen from '../screens/common/SettingsScreen';

// Acharya Screens
import DashboardScreen from '../screens/acharya/DashboardScreen';
import ManageAvailabilityScreen from '../screens/acharya/ManageAvailabilityScreen';
import ManagePoojaScreen from '../screens/acharya/ManagePoojaScreen';
import BookingRequestsScreen from '../screens/acharya/BookingRequestsScreen';
import EarningsScreen from '../screens/acharya/EarningsScreen';
import StartBookingScreen from '../screens/acharya/StartBookingScreen';
import AttendanceConfirmScreen from '../screens/acharya/AttendanceConfirmScreen';
import ReviewsScreen from '../screens/acharya/ReviewsScreen';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const GrihastaTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        
        if (route.name === 'Home') iconName = 'home';
        else if (route.name === 'Search') iconName = 'magnify';
        else if (route.name === 'Bookings') iconName = 'calendar-check';
        else if (route.name === 'Chat') iconName = 'chat';
        else if (route.name === 'Profile') iconName = 'account';
        
        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#FF6B35',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <Tab.Screen name="Search" component={SearchAcharyasScreen} options={{ title: 'Find Acharya' }} />
    <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
    <Tab.Screen name="Chat" component={ChatListScreen} options={{ title: 'Messages' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AcharyaTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        
        if (route.name === 'Dashboard') iconName = 'view-dashboard';
        else if (route.name === 'Bookings') iconName = 'calendar-clock';
        else if (route.name === 'Earnings') iconName = 'cash-multiple';
        else if (route.name === 'Chat') iconName = 'chat';
        else if (route.name === 'Profile') iconName = 'account';
        
        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#FF6B35',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Bookings" component={BookingRequestsScreen} options={{ title: 'Requests' }} />
    <Tab.Screen name="Earnings" component={EarningsScreen} />
    <Tab.Screen name="Chat" component={ChatListScreen} options={{ title: 'Messages' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, isOnboarded, userRole } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
        ) : !isOnboarded ? (
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        ) : userRole === 'grihasta' ? (
          <>
            <Stack.Screen 
              name="GrihastaMain" 
              component={GrihastaTabNavigator} 
              options={{ headerShown: false }}
            />
            <Stack.Screen name="AcharyaDetails" component={AcharyaDetailsScreen} />
            <Stack.Screen name="Booking" component={BookingScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="AcharyaMain" 
              component={AcharyaTabNavigator} 
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ManageAvailability" component={ManageAvailabilityScreen} />
            <Stack.Screen name="ManagePooja" component={ManagePoojaScreen} />
            <Stack.Screen name="StartBooking" component={StartBookingScreen} />
            <Stack.Screen name="AttendanceConfirm" component={AttendanceConfirmScreen} />
            <Stack.Screen name="Reviews" component={ReviewsScreen} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
