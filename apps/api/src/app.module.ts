import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FriendsModule } from './friends/friends.module';
import { GroupsModule } from './groups/groups.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BalancesModule } from './balances/balances.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SettlementModule } from './settlement/settlement.module';
import { PaymentsModule } from './payments/payments.module';
import { FeedModule } from './feed/feed.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { AuditModule } from './common/audit/audit.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
    }),
    DatabaseModule,
    RedisModule,
    RateLimitModule,
    AuditModule,
    MetricsModule,
    RealtimeModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    GroupsModule,
    ExpensesModule,
    BalancesModule,
    SettlementModule,
    PaymentsModule,
    FeedModule,
    HealthModule,
  ],
})
export class AppModule {}
