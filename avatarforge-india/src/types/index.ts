// ============================================
// AvatarForge India - Type Definitions
// ============================================

export type Locale = 'en' | 'hi';

// ─── HeyGen API Types ────────────────────────────────────────

export interface HeyGenAvatarCreateResponse {
  data: {
    avatar_id: string;
    status: string;
    consent_url?: string;
  };
  error?: string;
}

export interface HeyGenVoiceCloneResponse {
  data: {
    voice_id: string;
    status: string;
  };
  error?: string;
}

export interface HeyGenVideoCreateResponse {
  data: {
    video_id: string;
    status: string;
  };
  error?: string;
}

export interface HeyGenVideoStatusResponse {
  data: {
    video_id: string;
    status: 'processing' | 'completed' | 'failed';
    video_url?: string;
    duration?: number;
    error?: string;
  };
}

export interface HeyGenWebhookPayload {
  event_type: string;
  event_data: {
    avatar_id?: string;
    voice_id?: string;
    video_id?: string;
    status: string;
    url?: string;
    error?: string;
  };
}

// ─── API Response Types ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Upload Types ────────────────────────────────────────────

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
}

// ─── Billing Types ───────────────────────────────────────────

export interface PlanConfig {
  id: string;
  name: string;
  nameHi: string;
  priceInr: number; // monthly price
  razorpayPlanId: string;
  credits: number;
  maxAvatars: number;
  maxVoices: number;
  maxResolution: string;
  maxVideoDurationSec: number;
  features: string[];
  featuresHi: string[];
}

export interface CreditEstimate {
  credits: number;
  costInr: number;
  breakdown: {
    baseCost: number;
    resolutionMultiplier: number;
    durationMinutes: number;
  };
}

// ─── Job Types ───────────────────────────────────────────────

export interface JobPayload {
  userId: string;
  entityId: string;
  entityType: 'AVATAR' | 'VOICE' | 'VIDEO';
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

// ─── Dashboard Types ─────────────────────────────────────────

export interface DashboardStats {
  avatarsCount: number;
  voicesCount: number;
  videosCount: number;
  creditsRemaining: number;
  creditsTotal: number;
  currentPlan: string;
  recentVideos: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    thumbnailUrl?: string;
  }>;
}

// ─── Admin Types ─────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalVideosGenerated: number;
  failedJobs: number;
  revenue: {
    thisMonth: number;
    lastMonth: number;
  };
  apiCosts: {
    thisMonth: number;
    lastMonth: number;
  };
}
