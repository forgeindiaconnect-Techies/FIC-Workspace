import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { api } from './api';

/**
 * Requests permission for remote notifications, retrieves the FCM push token,
 * and sends it to the backend to associate it with the active user session.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('[PushHelper] Notification permission was not granted.');
      return null;
    }

    // Retrieve the FCM push token
    const token = await messaging().getToken();
    console.log('[PushHelper] Retrieved FCM push token:', token);

    // Register token on the backend
    await api.auth.registerPushToken(token);
    console.log('[PushHelper] Successfully registered push token on the backend.');

    // Configure notification channels for Android devices
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });
      await notifee.createChannel({
        id: 'calls_ring',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        sound: 'phone_calling_1',
        vibration: true,
      });
    }

    return token;
  } catch (error) {
    console.warn('[PushHelper] Error during push notification registration:', error);
    return null;
  }
}

// Background Task for FCM Data-Only Messages (Incoming Calls)


messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const message = remoteMessage.data;
  if (message && message.type === 'incoming_call') {
    const channelId = await notifee.createChannel({
      id: 'calls_ring',
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'phone_calling_1',
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
