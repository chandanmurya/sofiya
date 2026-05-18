// ============================================
// HeyGen Webhook Handler
// Receives callbacks for avatar training, voice cloning, video generation
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyHeyGenWebhook, processHeyGenWebhook } from '@/lib/heygen';
import type { HeyGenWebhookEvent } from '@/lib/heygen';

export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Get verification headers
    const signature = req.headers.get('x-heygen-signature') || 
                      req.headers.get('x-signature') ||
                      req.headers.get('signature');
    const token = req.headers.get('x-heygen-token') ||
                  req.headers.get('authorization')?.replace('Bearer ', '');

    // Verify webhook authenticity
    const isValid = verifyHeyGenWebhook({
      payload: rawBody,
      signature,
      token,
    });

    if (!isValid) {
      console.warn('HeyGen webhook verification failed', {
        hasSignature: !!signature,
        hasToken: !!token,
        bodyLength: rawBody.length,
      });
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the event
    let event: HeyGenWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate event structure
    if (!event.event_type || !event.event_data) {
      return NextResponse.json(
        { error: 'Invalid event structure' },
        { status: 400 }
      );
    }

    // Process the event idempotently
    const result = await processHeyGenWebhook(event);

    console.log('HeyGen webhook processed:', {
      eventType: event.event_type,
      ...result,
    });

    // Always return 200 to acknowledge receipt
    // (even if we've already processed this event)
    return NextResponse.json({
      received: true,
      processed: result.processed,
      action: result.action,
    });
  } catch (error) {
    // Log but still return 200 to prevent retries for non-retryable errors
    console.error('HeyGen webhook processing error:', error);

    // Return 500 only for truly unexpected errors (HeyGen will retry)
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}

// HeyGen may send GET for webhook verification/health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'avatarforge-heygen-webhook' });
}
