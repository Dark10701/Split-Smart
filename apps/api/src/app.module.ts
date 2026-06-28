import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load apps/api/.env first, then fall back to the repo-root .env.
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
