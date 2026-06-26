// Service Worker for Browser Web Push Notifications

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Workspace Update';
    const options = {
      body: payload.body || 'You have a new notification.',
      icon: '/logo.png',
      badge: '/logo.png',
      data: {
        url: payload.url || '/'
      },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[ServiceWorker] Push event parse error:', err);
    // Fallback to plain text if JSON parsing fails
    event.waitUntil(
      self.registration.showNotification('Workspace Update', {
        body: event.data.text() || 'You have a new notification.',
        icon: '/logo.png',
        data: { url: '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Look for any open tab that starts with our origin
        const client = clientList.find((c) => {
          try {
            const clientUrl = new URL(c.url);
            const targetUrlObj = new URL(targetUrl, self.location.origin);
            return clientUrl.origin === targetUrlObj.origin;
          } catch (e) {
            return false;
          }
        });

        if (client && 'focus' in client) {
          // Navigate the open tab to the target URL and focus it
          return client.navigate(targetUrl).then((c) => {
            if (c && 'focus' in c) return c.focus();
          });
        }

        // If no tab is open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
