import type { Money } from './index';

/** True if the value is a valid integer minor-unit amount. */
export function isValidMinor(amountMinor: number): boolean {
  return Number.isInteger(amountMinor);
}

/** Add two Money values of the same currency. Throws on currency mismatch. */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}
