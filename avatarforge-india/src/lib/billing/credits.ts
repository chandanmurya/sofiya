// ============================================
// Credit Wallet Operations
// ============================================
// 1 credit = 1 second of video output.
// Monthly credits are consumed first, then topup seconds.
// Hard stop: no generation if credits < requested seconds.

import { prisma } from '@/lib/prisma';
import { validateCreditSufficiency, getCostPerSecondINR, BILLING_CONFIG } from './profitability';

// ─── Types ───────────────────────────────────────────────────

export interface DeductionResult {
  success: boolean;
  error?: string;
  secondsDeducted: number;
  fromMonthly: number;
  fromTopup: number;
  remainingMonthly: number;
  remainingTopup: number;
}

export interface WalletSnapshot {
  monthlyRemaining: number;
  topupSeconds: number;
  totalAvailable: number;
  monthlyIncludedSeconds: number;
}

// ─── Get Wallet ──────────────────────────────────────────────

export async function getWallet(userId: string): Promise<WalletSnapshot> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    return {
      monthlyRemaining: 0,
      topupSeconds: 0,
      totalAvailable: 0,
      monthlyIncludedSeconds: 0,
    };
  }

  // Expire topup seconds if past expiry (check TopupPurchase records)
  // This is a lightweight check - full cleanup runs in a cron
  return {
    monthlyRemaining: wallet.monthlyRemaining,
    topupSeconds: wallet.topupSeconds,
    totalAvailable: wallet.monthlyRemaining + wallet.topupSeconds,
    monthlyIncludedSeconds: wallet.monthlyIncludedSeconds,
  };
}

// ─── Pre-flight Check ────────────────────────────────────────
// Call BEFORE starting video generation to ensure sufficient credits.

export async function checkSufficientCredits(
  userId: string,
  requestedSeconds: number
): Promise<{
  allowed: boolean;
  reason?: string;
  wallet: WalletSnapshot;
  useMonthly: number;
  useTopup: number;
}> {
  const wallet = await getWallet(userId);

  const check = validateCreditSufficiency(
    requestedSeconds,
    wallet.monthlyRemaining,
    wallet.topupSeconds
  );

  return {
    allowed: check.allowed,
    reason: check.reason,
    wallet,
    useMonthly: check.useMonthly,
    useTopup: check.useTopup,
  };
}

// ─── Deduct Credits ──────────────────────────────────────────
// Atomically deduct seconds from wallet. Uses transaction to prevent races.
// Consumes monthly first, then topup.

export async function deductCredits(
  userId: string,
  seconds: number,
  params: {
    videoId?: string;
    jobId?: string;
    description?: string;
  }
): Promise<DeductionResult> {
  // Pre-check
  const wallet = await getWallet(userId);
  const check = validateCreditSufficiency(
    seconds,
    wallet.monthlyRemaining,
    wallet.topupSeconds
  );

  if (!check.allowed) {
    return {
      success: false,
      error: check.reason,
      secondsDeducted: 0,
      fromMonthly: 0,
      fromTopup: 0,
      remainingMonthly: wallet.monthlyRemaining,
      remainingTopup: wallet.topupSeconds,
    };
  }

  const costEstimate = seconds * getCostPerSecondINR();

  // Atomic transaction: deduct + log
  const result = await prisma.$transaction(async (tx) => {
    // Re-read wallet inside transaction for consistency
    const currentWallet = await tx.creditWallet.findUnique({
      where: { userId },
    });

    if (!currentWallet) {
      throw new Error('Wallet not found');
    }

    // Re-validate inside transaction
    const recheck = validateCreditSufficiency(
      seconds,
      currentWallet.monthlyRemaining,
      currentWallet.topupSeconds
    );

    if (!recheck.allowed) {
      throw new Error(recheck.reason || 'Insufficient credits');
    }

    const { useMonthly, useTopup } = recheck;

    // Deduct from wallet
    await tx.creditWallet.update({
      where: { userId },
      data: {
        monthlyRemaining: { decrement: useMonthly },
        topupSeconds: { decrement: useTopup },
        totalSecondsSpent: { increment: seconds },
      },
    });

    // Log usage from monthly bucket
    if (useMonthly > 0) {
      await tx.usageLedger.create({
        data: {
          userId,
          videoId: params.videoId,
          jobId: params.jobId,
          secondsUsed: useMonthly,
          source: 'MONTHLY',
          costEstimateInr: useMonthly * getCostPerSecondINR(),
          description: params.description || `Video generation (monthly credits)`,
        },
      });
    }

    // Log usage from topup bucket
    if (useTopup > 0) {
      await tx.usageLedger.create({
        data: {
          userId,
          videoId: params.videoId,
          jobId: params.jobId,
          secondsUsed: useTopup,
          source: 'TOPUP',
          costEstimateInr: useTopup * getCostPerSecondINR(),
          description: params.description || `Video generation (top-up credits)`,
        },
      });
    }

    return {
      useMonthly,
      useTopup,
      remainingMonthly: currentWallet.monthlyRemaining - useMonthly,
      remainingTopup: currentWallet.topupSeconds - useTopup,
    };
  });

  return {
    success: true,
    secondsDeducted: seconds,
    fromMonthly: result.useMonthly,
    fromTopup: result.useTopup,
    remainingMonthly: result.remainingMonthly,
    remainingTopup: result.remainingTopup,
  };
}

// ─── Refund Credits ──────────────────────────────────────────
// Used when a video generation fails after deduction.
// Refunds to monthly bucket first (up to included limit), overflow to topup.

export async function refundCredits(
  userId: string,
  seconds: number,
  params: {
    videoId?: string;
    reason: string;
  }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({
      where: { userId },
    });

    if (!wallet) return;

    // Refund to monthly first (up to cap)
    const monthlySpace = wallet.monthlyIncludedSeconds - wallet.monthlyRemaining;
    const refundToMonthly = Math.min(seconds, monthlySpace);
    const refundToTopup = seconds - refundToMonthly;

    await tx.creditWallet.update({
      where: { userId },
      data: {
        monthlyRemaining: { increment: refundToMonthly },
        topupSeconds: { increment: refundToTopup },
        totalSecondsSpent: { decrement: seconds },
      },
    });

    // Log refund
    await tx.usageLedger.create({
      data: {
        userId,
        videoId: params.videoId,
        secondsUsed: -seconds, // negative = refund
        source: 'MONTHLY', // source doesn't matter for refunds
        costEstimateInr: -(seconds * getCostPerSecondINR()),
        description: `Refund: ${params.reason}`,
      },
    });
  });
}

// ─── Check Subscription Active ───────────────────────────────
// Hard gate: block all video generation if subscription is not active.

export async function isSubscriptionActive(userId: string): Promise<{
  active: boolean;
  status: string;
  reason?: string;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return { active: false, status: 'NONE', reason: 'No subscription found. Please subscribe to a plan.' };
  }

  switch (subscription.status) {
    case 'ACTIVE':
      return { active: true, status: 'ACTIVE' };

    case 'CANCELLED':
      // Still active until period end
      if (subscription.currentPeriodEnd && new Date() < subscription.currentPeriodEnd) {
        return { active: true, status: 'CANCELLED' };
      }
      return { active: false, status: 'INACTIVE', reason: 'Subscription has expired. Please renew.' };

    case 'GRACE':
      // Still allowed during grace period
      if (subscription.gracePeriodEnd && new Date() < subscription.gracePeriodEnd) {
        return { active: true, status: 'GRACE' };
      }
      // Grace expired
      return { active: false, status: 'PAST_DUE', reason: 'Payment overdue. Please update your payment method.' };

    case 'PAST_DUE':
      return { active: false, status: 'PAST_DUE', reason: 'Payment overdue. Please update your payment method.' };

    case 'INACTIVE':
    case 'PAUSED':
      return { active: false, status: subscription.status, reason: 'Subscription is not active. Please resubscribe.' };

    case 'CREATED':
      return { active: false, status: 'CREATED', reason: 'Subscription payment pending. Complete checkout.' };

    default:
      return { active: false, status: subscription.status, reason: 'Subscription state unknown.' };
  }
}
