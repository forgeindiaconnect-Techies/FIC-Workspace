import { User } from '../models/User';

interface PushPayload {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Sends remote push notifications to recipients via Expo's Push Notification Service.
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

    // Normalize emails for robust lookup
    const normalizedEmails = recipientEmails.map(email => email.trim().toLowerCase());

    // Find users with registered Expo push tokens
    const users = await User.find({
      email: { $in: normalizedEmails },
      expoPushToken: { $exists: true, $ne: '' }
    }).select('email expoPushToken');

    if (users.length === 0) {
      console.log(`[PushService] No registered push tokens found for recipients: ${normalizedEmails.join(', ')}`);
      return;
    }

    const messages: PushPayload[] = [];
    const seenTokens = new Set<string>();

    for (const user of users) {
      if (user.expoPushToken && !seenTokens.has(user.expoPushToken)) {
        seenTokens.add(user.expoPushToken);
        messages.push({
          to: user.expoPushToken,
          sound: 'default',
          title,
          body,
          data
        });
      }
    }

    if (messages.length === 0) {
      return;
    }

    console.log(`[PushService] Dispatching push notifications to ${messages.length} token(s)...`);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PushService] Expo Push gateway returned status ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json() as any;
    console.log('[PushService] Expo push result:', JSON.stringify(result));
  } catch (error) {
    console.error('[PushService] Failed to send push notifications:', error);
  }
}
