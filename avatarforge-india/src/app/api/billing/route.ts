// ============================================
// Billing API - Subscription management
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { PLANS, createSubscription, cancelSubscription } from '@/lib/razorpay/client';
import { subscribeSchema, cancelSubscriptionSchema } from '@/lib/validations';
import { resetMonthlyCredits } from '@/lib/credits';

// ─── GET /api/billing - Get current subscription & credits ───

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const [subscription, creditBalance, recentInvoices] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId: user.id } }),
      prisma.creditBalance.findUnique({ where: { userId: user.id } }),
      prisma.invoice.findMany({
        where: { subscription: { userId: user.id } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscription || { plan: 'FREE', status: 'ACTIVE' },
        credits: creditBalance || { balance: 0, totalEarned: 0, totalSpent: 0 },
        invoices: recentInvoices,
        plans: PLANS,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to get billing info' }, { status: 500 });
  }
}

// ─── POST /api/billing - Subscribe to a plan ─────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { planId } = parsed.data;
    const plan = PLANS[planId];

    if (!plan || !plan.razorpayPlanId) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription
    const existingSub = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (existingSub?.status === 'ACTIVE' && existingSub.plan !== 'FREE') {
      return NextResponse.json(
        { success: false, error: 'You already have an active subscription. Cancel it first to change plans.' },
        { status: 400 }
      );
    }

    // Create Razorpay subscription
    const razorpaySub = await createSubscription({
      planId: plan.razorpayPlanId,
      customerEmail: user.email,
    });

    // Update our subscription record
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        plan: planId as any,
        status: 'ACTIVE',
        razorpaySubId: razorpaySub.id,
        razorpayPlanId: plan.razorpayPlanId,
        monthlyCredits: plan.credits,
        maxAvatars: plan.maxAvatars,
        maxVoices: plan.maxVoices,
        maxResolution: plan.maxResolution as any,
        maxVideoDurationSec: plan.maxVideoDurationSec,
      },
      create: {
        userId: user.id,
        plan: planId as any,
        status: 'ACTIVE',
        razorpaySubId: razorpaySub.id,
        razorpayPlanId: plan.razorpayPlanId,
        monthlyCredits: plan.credits,
        maxAvatars: plan.maxAvatars,
        maxVoices: plan.maxVoices,
        maxResolution: plan.maxResolution as any,
        maxVideoDurationSec: plan.maxVideoDurationSec,
      },
    });

    // Grant credits immediately
    await resetMonthlyCredits(user.id, plan.credits);

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: razorpaySub.id,
        shortUrl: razorpaySub.short_url, // Razorpay payment link
        plan: planId,
        credits: plan.credits,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Subscribe error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create subscription' }, { status: 500 });
  }
}

// ─── DELETE /api/billing - Cancel subscription ───────────────

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const parsed = cancelSubscriptionSchema.safeParse(body);
    const cancelAtEnd = parsed.success ? parsed.data.cancelAtEnd : true;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription || !subscription.razorpaySubId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription to cancel' },
        { status: 400 }
      );
    }

    // Cancel on Razorpay
    await cancelSubscription(subscription.razorpaySubId, cancelAtEnd);

    // Update local record
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        status: cancelAtEnd ? 'ACTIVE' : 'CANCELLED', // Will be cancelled at period end
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: cancelAtEnd
          ? 'Subscription will be cancelled at the end of current billing period.'
          : 'Subscription cancelled immediately.',
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
