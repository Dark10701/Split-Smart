import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthClaims } from '@splitsmart/validation';
import { RateLimiterService } from './rate-limiter.service';
import { RATE_LIMIT_KEY, SKIP_RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator';

/** Global default: generous enough for normal use, low enough to blunt abuse. */
const DEFAULT_LIMIT: RateLimitOptions = { limit: 120, windowSeconds: 60 };

interface AuthedRequest extends Request {
  user?: AuthClaims;
}

/**
 * Per-caller rate limiting at the gateway (M6-01). Registered as a global guard,
 * so it runs before route-level auth and keys by client IP (the true gateway
 * signal) — abuse is rejected before any auth work happens. If applied after an
 * auth guard it prefers the authenticated subject. Opt out with `@SkipRateLimit()`
 * and tune per route with `@RateLimit(limit, windowSeconds)`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: RateLimiterService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const cls = context.getClass();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, [handler, cls]);
    if (skip) return true;

    const opts =
      this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [handler, cls]) ??
      DEFAULT_LIMIT;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const caller = this.callerKey(req);
    const route = `${req.method}:${cls.name}.${handler.name}`;

    const result = await this.limiter.hit(`${caller}:${route}`, opts.limit, opts.windowSeconds);

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.resetSeconds);
      throw new HttpException('Too many requests, please slow down', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private callerKey(req: AuthedRequest): string {
    if (req.user?.sub) return `sub:${req.user.sub}`;
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.ip || 'unknown';
    return `ip:${ip}`;
  }
}
