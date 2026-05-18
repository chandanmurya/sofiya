// ============================================
// Upload API - Presigned URL Generation
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { getPresignedUploadUrl, generateObjectKey } from '@/lib/storage/r2';
import { trainingVideoUploadSchema, voiceAudioUploadSchema } from '@/lib/validations';
import { z } from 'zod';

const uploadRequestSchema = z.object({
  type: z.enum(['training-video', 'voice-audio', 'background']),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSizeMb: z.number().positive(),
  durationHintSec: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // Validate base request
    const parsed = uploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, filename, contentType, fileSizeMb, durationHintSec } = parsed.data;

    // Type-specific validation
    if (type === 'training-video') {
      const validation = trainingVideoUploadSchema.safeParse({
        filename, contentType, fileSizeMb, durationHintSec,
      });
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid training video', details: validation.error.flatten() },
          { status: 400 }
        );
      }
    } else if (type === 'voice-audio') {
      const validation = voiceAudioUploadSchema.safeParse({
        filename, contentType, fileSizeMb, durationHintSec,
      });
      if (!validation.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid audio file', details: validation.error.flatten() },
          { status: 400 }
        );
      }
    }

    // Generate presigned upload URL
    const key = generateObjectKey({ userId: user.id, type, filename });
    const presigned = await getPresignedUploadUrl({ key, contentType });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: presigned.uploadUrl,
        key: presigned.key,
        publicUrl: presigned.publicUrl,
        expiresAt: presigned.expiresAt,
        guidelines: getUploadGuidelines(type),
      },
    });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error('Upload presign error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

function getUploadGuidelines(type: string): Record<string, string> {
  switch (type) {
    case 'training-video':
      return {
        duration: '5-10 minutes recommended',
        resolution: 'At least 720p, 1080p preferred',
        lighting: 'Well-lit, even lighting, no shadows on face',
        background: 'Clean, uncluttered background',
        framing: 'Head and shoulders visible, centered',
        audio: 'Clear speech, minimal background noise',
        movement: 'Natural head movements, look at camera',
        format: 'MP4 preferred, max 500MB',
        compression: 'If file is large, use HandBrake (H.264, CRF 23) to compress without quality loss',
      };
    case 'voice-audio':
      return {
        duration: '1-3 minutes of clear speech',
        quality: 'No background music or noise',
        speaker: 'Single speaker only',
        format: 'MP3 or WAV preferred, max 50MB',
        content: 'Read a passage naturally, maintain consistent pace',
      };
    default:
      return {};
  }
}
