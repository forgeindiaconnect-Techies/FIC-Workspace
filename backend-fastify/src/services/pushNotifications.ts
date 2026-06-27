import { User } from '../models/User';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    let credential;
    // Check if the service account is provided via an environment variable (useful for Render/Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = cert(serviceAccount);
    } else {
      // Fallback to local file dynamically to prevent ESBuild bundle failures on Render
      // where the file does not exist during CI/CD.
      try {
        const fs = require('fs');
        const path = require('path');
        const fileContent = fs.readFileSync(path.join(__dirname, '../../serviceAccountKey.json'), 'utf8');
        credential = cert(JSON.parse(fileContent));
      } catch (err: any) {
        throw new Error('Local serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT env var is missing');
      }
    }
    
    initializeApp({
      credential,
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

    if (!getApps().length) {
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

    const response = await getMessaging().sendEachForMulticast(message);
    
    console.log(`[PushService] FCM push result: ${response.successCount} successful, ${response.failureCount} failed.`);
    
    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((resp: any, idx: number) => (!resp.success ? tokens[idx] : null))
        .filter((token: string | null) => token !== null);
      
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          console.error(`[PushService] Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
    }

  } catch (error) {
    console.error('[PushService] Failed to send push notifications:', error);
  }
}
