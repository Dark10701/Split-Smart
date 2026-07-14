import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type CreatedIntent,
  type CreateIntentInput,
  type PaymentProvider,
  type ProviderIntentStatus,
  type ProviderWebhookEvent,
} from './payment-provider';

/**
 * Default provider used until a real Stripe adapter is provisioned (M4-01).
 *
 * It is a genuine, deterministic in-memory provider (not a no-op): intent
 * creation is idempotent per key, webhooks are parsed from a signed test
 * envelope, and statuses are tracked so reconciliation works end to end in
 * dev/test. Swapping in the Stripe SDK adapter changes only this class.
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  private readonly byKey = new Map<string, CreatedIntent>();
  private readonly status = new Map<string, ProviderIntentStatus>();

  async createIntent(input: CreateIntentInput): Promise<CreatedIntent> {
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) return existing;
    const providerRef = `pi_stub_${input.idempotencyKey}`;
    const intent: CreatedIntent = { providerRef, clientSecret: `${providerRef}_secret` };
    this.byKey.set(input.idempotencyKey, intent);
    this.status.set(providerRef, 'pending');
    return intent;
  }

  /**
   * Test envelope: `<providerRef>:<status>` with signature `sig:<providerRef>`.
   * A real adapter verifies the Stripe-Signature header via the webhook secret.
   */
  parseWebhook(rawBody: string, signature: string | undefined): ProviderWebhookEvent {
    const [providerRef, status] = rawBody.split(':');
    if (!providerRef || !status) throw new BadRequestException('Malformed webhook payload');
    if (signature !== `sig:${providerRef}`)
      throw new BadRequestException('Invalid webhook signature');
    if (status !== 'succeeded' && status !== 'failed' && status !== 'pending') {
      throw new BadRequestException('Unknown webhook status');
    }
    this.status.set(providerRef, status);
    return { providerRef, status };
  }

  async getIntentStatus(providerRef: string): Promise<ProviderIntentStatus> {
    return this.status.get(providerRef) ?? 'pending';
  }
}
