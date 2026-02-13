import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: string | null;
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);

  useEffect(() => {
    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      // Handle notification tap - navigate to relevant screen
      const data = response.notification.request.content.data;
      handleNotificationResponse(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const handleNotificationResponse = (data: any) => {
    // Navigation will be handled by the component using this hook
    console.log('Notification tapped with data:', data);
  };

  const registerForPushNotifications = async (): Promise<string | null> => {
    try {
      // Note: Push notifications only work on physical devices
      // On simulator, this will fail gracefully

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setError('Permission not granted for push notifications');
        return null;
      }

      // Get project ID from app config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

      if (!projectId) {
        setError('Project ID not found in app config');
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      setExpoPushToken(token);

      // Store token locally
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1D1D1F',
        });
      }

      return token;
    } catch (err: any) {
      console.error('Error registering for push notifications:', err);
      setError(err.message || 'Failed to register for push notifications');
      return null;
    }
  };

  const sendTokenToBackend = async (token: string): Promise<boolean> => {
    try {
      await api.post('/profile/fcm-token', { token });
      console.log('Push token registered with backend');
      return true;
    } catch (err: any) {
      console.error('Failed to send push token to backend:', err);
      return false;
    }
  };

  const unregisterToken = async (): Promise<boolean> => {
    try {
      const storedToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (storedToken) {
        await api.delete('/profile/fcm-token', { data: { token: storedToken } });
        await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
        setExpoPushToken(null);
      }
      return true;
    } catch (err: any) {
      console.error('Failed to unregister push token:', err);
      return false;
    }
  };

  const initializePushNotifications = async (): Promise<string | null> => {
    const token = await registerForPushNotifications();
    if (token) {
      await sendTokenToBackend(token);
    }
    return token;
  };

  return {
    expoPushToken,
    notification,
    error,
    registerForPushNotifications,
    sendTokenToBackend,
    unregisterToken,
    initializePushNotifications,
  };
}
