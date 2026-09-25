/**
 * Fixed-window in-memory limiter, used to blunt brute-force attempts against
 * the login endpoint. Per-instance only — a multi-region deployment should back
 * this with Redis, but it is a meaningful guard for a single admin runtime.
 */
interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
  now: number = Date.now()
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000)
  };
}

/** Test helper: clears all tracked windows. */
export function resetRateLimits(): void {
  windows.clear();
}

/** Best-effort client identifier for rate limiting. */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim();
  return ip && ip.length > 0 ? ip : 'unknown';
}
