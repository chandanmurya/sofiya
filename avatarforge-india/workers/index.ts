// ============================================
// BullMQ Workers - Background Job Processing
// ============================================
// Run separately: `npm run worker:start`

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

console.log('🚀 AvatarForge Worker starting...');

// ─── Avatar Training Worker ──────────────────────────────────

const avatarWorker = new Worker(
  'avatar-training',
  async (job: Job) => {
    const { avatarId, userId, videoUrl, callbackUrl, idempotencyKey } = job.data;
    console.log(`[Avatar] Processing job ${job.id} for avatar ${avatarId}`);

    // This worker handles retry logic and status tracking
    // The actual HeyGen call is made at API route level (immediate)
    // This worker handles follow-up tasks like:
    // - Polling status if webhook hasn't arrived
    // - Sending notifications
    // - Cleanup on failure

    // For now, this is a placeholder - main logic is in API routes + webhooks
    return { status: 'submitted', avatarId };
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute max
    },
  }
);

// ─── Voice Cloning Worker ────────────────────────────────────

const voiceWorker = new Worker(
  'voice-cloning',
  async (job: Job) => {
    const { voiceId, userId } = job.data;
    console.log(`[Voice] Processing job ${job.id} for voice ${voiceId}`);
    return { status: 'submitted', voiceId };
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

// ─── Video Generation Worker ─────────────────────────────────

const videoWorker = new Worker(
  'video-generation',
  async (job: Job) => {
    const { videoId, userId } = job.data;
    console.log(`[Video] Processing job ${job.id} for video ${videoId}`);
    return { status: 'submitted', videoId };
  },
  {
    connection,
    concurrency: 3, // Lower concurrency for expensive ops
    limiter: {
      max: 5,
      duration: 60000, // 5 videos per minute max
    },
  }
);

// ─── Video Download Worker ───────────────────────────────────

const downloadWorker = new Worker(
  'video-download',
  async (job: Job) => {
    const { videoId, heygenVideoUrl, outputKey } = job.data;
    console.log(`[Download] Downloading video ${videoId} from HeyGen`);

    // Download from HeyGen URL and upload to our R2 storage
    // This ensures videos persist even after HeyGen URL expires
    // Implementation would be:
    // 1. Fetch video from heygenVideoUrl
    // 2. Upload to R2 with outputKey
    // 3. Update video record with our URL

    return { status: 'downloaded', videoId };
  },
  {
    connection,
    concurrency: 3,
  }
);

// ─── Error Handling ──────────────────────────────────────────

avatarWorker.on('failed', (job, err) => {
  console.error(`[Avatar] Job ${job?.id} failed:`, err.message);
});

voiceWorker.on('failed', (job, err) => {
  console.error(`[Voice] Job ${job?.id} failed:`, err.message);
});

videoWorker.on('failed', (job, err) => {
  console.error(`[Video] Job ${job?.id} failed:`, err.message);
});

downloadWorker.on('failed', (job, err) => {
  console.error(`[Download] Job ${job?.id} failed:`, err.message);
});

// ─── Graceful Shutdown ───────────────────────────────────────

async function shutdown() {
  console.log('⏹️  Shutting down workers...');
  await Promise.all([
    avatarWorker.close(),
    voiceWorker.close(),
    videoWorker.close(),
    downloadWorker.close(),
  ]);
  await connection.quit();
  console.log('✅ Workers stopped.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('✅ All workers running. Waiting for jobs...');
