/**
 * UPI deep-link builder (M5-23). Pure and shared by clients and server.
 *
 * A `upi://pay` URI opens any UPI app (GPay, PhonePe, Paytm, BHIM…) with the
 * payee and amount pre-filled. SplitSmart only builds the link — the user's
 * UPI app executes the payment, and the payer records the settlement after.
 */

export interface UpiPayParams {
  /** Payee VPA, e.g. `maya@okhdfcbank`. */
  payeeVpa: string;
  /** Payee display name shown in the UPI app. */
  payeeName: string;
  /** Amount in paise (integer minor units). Omit for an open-amount link. */
  amountPaise?: number;
  /** Optional transaction note, e.g. "SplitSmart · Goa trip". */
  note?: string;
}

/** Convert integer paise to the decimal rupee string UPI expects (`am=12.34`). */
export function paiseToRupeeString(paise: number): string {
  if (!Number.isInteger(paise) || paise <= 0) {
    throw new Error('Amount must be a positive integer of paise');
  }
  const rupees = Math.floor(paise / 100);
  const rem = paise % 100;
  return `${rupees}.${String(rem).padStart(2, '0')}`;
}

/** Build a `upi://pay` deep link. Currency is always INR (v1 is India-only). */
export function buildUpiPayUri(params: UpiPayParams): string {
  const query = new URLSearchParams();
  query.set('pa', params.payeeVpa);
  query.set('pn', params.payeeName);
  if (params.amountPaise !== undefined) {
    query.set('am', paiseToRupeeString(params.amountPaise));
  }
  query.set('cu', 'INR');
  if (params.note) query.set('tn', params.note.slice(0, 80));
  return `upi://pay?${query.toString()}`;
}

/** Format paise with Indian digit grouping, e.g. 12345678 -> "₹1,23,456.78". */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  // Indian grouping: last 3 digits, then pairs (1,23,456).
  const s = String(rupees);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${sign}₹${grouped}.${rem}`;
}
