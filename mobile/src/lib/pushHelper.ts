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

    // Retrieve the raw device push token (FCM token on Android, APNs token on iOS)
    const tokenData = await Notifications.getDevicePushTokenAsync();

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

// Background Task for FCM Data-Only Messages (Incoming Calls)
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const message = remoteMessage.data;
  if (message && message.type === 'incoming_call') {
    const channelId = await notifee.createChannel({
      id: 'calls',
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    await notifee.displayNotification({
      title: 'Incoming Call',
      body: `${message.callerName || message.callerEmail} is calling...`,
      data: message,
      android: {
        channelId,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        importance: AndroidImportance.HIGH,
        autoCancel: false,
        ongoing: true,
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
        },
        pressAction: {
          id: 'default',
        },
        actions: [
          {
            title: 'Answer',
            pressAction: { id: 'answer', launchActivity: 'default' },
          },
          {
            title: 'Decline',
            pressAction: { id: 'decline' },
          },
        ],
      },
    });
  }
});
