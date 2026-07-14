import { BadRequestException } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import type { PrismaService } from '../database/prisma.service';
import type { BalancesService } from '../balances/balances.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { NotificationsService } from '../notifications/notifications.service';

const GID = 'group-1';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

function makeService(prisma: Record<string, unknown>) {
  const invalidate = jest.fn().mockResolvedValue(undefined);
  const emitToGroup = jest.fn();
  const notify = jest.fn().mockResolvedValue(undefined);
  const svc = new SettlementService(
    prisma as unknown as PrismaService,
    { invalidate } as unknown as BalancesService,
    { emitToGroup } as unknown as RealtimeGateway,
    { notify } as unknown as NotificationsService,
  );
  return { svc, invalidate, emitToGroup, notify };
}

const validInput = {
  fromMemberId: A,
  toMemberId: B,
  amountMinor: 500,
  currency: 'USD',
  method: 'cash' as const,
  idempotencyKey: 'idem-key-123456',
};

describe('SettlementService.recordManual', () => {
  it('returns the existing payment on a repeated idempotency key (no double-record)', async () => {
    const existing = { id: 'p1', groupId: GID, idempotencyKey: validInput.idempotencyKey };
    const create = jest.fn();
    const { svc, invalidate } = makeService({
      payment: { findUnique: jest.fn().mockResolvedValue(existing) },
    });
    const result = await svc.recordManual(GID, 'user-1', validInput);
    expect(result).toBe(existing);
    expect(create).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key already used in a different group', async () => {
    const { svc } = makeService({
      payment: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', groupId: 'other' }) },
    });
    await expect(svc.recordManual(GID, 'user-1', validInput)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when payer or payee is not an active member', async () => {
    const { svc } = makeService({
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      groupMember: { findMany: jest.fn().mockResolvedValue([{ id: A }]) }, // only one found
    });
    await expect(svc.recordManual(GID, 'user-1', validInput)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records a new settlement, logs activity, invalidates balances, and notifies the payee', async () => {
    const created = {
      id: 'p9',
      groupId: GID,
      fromMemberId: A,
      toMemberId: B,
      amountMinor: 500,
      currency: 'USD',
      method: 'cash',
    };
    const paymentCreate = jest.fn().mockResolvedValue(created);
    const activityCreate = jest.fn().mockResolvedValue({});
    const tx = { payment: { create: paymentCreate }, activityLog: { create: activityCreate } };
    const { svc, invalidate, emitToGroup, notify } = makeService({
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      groupMember: {
        findMany: jest.fn().mockResolvedValue([{ id: A }, { id: B }]),
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-b' }),
      },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    });

    const result = await svc.recordManual(GID, 'user-1', validInput);
    expect(result).toBe(created);
    expect(paymentCreate).toHaveBeenCalled();
    expect(activityCreate.mock.calls[0][0].data.entityType).toBe('payment');
    expect(invalidate).toHaveBeenCalledWith(GID);
    expect(emitToGroup).toHaveBeenCalledWith(GID, { type: 'balances.updated' });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'payment_confirmed', recipientUserIds: ['user-b'] }),
    );
  });

  it('resolves the winner when a concurrent insert hits the unique constraint (P2002)', async () => {
    const winner = { id: 'p-winner', groupId: GID };
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // initial idempotency check
      .mockResolvedValueOnce(winner); // after P2002
    const { svc } = makeService({
      payment: { findUnique },
      groupMember: { findMany: jest.fn().mockResolvedValue([{ id: A }, { id: B }]) },
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    });
    const result = await svc.recordManual(GID, 'user-1', validInput);
    expect(result).toBe(winner);
  });
});
