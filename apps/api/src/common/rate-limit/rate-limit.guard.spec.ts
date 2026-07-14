import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import type { RateLimiterService, RateLimitResult } from './rate-limiter.service';

function makeContext(req: Record<string, unknown>, res: Record<string, unknown>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

function makeGuard(hitResult: RateLimitResult, reflectorValue?: unknown) {
  const hit = jest.fn().mockResolvedValue(hitResult);
  const limiter = { hit } as unknown as RateLimiterService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(reflectorValue),
  } as unknown as Reflector;
  return { guard: new RateLimitGuard(limiter, reflector), hit };
}

const res = () => {
  const headers: Record<string, unknown> = {};
  return {
    setHeader: (k: string, v: unknown) => {
      headers[k] = v;
    },
    headers,
  };
};

describe('RateLimitGuard', () => {
  it('allows and sets rate-limit headers when under the limit', async () => {
    const { guard } = makeGuard({ allowed: true, remaining: 3, resetSeconds: 60, limit: 5 });
    const r = res();
    const ok = await guard.canActivate(
      makeContext({ method: 'GET', ip: '1.2.3.4', headers: {} }, r),
    );
    expect(ok).toBe(true);
    expect(r.headers['X-RateLimit-Remaining']).toBe(3);
    expect(r.headers['X-RateLimit-Limit']).toBe(5);
  });

  it('throws 429 with Retry-After when the limit is exceeded', async () => {
    const { guard } = makeGuard({ allowed: false, remaining: 0, resetSeconds: 30, limit: 5 });
    const r = res();
    await expect(
      guard.canActivate(makeContext({ method: 'POST', ip: '1.2.3.4', headers: {} }, r)),
    ).rejects.toBeInstanceOf(HttpException);
    expect(r.headers['Retry-After']).toBe(30);
  });

  it('keys by authenticated subject when present', async () => {
    const { guard, hit } = makeGuard({ allowed: true, remaining: 1, resetSeconds: 60, limit: 5 });
    await guard.canActivate(
      makeContext({ method: 'GET', headers: {}, user: { sub: 'auth0|maya' } }, res()),
    );
    expect(hit.mock.calls[0][0]).toContain('sub:auth0|maya');
  });

  it('honours @SkipRateLimit (reflector returns true first)', async () => {
    const hit = jest.fn();
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce(true),
    } as unknown as Reflector;
    const guard = new RateLimitGuard({ hit } as unknown as RateLimiterService, reflector);
    const ok = await guard.canActivate(makeContext({ method: 'GET', headers: {} }, res()));
    expect(ok).toBe(true);
    expect(hit).not.toHaveBeenCalled();
  });
});
