import { describe, it, expect } from 'vitest';
import { addMoney, isValidMinor } from './money';

describe('money', () => {
  it('adds amounts of the same currency', () => {
    expect(
      addMoney({ amountMinor: 100, currency: 'USD' }, { amountMinor: 250, currency: 'USD' }),
    ).toEqual({ amountMinor: 350, currency: 'USD' });
  });

  it('throws on currency mismatch', () => {
    expect(() =>
      addMoney({ amountMinor: 1, currency: 'USD' }, { amountMinor: 1, currency: 'EUR' }),
    ).toThrow();
  });

  it('validates integer minor units', () => {
    expect(isValidMinor(100)).toBe(true);
    expect(isValidMinor(10.5)).toBe(false);
  });
});
