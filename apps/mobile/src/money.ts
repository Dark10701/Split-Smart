/** Format integer minor units + currency as a human string, e.g. 1234 USD -> "$12.34". */
const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };

// Currencies with no minor unit (amount is already the major unit).
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND']);

export function formatMoney(amountMinor: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? '';
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const major = ZERO_DECIMAL.has(currency)
    ? String(abs)
    : (abs / 100).toFixed(2);
  const suffix = symbol ? '' : ` ${currency}`;
  return `${sign}${symbol}${major}${suffix}`;
}
