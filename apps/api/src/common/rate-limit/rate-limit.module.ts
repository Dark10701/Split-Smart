import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitGuard } from './rate-limit.guard';

/** Wires the Redis-backed rate limiter and registers the guard globally (M6-01). */
@Global()
@Module({
  providers: [RateLimiterService, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimiterService],
})
export class RateLimitModule {}
