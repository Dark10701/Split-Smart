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

/** PATCH /me body. All fields optional; at least one must be present. */
export const updateMeSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    defaultCurrency: currencyCodeSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.defaultCurrency !== undefined, {
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

/** Sample contract: create-expense payload. Expanded in later tickets. */
export const createExpenseSchema = z.object({
  description: z.string().min(1).max(140),
  amountMinor: z.number().int().positive(),
  currency: currencyCodeSchema,
  payerId: z.string().uuid(),
  participantIds: z.array(z.string().uuid()).min(1),
  splitType: splitTypeSchema,
  occurredAt: z.string().datetime(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
