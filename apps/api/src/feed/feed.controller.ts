import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ActivityLog, Comment } from '@prisma/client';
import { createCommentSchema, listActivityQuerySchema } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMembershipGuard } from '../groups/group-membership.guard';
import { CurrentMembership, type Membership } from '../groups/membership.decorator';
import { FeedService } from './feed.service';

type Validatable<T> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
};

function validate<T>(schema: Validatable<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

@Controller('groups/:id')
@UseGuards(JwtAuthGuard, GroupMembershipGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('activity')
  async activity(
    @Param('id') groupId: string,
    @Query() query: unknown,
  ): Promise<{ items: ActivityLog[]; nextCursor: string | null }> {
    return this.feed.listActivity(groupId, validate(listActivityQuerySchema, query));
  }

  @Get('expenses/:expenseId/comments')
  async listComments(
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
  ): Promise<Comment[]> {
    return this.feed.listComments(groupId, expenseId);
  }

  @Post('expenses/:expenseId/comments')
  async addComment(
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<Comment> {
    return this.feed.addComment(
      groupId,
      expenseId,
      membership.userId,
      validate(createCommentSchema, body),
    );
  }
}
