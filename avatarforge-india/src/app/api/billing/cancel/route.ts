// ============================================
// POST /api/billing/cancel
// Cancel subscription (at cycle end by default)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelRazorpaySubscription } from '@/lib/billing/razorpay';
import { z } from 'zod';

const cancelSchema = z.object({
  immediate: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const body = await req.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);
    const immediate = parsed.success ? parsed.data.immediate : false;

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.razorpaySubId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    if (!['ACTIVE', 'GRACE', 'CREATED'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Subscription is not in a cancellable state' },
        { status: 400 }
      );
    }

    // Cancel on Razorpay (at cycle end unless immediate)
    await cancelRazorpaySubscription(subscription.razorpaySubId, !immediate);

    // Update local status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: immediate ? 'INACTIVE' : 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: immediate
          ? 'Subscription cancelled immediately. Access has been revoked.'
          : 'Subscription will be cancelled at the end of the current billing period. You retain access until then.',
        activeUntil: immediate ? null : subscription.currentPeriodEnd?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Cancel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription', details: error.message },
      { status: 500 }
    );
  }
}
