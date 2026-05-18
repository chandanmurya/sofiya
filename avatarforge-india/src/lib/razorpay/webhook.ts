// ============================================
// Razorpay Webhook Verification & Processing
// ============================================

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { resetMonthlyCredits } from '@/lib/credits';
import { PLANS } from './client';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

export function verifyRazorpayWebhook(
  payload: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function processRazorpayWebhook(event: any): Promise<void> {
  const eventType = event.event;
  const payload = event.payload;

  switch (eventType) {
    case 'subscription.activated':
      await handleSubscriptionActivated(payload);
      break;

    case 'subscription.charged':
      await handleSubscriptionCharged(payload);
      break;

    case 'subscription.cancelled':
      await handleSubscriptionCancelled(payload);
      break;

    case 'subscription.paused':
      await handleSubscriptionPaused(payload);
      break;

    case 'subscription.resumed':
      await handleSubscriptionResumed(payload);
      break;

    case 'payment.captured':
      await handlePaymentCaptured(payload);
      break;

    case 'payment.failed':
      await handlePaymentFailed(payload);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(payload);
      break;

    default:
      console.log(`Unhandled Razorpay event: ${eventType}`);
  }
}

// ─── Event Handlers ──────────────────────────────────────────

async function handleSubscriptionActivated(payload: any) {
  const subscription = payload.subscription?.entity;
  if (!subscription) return;

  const razorpaySubId = subscription.id;
  const planId = subscription.plan_id;

  // Find which plan matches
  const plan = Object.values(PLANS).find(
    (p) => p.razorpayPlanId === planId
  );

  if (!plan) {
    console.error(`Unknown plan_id: ${planId}`);
    return;
  }

  await prisma.subscription.updateMany({
    where: { razorpaySubId },
    data: {
      status: 'ACTIVE',
      plan: plan.id as any,
      monthlyCredits: plan.credits,
      maxAvatars: plan.maxAvatars,
      maxVoices: plan.maxVoices,
      maxResolution: plan.maxResolution as any,
      maxVideoDurationSec: plan.maxVideoDurationSec,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(subscription.current_end * 1000),
    },
  });
}

async function handleSubscriptionCharged(payload: any) {
  const subscription = payload.subscription?.entity;
  const payment = payload.payment?.entity;
  if (!subscription) return;

  const razorpaySubId = subscription.id;

  // Find the user's subscription
  const sub = await prisma.subscription.findUnique({
    where: { razorpaySubId },
  });

  if (!sub) return;

  // Reset monthly credits
  await resetMonthlyCredits(sub.userId, sub.monthlyCredits);

  // Update period
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(subscription.current_end * 1000),
      status: 'ACTIVE',
    },
  });

  // Create invoice record
  if (payment) {
    await prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        razorpayInvoiceId: payment.invoice_id,
        razorpayPaymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency || 'INR',
        status: 'PAID',
        paidAt: new Date(),
      },
    });
  }
}

async function handleSubscriptionCancelled(payload: any) {
  const subscription = payload.subscription?.entity;
  if (!subscription) return;

  await prisma.subscription.updateMany({
    where: { razorpaySubId: subscription.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });
}

async function handleSubscriptionPaused(payload: any) {
  const subscription = payload.subscription?.entity;
  if (!subscription) return;

  await prisma.subscription.updateMany({
    where: { razorpaySubId: subscription.id },
    data: { status: 'PAUSED' },
  });
}

async function handleSubscriptionResumed(payload: any) {
  const subscription = payload.subscription?.entity;
  if (!subscription) return;

  await prisma.subscription.updateMany({
    where: { razorpaySubId: subscription.id },
    data: { status: 'ACTIVE' },
  });
}

async function handlePaymentCaptured(payload: any) {
  const payment = payload.payment?.entity;
  if (!payment) return;

  // Update invoice if exists
  if (payment.invoice_id) {
    await prisma.invoice.updateMany({
      where: { razorpayPaymentId: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });
  }
}

async function handlePaymentFailed(payload: any) {
  const payment = payload.payment?.entity;
  if (!payment) return;

  // Mark subscription as past due
  const notes = payment.notes;
  if (notes?.subscription_id) {
    await prisma.subscription.updateMany({
      where: { razorpaySubId: notes.subscription_id },
      data: { status: 'PAST_DUE' },
    });
  }
}

async function handleInvoicePaid(payload: any) {
  const invoice = payload.invoice?.entity;
  if (!invoice) return;

  await prisma.invoice.updateMany({
    where: { razorpayInvoiceId: invoice.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
}
