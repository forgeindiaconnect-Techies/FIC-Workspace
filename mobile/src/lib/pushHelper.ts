import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';

/**
 * Requests permission for remote notifications, retrieves the Expo push token,
 * and sends it to the backend to associate it with the active user session.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushHelper] Notification permission was not granted.');
      return null;
    }

    // Retrieve the Expo push token using the projectId specified in mobile/app.json
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '9a59e2da-9908-4e8f-a3d2-4a6af81ab2ff',
    });

    const token = tokenData.data;
    console.log('[PushHelper] Retrieved Expo push token:', token);

    // Register token on the backend
    await api.auth.registerPushToken(token);
    console.log('[PushHelper] Successfully registered push token on the backend.');

    // Configure notification channel for Android devices
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });
    }

    return token;
  } catch (error) {
    console.warn('[PushHelper] Error during push notification registration:', error);
    return null;
  }
}
