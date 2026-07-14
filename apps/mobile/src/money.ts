import { formatPaise } from '@splitsmart/types';

/**
 * Format integer minor units + currency. INR (the only v1 currency) gets
 * Indian digit grouping (₹1,23,456.78); anything else falls back to a plain
 * decimal so historical non-INR data still renders.
 */
export function formatMoney(amountMinor: number, currency: string): string {
  if (currency === 'INR') return formatPaise(amountMinor);
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  return `${sign}${(abs / 100).toFixed(2)} ${currency}`;
}
