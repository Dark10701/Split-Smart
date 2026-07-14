import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Expense } from '@prisma/client';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  SplitInput,
} from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { computeShares, SplitError } from './split-strategies';
import { BalancesService } from '../balances/balances.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

/** An expense with its splits and payer, as returned to clients. */
export type ExpenseWithSplits = Prisma.ExpenseGetPayload<{
  include: { splits: true; items: true };
}>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Notify every participant's user (except the actor) that an expense was added. */
  private async notifyExpenseAdded(
    groupId: string,
    actorUserId: string,
    expense: ExpenseWithSplits,
  ): Promise<void> {
    const memberIds = [
      ...new Set([expense.payerMemberId, ...expense.splits.map((s) => s.memberId)]),
    ];
    const members = await this.prisma.groupMember.findMany({
      where: { id: { in: memberIds }, userId: { not: null } },
      select: { userId: true },
    });
    const recipientUserIds = members.map((m) => m.userId).filter((id): id is string => id !== null);
    await this.notifications.notify({
      groupId,
      type: 'expense_added',
      actorUserId,
      recipientUserIds,
      title: 'New expense',
      body: `${expense.description} — ${expense.amountMinor} ${expense.currency}`,
      data: { expenseId: expense.id },
    });
  }

  /** Invalidate the balance cache and notify subscribers of the group. */
  private async publishMutation(
    groupId: string,
    event: Parameters<RealtimeGateway['emitToGroup']>[1],
  ): Promise<void> {
    await this.balances.invalidate(groupId);
    this.realtime.emitToGroup(groupId, event);
    this.realtime.emitToGroup(groupId, { type: 'balances.updated' });
  }

  /**
   * Validate that every member referenced by an expense belongs to the group
   * (active membership). Guests count. Throws 400 on any stray member.
   */
  private async assertMembersInGroup(groupId: string, memberIds: string[]): Promise<void> {
    const unique = [...new Set(memberIds)];
    const found = await this.prisma.groupMember.findMany({
      where: { id: { in: unique }, groupId, removedAt: null },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      const ok = new Set(found.map((m) => m.id));
      const bad = unique.filter((id) => !ok.has(id));
      throw new BadRequestException(`Members not in this group: ${bad.join(', ')}`);
    }
  }

  private splitMemberIds(split: SplitInput): string[] {
    switch (split.type) {
      case 'equal':
        return split.participantMemberIds;
      case 'itemized':
        return split.items.flatMap((i) => i.participantMemberIds);
      default:
        return split.shares.map((s) => s.memberId);
    }
  }

  /** Line items to persist alongside the splits (itemized expenses only). */
  private itemsToCreate(
    split: SplitInput,
  ): Array<{ description: string; amountMinor: number; participantMemberIds: string[] }> {
    if (split.type !== 'itemized') return [];
    return split.items.map((i) => ({
      description: i.description,
      amountMinor: i.amountMinor,
      participantMemberIds: i.participantMemberIds,
    }));
  }

  private computeOrThrow(
    amountMinor: number,
    split: SplitInput,
  ): Array<{ memberId: string; shareMinor: number }> {
    try {
      return computeShares(amountMinor, split);
    } catch (err) {
      if (err instanceof SplitError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  async create(
    groupId: string,
    actorUserId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseWithSplits> {
    const memberIds = [...this.splitMemberIds(input.split), input.payerMemberId];
    await this.assertMembersInGroup(groupId, memberIds);
    const shares = this.computeOrThrow(input.amountMinor, input.split);

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          groupId,
          payerMemberId: input.payerMemberId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          category: input.category ?? null,
          description: input.description,
          occurredAt: new Date(input.occurredAt),
          splitType: input.split.type,
          createdById: actorUserId,
          splits: {
            create: shares.map((s) => ({ memberId: s.memberId, shareMinor: s.shareMinor })),
          },
          items: { create: this.itemsToCreate(input.split) },
        },
        include: { splits: true, items: true },
      });
      await this.writeActivity(tx, groupId, actorUserId, created.id, 'created', {
        description: created.description,
        amountMinor: created.amountMinor,
        currency: created.currency,
        splitType: created.splitType,
      });
      return created;
    });

    await this.publishMutation(groupId, { type: 'expense.created', expenseId: expense.id });
    await this.notifyExpenseAdded(groupId, actorUserId, expense);
    return expense;
  }

  async list(
    groupId: string,
    query: ListExpensesQuery,
  ): Promise<{ items: ExpenseWithSplits[]; nextCursor: string | null }> {
    const items = await this.prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      include: { splits: true, items: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    const last = page[page.length - 1];
    return { items: page, nextCursor: hasMore && last ? last.id : null };
  }

  async getById(groupId: string, expenseId: string): Promise<ExpenseWithSplits> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
      include: { splits: true, items: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  /** Versioned edit: bumps `version`, replaces splits atomically, logs the change. */
  async update(
    groupId: string,
    expenseId: string,
    actorUserId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseWithSplits> {
    const current = await this.getById(groupId, expenseId);
    if (current.version !== input.version) {
      throw new ForbiddenException(
        `Expense was modified by someone else (expected version ${current.version})`,
      );
    }

    const nextAmount = input.amountMinor ?? current.amountMinor;
    let shares: Array<{ memberId: string; shareMinor: number }> | null = null;
    if (input.split) {
      const memberIds = [
        ...this.splitMemberIds(input.split),
        input.payerMemberId ?? current.payerMemberId,
      ];
      await this.assertMembersInGroup(groupId, memberIds);
      shares = this.computeOrThrow(nextAmount, input.split);
    } else if (input.payerMemberId) {
      await this.assertMembersInGroup(groupId, [input.payerMemberId]);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (shares && input.split) {
        // Replacing the split replaces the line items too (empty for
        // non-itemized splits, so switching away from itemized clears them).
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseItem.deleteMany({ where: { expenseId } });
      }
      const result = await tx.expense.update({
        where: { id: expenseId },
        data: {
          description: input.description ?? undefined,
          amountMinor: input.amountMinor ?? undefined,
          currency: input.currency ?? undefined,
          payerMemberId: input.payerMemberId ?? undefined,
          category: input.category === undefined ? undefined : input.category,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
          splitType: input.split ? input.split.type : undefined,
          version: { increment: 1 },
          ...(shares && input.split
            ? {
                splits: {
                  create: shares.map((s) => ({ memberId: s.memberId, shareMinor: s.shareMinor })),
                },
                items: { create: this.itemsToCreate(input.split) },
              }
            : {}),
        },
        include: { splits: true, items: true },
      });
      await this.writeActivity(tx, groupId, actorUserId, expenseId, 'updated', {
        fromVersion: current.version,
        toVersion: result.version,
        changed: Object.keys(input).filter((k) => k !== 'version'),
      });
      return result;
    });

    await this.publishMutation(groupId, { type: 'expense.updated', expenseId });
    return updated;
  }

  /** Soft-delete: preserves history, records the deletion, recomputes balances. */
  async remove(groupId: string, expenseId: string, actorUserId: string): Promise<{ id: string }> {
    const current = await this.getById(groupId, expenseId);
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } });
      await this.writeActivity(tx, groupId, actorUserId, expenseId, 'deleted', {
        description: current.description,
        amountMinor: current.amountMinor,
      });
    });
    await this.publishMutation(groupId, { type: 'expense.deleted', expenseId });
    return { id: expenseId };
  }

  private writeActivity(
    tx: Prisma.TransactionClient,
    groupId: string,
    actorId: string,
    entityId: string,
    action: 'created' | 'updated' | 'deleted',
    payload: Prisma.InputJsonValue,
  ): Promise<unknown> {
    return tx.activityLog.create({
      data: { groupId, actorId, entityType: 'expense', entityId, action, payload },
    });
  }
}

// Re-export for consumers/tests.
export type { Expense };
