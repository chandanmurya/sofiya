// ============================================
// Free Demo Mode — Logic & Constraints
// ============================================
//
// Free Demo Mode is optimized for user acquisition and virality
// WITHOUT hurting profitability.
//
// Constraints:
// - 15 seconds LIFETIME (never resets)
// - Stock avatars ONLY (no custom Digital Twin)
// - 720p ONLY
// - Watermark enabled ("Made with AvatarForge")
// - No voice cloning
// - No transparent WEBM export
// - No 4K
// - Max 1 concurrent generation
// - Limited templates only
// - Generation hard cap = 15 seconds per video
//
// Abuse Prevention:
// - Lifetime credits (not monthly)
// - IP rate limiting (1 generation per 5 minutes for free users)
// - Device fingerprint hash tracking
// - Abuse score incremented on suspicious patterns
// - Admin flagging system
// - Block account farming (multiple accounts same device/IP)

import { prisma } from '@/lib/prisma';

// ─── Constants ───────────────────────────────────────────────

export const FREE_DEMO_CONFIG = {
  /** Total lifetime seconds for free users (never resets) */
  LIFETIME_SECONDS: 15,

  /** Maximum seconds per single video for free users */
  MAX_VIDEO_SECONDS: 15,

  /** Maximum concurrent generations for free users */
  MAX_CONCURRENT_GENERATIONS: 1,

  /** Cooldown between generations for free users (ms) */
  GENERATION_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes

  /** IP-based rate limit: max generations per IP per day */
  IP_DAILY_GENERATION_LIMIT: 3,

  /** Device hash: max accounts per device hash */
  MAX_ACCOUNTS_PER_DEVICE: 2,

  /** Resolution cap for free users */
  MAX_RESOLUTION: 'HD_720P' as const,

  /** Watermark text */
  WATERMARK_TEXT: 'Made with AvatarForge',

  /** Abuse score threshold for auto-block */
  ABUSE_SCORE_BLOCK_THRESHOLD: 10,

  /** Use cheapest HeyGen settings for free users */
  HEYGEN_SETTINGS: {
    resolution: '720p' as const,
    priority: 'low',
  },

  /** Limited template IDs available to free users */
  FREE_TEMPLATE_IDS: [
    'reel-en',
    'reel-hi',
    'promo',
  ],

  /** Stock avatar IDs (these are HeyGen's public/stock avatars) */
  STOCK_AVATAR_IDS: [
    'stock_avatar_1',
    'stock_avatar_2',
    'stock_avatar_3',
    'stock_avatar_4',
  ],
} as const;

// ─── Types ───────────────────────────────────────────────────

export interface FreeDemoStatus {
  isFreeUser: boolean;
  creditsRemaining: number;
  creditsUsed: number;
  canGenerate: boolean;
  blockReason?: string;
  onboardingCompleted: boolean;
  freeDemoUsed: boolean;
}

export interface FreeDemoGenerationCheck {
  allowed: boolean;
  reason?: string;
  secondsAvailable: number;
  watermarkRequired: boolean;
  maxResolution: string;
  maxDurationSec: number;
}

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  abuseScore: number;
  action?: 'ALLOW' | 'WARN' | 'BLOCK' | 'FLAG_ADMIN';
}

// ─── Core Functions ──────────────────────────────────────────

/**
 * Check if a user is on the free demo tier.
 */
export function isFreeDemoUser(user: {
  accountType: string;
  subscription?: { status: string } | null;
}): boolean {
  return user.accountType === 'FREE_DEMO' && (
    !user.subscription ||
    !['ACTIVE', 'GRACE', 'CANCELLED'].includes(user.subscription.status)
  );
}

/**
 * Get the full free demo status for a user.
 */
export async function getFreeDemoStatus(userId: string): Promise<FreeDemoStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountType: true,
      freeCreditsRemaining: true,
      freeDemoUsed: true,
      onboardingCompleted: true,
      abuseScore: true,
      adminFlagged: true,
      subscription: { select: { status: true } },
    },
  });

  if (!user) {
    return {
      isFreeUser: true,
      creditsRemaining: 0,
      creditsUsed: 15,
      canGenerate: false,
      blockReason: 'User not found',
      onboardingCompleted: false,
      freeDemoUsed: false,
    };
  }

  const isFree = isFreeDemoUser({
    accountType: user.accountType,
    subscription: user.subscription,
  });

  if (!isFree) {
    return {
      isFreeUser: false,
      creditsRemaining: 0,
      creditsUsed: 0,
      canGenerate: true, // paid users use normal credit system
      onboardingCompleted: user.onboardingCompleted,
      freeDemoUsed: user.freeDemoUsed,
    };
  }

  const creditsUsed = FREE_DEMO_CONFIG.LIFETIME_SECONDS - user.freeCreditsRemaining;
  let canGenerate = user.freeCreditsRemaining > 0;
  let blockReason: string | undefined;

  if (user.adminFlagged) {
    canGenerate = false;
    blockReason = 'Account flagged for review. Contact support.';
  } else if (user.abuseScore >= FREE_DEMO_CONFIG.ABUSE_SCORE_BLOCK_THRESHOLD) {
    canGenerate = false;
    blockReason = 'Account restricted due to suspicious activity.';
  } else if (user.freeCreditsRemaining <= 0) {
    canGenerate = false;
    blockReason = 'Free demo credits exhausted. Upgrade to continue.';
  }

  return {
    isFreeUser: true,
    creditsRemaining: user.freeCreditsRemaining,
    creditsUsed,
    canGenerate,
    blockReason,
    onboardingCompleted: user.onboardingCompleted,
    freeDemoUsed: user.freeDemoUsed,
  };
}

/**
 * Pre-flight check before allowing a free user to generate a video.
 * Returns detailed constraints.
 */
export async function checkFreeDemoGeneration(
  userId: string,
  requestedSeconds: number,
  clientIp: string,
  deviceHash?: string
): Promise<FreeDemoGenerationCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountType: true,
      freeCreditsRemaining: true,
      abuseScore: true,
      adminFlagged: true,
      lastGenerationIp: true,
      deviceHash: true,
      subscription: { select: { status: true } },
    },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found', secondsAvailable: 0, watermarkRequired: true, maxResolution: '720p', maxDurationSec: 0 };
  }

  // Not a free user — don't apply free constraints
  if (!isFreeDemoUser({ accountType: user.accountType, subscription: user.subscription })) {
    return { allowed: true, secondsAvailable: 999, watermarkRequired: false, maxResolution: '1080p', maxDurationSec: 600 };
  }

  // ── Check admin flag ──
  if (user.adminFlagged) {
    return { allowed: false, reason: 'Account flagged. Contact support.', secondsAvailable: 0, watermarkRequired: true, maxResolution: '720p', maxDurationSec: 0 };
  }

  // ── Check abuse score ──
  if (user.abuseScore >= FREE_DEMO_CONFIG.ABUSE_SCORE_BLOCK_THRESHOLD) {
    return { allowed: false, reason: 'Account restricted.', secondsAvailable: 0, watermarkRequired: true, maxResolution: '720p', maxDurationSec: 0 };
  }

  // ── Check remaining credits ──
  if (user.freeCreditsRemaining <= 0) {
    return { allowed: false, reason: 'Free credits exhausted. Upgrade to continue generating.', secondsAvailable: 0, watermarkRequired: true, maxResolution: '720p', maxDurationSec: 0 };
  }

  // ── Check requested duration cap ──
  const effectiveSeconds = Math.min(requestedSeconds, user.freeCreditsRemaining, FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS);
  if (requestedSeconds > FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS) {
    return { allowed: false, reason: `Free demo limited to ${FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS}s max. Upgrade for longer videos.`, secondsAvailable: user.freeCreditsRemaining, watermarkRequired: true, maxResolution: '720p', maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS };
  }

  // ── Check concurrent generations ──
  const activeGenerations = await prisma.video.count({
    where: {
      userId,
      status: { in: ['QUEUED', 'GENERATING', 'PROCESSING'] },
    },
  });
  if (activeGenerations >= FREE_DEMO_CONFIG.MAX_CONCURRENT_GENERATIONS) {
    return { allowed: false, reason: 'Please wait for your current video to finish. Free users can generate 1 video at a time.', secondsAvailable: user.freeCreditsRemaining, watermarkRequired: true, maxResolution: '720p', maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS };
  }

  // ── Check generation cooldown ──
  const lastVideo = await prisma.video.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (lastVideo) {
    const elapsed = Date.now() - lastVideo.createdAt.getTime();
    if (elapsed < FREE_DEMO_CONFIG.GENERATION_COOLDOWN_MS) {
      const waitSec = Math.ceil((FREE_DEMO_CONFIG.GENERATION_COOLDOWN_MS - elapsed) / 1000);
      return { allowed: false, reason: `Please wait ${waitSec}s before generating again. Upgrade for unlimited.`, secondsAvailable: user.freeCreditsRemaining, watermarkRequired: true, maxResolution: '720p', maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS };
    }
  }

  // ── IP rate limit check ──
  const ipAbuseCheck = await checkIpRateLimit(clientIp);
  if (!ipAbuseCheck.allowed) {
    return { allowed: false, reason: ipAbuseCheck.reason, secondsAvailable: user.freeCreditsRemaining, watermarkRequired: true, maxResolution: '720p', maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS };
  }

  // ── Device hash check ──
  if (deviceHash) {
    const deviceCheck = await checkDeviceAbuse(userId, deviceHash);
    if (!deviceCheck.allowed) {
      return { allowed: false, reason: deviceCheck.reason, secondsAvailable: user.freeCreditsRemaining, watermarkRequired: true, maxResolution: '720p', maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS };
    }
  }

  return {
    allowed: true,
    secondsAvailable: user.freeCreditsRemaining,
    watermarkRequired: true,
    maxResolution: FREE_DEMO_CONFIG.MAX_RESOLUTION,
    maxDurationSec: FREE_DEMO_CONFIG.MAX_VIDEO_SECONDS,
  };
}

/**
 * Deduct free demo credits after successful generation.
 * Lifetime-based: once consumed, they never come back.
 */
export async function deductFreeDemoCredits(
  userId: string,
  secondsUsed: number,
  params: { videoId: string; clientIp: string; deviceHash?: string }
): Promise<{ success: boolean; remaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { freeCreditsRemaining: true },
  });

  if (!user || user.freeCreditsRemaining < secondsUsed) {
    return { success: false, remaining: user?.freeCreditsRemaining || 0 };
  }

  const result = await prisma.user.update({
    where: { id: userId },
    data: {
      freeCreditsRemaining: { decrement: secondsUsed },
      freeDemoUsed: true,
      lastGenerationIp: params.clientIp,
      ...(params.deviceHash && { deviceHash: params.deviceHash }),
    },
  });

  return { success: true, remaining: result.freeCreditsRemaining };
}

/**
 * Mark onboarding as completed.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });
}

// ─── Abuse Prevention ────────────────────────────────────────

/**
 * Check if an IP has exceeded daily generation limits for free users.
 */
async function checkIpRateLimit(ip: string): Promise<{ allowed: boolean; reason?: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count generations from this IP today (across ALL free users)
  const count = await prisma.video.count({
    where: {
      createdAt: { gte: today },
      user: {
        lastGenerationIp: ip,
        accountType: 'FREE_DEMO',
      },
    },
  });

  if (count >= FREE_DEMO_CONFIG.IP_DAILY_GENERATION_LIMIT) {
    return { allowed: false, reason: 'Too many generations from this network today. Try again tomorrow or upgrade.' };
  }

  return { allowed: true };
}

/**
 * Check for device-based account farming.
 * If the same device hash has been used to create multiple accounts,
 * flag as suspicious.
 */
async function checkDeviceAbuse(
  userId: string,
  deviceHash: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Count how many accounts use this device hash
  const accountsWithDevice = await prisma.user.count({
    where: {
      deviceHash,
      id: { not: userId },
      accountType: 'FREE_DEMO',
    },
  });

  if (accountsWithDevice >= FREE_DEMO_CONFIG.MAX_ACCOUNTS_PER_DEVICE) {
    // Increment abuse score for this user
    await prisma.user.update({
      where: { id: userId },
      data: { abuseScore: { increment: 3 } },
    });

    return { allowed: false, reason: 'Suspicious activity detected. Please sign up with a unique account.' };
  }

  return { allowed: true };
}

/**
 * Run a full abuse check combining all signals.
 * Called during registration and before generation.
 */
export async function runAbuseCheck(params: {
  userId: string;
  ip: string;
  deviceHash?: string;
  email?: string;
}): Promise<AbuseCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { abuseScore: true, adminFlagged: true, deviceHash: true, createdAt: true },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found', abuseScore: 0, action: 'BLOCK' };
  }

  let score = user.abuseScore;

  // Check: rapid account creation from same IP
  const recentAccountsFromIp = await prisma.user.count({
    where: {
      lastGenerationIp: params.ip,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentAccountsFromIp > 3) {
    score += 2;
  }

  // Check: disposable email patterns
  if (params.email) {
    const disposablePatterns = ['tempmail', 'guerrilla', 'throwaway', 'yopmail', 'mailinator', '10minutemail'];
    if (disposablePatterns.some((p) => params.email!.toLowerCase().includes(p))) {
      score += 5;
    }
  }

  // Check: device hash farming
  if (params.deviceHash) {
    const deviceAccounts = await prisma.user.count({
      where: { deviceHash: params.deviceHash },
    });
    if (deviceAccounts > FREE_DEMO_CONFIG.MAX_ACCOUNTS_PER_DEVICE) {
      score += 4;
    }
  }

  // Update score
  if (score !== user.abuseScore) {
    await prisma.user.update({
      where: { id: params.userId },
      data: { abuseScore: score },
    });
  }

  // Determine action
  if (user.adminFlagged || score >= FREE_DEMO_CONFIG.ABUSE_SCORE_BLOCK_THRESHOLD) {
    return { allowed: false, reason: 'Account restricted.', abuseScore: score, action: 'BLOCK' };
  }

  if (score >= 7) {
    // Flag for admin review but still allow
    await prisma.user.update({
      where: { id: params.userId },
      data: { adminFlagged: true, flagReason: `Auto-flagged: abuse score ${score}` },
    });
    return { allowed: true, abuseScore: score, action: 'FLAG_ADMIN' };
  }

  if (score >= 4) {
    return { allowed: true, abuseScore: score, action: 'WARN' };
  }

  return { allowed: true, abuseScore: score, action: 'ALLOW' };
}

// ─── Admin Helpers ───────────────────────────────────────────

/**
 * Flag a user for admin review.
 */
export async function adminFlagUser(userId: string, reason: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { adminFlagged: true, flagReason: reason },
  });
}

/**
 * Unflag a user and reset abuse score.
 */
export async function adminUnflagUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { adminFlagged: false, flagReason: null, abuseScore: 0 },
  });
}

/**
 * Get all flagged users for admin review.
 */
export async function getFlaggedUsers() {
  return prisma.user.findMany({
    where: {
      OR: [
        { adminFlagged: true },
        { abuseScore: { gte: FREE_DEMO_CONFIG.ABUSE_SCORE_BLOCK_THRESHOLD } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      abuseScore: true,
      adminFlagged: true,
      flagReason: true,
      deviceHash: true,
      lastGenerationIp: true,
      freeCreditsRemaining: true,
      freeDemoUsed: true,
      createdAt: true,
    },
    orderBy: { abuseScore: 'desc' },
    take: 50,
  });
}

// ─── Upgrade Helpers ─────────────────────────────────────────

/**
 * When a user subscribes, transition them from FREE_DEMO to SUBSCRIBED.
 */
export async function upgradeFreeUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { accountType: 'SUBSCRIBED' },
  });
}

/**
 * Check if user should see upgrade prompts.
 */
export function shouldShowUpgradePrompt(demoStatus: FreeDemoStatus): {
  show: boolean;
  urgency: 'low' | 'medium' | 'high';
  message?: string;
} {
  if (!demoStatus.isFreeUser) return { show: false, urgency: 'low' };

  if (demoStatus.creditsRemaining <= 0) {
    return {
      show: true,
      urgency: 'high',
      message: 'Your free credits are used up! Upgrade to keep creating.',
    };
  }

  if (demoStatus.freeDemoUsed && demoStatus.creditsRemaining <= 5) {
    return {
      show: true,
      urgency: 'medium',
      message: `Only ${demoStatus.creditsRemaining}s left. Unlock unlimited with a plan.`,
    };
  }

  if (demoStatus.freeDemoUsed) {
    return {
      show: true,
      urgency: 'low',
      message: 'Enjoying AvatarForge? Upgrade for longer videos, custom avatars & more.',
    };
  }

  return { show: false, urgency: 'low' };
}
