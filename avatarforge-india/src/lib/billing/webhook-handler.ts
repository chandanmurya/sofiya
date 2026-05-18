// ============================================
// Razorpay Webhook Handler (Idempotent)
// ============================================
//
// All webhook handlers:
// 1. Verify signature strictly
// 2. Check EventDedup table for duplicate (idempotent)
// 3. Process event
// 4. Mark as processed in EventDedup
//
// Supported events:
// - subscription.activated → ACTIVE, reset credits
// - subscription.charged / payment.captured / invoice.paid → credit renewal
// - payment.failed → GRACE (3 days), then BLOCK
// - subscription.cancelled → INACTIVE at end of cycle
// - subscription.paused / subscription.resumed

import { prisma } from '@/lib/prisma';
import { getPlans } from './profitability';

// ─── Types ───────────────────────────────────────────────────

interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    subscription?: { entity: any };
    payment?: { entity: any };
    invoice?: { entity: any };
  };
  created_at: number;
}

export interface WebhookResult {
  processed: boolean;
  action: string;
  details?: string;
}

// ─── Main Handler (with idempotency) ─────────────────────────

export async function handleRazorpayWebhook(
  event: RazorpayWebhookPayload,
  rawEventId: string // The unique event ID from Razorpay headers or payload
): Promise<WebhookResult> {
  // ── Step 1: Idempotency check via EventDedup ──
  const existing = await prisma.eventDedup.findUnique({
    where: {
      provider_eventId: {
        provider: 'razorpay',
        eventId: rawEventId,
      },
    },
  });

  if (existing?.processed) {
    return { processed: false, action: 'duplicate_skipped', details: `Event ${rawEventId} already processed` };
  }

  // ── Step 2: Create dedup record (or update if exists but unprocessed) ──
  await prisma.eventDedup.upsert({
    where: {
      provider_eventId: {
        provider: 'razorpay',
        eventId: rawEventId,
      },
    },
    update: {},
    create: {
      provider: 'razorpay',
      eventId: rawEventId,
      processed: false,
      payload: event as any,
    },
  });

  // ── Step 3: Route to handler ──
  let result: WebhookResult;

  try {
    switch (event.event) {
      case 'subscription.activated':
        result = await onSubscriptionActivated(event.payload);
        break;

      case 'subscription.charged':
        result = await onSubscriptionCharged(event.payload);
        break;

      case 'payment.captured':
        result = await onPaymentCaptured(event.payload);
        break;

      case 'payment.failed':
        result = await onPaymentFailed(event.payload);
        break;

      case 'invoice.paid':
        result = await onInvoicePaid(event.payload);
        break;

      case 'subscription.cancelled':
        result = await onSubscriptionCancelled(event.payload);
        break;

      case 'subscription.paused':
        result = await onSubscriptionPaused(event.payload);
        break;

      case 'subscription.resumed':
        result = await onSubscriptionResumed(event.payload);
        break;

      default:
        result = { processed: true, action: `unhandled:${event.event}` };
    }
  } catch (error) {
    // Log failure but mark as NOT processed so it can be retried
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Webhook handler error for ${event.event}:`, errMsg);

    await prisma.webhookLog.create({
      data: {
        source: 'razorpay',
        eventType: event.event,
        payload: event as any,
        status: 'failed',
        errorMessage: errMsg,
      },
    });

    return { processed: false, action: 'error', details: errMsg };
  }

  // ── Step 4: Mark as processed ──
  await prisma.eventDedup.update({
    where: {
      provider_eventId: {
        provider: 'razorpay',
        eventId: rawEventId,
      },
    },
    data: { processed: true },
  });

  // Audit log
  await prisma.webhookLog.create({
    data: {
      source: 'razorpay',
      eventType: event.event,
      payload: event as any,
      status: 'processed',
      processedAt: new Date(),
    },
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

// ─── subscription.activated ──────────────────────────────────
// First successful charge → activate subscription & grant credits

async function onSubscriptionActivated(payload: any): Promise<WebhookResult> {
  const sub = payload.subscription?.entity;
  if (!sub) return { processed: true, action: 'no_subscription_entity' };

  const razorpaySubId = sub.id;
  const planId = sub.plan_id;
  const notes = sub.notes || {};
  const userId = notes.user_id;
  const planType = notes.plan_type as string;

  // Find matching plan from profitability engine
  const plans = getPlans();
  const plan = plans.find((p) => p.id === planType);

  if (!plan) {
    console.error(`Unknown plan_type in subscription notes: ${planType}`);
    return { processed: true, action: 'unknown_plan', details: planType };
  }

  // Update subscription to ACTIVE
  const dbSub = await prisma.subscription.findUnique({
    where: { razorpaySubId },
  });

  if (!dbSub) {
    // Subscription might have been created with a different flow
    // Try to find by userId from notes
    if (userId) {
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          razorpaySubId,
          razorpayPlanId: planId,
          plan: planType as any,
          status: 'ACTIVE',
          monthlyIncludedSeconds: plan.includedSeconds,
          maxResolution: plan.maxResolution,
          priorityQueue: plan.priorityQueue,
          currentPeriodStart: new Date(),
          currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
          gracePeriodEnd: null,
        },
        create: {
          userId,
          razorpaySubId,
          razorpayPlanId: planId,
          plan: planType as any,
          status: 'ACTIVE',
          monthlyIncludedSeconds: plan.includedSeconds,
          maxResolution: plan.maxResolution,
          priorityQueue: plan.priorityQueue,
          currentPeriodStart: new Date(),
          currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
        },
      });
    }
  } else {
    await prisma.subscription.update({
      where: { razorpaySubId },
      data: {
        plan: planType as any,
        status: 'ACTIVE',
        monthlyIncludedSeconds: plan.includedSeconds,
        maxResolution: plan.maxResolution,
        priorityQueue: plan.priorityQueue,
        currentPeriodStart: new Date(),
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
        gracePeriodEnd: null,
      },
    });
  }

  // Reset credit wallet
  const targetUserId = dbSub?.userId || userId;
  if (targetUserId) {
    await resetMonthlyCredits(targetUserId, plan.includedSeconds);
  }

  return { processed: true, action: 'subscription_activated', details: `${planType} for ${targetUserId}` };
}

// ─── subscription.charged ────────────────────────────────────
// Recurring charge success → renew credits for new billing cycle

async function onSubscriptionCharged(payload: any): Promise<WebhookResult> {
  const sub = payload.subscription?.entity;
  const payment = payload.payment?.entity;
  if (!sub) return { processed: true, action: 'no_subscription_entity' };

  const razorpaySubId = sub.id;

  const dbSub = await prisma.subscription.findUnique({
    where: { razorpaySubId },
  });

  if (!dbSub) {
    return { processed: true, action: 'subscription_not_found', details: razorpaySubId };
  }

  // Update period & status
  await prisma.subscription.update({
    where: { id: dbSub.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      gracePeriodEnd: null,
    },
  });

  // Reset monthly credits (fresh allocation for new cycle)
  await resetMonthlyCredits(dbSub.userId, dbSub.monthlyIncludedSeconds);

  // Create invoice record
  if (payment) {
    await prisma.invoice.create({
      data: {
        subscriptionId: dbSub.id,
        razorpayInvoiceId: payment.invoice_id || null,
        razorpayPaymentId: payment.id,
        amount: payment.amount, // in paise
        currency: payment.currency || 'INR',
        status: 'PAID',
        paidAt: new Date(),
      },
    });
  }

  return { processed: true, action: 'subscription_charged', details: `Reset ${dbSub.monthlyIncludedSeconds}s for ${dbSub.userId}` };
}

// ─── payment.captured ────────────────────────────────────────
// Generic payment captured (could be subscription or one-time)

async function onPaymentCaptured(payload: any): Promise<WebhookResult> {
  const payment = payload.payment?.entity;
  if (!payment) return { processed: true, action: 'no_payment_entity' };

  // Check if this is for a top-up or add-on order
  const orderId = payment.order_id;
  if (orderId) {
    // Check top-up
    const topup = await prisma.topupPurchase.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (topup && topup.status === 'PENDING_PAYMENT') {
      await prisma.topupPurchase.update({
        where: { id: topup.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: payment.id,
          paidAt: new Date(),
        },
      });

      // Add seconds to wallet
      await prisma.creditWallet.update({
        where: { userId: topup.userId },
        data: {
          topupSeconds: { increment: topup.seconds },
          totalSecondsEarned: { increment: topup.seconds },
        },
      });

      return { processed: true, action: 'topup_captured', details: `+${topup.seconds}s for ${topup.userId}` };
    }

    // Check add-on
    const addon = await prisma.addOn.findUnique({
      where: { razorpayOrderId: orderId },
    });
    if (addon && addon.status === 'PENDING_PAYMENT') {
      await prisma.addOn.update({
        where: { id: addon.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: payment.id,
          completedAt: new Date(),
        },
      });

      return { processed: true, action: 'addon_captured', details: `${addon.type} for ${addon.userId}` };
    }
  }

  // Otherwise it's a subscription payment - update invoice if exists
  if (payment.invoice_id) {
    await prisma.invoice.updateMany({
      where: { razorpayPaymentId: payment.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  return { processed: true, action: 'payment_captured', details: payment.id };
}

// ─── payment.failed ──────────────────────────────────────────
// Payment failed → set GRACE (3 days), then block

async function onPaymentFailed(payload: any): Promise<WebhookResult> {
  const payment = payload.payment?.entity;
  if (!payment) return { processed: true, action: 'no_payment_entity' };

  // Find subscription via notes or invoice
  const notes = payment.notes || {};
  const razorpaySubId = notes.subscription_id || null;

  let dbSub: any = null;
  if (razorpaySubId) {
    dbSub = await prisma.subscription.findUnique({
      where: { razorpaySubId },
    });
  }

  if (!dbSub) {
    // Try to find via customer email in notes
    const email = notes.customer_email;
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        dbSub = await prisma.subscription.findUnique({ where: { userId: user.id } });
      }
    }
  }

  if (dbSub && dbSub.status === 'ACTIVE') {
    // Set GRACE period: 3 days to fix payment
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

    await prisma.subscription.update({
      where: { id: dbSub.id },
      data: {
        status: 'GRACE',
        gracePeriodEnd,
      },
    });

    return { processed: true, action: 'payment_failed_grace', details: `Grace until ${gracePeriodEnd.toISOString()}` };
  }

  if (dbSub && dbSub.status === 'GRACE') {
    // Already in grace - check if grace expired
    if (dbSub.gracePeriodEnd && new Date() > dbSub.gracePeriodEnd) {
      await prisma.subscription.update({
        where: { id: dbSub.id },
        data: { status: 'PAST_DUE' },
      });
      return { processed: true, action: 'payment_failed_blocked', details: 'Grace expired, user blocked' };
    }
  }

  return { processed: true, action: 'payment_failed', details: payment.id };
}

// ─── invoice.paid ────────────────────────────────────────────

async function onInvoicePaid(payload: any): Promise<WebhookResult> {
  const invoice = payload.invoice?.entity;
  if (!invoice) return { processed: true, action: 'no_invoice_entity' };

  await prisma.invoice.updateMany({
    where: { razorpayInvoiceId: invoice.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  return { processed: true, action: 'invoice_paid', details: invoice.id };
}

// ─── subscription.cancelled ──────────────────────────────────
// User cancelled → remains active until period end, then INACTIVE

async function onSubscriptionCancelled(payload: any): Promise<WebhookResult> {
  const sub = payload.subscription?.entity;
  if (!sub) return { processed: true, action: 'no_subscription_entity' };

  const razorpaySubId = sub.id;

  await prisma.subscription.updateMany({
    where: { razorpaySubId },
    data: {
      status: 'CANCELLED', // still active until period end
      cancelledAt: new Date(),
    },
  });

  return { processed: true, action: 'subscription_cancelled', details: razorpaySubId };
}

// ─── subscription.paused ─────────────────────────────────────

async function onSubscriptionPaused(payload: any): Promise<WebhookResult> {
  const sub = payload.subscription?.entity;
  if (!sub) return { processed: true, action: 'no_subscription_entity' };

  await prisma.subscription.updateMany({
    where: { razorpaySubId: sub.id },
    data: { status: 'PAUSED' },
  });

  return { processed: true, action: 'subscription_paused' };
}

// ─── subscription.resumed ────────────────────────────────────

async function onSubscriptionResumed(payload: any): Promise<WebhookResult> {
  const sub = payload.subscription?.entity;
  if (!sub) return { processed: true, action: 'no_subscription_entity' };

  await prisma.subscription.updateMany({
    where: { razorpaySubId: sub.id },
    data: { status: 'ACTIVE', gracePeriodEnd: null },
  });

  return { processed: true, action: 'subscription_resumed' };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function resetMonthlyCredits(userId: string, includedSeconds: number): Promise<void> {
  await prisma.creditWallet.upsert({
    where: { userId },
    update: {
      monthlyIncludedSeconds: includedSeconds,
      monthlyRemaining: includedSeconds,
      monthlyResetAt: new Date(),
      totalSecondsEarned: { increment: includedSeconds },
    },
    create: {
      userId,
      monthlyIncludedSeconds: includedSeconds,
      monthlyRemaining: includedSeconds,
      totalSecondsEarned: includedSeconds,
      monthlyResetAt: new Date(),
    },
  });
}
