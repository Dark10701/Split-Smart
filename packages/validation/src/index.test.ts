import { describe, it, expect } from 'vitest';
import { currencyCodeSchema, moneySchema } from './index';

describe('validation', () => {
  it('accepts valid currency codes', () => {
    expect(currencyCodeSchema.safeParse('USD').success).toBe(true);
  });

  it('rejects invalid currency codes', () => {
    expect(currencyCodeSchema.safeParse('usd').success).toBe(false);
    expect(currencyCodeSchema.safeParse('US').success).toBe(false);
  });

  it('rejects non-integer money', () => {
    expect(moneySchema.safeParse({ amountMinor: 10.5, currency: 'USD' }).success).toBe(false);
  });
});
