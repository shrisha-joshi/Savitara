/**
 * Push Notification Service
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PUSH_TOKEN_KEY = 'push_notification_token';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  async initialize(navigation) {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return;
    }

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

      // Get Expo push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push notification token:', token);
      
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  setupNotificationListeners(navigation) {
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
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default new NotificationService();
