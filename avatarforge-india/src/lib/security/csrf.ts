// ============================================
// CSRF Protection for Sensitive Actions
// ============================================
// Uses double-submit cookie pattern.
// For Next.js, we rely on:
// 1. SameSite=Lax cookies (NextAuth default)
// 2. Origin/Referer header validation for state-changing requests
// 3. Custom header requirement for API mutations

import { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
];

/**
 * Validate that a request originates from our app.
 * Checks Origin and Referer headers against allowed origins.
 * Returns true if valid, false if suspicious.
 */
export function validateOrigin(req: NextRequest): boolean {
  // Skip for GET/HEAD/OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }

  // Skip for webhook endpoints (called by external services)
  if (req.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return true;
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // If origin header present, validate it
  if (origin) {
    return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
  }

  // Fallback to referer
  if (referer) {
    return ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed));
  }

  // If neither header present (e.g., same-origin fetch), allow
  // Browser always sends Origin for cross-origin requests
  return true;
}

/**
 * For extra-sensitive actions (delete account, cancel subscription),
 * require a custom header to prevent CSRF from form submissions.
 */
export function requireCustomHeader(req: NextRequest): boolean {
  return req.headers.get('x-requested-with') === 'AvatarForge';
}
