// ============================================
// Admin API - Dashboard stats & management
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

// ─── GET /api/admin - Get admin dashboard stats ──────────────

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      activeSubscriptions,
      totalVideos,
      failedJobs,
      thisMonthRevenue,
      lastMonthRevenue,
      thisMonthUsage,
      lastMonthUsage,
      recentFailedJobs,
      topUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', plan: { not: 'FREE' } } }),
      prisma.video.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: 'FAILED' } }),
      prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { amount: true },
      }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: thisMonthStart } },
        _sum: { costInr: true },
      }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { costInr: true },
      }),
      prisma.job.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.usageRecord.groupBy({
        by: ['userId'],
        _sum: { credits: true },
        orderBy: { _sum: { credits: 'desc' } },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeSubscriptions,
          totalVideosGenerated: totalVideos,
          failedJobs,
          revenue: {
            thisMonth: (thisMonthRevenue._sum.amount || 0) / 100, // paise to INR
            lastMonth: (lastMonthRevenue._sum.amount || 0) / 100,
          },
          apiCosts: {
            thisMonth: thisMonthUsage._sum.costInr || 0,
            lastMonth: lastMonthUsage._sum.costInr || 0,
          },
        },
        recentFailedJobs,
        topUsers,
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode || 401 });
    }
    console.error('Admin stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get admin stats' }, { status: 500 });
  }
}
