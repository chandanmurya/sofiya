// ============================================
// HeyGen Status Polling (Fallback for webhooks)
// ============================================

import { prisma } from '@/lib/prisma';
import { getHeyGenClient } from './client';

/**
 * Poll avatar status from HeyGen and update local DB.
 * Used as fallback when webhook hasn't fired within expected time.
 */
export async function pollAvatarStatus(avatarId: string): Promise<{
  status: string;
  updated: boolean;
}> {
  const avatar = await prisma.avatar.findUnique({
    where: { id: avatarId },
  });

  if (!avatar || !avatar.heygenAvatarId) {
    return { status: 'not_found', updated: false };
  }

  // Don't poll if already in terminal state
  if (['READY', 'FAILED', 'TRAINING_FAILED'].includes(avatar.status)) {
    return { status: avatar.status, updated: false };
  }

  try {
    const client = getHeyGenClient();
    const { data } = await client.getAvatarStatus(avatar.heygenAvatarId);

    const newStatus = mapAvatarStatus(data.status);

    if (newStatus !== avatar.status) {
      await prisma.avatar.update({
        where: { id: avatarId },
        data: {
          status: newStatus as any,
          ...(data.avatar_group_id && { heygenGroupId: data.avatar_group_id }),
          updatedAt: new Date(),
        },
      });
      return { status: newStatus, updated: true };
    }

    return { status: avatar.status, updated: false };
  } catch (error) {
    console.error(`Polling avatar ${avatarId} failed:`, error);
    return { status: avatar.status, updated: false };
  }
}

/**
 * Poll voice clone status
 */
export async function pollVoiceStatus(voiceId: string): Promise<{
  status: string;
  updated: boolean;
}> {
  const voice = await prisma.voiceClone.findUnique({
    where: { id: voiceId },
  });

  if (!voice || !voice.heygenVoiceId) {
    return { status: 'not_found', updated: false };
  }

  if (['READY', 'FAILED'].includes(voice.status)) {
    return { status: voice.status, updated: false };
  }

  try {
    const client = getHeyGenClient();
    const { data } = await client.getVoiceStatus(voice.heygenVoiceId);

    const newStatus = mapVoiceStatus(data.status);

    if (newStatus !== voice.status) {
      await prisma.voiceClone.update({
        where: { id: voiceId },
        data: {
          status: newStatus as any,
          updatedAt: new Date(),
        },
      });
      return { status: newStatus, updated: true };
    }

    return { status: voice.status, updated: false };
  } catch (error) {
    console.error(`Polling voice ${voiceId} failed:`, error);
    return { status: voice.status, updated: false };
  }
}

/**
 * Poll video generation status
 */
export async function pollVideoStatus(videoId: string): Promise<{
  status: string;
  videoUrl?: string;
  updated: boolean;
}> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video || !video.heygenVideoId) {
    return { status: 'not_found', updated: false };
  }

  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(video.status)) {
    return { status: video.status, updated: false };
  }

  try {
    const client = getHeyGenClient();
    const { data } = await client.getVideoStatus(video.heygenVideoId);

    const newStatus = mapVideoStatus(data.status);

    if (newStatus !== video.status) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: newStatus as any,
          ...(data.video_url && { outputUrl: data.video_url }),
          ...(data.duration && { durationSec: Math.ceil(data.duration) }),
          ...(newStatus === 'COMPLETED' && { completedAt: new Date() }),
          updatedAt: new Date(),
        },
      });
      return { status: newStatus, videoUrl: data.video_url, updated: true };
    }

    return { status: video.status, updated: false };
  } catch (error) {
    console.error(`Polling video ${videoId} failed:`, error);
    return { status: video.status, updated: false };
  }
}

/**
 * Poll consent status
 */
export async function pollConsentStatus(avatarId: string): Promise<{
  status: string;
  consentUrl?: string;
  updated: boolean;
}> {
  const avatar = await prisma.avatar.findUnique({
    where: { id: avatarId },
  });

  if (!avatar || !avatar.heygenAvatarId) {
    return { status: 'not_found', updated: false };
  }

  if (avatar.consentStatus === 'COMPLETED') {
    return { status: 'COMPLETED', updated: false };
  }

  try {
    const client = getHeyGenClient();
    const { data } = await client.getConsentStatus(avatar.heygenAvatarId);

    if (data.status === 'approved' && avatar.consentStatus !== 'COMPLETED') {
      await prisma.avatar.update({
        where: { id: avatarId },
        data: {
          consentStatus: 'COMPLETED',
          consentCompletedAt: new Date(),
          status: 'TRAINING',
          updatedAt: new Date(),
        },
      });
      return { status: 'COMPLETED', updated: true };
    }

    return { status: data.status, consentUrl: data.consent_url, updated: false };
  } catch (error) {
    console.error(`Polling consent for avatar ${avatarId} failed:`, error);
    return { status: avatar.consentStatus, updated: false };
  }
}

// ─── Status Mappers ──────────────────────────────────────────

function mapAvatarStatus(heygenStatus: string): string {
  const map: Record<string, string> = {
    pending: 'CONSENT_PENDING',
    needs_consent: 'CONSENT_REQUIRED',
    processing: 'TRAINING',
    training: 'TRAINING',
    ready: 'READY',
    completed: 'READY',
    failed: 'TRAINING_FAILED',
    error: 'TRAINING_FAILED',
  };
  return map[heygenStatus.toLowerCase()] || 'TRAINING';
}

function mapVoiceStatus(heygenStatus: string): string {
  const map: Record<string, string> = {
    pending: 'CLONING',
    processing: 'CLONING',
    ready: 'READY',
    completed: 'READY',
    failed: 'FAILED',
    error: 'FAILED',
  };
  return map[heygenStatus.toLowerCase()] || 'CLONING';
}

function mapVideoStatus(heygenStatus: string): string {
  const map: Record<string, string> = {
    pending: 'QUEUED',
    processing: 'GENERATING',
    completed: 'COMPLETED',
    failed: 'FAILED',
    error: 'FAILED',
  };
  return map[heygenStatus.toLowerCase()] || 'GENERATING';
}
