import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import type { PrismaService } from '../database/prisma.service';
import type { BalancesService } from '../balances/balances.service';

const GID = 'group-1';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

function makeService(prismaOverrides: Record<string, unknown>) {
  const invalidate = jest.fn().mockResolvedValue(undefined);
  const balances = { invalidate } as unknown as BalancesService;
  const emitToGroup = jest.fn();
  const realtime = {
    emitToGroup,
  } as unknown as import('../realtime/realtime.gateway').RealtimeGateway;
  const notify = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    notify,
  } as unknown as import('../notifications/notifications.service').NotificationsService;
  const svc = new ExpensesService(
    prismaOverrides as unknown as PrismaService,
    balances,
    realtime,
    notifications,
  );
  return { svc, invalidate, emitToGroup, notify };
}

/** A groupMember.findMany that reports the given ids as valid active members. */
function membersFindMany(validIds: string[]) {
  return jest
    .fn()
    .mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(where.id.in.filter((id) => validIds.includes(id)).map((id) => ({ id }))),
    );
}

describe('ExpensesService', () => {
  it('create() rejects a member not in the group', async () => {
    const { svc } = makeService({
      groupMember: { findMany: membersFindMany([A]) }, // B is missing
    });
    await expect(
      svc.create(GID, 'user-1', {
        description: 'Dinner',
        amountMinor: 1000,
        currency: 'USD',
        payerMemberId: A,
        occurredAt: new Date().toISOString(),
        split: { type: 'equal', participantMemberIds: [A, B] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create() persists computed splits, logs activity, and invalidates the cache', async () => {
    const expenseCreate = jest.fn().mockResolvedValue({
      id: 'e1',
      description: 'Dinner',
      amountMinor: 1000,
      currency: 'USD',
      splitType: 'equal',
      splits: [],
    });
    const activityCreate = jest.fn().mockResolvedValue({});
    const tx = {
      expense: { create: expenseCreate },
      activityLog: { create: activityCreate },
    };
    const { svc, invalidate } = makeService({
      groupMember: { findMany: membersFindMany([A, B]) },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    });

    await svc.create(GID, 'user-1', {
      description: 'Dinner',
      amountMinor: 1000,
      currency: 'USD',
      payerMemberId: A,
      occurredAt: new Date().toISOString(),
      split: { type: 'equal', participantMemberIds: [A, B] },
    });

    const created = expenseCreate.mock.calls[0][0];
    const shares = created.data.splits.create;
    expect(shares.reduce((s: number, x: { shareMinor: number }) => s + x.shareMinor, 0)).toBe(1000);
    expect(activityCreate).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith(GID);
  });

  it('create() persists line items for an itemized split', async () => {
    const expenseCreate = jest.fn().mockResolvedValue({
      id: 'e2',
      description: 'Groceries',
      amountMinor: 500,
      currency: 'INR',
      splitType: 'itemized',
      splits: [],
      items: [],
    });
    const tx = {
      expense: { create: expenseCreate },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const { svc } = makeService({
      groupMember: { findMany: membersFindMany([A, B]) },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    });

    await svc.create(GID, 'user-1', {
      description: 'Groceries',
      amountMinor: 500,
      currency: 'INR',
      payerMemberId: A,
      occurredAt: new Date().toISOString(),
      split: {
        type: 'itemized',
        items: [
          { description: 'Veggies', amountMinor: 300, participantMemberIds: [A, B] },
          { description: 'Ice cream', amountMinor: 200, participantMemberIds: [B] },
        ],
      },
    });

    const created = expenseCreate.mock.calls[0][0];
    expect(created.data.items.create).toHaveLength(2);
    expect(created.data.items.create[0]).toEqual({
      description: 'Veggies',
      amountMinor: 300,
      participantMemberIds: [A, B],
    });
    // Shares aggregate: A owes 150, B owes 150 + 200.
    const shares = created.data.splits.create;
    expect(shares).toEqual([
      { memberId: A, shareMinor: 150 },
      { memberId: B, shareMinor: 350 },
    ]);
  });

  it('create() rejects an exact split that does not reconcile', async () => {
    const { svc } = makeService({
      groupMember: { findMany: membersFindMany([A, B]) },
    });
    await expect(
      svc.create(GID, 'user-1', {
        description: 'Taxi',
        amountMinor: 1000,
        currency: 'USD',
        payerMemberId: A,
        occurredAt: new Date().toISOString(),
        split: {
          type: 'exact',
          shares: [
            { memberId: A, amountMinor: 400 },
            { memberId: B, amountMinor: 400 },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update() enforces optimistic-concurrency version match', async () => {
    const { svc } = makeService({
      expense: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'e1',
          groupId: GID,
          version: 3,
          payerMemberId: A,
          amountMinor: 1000,
        }),
      },
    });
    await expect(
      svc.update(GID, 'e1', 'user-1', { version: 2, description: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById() throws NotFound for a missing/deleted expense', async () => {
    const { svc } = makeService({ expense: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(svc.getById(GID, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove() soft-deletes, logs, and invalidates', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'e1',
      groupId: GID,
      version: 1,
      description: 'D',
      amountMinor: 100,
      splits: [],
    });
    const expenseUpdate = jest.fn().mockResolvedValue({});
    const activityCreate = jest.fn().mockResolvedValue({});
    const tx = { expense: { update: expenseUpdate }, activityLog: { create: activityCreate } };
    const { svc, invalidate } = makeService({
      expense: { findFirst },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    });
    await svc.remove(GID, 'e1', 'user-1');
    expect(expenseUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(activityCreate.mock.calls[0][0].data.action).toBe('deleted');
    expect(invalidate).toHaveBeenCalledWith(GID);
  });
});
