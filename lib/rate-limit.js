/**
 * lib/rate-limit.js — Simple in-memory rate limiter
 *
 * Uses a sliding window per IP. Works on Vercel edge and Node runtimes.
 * For high-scale production, swap the store for Upstash Redis.
 */

import { serverEnv } from "@/lib/env.js";

// ─── In-memory store ──────────────────────────────────────────────────────────
// key: IP address → { count, windowStart }
const store = new Map();

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > 60_000) {
        store.delete(key);
      }
    }
  },
  5 * 60_000
);

/**
 * Check if the given key (IP address) is within the rate limit.
 *
 * @param {string} key - Usually the client's IP address
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
export function rateLimit(key) {
  const limit = serverEnv?.RATE_LIMIT_PER_MINUTE ?? 20;
  const windowMs = 60_000; // 1 minute
  const now = Date.now();

  const entry = store.get(key);

  // First request or window expired — start fresh
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1 };
  }

  // Within current window
  if (entry.count < limit) {
    entry.count++;
    return { allowed: true, remaining: limit - entry.count };
  }

  // Limit exceeded
  const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
  return { allowed: false, remaining: 0, retryAfter };
}
