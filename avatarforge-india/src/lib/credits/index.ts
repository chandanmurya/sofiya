// ============================================
// Credits & Cost Control System
// ============================================

import { prisma } from '@/lib/prisma';
import { CreditEstimate } from '@/types';

// ─── Cost Model ──────────────────────────────────────────────
// HeyGen API costs (approximate, per minute):
// - Avatar training: ~$5 per training
// - Voice cloning: ~$1 per clone
// - Video generation: ~$1.50/min (720p), ~$2.50/min (1080p)
//
// Our pricing (with 3x margin for profitability):
// - 1 credit = ₹10 of API cost
// - Avatar training: 50 credits (₹500)
// - Voice cloning: 10 credits (₹100)
// - Video (per minute): 15-25 credits depending on resolution
// ─────────────────────────────────────────────────────────────

const COST_TABLE = {
  AVATAR_TRAINING: 50, // credits
  VOICE_CLONING: 10, // credits
  VIDEO_PER_MINUTE: {
    SD_480P: 10,
    HD_720P: 15,
    FHD_1080P: 25,
  },
} as const;

const INR_PER_CREDIT = 10; // ₹10 per credit internally

export function estimateVideoCost(params: {
  durationSec: number;
  resolution: string;
  transparent?: boolean;
}): CreditEstimate {
  const durationMinutes = Math.ceil(params.durationSec / 60);
  const resolutionKey = params.resolution as keyof typeof COST_TABLE.VIDEO_PER_MINUTE;
  const baseCreditsPerMin = COST_TABLE.VIDEO_PER_MINUTE[resolutionKey] || 15;
  
  // Transparent adds 20% cost
  const transparencyMultiplier = params.transparent ? 1.2 : 1.0;
  
  const credits = Math.ceil(durationMinutes * baseCreditsPerMin * transparencyMultiplier);
  const costInr = credits * INR_PER_CREDIT;

  return {
    credits,
    costInr,
    breakdown: {
      baseCost: baseCreditsPerMin,
      resolutionMultiplier: transparencyMultiplier,
      durationMinutes,
    },
  };
}

export function getAvatarTrainingCost(): number {
  return COST_TABLE.AVATAR_TRAINING;
}

export function getVoiceCloningCost(): number {
  return COST_TABLE.VOICE_CLONING;
}

export async function checkCreditsAvailable(
  userId: string,
  requiredCredits: number
): Promise<{ available: boolean; balance: number; shortfall: number }> {
  const creditBalance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  const balance = creditBalance?.balance || 0;
  const available = balance >= requiredCredits;
  const shortfall = available ? 0 : requiredCredits - balance;

  return { available, balance, shortfall };
}

export async function deductCredits(
  userId: string,
  credits: number,
  params: {
    type: 'AVATAR_TRAINING' | 'VOICE_CLONING' | 'VIDEO_GENERATION';
    entityId: string;
    description?: string;
  }
): Promise<boolean> {
  const { available } = await checkCreditsAvailable(userId, credits);
  if (!available) return false;

  await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: {
        balance: { decrement: credits },
        totalSpent: { increment: credits },
      },
    }),
    prisma.usageRecord.create({
      data: {
        userId,
        type: params.type,
        entityId: params.entityId,
        credits,
        costInr: credits * INR_PER_CREDIT,
        description: params.description,
      },
    }),
  ]);

  return true;
}

export async function addCredits(
  userId: string,
  credits: number
): Promise<void> {
  await prisma.creditBalance.upsert({
    where: { userId },
    update: {
      balance: { increment: credits },
      totalEarned: { increment: credits },
    },
    create: {
      userId,
      balance: credits,
      totalEarned: credits,
    },
  });
}

export async function resetMonthlyCredits(
  userId: string,
  monthlyCredits: number
): Promise<void> {
  await prisma.creditBalance.upsert({
    where: { userId },
    update: {
      balance: monthlyCredits,
      lastResetAt: new Date(),
    },
    create: {
      userId,
      balance: monthlyCredits,
      totalEarned: monthlyCredits,
    },
  });
}

// ─── Plan Limits Check ───────────────────────────────────────

export async function checkPlanLimits(
  userId: string,
  action: 'CREATE_AVATAR' | 'CREATE_VOICE' | 'CREATE_VIDEO',
  params?: { durationSec?: number; resolution?: string }
): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return { allowed: false, reason: 'No active subscription' };
  }

  switch (action) {
    case 'CREATE_AVATAR': {
      const avatarCount = await prisma.avatar.count({
        where: { userId, status: { not: 'FAILED' } },
      });
      if (avatarCount >= subscription.maxAvatars) {
        return {
          allowed: false,
          reason: `Avatar limit reached (${subscription.maxAvatars}). Upgrade your plan.`,
        };
      }
      break;
    }

    case 'CREATE_VOICE': {
      const voiceCount = await prisma.voiceClone.count({
        where: { userId, status: { not: 'FAILED' } },
      });
      if (voiceCount >= subscription.maxVoices) {
        return {
          allowed: false,
          reason: `Voice clone limit reached (${subscription.maxVoices}). Upgrade your plan.`,
        };
      }
      break;
    }

    case 'CREATE_VIDEO': {
      if (params?.durationSec && params.durationSec > subscription.maxVideoDurationSec) {
        return {
          allowed: false,
          reason: `Video duration exceeds plan limit (${subscription.maxVideoDurationSec}s). Upgrade your plan.`,
        };
      }
      // Resolution check
      const resolutionOrder = ['SD_480P', 'HD_720P', 'FHD_1080P'];
      const maxResIdx = resolutionOrder.indexOf(subscription.maxResolution);
      const reqResIdx = resolutionOrder.indexOf(params?.resolution || 'HD_720P');
      if (reqResIdx > maxResIdx) {
        return {
          allowed: false,
          reason: `Resolution ${params?.resolution} not available on your plan. Max: ${subscription.maxResolution}`,
        };
      }
      break;
    }
  }

  return { allowed: true };
}
