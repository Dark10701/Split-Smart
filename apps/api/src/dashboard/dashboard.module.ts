import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BalancesModule } from '../balances/balances.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [AuthModule, UsersModule, BalancesModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
