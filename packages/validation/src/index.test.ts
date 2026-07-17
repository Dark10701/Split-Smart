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
  createSettlementSchema,
  createCommentSchema,
  createPaymentIntentSchema,
  normalizeUpiInput,
  upiIdInputSchema,
  normalizePhoneInput,
  phoneInputSchema,
  updateNotificationPrefsSchema,
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
    const verified = { sub: 'auth0|1', email: 'a@b.com', name: 'A', email_verified: true };
    expect(authClaimsSchema.safeParse(verified).success).toBe(true);
    expect(authClaimsSchema.safeParse({ ...verified, email: 'not-an-email' }).success).toBe(false);
    expect(authClaimsSchema.safeParse({ ...verified, sub: undefined }).success).toBe(false);
  });

  it('rejects tokens without a verified email', () => {
    const base = { sub: 'auth0|1', email: 'a@b.com', name: 'A' };
    expect(authClaimsSchema.safeParse(base).success).toBe(false); // claim missing
    expect(authClaimsSchema.safeParse({ ...base, email_verified: false }).success).toBe(false);
    expect(authClaimsSchema.safeParse({ ...base, email_verified: true }).success).toBe(true);
  });

  it('updateMe requires at least one field and validates currency', () => {
    expect(updateMeSchema.safeParse({}).success).toBe(false);
    expect(updateMeSchema.safeParse({ name: 'New' }).success).toBe(true);
    expect(updateMeSchema.safeParse({ defaultCurrency: 'eur' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ defaultCurrency: 'EUR' }).success).toBe(true);
  });

  it('normalizes Indian mobile numbers to E.164 and rejects invalid ones', () => {
    expect(normalizePhoneInput('9876543210')).toBe('+919876543210');
    expect(normalizePhoneInput('09876543210')).toBe('+919876543210');
    expect(normalizePhoneInput('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhoneInput('91-9876543210')).toBe('+919876543210');
    expect(normalizePhoneInput('5876543210')).toBeNull(); // starts with 5
    expect(normalizePhoneInput('98765')).toBeNull(); // too short
    expect(normalizePhoneInput('98765432101')).toBeNull(); // 11 digits, no prefix
    expect(phoneInputSchema.safeParse('98765 43210').success).toBe(true);
    expect(phoneInputSchema.parse('9876543210')).toBe('+919876543210');
    expect(phoneInputSchema.safeParse('1234567890').success).toBe(false);
  });

  it('updateMe accepts a phone and null to clear it', () => {
    const ok = updateMeSchema.safeParse({ phone: '9876543210' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.phone).toBe('+919876543210');
    expect(updateMeSchema.safeParse({ phone: null }).success).toBe(true);
    expect(updateMeSchema.safeParse({ phone: 'abc' }).success).toBe(false);
  });

  it('updateMe validates avatarColor as #rrggbb and allows null to reset', () => {
    expect(updateMeSchema.safeParse({ avatarColor: '#4f46e5' }).success).toBe(true);
    expect(updateMeSchema.safeParse({ avatarColor: '#ABCDEF' }).success).toBe(true);
    expect(updateMeSchema.safeParse({ avatarColor: null }).success).toBe(true);
    expect(updateMeSchema.safeParse({ avatarColor: '#fff' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ avatarColor: '4f46e5' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ avatarColor: 'red' }).success).toBe(false);
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
    expect(createExpenseSchema.safeParse({ ...base, amountMinor: 10.5, split }).success).toBe(
      false,
    );
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

  it('accepts an itemized split and rejects empty/invalid items', () => {
    expect(
      splitInputSchema.safeParse({
        type: 'itemized',
        items: [
          { description: 'Starter', amountMinor: 300, participantMemberIds: [uid(1), uid(2)] },
        ],
      }).success,
    ).toBe(true);
    expect(splitInputSchema.safeParse({ type: 'itemized', items: [] }).success).toBe(false);
    expect(
      splitInputSchema.safeParse({
        type: 'itemized',
        items: [{ description: '', amountMinor: 300, participantMemberIds: [uid(1)] }],
      }).success,
    ).toBe(false);
    expect(
      splitInputSchema.safeParse({
        type: 'itemized',
        items: [{ description: 'X', amountMinor: 0, participantMemberIds: [uid(1)] }],
      }).success,
    ).toBe(false);
    expect(
      splitInputSchema.safeParse({
        type: 'itemized',
        items: [{ description: 'X', amountMinor: 100, participantMemberIds: [] }],
      }).success,
    ).toBe(false);
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

describe('settlement & comment validation (M3)', () => {
  const base = {
    fromMemberId: uid(1),
    toMemberId: uid(2),
    amountMinor: 500,
    currency: 'USD',
    idempotencyKey: 'idem-key-123456',
  };

  it('accepts a valid manual settlement and defaults method to cash', () => {
    const r = createSettlementSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.method).toBe('cash');
  });

  it('rejects a self-settlement', () => {
    expect(createSettlementSchema.safeParse({ ...base, toMemberId: uid(1) }).success).toBe(false);
  });

  it('rejects non-positive amounts and short idempotency keys', () => {
    expect(createSettlementSchema.safeParse({ ...base, amountMinor: 0 }).success).toBe(false);
    expect(createSettlementSchema.safeParse({ ...base, idempotencyKey: 'short' }).success).toBe(
      false,
    );
  });

  it('bounds comment length', () => {
    expect(createCommentSchema.safeParse({ body: 'Looks right' }).success).toBe(true);
    expect(createCommentSchema.safeParse({ body: '' }).success).toBe(false);
    expect(createCommentSchema.safeParse({ body: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('validates a payment intent and rejects self-payment', () => {
    const good = {
      fromMemberId: uid(1),
      toMemberId: uid(2),
      amountMinor: 500,
      currency: 'USD',
      idempotencyKey: 'pay-key-12345678',
    };
    expect(createPaymentIntentSchema.safeParse(good).success).toBe(true);
    expect(createPaymentIntentSchema.safeParse({ ...good, toMemberId: uid(1) }).success).toBe(
      false,
    );
    expect(createPaymentIntentSchema.safeParse({ ...good, amountMinor: -1 }).success).toBe(false);
  });

  it('accepts the upi settlement method', () => {
    const r = createSettlementSchema.safeParse({
      fromMemberId: uid(1),
      toMemberId: uid(2),
      amountMinor: 500,
      currency: 'INR',
      method: 'upi',
      idempotencyKey: 'idem-key-123456',
    });
    expect(r.success).toBe(true);
  });
});

describe('UPI validation (M5)', () => {
  it('accepts a bare VPA and lowercases it', () => {
    expect(normalizeUpiInput('Maya@okHDFCbank')).toBe('maya@okhdfcbank');
    expect(normalizeUpiInput('  ravi.k-99@ybl ')).toBe('ravi.k-99@ybl');
  });

  it('extracts the VPA from a upi:// link (pasted QR contents)', () => {
    expect(normalizeUpiInput('upi://pay?pa=maya@okhdfcbank&pn=Maya&cu=INR')).toBe(
      'maya@okhdfcbank',
    );
    expect(normalizeUpiInput('upi://pay?pn=Maya&pa=ravi%40ybl&am=100.00')).toBe('ravi@ybl');
  });

  it('rejects things that are not VPAs or UPI links', () => {
    expect(normalizeUpiInput('not a upi id')).toBeNull();
    expect(normalizeUpiInput('maya@')).toBeNull();
    expect(normalizeUpiInput('@bank')).toBeNull();
    expect(normalizeUpiInput('https://example.com/?x=1')).toBeNull();
    expect(normalizeUpiInput('upi://pay?pn=NoVpaHere')).toBeNull();
  });

  it('returns null (not a throw) for malformed percent-escapes in links', () => {
    expect(normalizeUpiInput('upi://pay?pa=maya%ZZ@ybl')).toBeNull();
    expect(upiIdInputSchema.safeParse('upi://pay?pa=maya%ZZ@ybl').success).toBe(false);
  });

  it('upiIdInputSchema transforms input to the normalized VPA', () => {
    const ok = upiIdInputSchema.safeParse('upi://pay?pa=Maya@okhdfcbank&pn=M');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe('maya@okhdfcbank');
    expect(upiIdInputSchema.safeParse('garbage').success).toBe(false);
  });

  it('updateMe accepts setting and clearing upiId', () => {
    const set = updateMeSchema.safeParse({ upiId: 'maya@okhdfcbank' });
    expect(set.success).toBe(true);
    if (set.success) expect(set.data.upiId).toBe('maya@okhdfcbank');
    expect(updateMeSchema.safeParse({ upiId: null }).success).toBe(true);
    expect(updateMeSchema.safeParse({ upiId: 'nope' }).success).toBe(false);
  });
});

describe('notification prefs validation (M6-14)', () => {
  it('accepts a sparse list of valid toggles', () => {
    expect(
      updateNotificationPrefsSchema.safeParse({
        prefs: [{ channel: 'push', type: 'expense_added', enabled: false }],
      }).success,
    ).toBe(true);
  });

  it('rejects empty, oversized, or invalid enum values', () => {
    expect(updateNotificationPrefsSchema.safeParse({ prefs: [] }).success).toBe(false);
    expect(
      updateNotificationPrefsSchema.safeParse({
        prefs: [{ channel: 'carrier-pigeon', type: 'expense_added', enabled: true }],
      }).success,
    ).toBe(false);
    expect(
      updateNotificationPrefsSchema.safeParse({
        prefs: [{ channel: 'push', type: 'nope', enabled: true }],
      }).success,
    ).toBe(false);
  });
});
