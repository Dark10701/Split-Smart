/**
 * Payment-provider seam (M4). The orchestration in PaymentsService is
 * provider-agnostic; the concrete Stripe adapter is injected via this token.
 * The default in-repo provider is a deterministic test/dev implementation used
 * until STRIPE_SECRET_KEY is provisioned (M4-01) — the same pattern as the
 * INVITE_NOTIFIER seam used for email.
 */

export interface CreateIntentInput {
  amountMinor: number;
  currency: string;
  /** Stable key so provider-side intent creation is idempotent. */
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface CreatedIntent {
  providerRef: string;
  /** Returned to the client SDK to confirm the payment. */
  clientSecret: string;
}

export type ProviderIntentStatus = 'succeeded' | 'failed' | 'pending';

export interface ProviderWebhookEvent {
  providerRef: string;
  status: ProviderIntentStatus;
}

export interface PaymentProvider {
  createIntent(input: CreateIntentInput): Promise<CreatedIntent>;
  /** Verify + parse a raw webhook. Throws if the signature is invalid. */
  parseWebhook(rawBody: string, signature: string | undefined): ProviderWebhookEvent;
  /** Poll the provider for an intent's current status (reconciliation). */
  getIntentStatus(providerRef: string): Promise<ProviderIntentStatus>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
