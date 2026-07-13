import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupMembershipGuard } from '../groups/group-membership.guard';
import { BalancesService, type GroupBalances } from './balances.service';

@Controller('groups/:id/balances')
@UseGuards(JwtAuthGuard, GroupMembershipGuard)
export class BalancesController {
  constructor(private readonly balances: BalancesService) {}

  @Get()
  async get(@Param('id') groupId: string): Promise<GroupBalances> {
    return this.balances.getForGroup(groupId);
  }
}
