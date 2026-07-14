import { BalancesService } from './balances.service';
import type { PrismaService } from '../database/prisma.service';

const A = 'member-a';
const B = 'member-b';

/**
 * Graceful degradation (M6-20): when the Redis cache is unavailable the balances
 * endpoint must still serve correct numbers computed straight from Postgres —
 * an infra blip on the cache never blocks the money-critical read path.
 */
describe('BalancesService graceful degradation', () => {
  const prisma = {
    expense: {
      findMany: jest.fn().mockResolvedValue([
        {
          payerMemberId: A,
          amountMinor: 1000,
          currency: 'INR',
          splits: [
            { memberId: A, shareMinor: 500 },
            { memberId: B, shareMinor: 500 },
          ],
        },
      ]),
    },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  beforeEach(() => {
    // Clear call history but keep the mock implementations (resolved values).
    (prisma.expense.findMany as jest.Mock).mockClear();
    (prisma.payment.findMany as jest.Mock).mockClear();
  });

  it('computes from the DB when Redis reads AND writes both throw', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('redis down')),
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      del: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const svc = new BalancesService(prisma, redis as never);

    const result = await svc.getForGroup('g1');
    expect(result.nets.INR).toEqual({ [A]: 500, [B]: -500 });
    expect(result.settlements).toEqual([
      { fromMemberId: B, toMemberId: A, amountMinor: 500, currency: 'INR' },
    ]);
  });

  it('invalidate() never throws even when Redis DEL fails', async () => {
    const redis = { del: jest.fn().mockRejectedValue(new Error('redis down')) };
    const svc = new BalancesService(prisma, redis as never);
    await expect(svc.invalidate('g1')).resolves.toBeUndefined();
  });

  it('serves the cached value when Redis is healthy (fast path)', async () => {
    const cached = { nets: { INR: { [A]: 1, [B]: -1 } }, settlements: [] };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
      set: jest.fn(),
    };
    const svc = new BalancesService(prisma, redis as never);
    const result = await svc.getForGroup('g1');
    expect(result).toEqual(cached);
    expect((prisma.expense.findMany as jest.Mock).mock.calls.length).toBe(0);
  });
});
