// ============================================
// HeyGen v3 Direct API Client - Server-side only
// ============================================
// NEVER import this on client side. API key stays server-only.

import { generateIdempotencyKey, sleep } from '@/lib/utils';

const HEYGEN_API_V2 = 'https://api.heygen.com/v2';
const HEYGEN_API_V1 = 'https://api.heygen.com/v1';

// ─── Types ───────────────────────────────────────────────────

export interface HeyGenRequestOptions {
  retries?: number;
  backoffMs?: number;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface HeyGenAvatarCreateRequest {
  videoUrl: string; // our signed R2 URL
  avatarName: string;
  callbackUrl: string;
  idempotencyKey?: string;
}

export interface HeyGenAvatarCreateResponse {
  avatar_id: string;
  avatar_group_id: string;
  status: string; // 'pending' | 'processing' | 'ready' | 'failed'
  consent_url?: string;
}

export interface HeyGenConsentResponse {
  consent_url: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface HeyGenVoiceCloneRequest {
  audioUrl: string; // our signed R2 URL
  voiceName: string;
  language?: string;
  callbackUrl?: string;
}

export interface HeyGenVoiceCloneResponse {
  voice_id: string;
  status: string;
}

export interface HeyGenVideoCreateRequest {
  avatarId: string;
  voiceId: string;
  script: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: '480p' | '720p' | '1080p';
  backgroundColor?: string;
  backgroundImageUrl?: string;
  transparentBackground?: boolean;
  callbackUrl: string;
  idempotencyKey?: string;
}

export interface HeyGenVideoCreateResponse {
  video_id: string;
  status: string;
}

export interface HeyGenVideoStatusResponse {
  video_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  duration?: number;
  thumbnail_url?: string;
  error?: { message: string; code: string };
}

export interface HeyGenAvatarStatusResponse {
  avatar_id: string;
  avatar_group_id?: string;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'needs_consent';
  error?: { message: string };
}

export interface HeyGenRawResponse {
  code: number;
  data: any;
  message?: string;
  error?: any;
}

// ─── Error Class ─────────────────────────────────────────────

export class HeyGenError extends Error {
  statusCode: number;
  heygenCode?: string;
  rawResponse?: any;
  retryable: boolean;

  constructor(params: {
    message: string;
    statusCode: number;
    heygenCode?: string;
    rawResponse?: any;
    retryable?: boolean;
  }) {
    super(params.message);
    this.name = 'HeyGenError';
    this.statusCode = params.statusCode;
    this.heygenCode = params.heygenCode;
    this.rawResponse = params.rawResponse;
    this.retryable = params.retryable ?? false;
  }
}

// ─── Client Class ────────────────────────────────────────────

class HeyGenClient {
  private apiKey: string;

  constructor() {
    const key = process.env.HEYGEN_API_KEY;
    if (!key) throw new Error('HEYGEN_API_KEY is required');
    this.apiKey = key;
  }

  // ─── Core Request Method with Retry + Backoff ────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit & HeyGenRequestOptions = {}
  ): Promise<{ data: T; raw: HeyGenRawResponse }> {
    const {
      retries = 3,
      backoffMs = 1000,
      idempotencyKey,
      timeoutMs = 30000,
      ...fetchOptions
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : 
      endpoint.startsWith('/v1') ? `${HEYGEN_API_V1.replace('/v1', '')}${endpoint}` :
      `${HEYGEN_API_V2.replace('/v2', '')}${endpoint}`;

    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      ...(fetchOptions.headers as Record<string, string>),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const rawBody = await response.text();
        let parsed: any;
        
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = { raw: rawBody };
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
          if (attempt < retries) {
            await sleep(retryAfter * 1000);
            continue;
          }
          throw new HeyGenError({
            message: 'Rate limited by HeyGen API',
            statusCode: 429,
            rawResponse: parsed,
            retryable: true,
          });
        }

        // Handle server errors (retryable)
        if (response.status >= 500) {
          if (attempt < retries) {
            await sleep(backoffMs * Math.pow(2, attempt));
            continue;
          }
          throw new HeyGenError({
            message: `HeyGen server error: ${response.status}`,
            statusCode: response.status,
            rawResponse: parsed,
            retryable: true,
          });
        }

        // Handle client errors (not retryable)
        if (response.status >= 400) {
          throw new HeyGenError({
            message: parsed?.message || parsed?.error?.message || `HeyGen error: ${response.status}`,
            statusCode: response.status,
            heygenCode: parsed?.error?.code,
            rawResponse: parsed,
            retryable: false,
          });
        }

        // Success
        return {
          data: (parsed.data || parsed) as T,
          raw: parsed,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof HeyGenError && !error.retryable) {
          throw error;
        }

        // AbortError = timeout
        if ((error as any).name === 'AbortError') {
          lastError = new HeyGenError({
            message: 'HeyGen API request timed out',
            statusCode: 408,
            retryable: true,
          });
        }

        if (attempt < retries) {
          await sleep(backoffMs * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError || new Error('HeyGen request failed after retries');
  }

  // ═══════════════════════════════════════════════════════════
  // AVATAR APIs
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a Digital Twin avatar from training video URL.
   * HeyGen v2 endpoint: POST /v2/avatars
   * The video must be accessible via HTTPS URL (we provide a time-limited signed URL).
   */
  async createAvatar(params: HeyGenAvatarCreateRequest): Promise<{
    data: HeyGenAvatarCreateResponse;
    raw: HeyGenRawResponse;
  }> {
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('avatar');

    return this.request<HeyGenAvatarCreateResponse>('/v2/avatars', {
      method: 'POST',
      body: JSON.stringify({
        video_url: params.videoUrl,
        avatar_name: params.avatarName,
        callback_url: params.callbackUrl,
      }),
      idempotencyKey,
      retries: 2, // Lower retries for creation (idempotent via key)
    });
  }

  /**
   * Get avatar training status (polling fallback)
   */
  async getAvatarStatus(avatarId: string): Promise<{
    data: HeyGenAvatarStatusResponse;
    raw: HeyGenRawResponse;
  }> {
    return this.request<HeyGenAvatarStatusResponse>(`/v2/avatars/${avatarId}`, {
      method: 'GET',
      retries: 2,
    });
  }

  /**
   * Request consent URL for avatar creation
   * User must complete consent before training proceeds
   */
  async requestConsent(avatarId: string): Promise<{
    data: HeyGenConsentResponse;
    raw: HeyGenRawResponse;
  }> {
    return this.request<HeyGenConsentResponse>(`/v2/avatars/${avatarId}/consent`, {
      method: 'POST',
      retries: 2,
    });
  }

  /**
   * Check consent status (polling fallback)
   */
  async getConsentStatus(avatarId: string): Promise<{
    data: HeyGenConsentResponse;
    raw: HeyGenRawResponse;
  }> {
    return this.request<HeyGenConsentResponse>(`/v2/avatars/${avatarId}/consent`, {
      method: 'GET',
      retries: 2,
    });
  }

  /**
   * Delete an avatar
   */
  async deleteAvatar(avatarId: string): Promise<void> {
    await this.request(`/v2/avatars/${avatarId}`, {
      method: 'DELETE',
      retries: 1,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VOICE CLONE APIs
  // ═══════════════════════════════════════════════════════════

  /**
   * Clone a voice from audio URL.
   * Audio must be 1-3 minutes, clean speech, single speaker.
   */
  async cloneVoice(params: HeyGenVoiceCloneRequest): Promise<{
    data: HeyGenVoiceCloneResponse;
    raw: HeyGenRawResponse;
  }> {
    return this.request<HeyGenVoiceCloneResponse>('/v1/voice.clone', {
      method: 'POST',
      body: JSON.stringify({
        audio_url: params.audioUrl,
        voice_name: params.voiceName,
        language: params.language || 'en',
        ...(params.callbackUrl && { callback_url: params.callbackUrl }),
      }),
      retries: 2,
    });
  }

  /**
   * Get voice clone status (polling fallback)
   */
  async getVoiceStatus(voiceId: string): Promise<{
    data: { voice_id: string; status: string };
    raw: HeyGenRawResponse;
  }> {
    return this.request(`/v1/voice/${voiceId}`, {
      method: 'GET',
      retries: 2,
    });
  }

  /**
   * Delete a cloned voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    await this.request(`/v1/voice/${voiceId}`, {
      method: 'DELETE',
      retries: 1,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VIDEO GENERATION APIs
  // ═══════════════════════════════════════════════════════════

  /**
   * Generate video with avatar + cloned voice + script.
   * Supports 9:16, 16:9, solid/image backgrounds, transparent WEBM.
   */
  async generateVideo(params: HeyGenVideoCreateRequest): Promise<{
    data: HeyGenVideoCreateResponse;
    raw: HeyGenRawResponse;
  }> {
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey('video');
    const dimension = this.resolveDimension(params.aspectRatio, params.resolution);

    // Build background config
    let background: any;
    if (params.transparentBackground) {
      background = { type: 'transparent' };
    } else if (params.backgroundImageUrl) {
      background = { type: 'image', url: params.backgroundImageUrl };
    } else {
      background = { type: 'color', value: params.backgroundColor || '#000000' };
    }

    const body = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: params.avatarId,
            avatar_style: 'normal',
          },
          voice: {
            type: 'text',
            voice_id: params.voiceId,
            input_text: params.script,
          },
          background,
        },
      ],
      dimension,
      callback_id: idempotencyKey,
      callback_url: params.callbackUrl,
      ...(params.transparentBackground && { output_format: 'webm' }),
    };

    return this.request<HeyGenVideoCreateResponse>('/v2/video/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotencyKey,
      retries: 1, // Video generation is expensive, fewer retries
    });
  }

  /**
   * Get video generation status (polling fallback)
   */
  async getVideoStatus(videoId: string): Promise<{
    data: HeyGenVideoStatusResponse;
    raw: HeyGenRawResponse;
  }> {
    return this.request<HeyGenVideoStatusResponse>(`/v1/video_status.get?video_id=${videoId}`, {
      method: 'GET',
      retries: 3,
    });
  }

  // ─── Dimension Resolver ──────────────────────────────────

  private resolveDimension(
    aspectRatio: '9:16' | '16:9' | '1:1',
    resolution: '480p' | '720p' | '1080p'
  ): { width: number; height: number } {
    const map: Record<string, Record<string, { width: number; height: number }>> = {
      '9:16': {
        '480p': { width: 480, height: 854 },
        '720p': { width: 720, height: 1280 },
        '1080p': { width: 1080, height: 1920 },
      },
      '16:9': {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 },
      },
      '1:1': {
        '480p': { width: 480, height: 480 },
        '720p': { width: 720, height: 720 },
        '1080p': { width: 1080, height: 1080 },
      },
    };

    return map[aspectRatio]?.[resolution] || { width: 1280, height: 720 };
  }
}

// ─── Singleton Export ────────────────────────────────────────

let _client: HeyGenClient | null = null;

export function getHeyGenClient(): HeyGenClient {
  if (!_client) {
    _client = new HeyGenClient();
  }
  return _client;
}

export const heygenClient = new Proxy({} as HeyGenClient, {
  get(_, prop) {
    return (getHeyGenClient() as any)[prop];
  },
});
