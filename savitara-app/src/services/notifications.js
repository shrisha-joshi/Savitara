/**
 * Push Notification Service
 * Note: Push notifications are not available in Expo Go (SDK 53+).
 * For push notifications, use a development build or production build.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PUSH_TOKEN_KEY = 'push_notification_token';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Lazy load notification modules to avoid initialization issues in Expo Go
let Notifications = null;
let Device = null;

async function loadNotificationModules() {
  if (isExpoGo && Platform.OS !== 'web') {
    console.log('📱 Running in Expo Go - Push notifications disabled (SDK 53+)');
    return false;
  }
  
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
    
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    return true;
  } catch (error) {
    console.warn('Failed to load notification modules:', error.message);
    return false;
  }
}

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
    this.isExpoGo = isExpoGo;
    this.initialized = false;
  }

  async initialize(navigation) {
    // Skip in Expo Go on mobile devices
    if (this.isExpoGo && Platform.OS !== 'web') {
      console.log('ℹ️ Push notifications are not available in Expo Go (SDK 53+).');
      console.log('ℹ️ To test push notifications, create a development build with: npx expo run:android');
      return;
    }

    // Try to load notification modules
    const loaded = await loadNotificationModules();
    if (!loaded || !Notifications) {
      console.log('ℹ️ Notification modules not available');
      return;
    }

    if (Device && !Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return;
    }

    this.initialized = true;

    // Register for push notifications
    const token = await this.registerForPushNotifications();
    
    if (token) {
      // Save token to AsyncStorage
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      
      // Send token to backend
      try {
        await api.post('/users/push-token', { token });
      } catch (error) {
        console.error('Error sending push token to backend:', error);
      }
    }

    // Setup listeners
    this.setupNotificationListeners(navigation);
  }

  async registerForPushNotifications() {
    // Skip if not initialized or modules not loaded
    if (!this.initialized || !Notifications) {
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Ask for permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permissions');
        return null;
      }

      // Setup notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B35',
        });
      }

      if (Platform.OS === 'web') {
        return null;
      }

      // Get project ID from app config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 
                        Constants.easConfig?.projectId ?? 
                        'savitara-app';

      // Get Expo push token with projectId
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Push notification token:', token);
      
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  setupNotificationListeners(navigation) {
    // Skip if notifications not loaded
    if (!Notifications) return;

    // Notification received while app is open
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        console.log('Notification received:', notification);
        
        // You can show in-app notification or update UI
        const { title, body, data } = notification.request.content;
        console.log('Notification content:', { title, body, data });
      }
    );

    // Notification tapped/clicked
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        console.log('Notification tapped:', response);
        
        const data = response.notification.request.content.data;
        
        // Navigate based on notification type
        this.handleNotificationNavigation(navigation, data);
      }
    );
  }

  handleNotificationNavigation(navigation, data) {
    if (!data || !navigation) return;

    const { type, bookingId, conversationId, acharyaId } = data;

    switch (type) {
      case 'booking_confirmed':
      case 'booking_update':
        navigation.navigate('BookingDetails', { bookingId });
        break;
      
      case 'new_message':
        navigation.navigate('Chat', { conversationId });
        break;
      
      case 'booking_request':
        navigation.navigate('BookingRequest', { bookingId });
        break;
      
      case 'review_reminder':
        navigation.navigate('WriteReview', { bookingId });
        break;
      
      case 'acharya_recommendation':
        if (acharyaId) {
          navigation.navigate('AcharyaDetails', { acharyaId });
        }
        break;
      
      default:
        console.log('Unknown notification type:', type);
    }
  }

  async scheduleLocalNotification(title, body, data = {}, triggerSeconds = 1) {
    if (!Notifications) {
      console.log('ℹ️ Cannot schedule notification - notifications not available');
      return null;
    }
    
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: {
          seconds: triggerSeconds,
        },
      });
      
      return id;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  async cancelNotification(notificationId) {
    if (!Notifications) return;
    
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications() {
    if (!Notifications) return;
    
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async getBadgeCount() {
    if (!Notifications) return 0;
    
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count) {
    if (!Notifications) return;
    
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  cleanup() {
    if (!Notifications) return;
    
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default new NotificationService();
