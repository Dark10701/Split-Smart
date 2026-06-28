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
        // lazyConnect avoids crashing the app at boot if Redis isn't up yet.
        return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
