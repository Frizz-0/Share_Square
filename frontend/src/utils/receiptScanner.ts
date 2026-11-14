// src/utils/receiptScanner.ts
import type { CurrencyCode, ExpenseItem } from '../types';
import { AWS_API_GATEWAY_URL } from '../config';

export interface ScannedReceiptResult {
    title: string;
    amount: number;
    currency: CurrencyCode;
    note: string;
    items: ExpenseItem[];
}

export async function scanVideoFrameWithGroq(videoEl: HTMLVideoElement): Promise<ScannedReceiptResult> {
    const maxWidth = 1024;
    const vw = videoEl.videoWidth || 1024;
    const vh = videoEl.videoHeight || 1365;
    const scale = Math.min(1, maxWidth / vw);

    let canvas: HTMLCanvasElement | null = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Camera capture context unavailable');

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    let imageDataUrl: string | null = canvas.toDataURL('image/jpeg', 0.8);

    // Immediately wipe canvas buffer from memory
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    canvas = null;

    try {
        const baseUrl = AWS_API_GATEWAY_URL.replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/scan-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageDataUrl }),
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`Scan failed (${res.status}): ${errBody || 'Server error'}`);
        }

        const data = await res.json();
        return {
            title: data.title || 'Grocery Receipt',
            amount: Number(data.amount) || 0,
            currency: (['GBP', 'USD', 'EUR', 'INR', 'JPY'].includes(data.currency) ? data.currency : 'GBP') as CurrencyCode,
            note: data.note || '',
            items: Array.isArray(data.items)
                ? data.items
                    .map((it: any, i: number) => ({
                        id: `scan-${Date.now()}-${i}`,
                        name: String(it.name || '').trim(),
                        qty: Number(it.qty) > 1 ? Number(it.qty) : undefined,
                        price: it.price !== undefined && !isNaN(Number(it.price)) ? Number(it.price) : undefined,
                    }))
                    .filter((it: ExpenseItem) => it.name.length > 0)
                : [],
        };
    } finally {
        // Dereference base64 payload so GC reclaims it immediately
        imageDataUrl = null;
    }
}