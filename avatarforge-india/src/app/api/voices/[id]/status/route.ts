// ============================================
// Voice Status API - Polling endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { pollVoiceStatus } from '@/lib/heygen';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const voice = await prisma.voiceClone.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        name: true,
        status: true,
        language: true,
        heygenVoiceId: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!voice) {
      return NextResponse.json(
        { success: false, error: 'Voice not found' },
        { status: 404 }
      );
    }

    // Poll if in non-terminal state
    if (['CLONING', 'UPLOADED'].includes(voice.status) && voice.heygenVoiceId) {
      const pollResult = await pollVoiceStatus(params.id);
      if (pollResult.updated) {
        const updated = await prisma.voiceClone.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            name: true,
            status: true,
            language: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return NextResponse.json({ success: true, data: updated, polled: true });
      }
    }

    return NextResponse.json({ success: true, data: voice, polled: false });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}
