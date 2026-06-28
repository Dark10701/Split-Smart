import { describe, it, expect } from 'vitest';
import {
  currencyCodeSchema,
  moneySchema,
  authClaimsSchema,
  updateMeSchema,
  createGroupSchema,
  addMemberSchema,
  joinGroupSchema,
} from './index';

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

  it('parses valid auth claims and rejects bad email', () => {
    expect(authClaimsSchema.safeParse({ sub: 'auth0|1', email: 'a@b.com', name: 'A' }).success).toBe(true);
    expect(authClaimsSchema.safeParse({ sub: 'auth0|1', email: 'not-an-email' }).success).toBe(false);
    expect(authClaimsSchema.safeParse({ email: 'a@b.com' }).success).toBe(false); // missing sub
  });

  it('updateMe requires at least one field and validates currency', () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false);
    expect(updateMeSchema.safeParse({ name: 'New' }).success).toBe(true);
    expect(updateMeSchema.safeParse({ defaultCurrency: 'eur' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ defaultCurrency: 'EUR' }).success).toBe(true);
  });

  it('createGroup requires a name', () => {
    expect(createGroupSchema.safeParse({ name: 'Trip' }).success).toBe(true);
    expect(createGroupSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('addMember requires exactly one of email or guestName', () => {
    expect(addMemberSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(addMemberSchema.safeParse({ guestName: 'Bob' }).success).toBe(true);
    expect(addMemberSchema.safeParse({}).success).toBe(false);
    expect(addMemberSchema.safeParse({ email: 'a@b.com', guestName: 'Bob' }).success).toBe(false);
  });

  it('joinGroup needs a token', () => {
    expect(joinGroupSchema.safeParse({ token: 'x' }).success).toBe(true);
    expect(joinGroupSchema.safeParse({ token: '' }).success).toBe(false);
  });
});
