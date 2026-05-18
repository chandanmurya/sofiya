// ============================================
// Video Status API - Polling endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { pollVideoStatus } from '@/lib/heygen';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const video = await prisma.video.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        outputUrl: true,
        durationSec: true,
        heygenVideoId: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // If in non-terminal state, poll HeyGen
    if (['QUEUED', 'GENERATING', 'PROCESSING'].includes(video.status) && video.heygenVideoId) {
      const pollResult = await pollVideoStatus(params.id);
      if (pollResult.updated) {
        const updated = await prisma.video.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            title: true,
            status: true,
            outputUrl: true,
            durationSec: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
          },
        });
        return NextResponse.json({ success: true, data: updated, polled: true });
      }
    }

    return NextResponse.json({ success: true, data: video, polled: false });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Video status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}
