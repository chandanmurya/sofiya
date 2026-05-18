// ============================================
// Video Generation API Routes - Create & List
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getHeyGenClient } from '@/lib/heygen';
import { createVideoSchema } from '@/lib/validations';
import { checkPlanLimits, checkCreditsAvailable, deductCredits, estimateVideoCost } from '@/lib/credits';
import { generateIdempotencyKey } from '@/lib/utils';

// ─── Aspect ratio mapping ────────────────────────────────────
const ASPECT_RATIO_MAP: Record<string, '9:16' | '16:9' | '1:1'> = {
  'PORTRAIT_9_16': '9:16',
  'LANDSCAPE_16_9': '16:9',
  'SQUARE_1_1': '1:1',
};

const RESOLUTION_MAP: Record<string, '480p' | '720p' | '1080p'> = {
  'SD_480P': '480p',
  'HD_720P': '720p',
  'FHD_1080P': '1080p',
};

// ─── GET /api/videos - List user's videos ────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          aspectRatio: true,
          resolution: true,
          outputUrl: true,
          durationSec: true,
          creditsUsed: true,
          script: true,
          scriptLanguage: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
          avatar: { select: { id: true, name: true } },
          voice: { select: { id: true, name: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('List videos error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list videos' }, { status: 500 });
  }
}

// ─── POST /api/videos - Generate a new video ─────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate input
    const parsed = createVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      title, avatarId, voiceId, script, scriptLanguage,
      aspectRatio, resolution, backgroundColor,
      backgroundImageUrl, transparentBg, templateId,
    } = parsed.data;

    // Verify avatar belongs to user and is READY
    const avatar = await prisma.avatar.findFirst({
      where: { id: avatarId, userId: user.id, status: 'READY' },
    });
    if (!avatar) {
      return NextResponse.json(
        { success: false, error: 'Avatar not found or not ready. Complete avatar training first.' },
        { status: 400 }
      );
    }

    // Verify voice belongs to user and is READY
    const voice = await prisma.voiceClone.findFirst({
      where: { id: voiceId, userId: user.id, status: 'READY' },
    });
    if (!voice) {
      return NextResponse.json(
        { success: false, error: 'Voice not found or not ready. Complete voice cloning first.' },
        { status: 400 }
      );
    }

    // Estimate duration from script (rough: ~150 words/min)
    const wordCount = script.split(/\s+/).length;
    const estimatedDurationSec = Math.ceil((wordCount / 150) * 60);

    // Check plan limits
    const planCheck = await checkPlanLimits(user.id, 'CREATE_VIDEO', {
      durationSec: estimatedDurationSec,
      resolution,
    });
    if (!planCheck.allowed) {
      return NextResponse.json(
        { success: false, error: planCheck.reason },
        { status: 403 }
      );
    }

    // Estimate cost
    const costEstimate = estimateVideoCost({
      durationSec: estimatedDurationSec,
      resolution,
      transparent: transparentBg,
    });

    // Check credits
    const creditCheck = await checkCreditsAvailable(user.id, costEstimate.credits);
    if (!creditCheck.available) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient credits. Need ${costEstimate.credits}, have ${creditCheck.balance}. Upgrade your plan or reduce video length.`,
          estimate: costEstimate,
        },
        { status: 402 }
      );
    }

    const idempotencyKey = generateIdempotencyKey('video');
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/heygen`;

    // Create video record
    const video = await prisma.video.create({
      data: {
        userId: user.id,
        avatarId: avatar.id,
        voiceId: voice.id,
        title,
        status: 'QUEUED',
        script,
        scriptLanguage,
        aspectRatio: aspectRatio as any,
        resolution: resolution as any,
        backgroundColor,
        backgroundImageUrl,
        transparentBg,
        creditsUsed: costEstimate.credits,
        estimatedCost: costEstimate.costInr,
        templateId,
        idempotencyKey,
      },
    });

    // Call HeyGen to generate video
    try {
      const client = getHeyGenClient();
      const { data: heygenResponse, raw } = await client.generateVideo({
        avatarId: avatar.heygenAvatarId!,
        voiceId: voice.heygenVoiceId!,
        script,
        aspectRatio: ASPECT_RATIO_MAP[aspectRatio],
        resolution: RESOLUTION_MAP[resolution],
        backgroundColor,
        backgroundImageUrl,
        transparentBackground: transparentBg,
        callbackUrl,
        idempotencyKey,
      });

      // Update video with HeyGen response
      await prisma.video.update({
        where: { id: video.id },
        data: {
          heygenVideoId: heygenResponse.video_id,
          status: 'GENERATING',
        },
      });

      // Deduct credits
      await deductCredits(user.id, costEstimate.credits, {
        type: 'VIDEO_GENERATION',
        entityId: video.id,
        description: `Video: ${title} (est. ${estimatedDurationSec}s)`,
      });

      // Create job record
      await prisma.job.create({
        data: {
          userId: user.id,
          type: 'VIDEO_GENERATION',
          status: 'PROCESSING',
          entityId: video.id,
          entityType: 'VIDEO',
          idempotencyKey,
          startedAt: new Date(),
        },
      });

      // Store raw response
      await prisma.webhookLog.create({
        data: {
          source: 'heygen_api_response',
          eventType: 'video_generate',
          payload: raw as any,
          status: 'received',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: video.id,
          title: video.title,
          status: 'GENERATING',
          heygenVideoId: heygenResponse.video_id,
          creditsDeducted: costEstimate.credits,
          estimatedDurationSec,
        },
      }, { status: 201 });
    } catch (heygenError: any) {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'FAILED',
          errorMessage: heygenError.message,
        },
      });

      console.error('HeyGen video generation failed:', heygenError);
      return NextResponse.json(
        { success: false, error: 'Video generation failed. Please try again.', details: heygenError.message },
        { status: 502 }
      );
    }
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Create video error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
