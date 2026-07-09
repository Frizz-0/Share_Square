import type { CurrencyCode } from './types';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£', USD: '$', EUR: '€', INR: '₹', JPY: '¥'
};

export const QUICK_ACTIONS_PRESETS = [
  { label: '🍕 Food', title: 'Pizza Night', icon: '🍕' },
  { label: '🛒 Groceries', title: 'Groceries Run', icon: '🛒' },
  { label: '⚡ Energy', title: 'Electric Bill', icon: '⚡' },
  { label: '📶 Wi-Fi', title: 'Broadband Internet', icon: '📶' },
  { label: '🍺 Drinks', title: 'Pub Weekend', icon: '🍺' },
  { label: '🧹 Clean', title: 'House Cleaning Supplies', icon: '🧹' }
];
