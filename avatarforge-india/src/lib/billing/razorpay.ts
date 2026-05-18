// ============================================
// Razorpay Billing Integration
// ============================================
// Subscription management, order creation, and payment verification.

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getPlans, getTopupOptions, computeAvatarSetupPrice } from './profitability';

// ─── Razorpay Client (singleton) ─────────────────────────────

let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
    }
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

export { getRazorpay };

// ─── Razorpay Plan IDs (mapped to ENV) ──────────────────────

export function getRazorpayPlanId(planType: 'STARTER' | 'CREATOR' | 'STUDIO'): string {
  const map: Record<string, string> = {
    STARTER: process.env.RAZORPAY_PLAN_STARTER || '',
    CREATOR: process.env.RAZORPAY_PLAN_CREATOR || '',
    STUDIO: process.env.RAZORPAY_PLAN_STUDIO || '',
  };
  const planId = map[planType];
  if (!planId) {
    throw new Error(`Razorpay plan ID not configured for ${planType}. Set RAZORPAY_PLAN_${planType} env var.`);
  }
  return planId;
}

// ─── Create Subscription ─────────────────────────────────────

export async function createRazorpaySubscription(params: {
  planType: 'STARTER' | 'CREATOR' | 'STUDIO';
  customerEmail: string;
  customerPhone?: string;
  userId: string;
}): Promise<{
  subscriptionId: string;
  shortUrl: string;
  status: string;
}> {
  const razorpay = getRazorpay();
  const planId = getRazorpayPlanId(params.planType);

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 12, // 12 billing cycles max
    customer_notify: 1,
    notes: {
      user_id: params.userId,
      plan_type: params.planType,
      customer_email: params.customerEmail,
    },
  });

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
    status: subscription.status,
  };
}

// ─── Cancel Subscription ─────────────────────────────────────

export async function cancelRazorpaySubscription(
  razorpaySubId: string,
  cancelAtCycleEnd: boolean = true
): Promise<void> {
  const razorpay = getRazorpay();
  await razorpay.subscriptions.cancel(razorpaySubId, cancelAtCycleEnd);
}

// ─── Create Order (for top-ups & add-ons) ────────────────────

export async function createRazorpayOrder(params: {
  amountPaise: number; // INR * 100
  currency?: string;
  receipt: string; // unique receipt id
  notes?: Record<string, string>;
}): Promise<{
  orderId: string;
  amount: number;
  currency: string;
}> {
  const razorpay = getRazorpay();

  const order = await razorpay.orders.create({
    amount: params.amountPaise,
    currency: params.currency || 'INR',
    receipt: params.receipt,
    notes: params.notes || {},
  });

  return {
    orderId: order.id,
    amount: order.amount as number,
    currency: order.currency,
  };
}

// ─── Verify Payment Signature ────────────────────────────────

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ─── Verify Webhook Signature (STRICT) ───────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not configured - rejecting all webhooks');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
