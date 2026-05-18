// ============================================
// POST /api/billing/topup
// Purchase additional seconds (top-up)
// ============================================
// Creates a Razorpay order. Client completes payment via Razorpay Checkout.
// On payment.captured webhook, seconds are added to wallet.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRazorpayOrder } from '@/lib/billing/razorpay';
import { getTopupOptions, BILLING_CONFIG } from '@/lib/billing/profitability';
import { isSubscriptionActive } from '@/lib/billing/credits';
import { z } from 'zod';

const topupSchema = z.object({
  topupId: z.enum(['topup_60', 'topup_180', 'topup_360']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    // Must have active subscription to buy top-ups
    const subCheck = await isSubscriptionActive(userId);
    if (!subCheck.active) {
      return NextResponse.json(
        { error: 'Active subscription required to purchase top-ups.', reason: subCheck.reason },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = topupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid top-up selection', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { topupId } = parsed.data;
    const options = getTopupOptions();
    const selected = options.find((o) => o.id === topupId);

    if (!selected) {
      return NextResponse.json({ error: 'Top-up option not found' }, { status: 400 });
    }

    // Create Razorpay order
    const receipt = `topup_${userId}_${Date.now()}`;
    const order = await createRazorpayOrder({
      amountPaise: selected.priceINR * 100, // INR to paise
      receipt,
      notes: {
        user_id: userId,
        type: 'topup',
        topup_id: topupId,
        seconds: String(selected.seconds),
      },
    });

    // Compute expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + BILLING_CONFIG.TOPUP_EXPIRY_DAYS);

    // Create TopupPurchase record (pending payment)
    await prisma.topupPurchase.create({
      data: {
        userId,
        seconds: selected.seconds,
        priceInr: selected.priceINR * 100, // store in paise
        razorpayOrderId: order.orderId,
        status: 'PENDING_PAYMENT',
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        seconds: selected.seconds,
        priceINR: selected.priceINR,
        expiresAt: expiresAt.toISOString(),
        // Client uses these to open Razorpay Checkout
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        prefill: {
          email: session.user.email,
          name: session.user.name,
        },
      },
    });
  } catch (error: any) {
    console.error('[Topup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create top-up order', details: error.message },
      { status: 500 }
    );
  }
}

// ─── POST /api/billing/topup/verify ──────────────────────────
// Client calls this after Razorpay Checkout success to verify payment

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const body = await req.json();
    const { orderId, paymentId, signature } = body;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'Missing orderId, paymentId, or signature' },
        { status: 400 }
      );
    }

    // Verify payment signature
    const { verifyPaymentSignature } = await import('@/lib/billing/razorpay');
    const valid = verifyPaymentSignature({ orderId, paymentId, signature });

    if (!valid) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Find the topup purchase
    const topup = await prisma.topupPurchase.findUnique({
      where: { razorpayOrderId: orderId },
    });

    if (!topup || topup.userId !== userId) {
      return NextResponse.json({ error: 'Top-up not found' }, { status: 404 });
    }

    if (topup.status === 'PAID') {
      // Already processed (idempotent)
      return NextResponse.json({
        success: true,
        data: { message: 'Top-up already applied', seconds: topup.seconds },
      });
    }

    // Mark as paid and add to wallet
    await prisma.$transaction([
      prisma.topupPurchase.update({
        where: { id: topup.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: paymentId,
          paidAt: new Date(),
        },
      }),
      prisma.creditWallet.upsert({
        where: { userId },
        update: {
          topupSeconds: { increment: topup.seconds },
          totalSecondsEarned: { increment: topup.seconds },
        },
        create: {
          userId,
          monthlyIncludedSeconds: 0,
          monthlyRemaining: 0,
          topupSeconds: topup.seconds,
          totalSecondsEarned: topup.seconds,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        message: `+${topup.seconds} seconds added to your wallet!`,
        seconds: topup.seconds,
      },
    });
  } catch (error: any) {
    console.error('[Topup Verify] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: error.message },
      { status: 500 }
    );
  }
}
