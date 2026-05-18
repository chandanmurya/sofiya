// ============================================
// POST /api/billing/avatar-setup
// Purchase Avatar Setup Add-on (one-time per avatar)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRazorpayOrder } from '@/lib/billing/razorpay';
import { computeAvatarSetupPrice } from '@/lib/billing/profitability';
import { isSubscriptionActive } from '@/lib/billing/credits';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as any).id;

    // Must have active subscription
    const subCheck = await isSubscriptionActive(userId);
    if (!subCheck.active) {
      return NextResponse.json(
        { error: 'Active subscription required.', reason: subCheck.reason },
        { status: 403 }
      );
    }

    // Compute price
    const pricing = computeAvatarSetupPrice();
    const priceINR = pricing.customerPriceINR;
    const costINR = pricing.totalCostINR;

    // Create Razorpay order
    const receipt = `avatar_setup_${userId}_${Date.now()}`;
    const order = await createRazorpayOrder({
      amountPaise: priceINR * 100,
      receipt,
      notes: {
        user_id: userId,
        type: 'avatar_setup',
      },
    });

    // Create AddOn record
    await prisma.addOn.create({
      data: {
        userId,
        type: 'AVATAR_SETUP',
        status: 'PENDING_PAYMENT',
        priceInr: priceINR * 100, // paise
        costInr: costINR * 100,   // paise
        razorpayOrderId: order.orderId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        priceINR,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        prefill: {
          email: session.user.email,
          name: session.user.name,
        },
        includes: [
          'Digital Twin avatar training initiation',
          'Consent flow verification',
          'Avatar stored permanently (accessible while subscribed)',
        ],
      },
    });
  } catch (error: any) {
    console.error('[Avatar Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create avatar setup order', details: error.message },
      { status: 500 }
    );
  }
}

// ─── PUT /api/billing/avatar-setup (verify after checkout) ───

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

    const { verifyPaymentSignature } = await import('@/lib/billing/razorpay');
    const valid = verifyPaymentSignature({ orderId, paymentId, signature });

    if (!valid) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const addon = await prisma.addOn.findUnique({
      where: { razorpayOrderId: orderId },
    });

    if (!addon || addon.userId !== userId) {
      return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });
    }

    if (addon.status === 'PAID' || addon.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        data: { message: 'Avatar setup already purchased', addOnId: addon.id },
      });
    }

    // Mark as paid
    await prisma.addOn.update({
      where: { id: addon.id },
      data: {
        status: 'PAID',
        razorpayPaymentId: paymentId,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        addOnId: addon.id,
        message: 'Avatar Setup purchased! You can now create your Digital Twin.',
      },
    });
  } catch (error: any) {
    console.error('[Avatar Setup Verify] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: error.message },
      { status: 500 }
    );
  }
}
