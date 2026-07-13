import { describe, it, expect } from 'vitest';
import {
  currencyCodeSchema,
  moneySchema,
  authClaimsSchema,
  updateMeSchema,
  createGroupSchema,
  addMemberSchema,
  joinGroupSchema,
  createExpenseSchema,
  updateExpenseSchema,
  splitInputSchema,
  listExpensesQuerySchema,
} from './index';

const uid = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;

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

describe('expense validation (M2)', () => {
  const base = {
    description: 'Dinner',
    amountMinor: 3000,
    currency: 'USD',
    payerMemberId: uid(1),
    occurredAt: new Date().toISOString(),
  };

  it('accepts an equal split', () => {
    const r = createExpenseSchema.safeParse({
      ...base,
      split: { type: 'equal', participantMemberIds: [uid(1), uid(2)] },
    });
    expect(r.success).toBe(true);
  });

  it('rejects non-integer or non-positive amounts', () => {
    const split = { type: 'equal', participantMemberIds: [uid(1)] };
    expect(createExpenseSchema.safeParse({ ...base, amountMinor: 10.5, split }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...base, amountMinor: 0, split }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...base, amountMinor: -5, split }).success).toBe(false);
  });

  it('accepts exact / percentage / shares splits', () => {
    expect(
      splitInputSchema.safeParse({
        type: 'exact',
        shares: [{ memberId: uid(1), amountMinor: 1000 }],
      }).success,
    ).toBe(true);
    expect(
      splitInputSchema.safeParse({
        type: 'percentage',
        shares: [{ memberId: uid(1), percentBps: 10000 }],
      }).success,
    ).toBe(true);
    expect(
      splitInputSchema.safeParse({ type: 'shares', shares: [{ memberId: uid(1), units: 2 }] })
        .success,
    ).toBe(true);
  });

  it('rejects fractional basis points and zero share units', () => {
    expect(
      splitInputSchema.safeParse({
        type: 'percentage',
        shares: [{ memberId: uid(1), percentBps: 33.3 }],
      }).success,
    ).toBe(false);
    expect(
      splitInputSchema.safeParse({ type: 'shares', shares: [{ memberId: uid(1), units: 0 }] })
        .success,
    ).toBe(false);
  });

  it('update requires version and at least one field', () => {
    expect(updateExpenseSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateExpenseSchema.safeParse({ version: 1, description: 'Lunch' }).success).toBe(true);
    expect(updateExpenseSchema.safeParse({ description: 'Lunch' }).success).toBe(false);
  });

  it('update forbids changing amount without a new split', () => {
    expect(updateExpenseSchema.safeParse({ version: 1, amountMinor: 500 }).success).toBe(false);
    expect(
      updateExpenseSchema.safeParse({
        version: 1,
        amountMinor: 500,
        split: { type: 'equal', participantMemberIds: [uid(1)] },
      }).success,
    ).toBe(true);
  });

  it('list query coerces and bounds the limit', () => {
    expect(listExpensesQuerySchema.parse({}).limit).toBe(20);
    expect(listExpensesQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(listExpensesQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
