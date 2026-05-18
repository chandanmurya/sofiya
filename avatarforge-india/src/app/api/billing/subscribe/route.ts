// ============================================
// POST /api/billing/subscribe
// Create a new Razorpay subscription
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRazorpaySubscription, getRazorpayPlanId } from '@/lib/billing/razorpay';
import { getPlans } from '@/lib/billing/profitability';
import { z } from 'zod';

const subscribeSchema = z.object({
  planType: z.enum(['STARTER', 'CREATOR', 'STUDIO']),
});

export async function POST(req: NextRequest) {
  try {
    // Auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const userEmail = session.user.email!;

    // Validate input
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan type', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { planType } = parsed.data;

    // Check existing subscription
    const existing = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing && ['ACTIVE', 'GRACE'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Cancel it first to switch plans.' },
        { status: 409 }
      );
    }

    // Get plan details
    const plans = getPlans();
    const plan = plans.find((p) => p.id === planType);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Create Razorpay subscription
    const result = await createRazorpaySubscription({
      planType,
      customerEmail: userEmail,
      userId,
    });

    // Upsert local subscription record (status: CREATED until webhook activates it)
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        razorpaySubId: result.subscriptionId,
        razorpayPlanId: getRazorpayPlanId(planType),
        plan: planType,
        status: 'CREATED',
        monthlyIncludedSeconds: plan.includedSeconds,
        maxResolution: plan.maxResolution,
        priorityQueue: plan.priorityQueue,
      },
      create: {
        userId,
        razorpaySubId: result.subscriptionId,
        razorpayPlanId: getRazorpayPlanId(planType),
        plan: planType,
        status: 'CREATED',
        monthlyIncludedSeconds: plan.includedSeconds,
        maxResolution: plan.maxResolution,
        priorityQueue: plan.priorityQueue,
      },
    });

    // Ensure credit wallet exists
    await prisma.creditWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        monthlyIncludedSeconds: plan.includedSeconds,
        monthlyRemaining: 0, // will be set when subscription.activated webhook fires
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        shortUrl: result.shortUrl, // Razorpay hosted payment page
        plan: planType,
        priceINR: plan.priceINR,
        includedSeconds: plan.includedSeconds,
      },
    });
  } catch (error: any) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: error.message },
      { status: 500 }
    );
  }
}
