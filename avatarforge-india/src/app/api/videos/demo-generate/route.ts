// ============================================
// POST /api/videos/demo-generate
// Free demo video generation with strict constraints
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkFreeDemoGeneration, deductFreeDemoCredits, FREE_DEMO_CONFIG } from '@/lib/billing/free-demo';
import { getHeyGenClient } from '@/lib/heygen';
import { generateIdempotencyKey } from '@/lib/utils';
import { z } from 'zod';

const demoGenerateSchema = z.object({
  stockAvatarId: z.string().min(1),
  script: z.string().min(5).max(300),
  deviceHash: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    // ── Parse & validate ──
    const body = await req.json();
    const parsed = demoGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { stockAvatarId, script, deviceHash } = parsed.data;

    // ── Verify stock avatar ID ──
    if (!FREE_DEMO_CONFIG.STOCK_AVATAR_IDS.includes(stockAvatarId as any)) {
      return NextResponse.json(
        { error: 'Invalid stock avatar. Free users can only use stock avatars.' },
        { status: 400 }
      );
    }

    // ── Get client IP ──
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') || 'unknown';

    // ── Estimate duration (word count → seconds) ──
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const estSeconds = Math.max(1, Math.min(Math.ceil((wordCount / 150) * 60), FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS));

    // ── Run free demo generation check (all constraints) ──
    const check = await checkFreeDemoGeneration(userId, estSeconds, clientIp, deviceHash);

    if (!check.allowed) {
      return NextResponse.json(
        { success: false, error: check.reason, upgrade: true },
        { status: 403 }
      );
    }

    // ── Create video record ──
    const idempotencyKey = generateIdempotencyKey('demo_video');
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/heygen`;

    const video = await prisma.video.create({
      data: {
        userId,
        avatarId: stockAvatarId, // stock avatar reference
        voiceId: 'stock_voice_default', // use HeyGen's default voice for demo
        title: `Demo Video — ${new Date().toLocaleDateString('en-IN')}`,
        status: 'QUEUED',
        script,
        scriptLanguage: 'en',
        aspectRatio: 'PORTRAIT_9_16',
        resolution: 'HD_720P', // forced 720p for free
        backgroundColor: '#0a0a0f',
        transparentBg: false, // NEVER transparent for free
        secondsUsed: estSeconds,
        idempotencyKey,
      },
    });

    // ── Call HeyGen with cheapest settings ──
    try {
      const client = getHeyGenClient();
      const { data: heygenResponse } = await client.generateVideo({
        avatarId: stockAvatarId,
        voiceId: 'default', // HeyGen stock voice
        script,
        aspectRatio: '9:16',
        resolution: '720p', // cheapest
        backgroundColor: '#0a0a0f',
        transparentBackground: false,
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

      // Deduct free credits
      await deductFreeDemoCredits(userId, estSeconds, {
        videoId: video.id,
        clientIp,
        deviceHash,
      });

      // Create job record
      await prisma.job.create({
        data: {
          userId,
          type: 'VIDEO_GENERATION',
          status: 'PROCESSING',
          entityId: video.id,
          entityType: 'VIDEO',
          idempotencyKey,
          startedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          videoId: video.id,
          status: 'GENERATING',
          secondsUsed: estSeconds,
          watermark: true,
          message: 'Your demo video is being generated!',
        },
      }, { status: 201 });

    } catch (heygenError: any) {
      // If HeyGen fails, mark video as failed (don't deduct credits)
      await prisma.video.update({
        where: { id: video.id },
        data: { status: 'FAILED', errorMessage: heygenError.message },
      });

      console.error('[Demo Generate] HeyGen error:', heygenError.message);
      return NextResponse.json(
        { success: false, error: 'Video generation failed. Please try again in a moment.' },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('[Demo Generate] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error.message },
      { status: 500 }
    );
  }
}
