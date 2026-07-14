import { describe, it, expect } from 'vitest';
import { buildUpiPayUri, paiseToRupeeString, formatPaise } from './upi';

describe('paiseToRupeeString', () => {
  it('converts paise to a decimal rupee string', () => {
    expect(paiseToRupeeString(1)).toBe('0.01');
    expect(paiseToRupeeString(100)).toBe('1.00');
    expect(paiseToRupeeString(12345)).toBe('123.45');
    expect(paiseToRupeeString(50000)).toBe('500.00');
  });

  it('rejects non-positive and fractional amounts', () => {
    expect(() => paiseToRupeeString(0)).toThrow();
    expect(() => paiseToRupeeString(-100)).toThrow();
    expect(() => paiseToRupeeString(10.5)).toThrow();
  });
});

describe('buildUpiPayUri', () => {
  it('builds a upi://pay link with payee, amount, and INR', () => {
    const uri = buildUpiPayUri({
      payeeVpa: 'maya@okhdfcbank',
      payeeName: 'Maya',
      amountPaise: 45050,
      note: 'SplitSmart · Goa trip',
    });
    expect(uri.startsWith('upi://pay?')).toBe(true);
    const q = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect(q.get('pa')).toBe('maya@okhdfcbank');
    expect(q.get('pn')).toBe('Maya');
    expect(q.get('am')).toBe('450.50');
    expect(q.get('cu')).toBe('INR');
    expect(q.get('tn')).toBe('SplitSmart · Goa trip');
  });

  it('omits the amount for an open link and truncates long notes', () => {
    const uri = buildUpiPayUri({
      payeeVpa: 'a@bank',
      payeeName: 'A',
      note: 'x'.repeat(200),
    });
    const q = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect(q.get('am')).toBeNull();
    expect(q.get('tn')).toHaveLength(80);
  });

  it('URL-encodes special characters in names', () => {
    const uri = buildUpiPayUri({ payeeVpa: 'a@bank', payeeName: 'Ravi & Co', amountPaise: 100 });
    expect(uri).toContain('pn=Ravi+%26+Co');
  });
});

describe('formatPaise', () => {
  it('formats with Indian digit grouping', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
    expect(formatPaise(100)).toBe('₹1.00');
    expect(formatPaise(1000000)).toBe('₹10,000.00');
    expect(formatPaise(100000000)).toBe('₹10,00,000.00');
  });

  it('handles negatives and zero', () => {
    expect(formatPaise(-4550)).toBe('-₹45.50');
    expect(formatPaise(0)).toBe('₹0.00');
  });
});
