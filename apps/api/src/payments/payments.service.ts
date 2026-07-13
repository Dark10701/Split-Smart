import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type { CreatePaymentIntentInput } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { BalancesService } from '../balances/balances.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_PROVIDER, type PaymentProvider, type ProviderIntentStatus } from './payment-provider';

export interface IntentResult {
  paymentId: string;
  clientSecret: string;
  status: string;
}

/** Pending payments older than this are eligible for reconciliation. */
const STALE_AFTER_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Create (or return) a Stripe payment intent for a settlement (M4-03).
   * Idempotent on `idempotencyKey`: a repeat returns the existing pending
   * payment and its client secret instead of creating a second intent —
   * this is what prevents double-charging under client retries.
   */
  async createIntent(
    groupId: string,
    actorUserId: string,
    input: CreatePaymentIntentInput,
  ): Promise<IntentResult> {
    if (input.fromMemberId === input.toMemberId) {
      throw new BadRequestException('A member cannot pay themselves');
    }
    const members = await this.prisma.groupMember.findMany({
      where: { id: { in: [input.fromMemberId, input.toMemberId] }, groupId, removedAt: null },
      select: { id: true },
    });
    if (members.length !== 2) {
      throw new BadRequestException('Both payer and payee must be active members of this group');
    }

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.groupId !== groupId) {
        throw new BadRequestException('Idempotency key already used in another group');
      }
      const secret = existing.providerRef ? `${existing.providerRef}_secret` : '';
      return { paymentId: existing.id, clientSecret: secret, status: existing.status };
    }

    const intent = await this.provider.createIntent({
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      metadata: { groupId, fromMemberId: input.fromMemberId, toMemberId: input.toMemberId },
    });

    let payment: Payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
          groupId,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          method: 'stripe',
          status: 'pending',
          providerRef: intent.providerRef,
          idempotencyKey: input.idempotencyKey,
          createdById: actorUserId,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) {
          return {
            paymentId: winner.id,
            clientSecret: intent.clientSecret,
            status: winner.status,
          };
        }
      }
      throw err;
    }

    return { paymentId: payment.id, clientSecret: intent.clientSecret, status: payment.status };
  }

  /**
   * Handle a provider webhook (M4-05/06). Transitions the matching payment to
   * completed/failed exactly once and recomputes balances on success. Safe to
   * receive duplicate webhooks — a terminal payment is left untouched.
   */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<{ handled: boolean }> {
    const event = this.provider.parseWebhook(rawBody, signature);
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: event.providerRef },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown intent ${event.providerRef}`);
      return { handled: false };
    }
    if (payment.status !== 'pending') {
      // Already terminal — idempotent no-op.
      return { handled: true };
    }
    if (event.status === 'pending') return { handled: true };

    return this.transition(payment.id, event.status === 'succeeded' ? 'completed' : 'failed');
  }

  /**
   * Reconciliation job (M4-11): re-check stale pending payments against the
   * provider and settle their status, catching any missed webhooks.
   */
  async reconcileStale(now: number = Date.now()): Promise<{ checked: number; transitioned: number }> {
    const cutoff = new Date(now - STALE_AFTER_MS);
    const stale = await this.prisma.payment.findMany({
      where: { status: 'pending', method: 'stripe', createdAt: { lt: cutoff } },
    });
    let transitioned = 0;
    for (const payment of stale) {
      if (!payment.providerRef) continue;
      const status: ProviderIntentStatus = await this.provider.getIntentStatus(payment.providerRef);
      if (status === 'pending') continue;
      await this.transition(payment.id, status === 'succeeded' ? 'completed' : 'failed');
      transitioned += 1;
    }
    return { checked: stale.length, transitioned };
  }

  async getById(groupId: string, paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, groupId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /** Move a pending payment to a terminal status, logging + side effects once. */
  private async transition(
    paymentId: string,
    status: 'completed' | 'failed',
  ): Promise<{ handled: boolean }> {
    const payment = await this.prisma.$transaction(async (tx) => {
      // Guard against a concurrent transition: only update while still pending.
      const result = await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: { status },
      });
      if (result.count === 0) return null;
      const updated = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await tx.activityLog.create({
        data: {
          groupId: updated.groupId,
          actorId: updated.createdById,
          entityType: 'payment',
          entityId: updated.id,
          action: status === 'completed' ? 'created' : 'updated',
          payload: {
            status,
            amountMinor: updated.amountMinor,
            currency: updated.currency,
            method: updated.method,
          },
        },
      });
      return updated;
    });

    if (!payment) return { handled: true }; // lost the race; the winner did the work

    if (status === 'completed') {
      await this.balances.invalidate(payment.groupId);
      this.realtime.emitToGroup(payment.groupId, { type: 'balances.updated' });
      await this.notifyPayee(payment);
    }
    return { handled: true };
  }

  private async notifyPayee(payment: Payment): Promise<void> {
    const payee = await this.prisma.groupMember.findUnique({
      where: { id: payment.toMemberId },
      select: { userId: true },
    });
    if (!payee?.userId) return;
    await this.notifications.notify({
      groupId: payment.groupId,
      type: 'payment_confirmed',
      actorUserId: payment.createdById,
      recipientUserIds: [payee.userId],
      title: 'Payment received',
      body: `An in-app payment of ${payment.amountMinor} ${payment.currency} completed.`,
      data: { paymentId: payment.id },
    });
  }
}
