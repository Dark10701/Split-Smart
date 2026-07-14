import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import type { CreateSettlementInput } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { BalancesService } from '../balances/balances.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Record a manual (cash/offline) settlement. Idempotent on `idempotencyKey`:
   * a retry with the same key returns the original payment instead of
   * double-recording — money is sacred. Partial settlements are simply an
   * amount smaller than the outstanding balance; the balance engine recomputes.
   */
  async recordManual(
    groupId: string,
    actorUserId: string,
    input: CreateSettlementInput,
  ): Promise<Payment> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.groupId !== groupId) {
        throw new BadRequestException('Idempotency key already used in another group');
      }
      return existing;
    }

    const members = await this.prisma.groupMember.findMany({
      where: { id: { in: [input.fromMemberId, input.toMemberId] }, groupId, removedAt: null },
      select: { id: true },
    });
    if (members.length !== 2) {
      throw new BadRequestException('Both payer and payee must be active members of this group');
    }

    let payment: Payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            groupId,
            fromMemberId: input.fromMemberId,
            toMemberId: input.toMemberId,
            amountMinor: input.amountMinor,
            currency: input.currency,
            method: input.method,
            status: 'completed',
            idempotencyKey: input.idempotencyKey,
            createdById: actorUserId,
          },
        });
        await tx.activityLog.create({
          data: {
            groupId,
            actorId: actorUserId,
            entityType: 'payment',
            entityId: created.id,
            action: 'created',
            payload: {
              fromMemberId: created.fromMemberId,
              toMemberId: created.toMemberId,
              amountMinor: created.amountMinor,
              currency: created.currency,
              method: created.method,
            } satisfies Prisma.InputJsonObject,
          },
        });
        return created;
      });
    } catch (err) {
      // A concurrent request with the same key lost the unique-constraint race;
      // return the winner rather than failing the retry.
      if ((err as { code?: string }).code === 'P2002') {
        const winner = await this.prisma.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) return winner;
      }
      throw err;
    }

    await this.balances.invalidate(groupId);
    this.realtime.emitToGroup(groupId, { type: 'balances.updated' });
    await this.notifyPayee(groupId, actorUserId, payment);
    return payment;
  }

  async listForGroup(groupId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Notify the receiving member's user that a settlement was recorded. */
  private async notifyPayee(groupId: string, actorUserId: string, payment: Payment): Promise<void> {
    const payee = await this.prisma.groupMember.findUnique({
      where: { id: payment.toMemberId },
      select: { userId: true },
    });
    if (!payee?.userId) return; // guest members have no account to notify
    await this.notifications.notify({
      groupId,
      type: 'payment_confirmed',
      actorUserId,
      recipientUserIds: [payee.userId],
      title: 'Payment recorded',
      body: `A settlement of ${payment.amountMinor} ${payment.currency} was recorded.`,
      data: { paymentId: payment.id },
    });
  }
}
