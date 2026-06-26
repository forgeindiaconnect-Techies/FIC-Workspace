import { getApiUrl } from '../api';

/**
 * Utility helper to convert VAPID base64 public key to Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the background Service Worker, requests browser notification permissions,
 * fetches the server VAPID public key, and registers the subscription with the backend.
 */
export async function registerWebPush() {
  if (typeof window === 'undefined') return;

  // 1. Verify browser support for Service Workers and Push Manager
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Browser does not support Service Workers or Push Notifications.');
    return;
  }

  try {
    // 2. Register Service Worker (public/sw.js)
    console.log('[WebPush] Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[WebPush] Service Worker registered successfully with scope:', registration.scope);

    // 3. Request browser notification permissions
    if (Notification.permission === 'denied') {
      console.warn('[WebPush] Browser notification permission is denied.');
      return;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[WebPush] Notification permission was not granted.');
        return;
      }
    }

    // 4. Fetch the VAPID Public Key from the backend
    const pubKeyUrl = getApiUrl('/api/auth/web-push/public-key');
    const pubKeyResponse = await fetch(pubKeyUrl);
    if (!pubKeyResponse.ok) {
      throw new Error(`Failed to fetch VAPID public key from backend: ${pubKeyResponse.status}`);
    }
    const { publicKey } = await pubKeyResponse.json();
    if (!publicKey) {
      throw new Error('VAPID public key is empty or invalid.');
    }

    // 5. Subscribe to the push service
    console.log('[WebPush] Subscribing browser to PushManager...');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    
    let subscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    } catch (subError) {
      console.warn('[WebPush] Direct subscription failed. Attempting to clear stale subscription and retry...', subError);
      try {
        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription) {
          await existingSubscription.unsubscribe();
          console.log('[WebPush] Stale subscription cleared successfully.');
        }
        // Retry subscription with the new key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      } catch (retryError) {
        console.error('[WebPush] Subscription retry failed:', retryError);
        throw retryError;
      }
    }

    console.log('[WebPush] Obtained browser push subscription:', JSON.stringify(subscription));

    // 6. Send the subscription object to our backend
    const subscribeUrl = getApiUrl('/api/auth/web-push/subscribe');
    const token = localStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(subscribeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscription }),
    });

    if (response.ok) {
      console.log('[WebPush] Subscription registered successfully on backend.');
    } else {
      const errText = await response.text();
      console.error(`[WebPush] Backend subscription registration failed: ${response.status} - ${errText}`);
    }
  } catch (error) {
    console.error('[WebPush] Error during Web Push registration flow:', error);
  }
}

/**
 * Unsubscribes the browser from push notifications and updates the backend.
 */
export async function unregisterWebPush() {
  if (typeof window === 'undefined') return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      const endpoint = subscription.endpoint;
      
      // Unsubscribe locally
      await subscription.unsubscribe();
      console.log('[WebPush] Unsubscribed browser locally.');

      // Notify backend to remove the subscription record
      const unsubscribeUrl = getApiUrl('/api/auth/web-push/unsubscribe');
      const token = localStorage.getItem('token');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch(unsubscribeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint }),
      });
      console.log('[WebPush] Subscription removed from backend successfully.');
    }
  } catch (error) {
    console.error('[WebPush] Error during Web Push unregistration:', error);
  }
}
