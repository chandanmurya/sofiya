// ============================================
// Request Validation Schemas (Zod)
// ============================================

import { z } from 'zod';

// ─── Upload Validations ──────────────────────────────────────

export const trainingVideoUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().refine(
    (ct) => ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'].includes(ct),
    { message: 'Invalid video type. Supported: MP4, MOV, WebM, AVI' }
  ),
  fileSizeMb: z.number().min(1).max(500, 'Video must be under 500MB'),
  durationHintSec: z.number().min(300).max(900).optional(), // 5-15 min recommended
});

export const voiceAudioUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().refine(
    (ct) => ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/flac', 'audio/x-m4a'].includes(ct),
    { message: 'Invalid audio type. Supported: MP3, WAV, M4A, OGG, FLAC' }
  ),
  fileSizeMb: z.number().min(0.1).max(50, 'Audio must be under 50MB'),
  durationHintSec: z.number().min(60).max(300).optional(), // 1-5 min recommended
});

// ─── Avatar Validations ──────────────────────────────────────

export const createAvatarSchema = z.object({
  name: z.string().min(2).max(50, 'Avatar name must be 2-50 characters'),
  trainingVideoKey: z.string().min(1, 'Training video is required'),
  durationSec: z.number().min(300).max(900).optional(),
});

// ─── Voice Validations ───────────────────────────────────────

export const createVoiceSchema = z.object({
  name: z.string().min(2).max(50, 'Voice name must be 2-50 characters'),
  audioKey: z.string().min(1, 'Audio file is required'),
  language: z.enum(['en', 'hi', 'hinglish']).default('en'),
  sourceType: z.enum(['DEDICATED_AUDIO', 'EXTRACTED_FROM_VIDEO']).default('DEDICATED_AUDIO'),
  durationSec: z.number().min(60).max(300).optional(),
});

// ─── Video Validations ───────────────────────────────────────

export const createVideoSchema = z.object({
  title: z.string().min(2).max(100),
  avatarId: z.string().min(1, 'Avatar is required'),
  voiceId: z.string().min(1, 'Voice is required'),
  script: z.string().min(10).max(5000, 'Script must be 10-5000 characters'),
  scriptLanguage: z.enum(['en', 'hi', 'hinglish']).default('en'),
  aspectRatio: z.enum(['PORTRAIT_9_16', 'LANDSCAPE_16_9', 'SQUARE_1_1']).default('LANDSCAPE_16_9'),
  resolution: z.enum(['SD_480P', 'HD_720P', 'FHD_1080P']).default('HD_720P'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundImageUrl: z.string().url().optional(),
  transparentBg: z.boolean().default(false),
  templateId: z.string().optional(),
});

// ─── Billing Validations ─────────────────────────────────────

export const subscribeSchema = z.object({
  planId: z.enum(['STARTER', 'CREATOR', 'AGENCY']),
});

export const cancelSubscriptionSchema = z.object({
  cancelAtEnd: z.boolean().default(true),
});
