import { z } from 'zod';

/** ISO-4217 currency code (3 uppercase letters). */
export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO-4217 currency code');

/** Money as integer minor units + currency. Never floats. */
export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
});

export const splitTypeSchema = z.enum(['equal', 'exact', 'percentage', 'shares', 'itemized']);

/** Verified OIDC token claims we rely on to resolve an internal user. */
export const authClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).optional(),
});
export type AuthClaims = z.infer<typeof authClaimsSchema>;

// ---------------------------------------------------------------------------
// UPI (M5-21). A VPA (virtual payment address) looks like `maya@okhdfcbank`.
// Users may paste a `upi://pay?...` link or their UPI QR's contents instead of
// typing the VPA; `normalizeUpiInput` extracts and validates the VPA either way.
// ---------------------------------------------------------------------------

const VPA_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

/** A bare UPI VPA, e.g. `maya@okhdfcbank`. */
export const upiVpaSchema = z.string().regex(VPA_REGEX, 'Must be a valid UPI ID like name@bank');

/**
 * Extract the VPA from user input: a bare VPA, or a `upi://pay` /
 * `https://upi/...`-style link (as found in UPI QR codes), whose `pa`
 * parameter is the payee VPA. Returns null when no valid VPA is found.
 */
export function normalizeUpiInput(raw: string): string | null {
  const input = raw.trim();
  if (VPA_REGEX.test(input)) return input.toLowerCase();
  // upi://pay?pa=<vpa>&pn=... — tolerate any scheme/host, just read `pa`.
  const paMatch = /[?&]pa=([^&\s]+)/i.exec(input);
  if (paMatch?.[1]) {
    try {
      const candidate = decodeURIComponent(paMatch[1]).trim();
      if (VPA_REGEX.test(candidate)) return candidate.toLowerCase();
    } catch {
      // Malformed percent-escape (e.g. `pa=maya%ZZ@ybl`) — not a valid link.
      return null;
    }
  }
  return null;
}

/**
 * PATCH /me `upiId` field: accepts a VPA or a pasted UPI link/QR contents and
 * normalizes to the bare lowercase VPA. `null` clears the stored UPI ID.
 */
export const upiIdInputSchema = z
  .string()
  .min(3)
  .max(500)
  .transform((raw, ctx) => {
    const vpa = normalizeUpiInput(raw);
    if (!vpa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Not a valid UPI ID or UPI payment link',
      });
      return z.NEVER;
    }
    return vpa;
  });

export const notificationChannelSchema = z.enum(['push', 'email', 'sms', 'in_app']);
export const notificationTypeSchema = z.enum([
  'expense_added',
  'settle_up',
  'payment_confirmed',
  'reminder',
]);

/**
 * PATCH /me/notification-prefs body (M6-14). A sparse list of (channel, type)
 * toggles to apply; anything omitted is left unchanged.
 */
export const updateNotificationPrefsSchema = z.object({
  prefs: z
    .array(
      z.object({
        channel: notificationChannelSchema,
        type: notificationTypeSchema,
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(16),
});
export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;

/** PATCH /me body. All fields optional; at least one must be present. */
export const updateMeSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    defaultCurrency: currencyCodeSchema.optional(),
    upiId: upiIdInputSchema.nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.defaultCurrency !== undefined || v.upiId !== undefined, {
    message: 'Provide at least one field to update',
  });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** POST /groups body. */
export const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  defaultCurrency: currencyCodeSchema.optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const groupRoleSchema = z.enum(['admin', 'member']);
export type GroupRole = z.infer<typeof groupRoleSchema>;

/** Add a member: exactly one of an account email or a guest display name. */
export const addMemberSchema = z
  .object({
    email: z.string().email().optional(),
    guestName: z.string().min(1).max(80).optional(),
    role: groupRoleSchema.default('member'),
  })
  .refine((v) => Boolean(v.email) !== Boolean(v.guestName), {
    message: 'Provide exactly one of email or guestName',
  });
export type AddMemberInput = z.infer<typeof addMemberSchema>;

/** Accept an invite. */
export const joinGroupSchema = z.object({ token: z.string().min(1) });
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;

/** Optional targeted email for an invite. */
export const inviteSchema = z.object({ email: z.string().email().optional() });
export type InviteInput = z.infer<typeof inviteSchema>;

// ---------------------------------------------------------------------------
// Expenses (M2). All money is integer minor units; percentages are integer
// basis points (1% = 100 bps) so no floating point ever touches money.
// ---------------------------------------------------------------------------

const memberId = z.string().uuid();

/** How to divide an expense among participants. Discriminated on `type`. */
export const splitInputSchema = z.discriminatedUnion('type', [
  /** Split equally among the listed members (remainder cents distributed deterministically). */
  z.object({
    type: z.literal('equal'),
    participantMemberIds: z.array(memberId).min(1),
  }),
  /** Each member owes an exact minor-unit amount; amounts must sum to the total. */
  z.object({
    type: z.literal('exact'),
    shares: z.array(z.object({ memberId, amountMinor: z.number().int().nonnegative() })).min(1),
  }),
  /** Each member owes a percentage in basis points; must sum to 10000 (=100%). */
  z.object({
    type: z.literal('percentage'),
    shares: z
      .array(z.object({ memberId, percentBps: z.number().int().positive().max(10000) }))
      .min(1),
  }),
  /** Each member owes proportionally to their share units (e.g. 2 adults, 1 kid). */
  z.object({
    type: z.literal('shares'),
    shares: z.array(z.object({ memberId, units: z.number().int().positive() })).min(1),
  }),
  /**
   * Line items (e.g. from a receipt): each item is split equally among its
   * participants; item amounts must sum to the expense total.
   */
  z.object({
    type: z.literal('itemized'),
    items: z
      .array(
        z.object({
          description: z.string().min(1).max(140),
          amountMinor: z.number().int().positive(),
          participantMemberIds: z.array(memberId).min(1),
        }),
      )
      .min(1),
  }),
]);
export type SplitInput = z.infer<typeof splitInputSchema>;

/** POST /groups/:id/expenses body. */
export const createExpenseSchema = z.object({
  description: z.string().min(1).max(140),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  payerMemberId: memberId,
  category: z.string().min(1).max(40).optional(),
  occurredAt: z.string().datetime(),
  split: splitInputSchema,
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * PATCH /expenses/:id body. `version` is the version the client last saw
 * (optimistic concurrency). Changing the amount requires re-specifying the
 * split so shares always reconcile to the new total.
 */
export const updateExpenseSchema = z
  .object({
    version: z.number().int().positive(),
    description: z.string().min(1).max(140).optional(),
    amountMinor: z.number().int().positive().optional(),
    currency: currencyCodeSchema.optional(),
    payerMemberId: memberId.optional(),
    category: z.string().min(1).max(40).nullable().optional(),
    occurredAt: z.string().datetime().optional(),
    split: splitInputSchema.optional(),
  })
  .refine(
    (v) =>
      v.description !== undefined ||
      v.amountMinor !== undefined ||
      v.currency !== undefined ||
      v.payerMemberId !== undefined ||
      v.category !== undefined ||
      v.occurredAt !== undefined ||
      v.split !== undefined,
    { message: 'Provide at least one field to update' },
  )
  .refine((v) => v.amountMinor === undefined || v.split !== undefined, {
    message: 'Changing the amount requires re-specifying the split',
  });
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/** GET /groups/:id/expenses cursor pagination query. */
export const listExpensesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

// ---------------------------------------------------------------------------
// Settlements & comments (M3)
// ---------------------------------------------------------------------------

export const paymentMethodSchema = z.enum(['cash', 'offline', 'upi']);
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

/**
 * POST /groups/:id/settlements — record a manual (cash/offline) settlement.
 * Partial settlements are just an amount smaller than the outstanding balance.
 * `idempotencyKey` makes the write safe to retry (money is sacred).
 */
export const createSettlementSchema = z
  .object({
    fromMemberId: memberId,
    toMemberId: memberId,
    amountMinor: z.number().int().positive(),
    currency: currencyCodeSchema,
    method: paymentMethodSchema.default('cash'),
    idempotencyKey: z.string().min(8).max(200),
  })
  .refine((v) => v.fromMemberId !== v.toMemberId, {
    message: 'A member cannot settle with themselves',
  });
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;

/** POST /expenses/:id/comments body. */
export const createCommentSchema = z.object({
  body: z.string().min(1).max(1000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** GET /groups/:id/activity cursor pagination query. */
export const listActivityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

// ---------------------------------------------------------------------------
// In-app payments (M4)
// ---------------------------------------------------------------------------

/** POST /groups/:id/payments/intent — create a Stripe payment intent. */
export const createPaymentIntentSchema = z
  .object({
    fromMemberId: memberId,
    toMemberId: memberId,
    amountMinor: z.number().int().positive(),
    currency: currencyCodeSchema,
    idempotencyKey: z.string().min(8).max(200),
  })
  .refine((v) => v.fromMemberId !== v.toMemberId, {
    message: 'A member cannot pay themselves',
  });
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
