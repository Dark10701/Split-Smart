import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StubPaymentProvider } from './stub-payment-provider';
import type { PrismaService } from '../database/prisma.service';
import type { BalancesService } from '../balances/balances.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { NotificationsService } from '../notifications/notifications.service';

const GID = 'group-1';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

function makeService(prisma: Record<string, unknown>, provider = new StubPaymentProvider()) {
  const invalidate = jest.fn().mockResolvedValue(undefined);
  const emitToGroup = jest.fn();
  const notify = jest.fn().mockResolvedValue(undefined);
  const svc = new PaymentsService(
    prisma as unknown as PrismaService,
    { invalidate } as unknown as BalancesService,
    { emitToGroup } as unknown as RealtimeGateway,
    { notify } as unknown as NotificationsService,
    provider,
  );
  return { svc, invalidate, emitToGroup, notify };
}

const input = {
  fromMemberId: A,
  toMemberId: B,
  amountMinor: 500,
  currency: 'USD',
  idempotencyKey: 'pay-key-12345678',
};

describe('PaymentsService.createIntent', () => {
  it('creates a pending payment and returns a client secret', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p1', status: 'pending', providerRef: 'pi_stub_x' });
    const { svc } = makeService({
      groupMember: { findMany: jest.fn().mockResolvedValue([{ id: A }, { id: B }]) },
      payment: { findUnique: jest.fn().mockResolvedValue(null), create },
    });
    const result = await svc.createIntent(GID, 'user-1', input);
    expect(result.status).toBe('pending');
    expect(result.clientSecret).toContain('_secret');
    expect(create).toHaveBeenCalled();
  });

  it('is idempotent: a repeated key returns the existing payment without a new intent', async () => {
    const create = jest.fn();
    const provider = new StubPaymentProvider();
    const createIntentSpy = jest.spyOn(provider, 'createIntent');
    const { svc } = makeService(
      {
        groupMember: { findMany: jest.fn().mockResolvedValue([{ id: A }, { id: B }]) },
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'p1',
            groupId: GID,
            status: 'pending',
            providerRef: 'pi_stub_existing',
          }),
        },
      },
      provider,
    );
    const result = await svc.createIntent(GID, 'user-1', input);
    expect(result.paymentId).toBe('p1');
    expect(create).not.toHaveBeenCalled();
    expect(createIntentSpy).not.toHaveBeenCalled();
  });

  it('rejects a self-payment', async () => {
    const { svc } = makeService({});
    await expect(
      svc.createIntent(GID, 'user-1', { ...input, toMemberId: A }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when a member is not in the group', async () => {
    const { svc } = makeService({
      groupMember: { findMany: jest.fn().mockResolvedValue([{ id: A }]) },
    });
    await expect(svc.createIntent(GID, 'user-1', input)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaymentsService.handleWebhook', () => {
  function completingPrisma() {
    const findFirst = jest.fn().mockResolvedValue({ id: 'p1', groupId: GID, status: 'pending', providerRef: 'pi_stub_k' });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'p1', groupId: GID, createdById: 'user-1', amountMinor: 500, currency: 'USD', method: 'stripe', toMemberId: B });
    const activityCreate = jest.fn().mockResolvedValue({});
    const tx = {
      payment: { updateMany, findUniqueOrThrow },
      activityLog: { create: activityCreate },
    };
    return {
      payment: { findFirst },
      groupMember: { findUnique: jest.fn().mockResolvedValue({ userId: 'user-b' }) },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
      _updateMany: updateMany,
      _activityCreate: activityCreate,
    };
  }

  it('completes a pending payment on a succeeded webhook and recomputes balances', async () => {
    const prisma = completingPrisma();
    const { svc, invalidate, emitToGroup, notify } = makeService(prisma);
    const result = await svc.handleWebhook('pi_stub_k:succeeded', 'sig:pi_stub_k');
    expect(result.handled).toBe(true);
    expect(invalidate).toHaveBeenCalledWith(GID);
    expect(emitToGroup).toHaveBeenCalledWith(GID, { type: 'balances.updated' });
    expect(notify).toHaveBeenCalled();
  });

  it('rejects a webhook with a bad signature', async () => {
    const { svc } = makeService({ payment: { findFirst: jest.fn() } });
    await expect(svc.handleWebhook('pi_stub_k:succeeded', 'wrong')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('is a no-op for an already-terminal payment (duplicate webhook)', async () => {
    const { svc, invalidate } = makeService({
      payment: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', groupId: GID, status: 'completed', providerRef: 'pi_stub_k' }) },
    });
    const result = await svc.handleWebhook('pi_stub_k:succeeded', 'sig:pi_stub_k');
    expect(result.handled).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('ignores a webhook for an unknown intent', async () => {
    const { svc } = makeService({ payment: { findFirst: jest.fn().mockResolvedValue(null) } });
    const result = await svc.handleWebhook('pi_stub_unknown:succeeded', 'sig:pi_stub_unknown');
    expect(result.handled).toBe(false);
  });

  it('does not recompute balances on a failed webhook', async () => {
    const prisma = completingPrisma();
    const { svc, invalidate } = makeService(prisma);
    await svc.handleWebhook('pi_stub_k:failed', 'sig:pi_stub_k');
    expect(invalidate).not.toHaveBeenCalled();
    expect(prisma._updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed' } }),
    );
  });
});

describe('PaymentsService.reconcileStale', () => {
  it('transitions stale pending intents based on the provider status', async () => {
    const provider = new StubPaymentProvider();
    jest.spyOn(provider, 'getIntentStatus').mockResolvedValue('succeeded');
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      payment: { updateMany, findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', groupId: GID, createdById: 'u1', amountMinor: 100, currency: 'USD', method: 'stripe', toMemberId: B }) },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const { svc } = makeService(
      {
        payment: {
          findMany: jest.fn().mockResolvedValue([{ id: 'p1', providerRef: 'pi_stub_stale', groupId: GID }]),
        },
        groupMember: { findUnique: jest.fn().mockResolvedValue({ userId: null }) },
        $transaction: (fn: (t: unknown) => unknown) => fn(tx),
      },
      provider,
    );
    const result = await svc.reconcileStale();
    expect(result).toEqual({ checked: 1, transitioned: 1 });
  });

  it('leaves still-pending intents alone', async () => {
    const provider = new StubPaymentProvider();
    jest.spyOn(provider, 'getIntentStatus').mockResolvedValue('pending');
    const { svc } = makeService(
      {
        payment: {
          findMany: jest.fn().mockResolvedValue([{ id: 'p1', providerRef: 'pi_stub_x', groupId: GID }]),
        },
      },
      provider,
    );
    const result = await svc.reconcileStale();
    expect(result).toEqual({ checked: 1, transitioned: 0 });
  });
});
