// ============================================
// Avatar API Routes - Create & List
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getHeyGenClient } from '@/lib/heygen';
import { getPresignedDownloadUrl } from '@/lib/storage/r2';
import { createAvatarSchema } from '@/lib/validations';
import { checkPlanLimits, checkCreditsAvailable, deductCredits, getAvatarTrainingCost } from '@/lib/credits';
import { addToQueue, QUEUE_NAMES } from '@/lib/queue';
import { generateIdempotencyKey } from '@/lib/utils';

// ─── GET /api/avatars - List user's avatars ──────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const avatars = await prisma.avatar.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        consentStatus: true,
        consentUrl: true,
        thumbnailUrl: true,
        heygenAvatarId: true,
        trainingDurationSec: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: avatars });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('List avatars error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list avatars' }, { status: 500 });
  }
}

// ─── POST /api/avatars - Create new avatar ───────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate input
    const parsed = createAvatarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, trainingVideoKey, durationSec } = parsed.data;

    // Check plan limits
    const planCheck = await checkPlanLimits(user.id, 'CREATE_AVATAR');
    if (!planCheck.allowed) {
      return NextResponse.json(
        { success: false, error: planCheck.reason },
        { status: 403 }
      );
    }

    // Check credits
    const trainingCost = getAvatarTrainingCost();
    const creditCheck = await checkCreditsAvailable(user.id, trainingCost);
    if (!creditCheck.available) {
      return NextResponse.json(
        { success: false, error: `Insufficient credits. Need ${trainingCost}, have ${creditCheck.balance}.` },
        { status: 402 }
      );
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey('avatar');

    // Create avatar record
    const avatar = await prisma.avatar.create({
      data: {
        userId: user.id,
        name,
        status: 'UPLOADED',
        trainingVideoKey,
        trainingDurationSec: durationSec,
        idempotencyKey,
      },
    });

    // Get signed URL for HeyGen to access our training video
    const signedVideoUrl = await getPresignedDownloadUrl(trainingVideoKey);

    // Call HeyGen to create avatar
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/heygen`;
    
    try {
      const client = getHeyGenClient();
      const { data: heygenResponse, raw } = await client.createAvatar({
        videoUrl: signedVideoUrl,
        avatarName: name,
        callbackUrl,
        idempotencyKey,
      });

      // Update avatar with HeyGen response
      await prisma.avatar.update({
        where: { id: avatar.id },
        data: {
          heygenAvatarId: heygenResponse.avatar_id,
          heygenGroupId: heygenResponse.avatar_group_id,
          status: heygenResponse.consent_url ? 'CONSENT_REQUIRED' : 'TRAINING',
          consentUrl: heygenResponse.consent_url || null,
          consentStatus: heygenResponse.consent_url ? 'SENT' : 'PENDING',
        },
      });

      // Deduct credits
      await deductCredits(user.id, trainingCost, {
        type: 'AVATAR_TRAINING',
        entityId: avatar.id,
        description: `Avatar training: ${name}`,
      });

      // Create job record
      await prisma.job.create({
        data: {
          userId: user.id,
          type: 'AVATAR_TRAINING',
          status: heygenResponse.consent_url ? 'PENDING' : 'PROCESSING',
          entityId: avatar.id,
          entityType: 'AVATAR',
          idempotencyKey,
          startedAt: new Date(),
        },
      });

      // Store raw response for debugging
      await prisma.webhookLog.create({
        data: {
          source: 'heygen_api_response',
          eventType: 'avatar_create',
          payload: raw as any,
          status: 'received',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: avatar.id,
          name: avatar.name,
          status: heygenResponse.consent_url ? 'CONSENT_REQUIRED' : 'TRAINING',
          heygenAvatarId: heygenResponse.avatar_id,
          consentUrl: heygenResponse.consent_url || null,
          consentRequired: !!heygenResponse.consent_url,
          creditsDeducted: trainingCost,
        },
      }, { status: 201 });
    } catch (heygenError: any) {
      // Update avatar status to failed
      await prisma.avatar.update({
        where: { id: avatar.id },
        data: {
          status: 'FAILED',
          errorMessage: heygenError.message,
        },
      });

      // If HeyGen failed, don't deduct credits
      console.error('HeyGen avatar creation failed:', heygenError);

      return NextResponse.json(
        { 
          success: false, 
          error: 'Avatar creation failed. Please try again.',
          details: heygenError.message,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Create avatar error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
