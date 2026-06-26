import webpush from 'web-push';
import { User } from '../models/User';

// Initialize VAPID Keys
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

// Generate keys dynamically in development/convenience environments if not set in .env
if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('[WebPush] VAPID keys not configured in environment. Generating dynamic VAPID keys...');
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log('[WebPush] Generated VAPID Public Key:', vapidPublicKey);
}

// Configure VAPID details (required by the web-push library)
try {
  webpush.setVapidDetails(
    'mailto:admin@fic-workspace.app',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('[WebPush] VAPID details configured successfully.');
} catch (e) {
  console.error('[WebPush] Failed to set VAPID details:', e);
}

/**
 * Returns the active VAPID Public Key for client-side subscription.
 */
export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

/**
 * Sends Web Push notifications to a list of users by their emails.
 *
 * @param recipientEmails Array of recipient email addresses.
 * @param payload The push notification details.
 */
export async function sendWebPush(
  recipientEmails: string[],
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    if (!recipientEmails || recipientEmails.length === 0) return;

    const normalizedEmails = recipientEmails.map(email => email.trim().toLowerCase());

    // Find users with registered Web Push subscriptions
    const users = await User.find({
      email: { $in: normalizedEmails },
      'webPushSubscriptions.0': { $exists: true }
    }).select('email webPushSubscriptions');

    if (users.length === 0) {
      return;
    }

    const payloadString = JSON.stringify(payload);

    for (const user of users) {
      if (!user.webPushSubscriptions || user.webPushSubscriptions.length === 0) continue;

      const activeSubscriptions = [...user.webPushSubscriptions];
      let hasPruned = false;

      for (let i = activeSubscriptions.length - 1; i >= 0; i--) {
        const sub = activeSubscriptions[i];
        
        try {
          // Format subscription as required by the web-push library
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          };

          await webpush.sendNotification(pushSubscription, payloadString);
        } catch (err: any) {
          // If the subscription has expired, has been revoked, or is invalid, prune it from the database
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[WebPush] Pruning expired or revoked subscription for user ${user.email} (Endpoint: ${sub.endpoint})`);
            activeSubscriptions.splice(i, 1);
            hasPruned = true;
          } else {
            console.error(`[WebPush] Error sending push notification to ${user.email}:`, err.message || err);
          }
        }
      }

      // If we pruned any subscriptions, save the updated list to MongoDB
      if (hasPruned) {
        user.webPushSubscriptions = activeSubscriptions;
        await user.save();
      }
    }
  } catch (error) {
    console.error('[WebPush] Failed to dispatch web push notifications:', error);
  }
}
