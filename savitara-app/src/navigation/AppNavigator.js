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
import ServicesScreen from '../screens/common/ServicesScreen';
import ServiceDetailScreen from '../screens/common/ServiceDetailScreen';
import WalletScreen from '../screens/common/WalletScreen';

// Auth Screens
import LanguageSelectorScreen from '../screens/auth/LanguageSelectorScreen';

// Acharya Screens
import DashboardScreen from '../screens/acharya/DashboardScreen';
import CalendarScreen from '../screens/acharya/CalendarScreen';
import ManageAvailabilityScreen from '../screens/acharya/ManageAvailabilityScreen';
import ManagePoojaScreen from '../screens/acharya/ManagePoojaScreen';
import BookingRequestsScreen from '../screens/acharya/BookingRequestsScreen';
import EarningsScreen from '../screens/acharya/EarningsScreen';
import StartBookingScreen from '../screens/acharya/StartBookingScreen';
import AttendanceConfirmScreen from '../screens/acharya/AttendanceConfirmScreen';
import ReviewsScreen from '../screens/acharya/ReviewsScreen';
import LoginScreen from '../screens/auth/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Icon mapping for tab navigators (moved outside components)
const GRIHASTA_ICON_MAP = {
  Home: 'home',
  Services: 'book-open-variant',
  Search: 'magnify',
  Bookings: 'calendar-check',
  Chat: 'chat',
  Wallet: 'wallet',
  Profile: 'account',
};

const ACHARYA_ICON_MAP = {
  Dashboard: 'view-dashboard',
  Bookings: 'calendar-clock',
  Earnings: 'cash-multiple',
  Wallet: 'wallet',
  Chat: 'chat',
  Profile: 'account',
};

// Tab icon renderer (moved outside to avoid inline function definition)
const renderTabIcon = (iconMap) => ({ route }) => ({
  tabBarIcon: ({ color, size }) => (
    <MaterialCommunityIcons 
      name={iconMap[route.name] || 'help-circle'} 
      size={size} 
      color={color} 
    />
  ),
  tabBarActiveTintColor: '#FF6B35',
  tabBarInactiveTintColor: 'gray',
});

const GrihastaTabNavigator = () => (
  <Tab.Navigator screenOptions={renderTabIcon(GRIHASTA_ICON_MAP)}>
    <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <Tab.Screen name="Services" component={ServicesScreen} options={{ title: 'Services' }} />
    <Tab.Screen name="Search" component={SearchAcharyasScreen} options={{ title: 'Acharyas' }} />
    <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'Bookings' }} />
    <Tab.Screen name="Chat" component={ChatListScreen} options={{ title: 'Messages' }} />
    <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AcharyaTabNavigator = () => (
  <Tab.Navigator screenOptions={renderTabIcon(ACHARYA_ICON_MAP)}>
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Bookings" component={BookingRequestsScreen} options={{ title: 'Requests' }} />
    <Tab.Screen name="Earnings" component={EarningsScreen} />
    <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
    <Tab.Screen name="Chat" component={ChatListScreen} options={{ title: 'Messages' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Helper function to render navigation screens based on auth state
const renderNavigationScreens = (user, isOnboarded, userRole) => {
  // Unauthenticated user - show auth screens
  if (!user) {
    return (
      <>
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="LanguageSelect" 
          component={LanguageSelectorScreen}
          options={{ headerShown: false }}
        />
      </>
    );
  }
  
  // Authenticated but not onboarded - show onboarding screens
  if (!isOnboarded) {
    return (
      <>
        <Stack.Screen 
          name="LanguageSelect" 
          component={LanguageSelectorScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
      </>
    );
  }
  
  // Grihasta user - show grihasta screens
  if (userRole === 'grihasta') {
    return (
      <>
        <Stack.Screen 
          name="GrihastaMain" 
          component={GrihastaTabNavigator} 
          options={{ headerShown: false }}
        />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
        <Stack.Screen name="AcharyaDetails" component={AcharyaDetailsScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </>
    );
  }
  
  // Acharya user - show acharya screens
  return (
    <>
      <Stack.Screen 
        name="AcharyaMain" 
        component={AcharyaTabNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'My Availability' }} />
      <Stack.Screen name="ManageAvailability" component={ManageAvailabilityScreen} />
      <Stack.Screen name="ManagePooja" component={ManagePoojaScreen} />
      <Stack.Screen name="StartBooking" component={StartBookingScreen} />
      <Stack.Screen name="AttendanceConfirm" component={AttendanceConfirmScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </>
  );
};

const AppNavigator = () => {
  const { user, isOnboarded, userRole } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {renderNavigationScreens(user, isOnboarded, userRole)}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
