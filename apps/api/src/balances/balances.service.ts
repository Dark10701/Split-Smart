import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  computeNetBalances,
  settlementPlan,
  type LedgerExpense,
  type LedgerPayment,
  type NetBalances,
  type Transfer,
} from './engine';

export interface GroupBalances {
  /** currency -> memberId -> net minor units (positive = owed, negative = owes). */
  nets: NetBalances;
  /** Minimum set of transfers to settle the group. */
  settlements: Transfer[];
}

const CACHE_TTL_SECONDS = 300;
const cacheKey = (groupId: string): string => `balances:${groupId}`;

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Read balances, serving from Redis when warm and recomputing on a miss. */
  async getForGroup(groupId: string): Promise<GroupBalances> {
    const cached = await this.readCache(groupId);
    if (cached) return cached;

    const balances = await this.compute(groupId);
    await this.writeCache(groupId, balances);
    return balances;
  }

  /** Recompute from the durable ledger. Pure engine does the arithmetic. */
  private async compute(groupId: string): Promise<GroupBalances> {
    const [expenses, payments] = await Promise.all([
      this.prisma.expense.findMany({
        where: { groupId, deletedAt: null },
        include: { splits: true },
      }),
      this.prisma.payment.findMany({ where: { groupId, status: 'completed' } }),
    ]);
    const ledger: LedgerExpense[] = expenses.map((e) => ({
      payerMemberId: e.payerMemberId,
      amountMinor: e.amountMinor,
      currency: e.currency,
      splits: e.splits.map((s) => ({ memberId: s.memberId, shareMinor: s.shareMinor })),
    }));
    const settlements: LedgerPayment[] = payments.map((p) => ({
      fromMemberId: p.fromMemberId,
      toMemberId: p.toMemberId,
      amountMinor: p.amountMinor,
      currency: p.currency,
    }));
    const nets = computeNetBalances(ledger, settlements);
    return { nets, settlements: settlementPlan(nets) };
  }

  /** Drop the cached balances for a group after any mutation. */
  async invalidate(groupId: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(groupId));
    } catch (err) {
      this.logger.warn(`Balance cache invalidation failed for ${groupId}: ${(err as Error).message}`);
    }
  }

  private async readCache(groupId: string): Promise<GroupBalances | null> {
    try {
      const raw = await this.redis.get(cacheKey(groupId));
      return raw ? (JSON.parse(raw) as GroupBalances) : null;
    } catch (err) {
      this.logger.warn(`Balance cache read failed for ${groupId}: ${(err as Error).message}`);
      return null;
    }
  }

  private async writeCache(groupId: string, balances: GroupBalances): Promise<void> {
    try {
      await this.redis.set(cacheKey(groupId), JSON.stringify(balances), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`Balance cache write failed for ${groupId}: ${(err as Error).message}`);
    }
  }
}
