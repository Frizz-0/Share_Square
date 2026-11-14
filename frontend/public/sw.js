self.addEventListener('push', (event) => {
    let payload = {
        title: 'ShareSquare',
        body: 'New update in your House Hub.',
        url: '/',
        isUrgent: false
    };

    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch {
        if (event.data) payload.body = event.data.text();
    }

    const options = {
        body: payload.body,
        icon: '/SS_logo_2_512.png',
        badge: '/SS_logo_2_512.png',
        tag: payload.tag || 'sharesquare-notice',
        renotify: true,
        requireInteraction: Boolean(payload.isUrgent),
        vibrate: payload.isUrgent ? [250, 100, 250, 100, 400] : [120, 60, 120],
        data: { url: payload.url || '/' },
        actions: [
            { action: 'open', title: 'Open House Hub' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});