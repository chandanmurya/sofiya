// ============================================
// Razorpay Webhook Endpoint
// ============================================
// POST /api/webhooks/razorpay
//
// STRICT verification:
// 1. Require x-razorpay-signature header
// 2. HMAC-SHA256 verify against RAZORPAY_WEBHOOK_SECRET
// 3. Idempotent processing via EventDedup table

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/billing/razorpay';
import { handleRazorpayWebhook } from '@/lib/billing/webhook-handler';

export async function POST(req: NextRequest) {
  // ── Step 1: Read raw body ──
  const rawBody = await req.text();

  // ── Step 2: Get signature header ──
  const signature = req.headers.get('x-razorpay-signature');

  if (!signature) {
    console.warn('[Razorpay Webhook] Missing x-razorpay-signature header');
    return NextResponse.json(
      { error: 'Missing signature header' },
      { status: 401 }
    );
  }

  // ── Step 3: Verify signature (STRICT - timing-safe) ──
  const isValid = verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    console.warn('[Razorpay Webhook] Signature verification FAILED');
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  // ── Step 4: Parse payload ──
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  // ── Step 5: Extract event ID for idempotency ──
  // Razorpay sends a unique event ID in the payload
  const eventId = extractEventId(event, req);

  if (!eventId) {
    console.warn('[Razorpay Webhook] Could not extract event ID');
    return NextResponse.json(
      { error: 'Missing event identifier' },
      { status: 400 }
    );
  }

  // ── Step 6: Process (idempotent) ──
  try {
    const result = await handleRazorpayWebhook(event, eventId);

    console.log(`[Razorpay Webhook] ${event.event} → ${result.action}`, {
      eventId,
      processed: result.processed,
      details: result.details,
    });

    // Always return 200 to acknowledge receipt
    return NextResponse.json({
      received: true,
      processed: result.processed,
      action: result.action,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Razorpay Webhook] Unhandled error:', errMsg);

    // Return 500 so Razorpay retries
    return NextResponse.json(
      { error: 'Processing failed', message: errMsg },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'avatarforge-razorpay-webhook',
    timestamp: new Date().toISOString(),
  });
}

// ─── Helpers ─────────────────────────────────────────────────

function extractEventId(event: any, req: NextRequest): string | null {
  // Razorpay includes event ID in multiple places:
  // 1. X-Razorpay-Event-Id header (newer API)
  const headerEventId = req.headers.get('x-razorpay-event-id');
  if (headerEventId) return headerEventId;

  // 2. event.id field (older format)
  if (event.id) return event.id;

  // 3. Construct from event + entity ID + timestamp (fallback)
  const entityId =
    event.payload?.subscription?.entity?.id ||
    event.payload?.payment?.entity?.id ||
    event.payload?.invoice?.entity?.id;

  if (entityId && event.event && event.created_at) {
    return `${event.event}:${entityId}:${event.created_at}`;
  }

  return null;
}
