import { User } from '../models/User';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    let credential;
    // Check if the service account is provided via an environment variable (useful for Render/Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Fallback to local file
      const serviceAccount = require('../../serviceAccountKey.json');
      credential = admin.credential.cert(serviceAccount);
    }
    
    admin.initializeApp({
      credential
    });
    console.log('[PushService] Firebase Admin initialized successfully.');
  } catch (error: any) {
    console.warn('[PushService] Failed to initialize Firebase Admin. Ensure serviceAccountKey.json is present:', error.message);
  }
}

/**
 * Sends remote push notifications to recipients via Firebase Admin SDK (FCM).
 *
 * @param recipientEmails List of recipient email addresses.
 * @param title The notification title.
 * @param body The notification body text.
 * @param data Optional extra key-value data for the mobile app to consume.
 */
export async function sendPushNotification(
  recipientEmails: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    if (!recipientEmails || recipientEmails.length === 0) {
      return;
    }

    if (!admin.apps.length) {
      console.warn('[PushService] Firebase Admin is not initialized. Cannot send push notification.');
      return;
    }

    // Normalize emails for robust lookup
    const normalizedEmails = recipientEmails.map(email => email.trim().toLowerCase());

    // Find users with registered raw FCM tokens
    const users = await User.find({
      email: { $in: normalizedEmails },
      expoPushToken: { $exists: true, $ne: '' }
    }).select('email expoPushToken');

    if (users.length === 0) {
      console.log(`[PushService] No registered push tokens found for recipients: ${normalizedEmails.join(', ')}`);
      return;
    }

    const tokens = Array.from(new Set(users.map(u => u.expoPushToken).filter(Boolean))) as string[];

    if (tokens.length === 0) {
      return;
    }

    // Convert data values to strings (FCM only accepts string values in data payload)
    const stringifiedData: Record<string, string> = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    console.log(`[PushService] Dispatching FCM push notifications to ${tokens.length} token(s)...`);

    const message = {
      notification: {
        title,
        body
      },
      data: stringifiedData,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'default',
          sound: 'default'
        }
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`[PushService] FCM push result: ${response.successCount} successful, ${response.failureCount} failed.`);
    
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[PushService] Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
    }

  } catch (error) {
    console.error('[PushService] Failed to send push notifications:', error);
  }
}
