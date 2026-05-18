// ============================================
// Cloudflare R2 Storage Client
// ============================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PresignedUploadResponse } from '@/types';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function getPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  maxSizeMb?: number;
}): Promise<PresignedUploadResponse> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return {
    uploadUrl,
    key: params.key,
    publicUrl: `${R2_PUBLIC_URL}/${params.key}`,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function generateObjectKey(params: {
  userId: string;
  type: 'training-video' | 'voice-audio' | 'generated-video' | 'background';
  filename: string;
}): string {
  const timestamp = Date.now();
  const sanitizedFilename = params.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${params.type}/${params.userId}/${timestamp}_${sanitizedFilename}`;
}
