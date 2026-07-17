import { buildUpiPayUri } from '@splitsmart/types';

/**
 * UPI app providers. `any` uses the generic `upi://` scheme — Android shows
 * its app chooser (or opens the default UPI app) automatically. Named
 * providers use each app's own scheme so a specific app can be targeted;
 * adding a new app is one entry here, nothing else changes.
 */
export interface UpiPaymentParams {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
}

export interface UpiProvider {
  id: 'any' | 'gpay' | 'phonepe' | 'paytm' | 'bhim';
  label: string;
  buildUri: (params: UpiPaymentParams) => string;
}

/** Swap the scheme on the canonical upi:// link (params are identical). */
function withScheme(uri: string, scheme: string): string {
  return uri.replace(/^upi:\/\/pay/, scheme);
}

export const UPI_PROVIDERS: UpiProvider[] = [
  { id: 'any', label: 'Any UPI app', buildUri: (p) => buildUpiPayUri(p) },
  {
    id: 'gpay',
    label: 'Google Pay',
    buildUri: (p) => withScheme(buildUpiPayUri(p), 'tez://upi/pay'),
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    buildUri: (p) => withScheme(buildUpiPayUri(p), 'phonepe://pay'),
  },
  { id: 'paytm', label: 'Paytm', buildUri: (p) => withScheme(buildUpiPayUri(p), 'paytmmp://pay') },
  { id: 'bhim', label: 'BHIM', buildUri: (p) => withScheme(buildUpiPayUri(p), 'bhim://pay') },
];

/**
 * Open a UPI payment in the user's UPI app. Defaults to the generic scheme so
 * the OS handles app selection. Navigates via a temporary anchor so the SPA
 * never unloads — on desktop (no handler) the click is a no-op and callers
 * should offer the QR/copy fallback.
 */
export function openUpiPayment(
  params: UpiPaymentParams,
  providerId: UpiProvider['id'] = 'any',
): void {
  const provider = UPI_PROVIDERS.find((p) => p.id === providerId) ?? UPI_PROVIDERS[0]!;
  const a = document.createElement('a');
  a.href = provider.buildUri(params);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * The value encoded in "my QR": a static `upi://pay` link with payee + name
 * but NO amount, exactly like the printed QR standees — the payer's app asks
 * for the amount.
 */
export function buildMyQrValue(vpa: string, name: string): string {
  const q = new URLSearchParams({ pa: vpa, pn: name, cu: 'INR' });
  return `upi://pay?${q.toString()}`;
}
