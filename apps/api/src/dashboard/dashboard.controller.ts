import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthClaims } from '@splitsmart/validation';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from '../users/users.service';
import { DashboardService, type Dashboard, type FriendBalance } from './dashboard.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly users: UsersService,
  ) {}

  @Get('dashboard')
  async get(@CurrentUser() claims: AuthClaims): Promise<Dashboard> {
    const user = await this.users.resolveFromClaims(claims);
    return this.dashboard.forUser(user.id);
  }

  @Get('friend-balances')
  async friendBalances(@CurrentUser() claims: AuthClaims): Promise<FriendBalance[]> {
    const user = await this.users.resolveFromClaims(claims);
    return this.dashboard.friendBalancesForUser(user.id);
  }
}
