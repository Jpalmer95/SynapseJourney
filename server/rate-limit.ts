/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Single-process (the app runs as one PM2 instance on the droplet), so an
 * in-memory limiter is sufficient and dependency-free. It bounds the blast
 * radius if the platform OpenRouter key or a session is ever compromised:
 * a flooded endpoint gets rejected before it can rack up operator spend or
 * hammer the upstream provider.
 *
 * NOT a substitute for a reverse-proxy/edge limiter in a multi-instance
 * deployment — if you ever scale horizontally, move this behind Redis or
 * apply limits at Traefik/Cloudflare instead.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Prune expired buckets once the map grows past this size. */
const PRUNE_AT = 10_000;

function prune(now: number) {
  if (buckets.size < PRUNE_AT) return;
  buckets.forEach((b, key) => {
    if (now >= b.resetAt) buckets.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Fixed-window limiter. `max` requests per `windowMs`.
 * key is caller-defined (e.g. `prepaid:<userId>` or `checkout:<userId>`).
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  if (max <= 0) return { allowed: true, retryAfterSec: 0 }; // disabled
  const now = Date.now();
  prune(now);

  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Reset all buckets (useful for tests). */
export function resetRateLimits() {
  buckets.clear();
}