import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActivityLog, Comment } from '@prisma/client';
import type { CreateCommentInput, ListActivityQuery } from '@splitsmart/validation';
import { PrismaService } from '../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Chronological activity log for a group (M3-08), newest first, cursor-paged. */
  async listActivity(
    groupId: string,
    query: ListActivityQuery,
  ): Promise<{ items: ActivityLog[]; nextCursor: string | null }> {
    const rows = await this.prisma.activityLog.findMany({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }

  /** Ensure the expense exists in this group (and isn't deleted). */
  private async assertExpenseInGroup(groupId: string, expenseId: string): Promise<void> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
      select: { id: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
  }

  async listComments(groupId: string, expenseId: string): Promise<Comment[]> {
    await this.assertExpenseInGroup(groupId, expenseId);
    return this.prisma.comment.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    groupId: string,
    expenseId: string,
    authorId: string,
    input: CreateCommentInput,
  ): Promise<Comment> {
    await this.assertExpenseInGroup(groupId, expenseId);
    const comment = await this.prisma.comment.create({
      data: { expenseId, authorId, body: input.body },
    });
    this.realtime.emitToGroup(groupId, { type: 'expense.updated', expenseId });
    return comment;
  }
}
