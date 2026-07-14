import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window (never negative). */
  remaining: number;
  /** Seconds until the window resets. */
  resetSeconds: number;
  limit: number;
}

/**
 * Fixed-window rate limiter backed by Redis counters (M6-01).
 *
 * `INCR` the window key and set its TTL on first hit; the count is compared to
 * the limit. Fixed-window is simple, cheap, and good enough for gateway abuse
 * protection. If Redis is unreachable the limiter fails **open** (allows the
 * request) so an infra blip never takes the whole API down — availability over
 * strict enforcement, matching the PRD's graceful-degradation stance.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.expire(redisKey, windowSeconds);
      }
      let ttl = await this.redis.ttl(redisKey);
      // -1 = key exists but has no TTL (a prior INCR raced the EXPIRE); re-arm it.
      if (ttl < 0) {
        await this.redis.expire(redisKey, windowSeconds);
        ttl = windowSeconds;
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetSeconds: ttl,
        limit,
      };
    } catch (err) {
      this.logger.warn(`Rate limiter unavailable, failing open: ${(err as Error).message}`);
      return { allowed: true, remaining: limit, resetSeconds: windowSeconds, limit };
    }
  }
}
