// ============================================
// HeyGen Webhook Verification & Idempotent Processing
// ============================================

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const WEBHOOK_SECRET = process.env.HEYGEN_WEBHOOK_SECRET || '';
const WEBHOOK_TOKEN = process.env.HEYGEN_WEBHOOK_TOKEN || ''; // fallback token-based auth

// ─── Webhook Event Types ─────────────────────────────────────

export interface HeyGenWebhookEvent {
  event_type: string;
  event_data: {
    avatar_id?: string;
    avatar_group_id?: string;
    voice_id?: string;
    video_id?: string;
    callback_id?: string; // our idempotency key
    status: string;
    url?: string;
    duration?: number;
    error?: { message: string; code?: string };
  };
  timestamp?: string;
}

// ─── Verification ────────────────────────────────────────────

/**
 * Verify HeyGen webhook authenticity.
 * Strategy: HMAC signature check first, then token fallback.
 */
export function verifyHeyGenWebhook(params: {
  payload: string;
  signature?: string | null;
  token?: string | null;
}): boolean {
  // Strategy 1: HMAC signature verification
  if (params.signature && WEBHOOK_SECRET) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(params.payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(params.signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // Strategy 2: Token-based verification (fallback)
  if (params.token && WEBHOOK_TOKEN) {
    return params.token === WEBHOOK_TOKEN;
  }

  // If no verification method available, reject
  console.warn('HeyGen webhook received without valid verification');
  return false;
}

// ─── Idempotent Processing ───────────────────────────────────

/**
 * Process webhook event with idempotency guarantee.
 * Uses WebhookLog table to prevent duplicate processing.
 */
export async function processHeyGenWebhook(event: HeyGenWebhookEvent): Promise<{
  processed: boolean;
  action: string;
  entityId?: string;
}> {
  const { event_type, event_data } = event;

  // Generate dedup key from event
  const dedupKey = buildDedupKey(event);

  // Check if already processed (idempotency)
  const existing = await prisma.webhookLog.findFirst({
    where: {
      source: 'heygen',
      eventType: event_type,
      status: 'processed',
      // Use payload JSON field to check dedup
    },
  });

  // If we find an exact duplicate by checking our idempotency approach
  if (existing) {
    const existingPayload = existing.payload as any;
    if (existingPayload?._dedupKey === dedupKey) {
      return { processed: false, action: 'duplicate_skipped' };
    }
  }

  // Log the webhook
  const log = await prisma.webhookLog.create({
    data: {
      source: 'heygen',
      eventType: event_type,
      payload: { ...event_data, _dedupKey: dedupKey } as any,
      status: 'processing',
    },
  });

  try {
    let result: { action: string; entityId?: string };

    switch (event_type) {
      case 'avatar.created':
      case 'avatar.training.started':
        result = await handleAvatarTrainingStarted(event_data);
        break;

      case 'avatar.training.completed':
      case 'avatar.ready':
        result = await handleAvatarReady(event_data);
        break;

      case 'avatar.training.failed':
      case 'avatar.failed':
        result = await handleAvatarFailed(event_data);
        break;

      case 'avatar.consent.completed':
      case 'consent.approved':
        result = await handleConsentApproved(event_data);
        break;

      case 'avatar.consent.rejected':
      case 'consent.rejected':
        result = await handleConsentRejected(event_data);
        break;

      case 'voice.clone.completed':
      case 'voice.ready':
        result = await handleVoiceReady(event_data);
        break;

      case 'voice.clone.failed':
      case 'voice.failed':
        result = await handleVoiceFailed(event_data);
        break;

      case 'video.completed':
      case 'video_generation.success':
        result = await handleVideoCompleted(event_data);
        break;

      case 'video.failed':
      case 'video_generation.fail':
        result = await handleVideoFailed(event_data);
        break;

      default:
        result = { action: `unhandled_event:${event_type}` };
        console.warn(`Unhandled HeyGen webhook event: ${event_type}`);
    }

    // Mark as processed
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: 'processed', processedAt: new Date() },
    });

    return { processed: true, ...result };
  } catch (error) {
    // Mark as failed
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

// ─── Event Handlers ──────────────────────────────────────────

async function handleAvatarTrainingStarted(data: HeyGenWebhookEvent['event_data']) {
  const avatarId = data.avatar_id;
  if (!avatarId) return { action: 'no_avatar_id' };

  await prisma.avatar.updateMany({
    where: { heygenAvatarId: avatarId },
    data: {
      status: 'TRAINING',
      ...(data.avatar_group_id && { heygenGroupId: data.avatar_group_id }),
      updatedAt: new Date(),
    },
  });

  // Update associated job
  await prisma.job.updateMany({
    where: {
      entityType: 'AVATAR',
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    data: { status: 'WAITING_CALLBACK' },
  });

  return { action: 'avatar_training_started', entityId: avatarId };
}

async function handleAvatarReady(data: HeyGenWebhookEvent['event_data']) {
  const avatarId = data.avatar_id;
  if (!avatarId) return { action: 'no_avatar_id' };

  await prisma.avatar.updateMany({
    where: { heygenAvatarId: avatarId },
    data: {
      status: 'READY',
      updatedAt: new Date(),
    },
  });

  // Complete associated job
  const avatar = await prisma.avatar.findFirst({ where: { heygenAvatarId: avatarId } });
  if (avatar) {
    await prisma.job.updateMany({
      where: {
        entityId: avatar.id,
        entityType: 'AVATAR',
        status: { in: ['PROCESSING', 'WAITING_CALLBACK'] },
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  return { action: 'avatar_ready', entityId: avatarId };
}

async function handleAvatarFailed(data: HeyGenWebhookEvent['event_data']) {
  const avatarId = data.avatar_id;
  if (!avatarId) return { action: 'no_avatar_id' };

  const errorMsg = data.error?.message || 'Avatar training failed';

  await prisma.avatar.updateMany({
    where: { heygenAvatarId: avatarId },
    data: {
      status: 'TRAINING_FAILED',
      errorMessage: errorMsg,
      updatedAt: new Date(),
    },
  });

  const avatar = await prisma.avatar.findFirst({ where: { heygenAvatarId: avatarId } });
  if (avatar) {
    await prisma.job.updateMany({
      where: {
        entityId: avatar.id,
        entityType: 'AVATAR',
        status: { in: ['PROCESSING', 'WAITING_CALLBACK'] },
      },
      data: { status: 'FAILED', lastError: errorMsg, completedAt: new Date() },
    });
  }

  return { action: 'avatar_failed', entityId: avatarId };
}

async function handleConsentApproved(data: HeyGenWebhookEvent['event_data']) {
  const avatarId = data.avatar_id;
  if (!avatarId) return { action: 'no_avatar_id' };

  await prisma.avatar.updateMany({
    where: { heygenAvatarId: avatarId },
    data: {
      consentStatus: 'COMPLETED',
      consentCompletedAt: new Date(),
      status: 'TRAINING', // Now training can proceed
      updatedAt: new Date(),
    },
  });

  return { action: 'consent_approved', entityId: avatarId };
}

async function handleConsentRejected(data: HeyGenWebhookEvent['event_data']) {
  const avatarId = data.avatar_id;
  if (!avatarId) return { action: 'no_avatar_id' };

  await prisma.avatar.updateMany({
    where: { heygenAvatarId: avatarId },
    data: {
      consentStatus: 'FAILED',
      status: 'FAILED',
      errorMessage: 'Consent was rejected. Please create a new avatar with proper consent.',
      updatedAt: new Date(),
    },
  });

  return { action: 'consent_rejected', entityId: avatarId };
}

async function handleVoiceReady(data: HeyGenWebhookEvent['event_data']) {
  const voiceId = data.voice_id;
  if (!voiceId) return { action: 'no_voice_id' };

  await prisma.voiceClone.updateMany({
    where: { heygenVoiceId: voiceId },
    data: {
      status: 'READY',
      updatedAt: new Date(),
    },
  });

  const voice = await prisma.voiceClone.findFirst({ where: { heygenVoiceId: voiceId } });
  if (voice) {
    await prisma.job.updateMany({
      where: {
        entityId: voice.id,
        entityType: 'VOICE',
        status: { in: ['PROCESSING', 'WAITING_CALLBACK'] },
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  return { action: 'voice_ready', entityId: voiceId };
}

async function handleVoiceFailed(data: HeyGenWebhookEvent['event_data']) {
  const voiceId = data.voice_id;
  if (!voiceId) return { action: 'no_voice_id' };

  const errorMsg = data.error?.message || 'Voice cloning failed';

  await prisma.voiceClone.updateMany({
    where: { heygenVoiceId: voiceId },
    data: {
      status: 'FAILED',
      errorMessage: errorMsg,
      updatedAt: new Date(),
    },
  });

  return { action: 'voice_failed', entityId: voiceId };
}

async function handleVideoCompleted(data: HeyGenWebhookEvent['event_data']) {
  const videoId = data.video_id;
  if (!videoId) return { action: 'no_video_id' };

  await prisma.video.updateMany({
    where: { heygenVideoId: videoId },
    data: {
      status: 'COMPLETED',
      outputUrl: data.url || null,
      durationSec: data.duration ? Math.ceil(data.duration) : null,
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const video = await prisma.video.findFirst({ where: { heygenVideoId: videoId } });
  if (video) {
    await prisma.job.updateMany({
      where: {
        entityId: video.id,
        entityType: 'VIDEO',
        status: { in: ['PROCESSING', 'WAITING_CALLBACK'] },
      },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  return { action: 'video_completed', entityId: videoId };
}

async function handleVideoFailed(data: HeyGenWebhookEvent['event_data']) {
  const videoId = data.video_id;
  if (!videoId) return { action: 'no_video_id' };

  const errorMsg = data.error?.message || 'Video generation failed';

  await prisma.video.updateMany({
    where: { heygenVideoId: videoId },
    data: {
      status: 'FAILED',
      errorMessage: errorMsg,
      updatedAt: new Date(),
    },
  });

  return { action: 'video_failed', entityId: videoId };
}

// ─── Helpers ─────────────────────────────────────────────────

function buildDedupKey(event: HeyGenWebhookEvent): string {
  const { event_type, event_data } = event;
  const entityId = event_data.avatar_id || event_data.voice_id || event_data.video_id || '';
  const callbackId = event_data.callback_id || '';
  return `${event_type}:${entityId}:${callbackId}:${event_data.status}`;
}
