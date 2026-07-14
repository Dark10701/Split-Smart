import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new Redis(url, {
          // lazyConnect avoids crashing the app at boot if Redis isn't up yet.
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          // Graceful degradation (M6-20): bound every command so a hung/frozen
          // Redis fails fast — callers (rate limiter, balance cache) catch the
          // error and fall back, instead of blocking the request path.
          commandTimeout: 1000,
          enableOfflineQueue: false,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
