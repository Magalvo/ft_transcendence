import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./respond.js";

type Bucket = { count: number; resetAt: number };

export type RateLimiter = {
  hit: (key: string) => { allowed: boolean; retryAfterSec: number };
  reset: (key: string) => void;
};

// Fixed-window, in-memory limiter. Good enough for a single Auth instance;
// move to a shared store if the service is ever scaled horizontally.
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs);
  sweep.unref();

  return {
    hit(key) {
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + options.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      return {
        allowed: bucket.count <= options.max,
        retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

// Returns true when the request was rejected (a 429 has already been sent).
export function rejectIfLimited(
  limiter: RateLimiter,
  key: string,
  reply: FastifyReply,
): boolean {
  const { allowed, retryAfterSec } = limiter.hit(key);
  if (allowed) return false;
  reply.header("Retry-After", String(retryAfterSec));
  sendError(reply, "Too many attempts, please try again later", 429);
  return true;
}

export function rateLimitByIp(limiter: RateLimiter, scope: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (rejectIfLimited(limiter, `${scope}:${req.ip}`, reply)) return reply;
  };
}
