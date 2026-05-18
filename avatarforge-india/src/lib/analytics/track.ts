// ============================================
// Analytics Tracking — Conversion & Usage Metrics
// ============================================
//
// Tracks key conversion funnel events:
// - signup_conversion: user registered
// - demo_generation_started: free user initiated generation
// - demo_generation_completed: free video delivered
// - upgrade_modal_shown: upgrade modal displayed
// - upgrade_modal_clicked: user clicked upgrade CTA
// - upgrade_conversion: user subscribed to paid plan
// - onboarding_step_completed: user completed onboarding step
// - drop_off: user left at a specific step
//
// Implementation: fire-and-forget inserts to WebhookLog with source='analytics'.
// In production, replace with Mixpanel/Amplitude/PostHog SDK calls.

import { prisma } from '@/lib/prisma';

// ─── Event Types ─────────────────────────────────────────────

export type AnalyticsEvent =
  | 'signup_conversion'
  | 'demo_generation_started'
  | 'demo_generation_completed'
  | 'demo_video_downloaded'
  | 'upgrade_modal_shown'
  | 'upgrade_modal_cta_clicked'
  | 'upgrade_conversion'
  | 'onboarding_step_welcome'
  | 'onboarding_step_avatar'
  | 'onboarding_step_script'
  | 'onboarding_step_generating'
  | 'onboarding_step_done'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'locked_feature_clicked'
  | 'topup_purchased'
  | 'subscription_cancelled'
  | 'drop_off';

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  userId?: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

// ─── Server-side Track ───────────────────────────────────────

/**
 * Track an analytics event (server-side, fire-and-forget).
 * Non-blocking — failures are silently logged.
 */
export function trackEvent(payload: AnalyticsPayload): void {
  const { event, userId, properties, timestamp } = payload;

  prisma.webhookLog.create({
    data: {
      source: 'analytics',
      eventType: event,
      payload: {
        userId: userId || 'anonymous',
        properties: properties || {},
        ts: (timestamp || new Date()).toISOString(),
      } as any,
      status: 'processed',
      processedAt: new Date(),
    },
  }).catch((err) => {
    console.error('[Analytics] Track failed:', err.message);
  });
}

/**
 * Track a conversion event with explicit source attribution.
 */
export function trackConversion(params: {
  userId: string;
  from: 'free_demo' | 'pricing_page' | 'upgrade_modal' | 'locked_feature' | 'dashboard_cta';
  toPlan: string;
}): void {
  trackEvent({
    event: 'upgrade_conversion',
    userId: params.userId,
    properties: {
      conversionSource: params.from,
      plan: params.toPlan,
    },
  });
}

// ─── Client-side Track (lightweight) ─────────────────────────

/**
 * Client-side analytics call. Sends event to our API endpoint.
 * Fire-and-forget, non-blocking.
 */
export async function trackClientEvent(
  event: AnalyticsEvent,
  properties?: Record<string, any>
): Promise<void> {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties }),
    });
  } catch {
    // Silent fail — analytics should never block UX
  }
}

// ─── Query Helpers (for Admin Dashboard) ─────────────────────

/**
 * Get conversion funnel stats for a time period.
 */
export async function getConversionFunnel(params: {
  startDate: Date;
  endDate: Date;
}): Promise<{
  signups: number;
  demoStarted: number;
  demoCompleted: number;
  upgradeModalShown: number;
  upgradeClicked: number;
  upgraded: number;
  conversionRate: number;
  demoCompletionRate: number;
}> {
  const { startDate, endDate } = params;

  const where = {
    source: 'analytics',
    createdAt: { gte: startDate, lte: endDate },
  };

  const [signups, demoStarted, demoCompleted, upgradeModalShown, upgradeClicked, upgraded] =
    await Promise.all([
      prisma.webhookLog.count({ where: { ...where, eventType: 'signup_conversion' } }),
      prisma.webhookLog.count({ where: { ...where, eventType: 'demo_generation_started' } }),
      prisma.webhookLog.count({ where: { ...where, eventType: 'demo_generation_completed' } }),
      prisma.webhookLog.count({ where: { ...where, eventType: 'upgrade_modal_shown' } }),
      prisma.webhookLog.count({ where: { ...where, eventType: 'upgrade_modal_cta_clicked' } }),
      prisma.webhookLog.count({ where: { ...where, eventType: 'upgrade_conversion' } }),
    ]);

  return {
    signups,
    demoStarted,
    demoCompleted,
    upgradeModalShown,
    upgradeClicked,
    upgraded,
    conversionRate: signups > 0 ? (upgraded / signups) * 100 : 0,
    demoCompletionRate: demoStarted > 0 ? (demoCompleted / demoStarted) * 100 : 0,
  };
}

/**
 * Get average demo duration (from start to complete).
 */
export async function getAverageDemoDuration(params: {
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  // This would require matching start/complete events per user
  // Simplified: return from videos table
  const result = await prisma.video.aggregate({
    where: {
      createdAt: { gte: params.startDate, lte: params.endDate },
      user: { accountType: 'FREE_DEMO' },
      status: 'COMPLETED',
    },
    _avg: { durationSec: true },
  });

  return result._avg.durationSec || 0;
}

/**
 * Get drop-off by onboarding step.
 */
export async function getDropOffByStep(params: {
  startDate: Date;
  endDate: Date;
}): Promise<Record<string, number>> {
  const { startDate, endDate } = params;
  const where = {
    source: 'analytics',
    createdAt: { gte: startDate, lte: endDate },
  };

  const steps = [
    'onboarding_step_welcome',
    'onboarding_step_avatar',
    'onboarding_step_script',
    'onboarding_step_generating',
    'onboarding_step_done',
  ];

  const counts: Record<string, number> = {};
  for (const step of steps) {
    counts[step] = await prisma.webhookLog.count({
      where: { ...where, eventType: step },
    });
  }

  return counts;
}
