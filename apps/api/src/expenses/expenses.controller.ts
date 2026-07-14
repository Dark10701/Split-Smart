import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMembershipGuard } from '../groups/group-membership.guard';
import { CurrentMembership, type Membership } from '../groups/membership.decorator';
import { ExpensesService, type ExpenseWithSplits } from './expenses.service';

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

@Controller('groups/:id/expenses')
@UseGuards(JwtAuthGuard, GroupMembershipGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  async create(
    @Param('id') groupId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<ExpenseWithSplits> {
    const input = validate(createExpenseSchema, body);
    return this.expenses.create(groupId, membership.userId, input);
  }

  @Get()
  async list(
    @Param('id') groupId: string,
    @Query() query: unknown,
  ): Promise<{ items: ExpenseWithSplits[]; nextCursor: string | null }> {
    return this.expenses.list(groupId, validate(listExpensesQuerySchema, query));
  }

  @Get(':expenseId')
  async detail(
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
  ): Promise<ExpenseWithSplits> {
    return this.expenses.getById(groupId, expenseId);
  }

  @Patch(':expenseId')
  async update(
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<ExpenseWithSplits> {
    const input = validate(updateExpenseSchema, body);
    return this.expenses.update(groupId, expenseId, membership.userId, input);
  }

  @Delete(':expenseId')
  async remove(
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
    @CurrentMembership() membership: Membership,
  ): Promise<{ id: string }> {
    return this.expenses.remove(groupId, expenseId, membership.userId);
  }
}
