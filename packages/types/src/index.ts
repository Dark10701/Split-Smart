/**
 * Shared domain types for SplitSmart.
 *
 * Money is always stored as integer minor units (e.g. cents) plus an explicit
 * ISO-4217 currency code. Never use floating point for money.
 */

export type CurrencyCode = string; // ISO-4217, e.g. 'USD', 'EUR', 'INR'

export interface Money {
  /** Amount in the smallest currency unit (e.g. cents). Integer only. */
  amountMinor: number;
  currency: CurrencyCode;
}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares' | 'itemized';

export type GroupRole = 'admin' | 'member';

export interface UserSummary {
  id: string;
  name: string;
  defaultCurrency: CurrencyCode;
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

export * from './money';
