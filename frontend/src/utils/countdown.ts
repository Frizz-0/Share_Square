export interface CountdownState {
    label: string;
    urgency: 'UPCOMING' | 'SOON' | 'LIVE' | 'PAST';
}

export function formatEventCountdown(eventDateIso: string, nowMs: number): CountdownState {
    const targetMs = new Date(eventDateIso).getTime();
    if (isNaN(targetMs)) return { label: '', urgency: 'UPCOMING' };

    const diff = targetMs - nowMs;

    if (diff <= 0 && diff > -3600 * 1000 * 2) {
        return { label: 'Happening Now', urgency: 'LIVE' };
    }
    if (diff <= -3600 * 1000 * 2) {
        return { label: 'Ended', urgency: 'PAST' };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const urgency = diff < 24 * 3600 * 1000 ? 'SOON' : 'UPCOMING';

    if (days > 0) {
        return { label: `${days}d ${hours}h ${minutes}m left`, urgency };
    }
    if (hours > 0) {
        return { label: `${hours}h ${minutes}m ${seconds}s left`, urgency };
    }
    return { label: `${minutes}m ${seconds}s left`, urgency };
}