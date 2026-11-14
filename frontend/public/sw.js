self.addEventListener('push', (event) => {
    let payload = {
        title: 'ShareSquare House Alert',
        body: 'New update in your household hub.',
        url: '/'
    };

    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch {
        if (event.data) payload.body = event.data.text();
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: '/vite.svg',
            badge: '/vite.svg',
            tag: payload.tag || 'sharesquare-notice',
            renotify: true,
            data: { url: payload.url || '/' }
        })
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