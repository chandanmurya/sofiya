// ============================================
// Avatar Status API - Polling endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { pollAvatarStatus } from '@/lib/heygen';

// ─── GET /api/avatars/[id]/status - Poll avatar status ───────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const avatar = await prisma.avatar.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        name: true,
        status: true,
        consentStatus: true,
        consentUrl: true,
        heygenAvatarId: true,
        heygenGroupId: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!avatar) {
      return NextResponse.json(
        { success: false, error: 'Avatar not found' },
        { status: 404 }
      );
    }

    // If in a non-terminal state, try to poll HeyGen for latest
    const nonTerminalStates = ['TRAINING', 'CONSENT_PENDING', 'CONSENT_REQUIRED', 'UPLOADED'];
    if (nonTerminalStates.includes(avatar.status) && avatar.heygenAvatarId) {
      const pollResult = await pollAvatarStatus(params.id);
      if (pollResult.updated) {
        // Re-fetch updated data
        const updated = await prisma.avatar.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            name: true,
            status: true,
            consentStatus: true,
            consentUrl: true,
            heygenAvatarId: true,
            heygenGroupId: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return NextResponse.json({
          success: true,
          data: updated,
          polled: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: avatar,
      polled: false,
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Avatar status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}
