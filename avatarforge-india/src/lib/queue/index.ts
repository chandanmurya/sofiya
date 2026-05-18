// ============================================
// BullMQ Queue Configuration
// ============================================

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared Redis connection
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ─── Queue Definitions ───────────────────────────────────────

export const QUEUE_NAMES = {
  AVATAR_TRAINING: 'avatar-training',
  VOICE_CLONING: 'voice-cloning',
  VIDEO_GENERATION: 'video-generation',
  VIDEO_DOWNLOAD: 'video-download',
} as const;

// Avatar training queue
export const avatarTrainingQueue = new Queue(QUEUE_NAMES.AVATAR_TRAINING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// Voice cloning queue
export const voiceCloningQueue = new Queue(QUEUE_NAMES.VOICE_CLONING, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// Video generation queue
export const videoGenerationQueue = new Queue(QUEUE_NAMES.VIDEO_GENERATION, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

// Video download queue (after HeyGen callback)
export const videoDownloadQueue = new Queue(QUEUE_NAMES.VIDEO_DOWNLOAD, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

// ─── Queue Helpers ───────────────────────────────────────────

export async function addToQueue(
  queueName: string,
  data: any,
  options?: { priority?: number; delay?: number; jobId?: string }
) {
  const queue = getQueue(queueName);
  if (!queue) throw new Error(`Unknown queue: ${queueName}`);

  return queue.add(queueName, data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId, // for idempotency
  });
}

function getQueue(name: string): Queue | null {
  switch (name) {
    case QUEUE_NAMES.AVATAR_TRAINING:
      return avatarTrainingQueue;
    case QUEUE_NAMES.VOICE_CLONING:
      return voiceCloningQueue;
    case QUEUE_NAMES.VIDEO_GENERATION:
      return videoGenerationQueue;
    case QUEUE_NAMES.VIDEO_DOWNLOAD:
      return videoDownloadQueue;
    default:
      return null;
  }
}

export { Queue, Worker, Job };
