// ============================================
// GET /api/billing
// Get current subscription, wallet, and plan info
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlans, getTopupOptions, computeAvatarSetupPrice } from '@/lib/billing/profitability';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const [subscription, wallet, recentInvoices, recentUsage] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.creditWallet.findUnique({ where: { userId } }),
      prisma.invoice.findMany({
        where: { subscription: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.usageLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Compute whether subscription is truly active
    const isActive = subscription
      ? ['ACTIVE', 'GRACE', 'CANCELLED'].includes(subscription.status)
      : false;

    // Is in grace or blocked?
    const isBlocked = subscription?.status === 'PAST_DUE' || subscription?.status === 'INACTIVE';
    const isGrace = subscription?.status === 'GRACE';

    return NextResponse.json({
      success: true,
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              plan: subscription.plan,
              status: subscription.status,
              monthlyIncludedSeconds: subscription.monthlyIncludedSeconds,
              maxResolution: subscription.maxResolution,
              priorityQueue: subscription.priorityQueue,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelledAt: subscription.cancelledAt,
              gracePeriodEnd: subscription.gracePeriodEnd,
            }
          : null,
        wallet: wallet
          ? {
              monthlyIncludedSeconds: wallet.monthlyIncludedSeconds,
              monthlyRemaining: wallet.monthlyRemaining,
              topupSeconds: wallet.topupSeconds,
              totalAvailable: wallet.monthlyRemaining + wallet.topupSeconds,
              totalSecondsEarned: wallet.totalSecondsEarned,
              totalSecondsSpent: wallet.totalSecondsSpent,
              monthlyResetAt: wallet.monthlyResetAt,
            }
          : {
              monthlyIncludedSeconds: 0,
              monthlyRemaining: 0,
              topupSeconds: 0,
              totalAvailable: 0,
              totalSecondsEarned: 0,
              totalSecondsSpent: 0,
            },
        isActive,
        isBlocked,
        isGrace,
        plans: getPlans(),
        topupOptions: getTopupOptions(),
        avatarSetupPrice: computeAvatarSetupPrice(),
        invoices: recentInvoices.map((inv) => ({
          id: inv.id,
          amount: inv.amount,
          currency: inv.currency,
          status: inv.status,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        })),
        recentUsage: recentUsage.map((u) => ({
          id: u.id,
          secondsUsed: u.secondsUsed,
          source: u.source,
          costEstimateInr: u.costEstimateInr,
          description: u.description,
          createdAt: u.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Billing GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}
