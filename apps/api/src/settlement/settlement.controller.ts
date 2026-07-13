import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import { createSettlementSchema } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMembershipGuard } from '../groups/group-membership.guard';
import { CurrentMembership, type Membership } from '../groups/membership.decorator';
import { SettlementService } from './settlement.service';

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

@Controller('groups/:id/settlements')
@UseGuards(JwtAuthGuard, GroupMembershipGuard)
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Post()
  async record(
    @Param('id') groupId: string,
    @CurrentMembership() membership: Membership,
    @Body() body: unknown,
  ): Promise<Payment> {
    const input = validate(createSettlementSchema, body);
    return this.settlement.recordManual(groupId, membership.userId, input);
  }

  @Get()
  async list(@Param('id') groupId: string): Promise<Payment[]> {
    return this.settlement.listForGroup(groupId);
  }
}
