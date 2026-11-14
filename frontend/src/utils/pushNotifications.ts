import { AWS_API_GATEWAY_URL } from '../config';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    const buffer = new ArrayBuffer(outputArray.length);
    new Uint8Array(buffer).set(outputArray);
    return buffer;
}

export async function subscribeDeviceToHousePush(groupId: string, userId: string): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        console.warn('VITE_VAPID_PUBLIC_KEY missing in .env');
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

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

    return res.ok;
}