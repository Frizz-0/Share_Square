import { AWS_API_GATEWAY_URL } from '../config';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeDeviceToHousePush(
    groupId: string,
    userId: string
): Promise<{ ok: boolean; reason: string }> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { ok: false, reason: 'Push not supported on this browser (On iPhone, tap Share -> Add to Home Screen first).' };
    }

    const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
    if (!vapidPublicKey) {
        return { ok: false, reason: 'VITE_VAPID_PUBLIC_KEY is empty in this build.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return { ok: false, reason: `Browser notification permission is "${permission}".` };
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });
        }

        const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
        const res = await fetch(`${base}/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                groupId,
                userId,
                subscription: subscription.toJSON()
            })
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            return { ok: false, reason: `Backend /push/subscribe returned ${res.status}: ${errText}` };
        }

        return { ok: true, reason: 'Device registered for background push!' };
    } catch (err: any) {
        return { ok: false, reason: err?.message || 'Push subscription failed' };
    }
}

export async function sendTestPush(groupId: string, userId: string): Promise<any> {
    const base = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
    const res = await fetch(`${base}/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, userId })
    });
    return res.json();
}