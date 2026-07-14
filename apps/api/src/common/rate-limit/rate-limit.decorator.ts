import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

/**
 * Override the default rate limit for a route. Tighten hot or sensitive
 * endpoints (writes, settlements) below the global default.
 */
export const RateLimit = (limit: number, windowSeconds: number): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitOptions);

/** Skip rate limiting entirely (e.g. health checks, provider webhooks). */
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';
export const SkipRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_RATE_LIMIT_KEY, true);
