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
