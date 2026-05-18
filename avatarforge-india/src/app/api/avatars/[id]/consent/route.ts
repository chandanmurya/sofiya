// ============================================
// Avatar Consent API - Get/Check consent status
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getHeyGenClient, pollConsentStatus } from '@/lib/heygen';

// ─── GET /api/avatars/[id]/consent - Get consent status ──────

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
        status: true,
        consentUrl: true,
        consentStatus: true,
        consentCompletedAt: true,
        heygenAvatarId: true,
      },
    });

    if (!avatar) {
      return NextResponse.json(
        { success: false, error: 'Avatar not found' },
        { status: 404 }
      );
    }

    // If consent is pending, try polling HeyGen for latest status
    if (avatar.consentStatus === 'SENT' || avatar.consentStatus === 'PENDING') {
      const pollResult = await pollConsentStatus(params.id);
      if (pollResult.updated) {
        // Re-fetch updated avatar
        const updated = await prisma.avatar.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            status: true,
            consentUrl: true,
            consentStatus: true,
            consentCompletedAt: true,
          },
        });
        return NextResponse.json({ success: true, data: updated });
      }
    }

    return NextResponse.json({ success: true, data: avatar });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Consent status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get consent status' }, { status: 500 });
  }
}

// ─── POST /api/avatars/[id]/consent - Request new consent URL ─

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const avatar = await prisma.avatar.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!avatar) {
      return NextResponse.json(
        { success: false, error: 'Avatar not found' },
        { status: 404 }
      );
    }

    if (!avatar.heygenAvatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar not yet submitted to HeyGen' },
        { status: 400 }
      );
    }

    if (avatar.consentStatus === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Consent already completed' },
        { status: 400 }
      );
    }

    // Request consent URL from HeyGen
    const client = getHeyGenClient();
    const { data, raw } = await client.requestConsent(avatar.heygenAvatarId);

    // Update avatar with consent URL
    await prisma.avatar.update({
      where: { id: avatar.id },
      data: {
        consentUrl: data.consent_url,
        consentStatus: 'SENT',
        status: 'CONSENT_PENDING',
      },
    });

    // Log raw response
    await prisma.webhookLog.create({
      data: {
        source: 'heygen_api_response',
        eventType: 'consent_request',
        payload: raw as any,
        status: 'received',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        consentUrl: data.consent_url,
        status: 'SENT',
        message: 'Please complete the consent process by visiting the URL.',
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Request consent error:', error);
    return NextResponse.json({ success: false, error: 'Failed to request consent' }, { status: 500 });
  }
}
