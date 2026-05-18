// ============================================
// GET /api/demo/status
// Get free demo status for the current user
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFreeDemoStatus, shouldShowUpgradePrompt } from '@/lib/billing/free-demo';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const status = await getFreeDemoStatus(userId);
    const upgradePrompt = shouldShowUpgradePrompt(status);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        upgradePrompt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to get demo status' }, { status: 500 });
  }
}
