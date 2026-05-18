// ============================================
// Razorpay Webhook Handler
// Receives callbacks for subscription events, payments, invoices
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpayWebhook, processRazorpayWebhook } from '@/lib/razorpay/webhook';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Get Razorpay signature header
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.warn('Razorpay webhook missing signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify webhook authenticity
    const isValid = verifyRazorpayWebhook(rawBody, signature);
    if (!isValid) {
      console.warn('Razorpay webhook verification failed');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the event
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Idempotency: Check if this event was already processed
    const eventId = event.event_id || event.id;
    if (eventId) {
      const existing = await prisma.webhookLog.findFirst({
        where: {
          source: 'razorpay',
          status: 'processed',
          payload: { path: ['event_id'], equals: eventId },
        },
      });

      if (existing) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // Log the webhook
    const log = await prisma.webhookLog.create({
      data: {
        source: 'razorpay',
        eventType: event.event || 'unknown',
        payload: { ...event, event_id: eventId } as any,
        status: 'processing',
      },
    });

    try {
      // Process the event
      await processRazorpayWebhook(event);

      // Mark as processed
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 'processed', processedAt: new Date() },
      });

      console.log('Razorpay webhook processed:', {
        event: event.event,
        eventId,
      });

      return NextResponse.json({ received: true, processed: true });
    } catch (processError) {
      // Mark as failed
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: processError instanceof Error ? processError.message : 'Unknown error',
        },
      });

      console.error('Razorpay webhook processing error:', processError);
      // Still return 200 - Razorpay shouldn't retry for our processing errors
      return NextResponse.json({ received: true, processed: false });
    }
  } catch (error) {
    console.error('Razorpay webhook handler error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
