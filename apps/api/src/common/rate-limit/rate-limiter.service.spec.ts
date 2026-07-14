import { RateLimiterService } from './rate-limiter.service';

function makeRedis(overrides: Record<string, unknown>) {
  return overrides as unknown as import('ioredis').default;
}

describe('RateLimiterService', () => {
  it('allows requests under the limit and reports remaining', async () => {
    const svc = new RateLimiterService(
      makeRedis({
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(60),
      }),
    );
    const r = await svc.hit('k', 5, 60);
    expect(r).toEqual({ allowed: true, remaining: 4, resetSeconds: 60, limit: 5 });
  });

  it('sets the TTL only on the first hit of a window', async () => {
    const expire = jest.fn().mockResolvedValue(1);
    const svc = new RateLimiterService(
      makeRedis({
        incr: jest.fn().mockResolvedValue(3),
        expire,
        ttl: jest.fn().mockResolvedValue(42),
      }),
    );
    await svc.hit('k', 5, 60);
    expect(expire).not.toHaveBeenCalled(); // count !== 1
  });

  it('blocks once the count exceeds the limit', async () => {
    const svc = new RateLimiterService(
      makeRedis({
        incr: jest.fn().mockResolvedValue(6),
        expire: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(30),
      }),
    );
    const r = await svc.hit('k', 5, 60);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetSeconds).toBe(30);
  });

  it('re-arms a missing TTL (INCR raced EXPIRE)', async () => {
    const expire = jest.fn().mockResolvedValue(1);
    const svc = new RateLimiterService(
      makeRedis({
        incr: jest.fn().mockResolvedValue(2),
        expire,
        ttl: jest.fn().mockResolvedValue(-1),
      }),
    );
    const r = await svc.hit('k', 5, 60);
    expect(expire).toHaveBeenCalledWith('ratelimit:k', 60);
    expect(r.resetSeconds).toBe(60);
  });

  it('fails open when Redis is unavailable', async () => {
    const svc = new RateLimiterService(
      makeRedis({ incr: jest.fn().mockRejectedValue(new Error('conn refused')) }),
    );
    const r = await svc.hit('k', 5, 60);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(5);
  });
});
