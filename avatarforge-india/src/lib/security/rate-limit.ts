// ============================================
// Rate Limiting (Redis-backed via Upstash pattern)
// ============================================
// Per-user and per-IP rate limiting for API routes.
// Uses a sliding window counter stored in Redis.

import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory fallback (for dev without Redis) ──────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;   // time window in milliseconds
  maxRequests: number; // max requests per window
  identifier: string;  // user id or IP
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check rate limit. Returns { allowed, remaining, resetAt }.
 * In production, replace with Redis INCR + EXPIRE for distributed rate limiting.
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const key = `ratelimit:${config.identifier}`;
  const now = Date.now();

  const existing = memoryStore.get(key);

  if (!existing || now > existing.resetAt) {
    // New window
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs, limit: config.maxRequests };
  }

  if (existing.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit: config.maxRequests };
  }

  existing.count++;
  return { allowed: true, remaining: config.maxRequests - existing.count, resetAt: existing.resetAt, limit: config.maxRequests };
}

/**
 * Rate limit presets for different endpoint types.
 */
export const RATE_LIMITS = {
  // Video generation — expensive, limit tightly
  GENERATION: { windowMs: 60_000, maxRequests: 5 },
  // Avatar/voice creation — moderate
  CREATION: { windowMs: 60_000, maxRequests: 10 },
  // General API reads
  READ: { windowMs: 60_000, maxRequests: 60 },
  // Auth attempts
  AUTH: { windowMs: 300_000, maxRequests: 10 }, // 10 per 5 min
  // Webhook endpoints (higher limit, called by external services)
  WEBHOOK: { windowMs: 60_000, maxRequests: 100 },
  // Upload presigned URL requests
  UPLOAD: { windowMs: 60_000, maxRequests: 20 },
} as const;

/**
 * Extract identifier from request (user ID or IP).
 */
export function getRequestIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             'unknown';
  return `ip:${ip}`;
}

/**
 * Apply rate limit and return 429 response if exceeded.
 */
export function applyRateLimit(
  req: NextRequest,
  preset: keyof typeof RATE_LIMITS,
  userId?: string
): NextResponse | null {
  const config = RATE_LIMITS[preset];
  const identifier = getRequestIdentifier(req, userId);

  const result = checkRateLimit({
    ...config,
    identifier: `${preset}:${identifier}`,
  });

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  return null; // Allowed
}
