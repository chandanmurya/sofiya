// ============================================
// Voice Clone API Routes - Create & List
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getHeyGenClient } from '@/lib/heygen';
import { getPresignedDownloadUrl } from '@/lib/storage/r2';
import { createVoiceSchema } from '@/lib/validations';
import { checkPlanLimits, checkCreditsAvailable, deductCredits, getVoiceCloningCost } from '@/lib/credits';
import { generateIdempotencyKey } from '@/lib/utils';

// ─── GET /api/voices - List user's voice clones ──────────────

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const voices = await prisma.voiceClone.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        language: true,
        sourceType: true,
        heygenVoiceId: true,
        audioDurationSec: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: voices });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('List voices error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list voices' }, { status: 500 });
  }
}

// ─── POST /api/voices - Clone a new voice ────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate input
    const parsed = createVoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, audioKey, language, sourceType, durationSec } = parsed.data;

    // Check plan limits
    const planCheck = await checkPlanLimits(user.id, 'CREATE_VOICE');
    if (!planCheck.allowed) {
      return NextResponse.json(
        { success: false, error: planCheck.reason },
        { status: 403 }
      );
    }

    // Check credits
    const cloningCost = getVoiceCloningCost();
    const creditCheck = await checkCreditsAvailable(user.id, cloningCost);
    if (!creditCheck.available) {
      return NextResponse.json(
        { success: false, error: `Insufficient credits. Need ${cloningCost}, have ${creditCheck.balance}.` },
        { status: 402 }
      );
    }

    const idempotencyKey = generateIdempotencyKey('voice');

    // Create voice record
    const voice = await prisma.voiceClone.create({
      data: {
        userId: user.id,
        name,
        status: 'UPLOADED',
        audioKey,
        audioDurationSec: durationSec,
        language,
        sourceType: sourceType as any,
        idempotencyKey,
      },
    });

    // Get signed URL for HeyGen to access our audio
    const signedAudioUrl = await getPresignedDownloadUrl(audioKey);

    // Call HeyGen to clone voice
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/heygen`;

    try {
      const client = getHeyGenClient();
      const { data: heygenResponse, raw } = await client.cloneVoice({
        audioUrl: signedAudioUrl,
        voiceName: name,
        language: language === 'hinglish' ? 'hi' : language,
        callbackUrl,
      });

      // Update voice with HeyGen response
      await prisma.voiceClone.update({
        where: { id: voice.id },
        data: {
          heygenVoiceId: heygenResponse.voice_id,
          status: 'CLONING',
        },
      });

      // Deduct credits
      await deductCredits(user.id, cloningCost, {
        type: 'VOICE_CLONING',
        entityId: voice.id,
        description: `Voice cloning: ${name}`,
      });

      // Create job record
      await prisma.job.create({
        data: {
          userId: user.id,
          type: 'VOICE_CLONING',
          status: 'PROCESSING',
          entityId: voice.id,
          entityType: 'VOICE',
          idempotencyKey,
          startedAt: new Date(),
        },
      });

      // Store raw response
      await prisma.webhookLog.create({
        data: {
          source: 'heygen_api_response',
          eventType: 'voice_clone',
          payload: raw as any,
          status: 'received',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: voice.id,
          name: voice.name,
          status: 'CLONING',
          heygenVoiceId: heygenResponse.voice_id,
          creditsDeducted: cloningCost,
        },
      }, { status: 201 });
    } catch (heygenError: any) {
      await prisma.voiceClone.update({
        where: { id: voice.id },
        data: {
          status: 'FAILED',
          errorMessage: heygenError.message,
        },
      });

      console.error('HeyGen voice clone failed:', heygenError);
      return NextResponse.json(
        { success: false, error: 'Voice cloning failed. Please try again.', details: heygenError.message },
        { status: 502 }
      );
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Create voice error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
