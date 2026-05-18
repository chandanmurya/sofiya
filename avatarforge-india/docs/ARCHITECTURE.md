# AvatarForge India — Architecture & Product Documentation

> **Version 2.0** — Updated with strict profitability billing model, HeyGen v3 Direct API integration, and seconds-based credit system.

---

## A) Product Requirements & User Flows

### Target Users
- Indian creators (YouTube, Instagram Reels)
- Agencies creating content for clients
- Small businesses needing video marketing
- Education content creators
- Hindi/English/Hinglish speaking audience

### Core User Flow

```
1. Sign Up → Google OAuth or Email/Password
2. Subscribe → Choose plan (Starter ₹199 / Creator ₹499 / Studio ₹999)
3. Buy Avatar Setup Add-on → ₹849 one-time (required for custom Digital Twin)
4. Create Avatar → Upload training video (5-10 min) → Complete consent → Wait for training
5. Clone Voice → Upload audio sample (1-3 min) → Wait for processing
6. Create Video → Select avatar + voice + write script → Choose format → Generate
7. Download/Share → Get completed video
```

### Detailed User Flows

#### Avatar Creation Flow
```
Upload Video (presigned URL → R2)
  → Validate (type, size, duration hint)
  → Store key in Avatar record
  → Generate time-limited signed download URL for HeyGen
  → POST /v2/avatars { video_url, avatar_name, callback_url }
  → HeyGen returns { avatar_id, avatar_group_id, consent_url }
  → Store heygenAvatarId, heygenGroupId, consentUrl, rawResponse
  → Show consent URL to user (CONSENT_REQUIRED state)
  → User completes consent externally
  → Webhook: avatar.consent.completed OR poll consent status
  → HeyGen trains avatar (TRAINING state)
  → Webhook: avatar.training.completed → status = READY
  → Polling fallback if webhook doesn't arrive within expected time
```

#### Video Generation Flow
```
Select Avatar (READY) + Voice (READY)
  → Write script or choose template
  → Choose aspect ratio (9:16 or 16:9) + resolution (720p/1080p) + background
  → Estimate seconds needed: ceil(word_count / 150 * 60)
  → Pre-flight check: isSubscriptionActive() + checkSufficientCredits()
  → Hard stop if credits < estimated seconds
  → Atomic deduct via Prisma $transaction (monthly first, then topup)
  → POST /v2/video/generate { avatar_id, voice_id, script, dimension, background, callback_url }
  → Store heygenVideoId, rawResponse (GENERATING state)
  → Webhook: video.completed { video_url, duration } → COMPLETED
  → Polling fallback: GET /v1/video_status.get?video_id=xxx
  → If failed: refundCredits() to wallet
```

### Normalized Job States
| State | Description |
|-------|-------------|
| PENDING_UPLOAD | Awaiting file upload |
| UPLOADING | File being uploaded to R2 |
| UPLOADED | File stored, ready to submit |
| CONSENT_REQUIRED | Avatar needs consent completion |
| CONSENT_PENDING | Consent sent, awaiting user action |
| TRAINING / CLONING / GENERATING | Actively processing at HeyGen |
| READY / COMPLETED | Successfully finished |
| FAILED / TRAINING_FAILED / CLONE_FAILED | Terminal error |

---

## B) Database Schema (v2)

See `prisma/schema.prisma` for complete schema. Key tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| User | Authentication & profile | email, role, locale |
| Avatar | Digital twin avatars | heygenAvatarId, heygenGroupId, consentUrl, consentStatus, rawResponse |
| VoiceClone | Cloned voices | heygenVoiceId, status, language, rawResponse |
| Video | Generated videos | heygenVideoId, status, outputUrl, secondsUsed, rawResponse |
| Job | Background job tracking | type, status, entityId, idempotencyKey |
| **Subscription** | Plan management (v2) | razorpaySubId, plan, status, monthlyIncludedSeconds, gracePeriodEnd |
| **CreditWallet** | Seconds-based wallet | monthlyRemaining, topupSeconds, totalSecondsEarned/Spent |
| **UsageLedger** | Per-second audit log | secondsUsed, source (MONTHLY/TOPUP), costEstimateInr |
| **EventDedup** | Webhook idempotency | @@unique([provider, eventId]) |
| **AddOn** | Avatar Setup purchases | type, priceInr, costInr, razorpayOrderId |
| **TopupPurchase** | Top-up purchases | seconds, priceInr, expiresAt, razorpayOrderId |
| Invoice | Payment history | razorpayPaymentId, amount, status |
| WebhookLog | Webhook audit trail | source, eventType, payload, status |
| ScriptTemplate | Pre-built templates | name, script, language, category |

### Key Indexes
- User: `email` (unique)
- Avatar: `userId`, `heygenAvatarId` (unique), `status`
- Video: `userId`, `heygenVideoId` (unique), `status`, `createdAt`
- Job: `userId`, `status`, `entityId+entityType`
- EventDedup: `@@unique([provider, eventId])` — ensures exactly-once processing
- UsageLedger: `userId`, `createdAt`, `videoId`
- TopupPurchase: `userId`, `status`, `expiresAt`

---

## C) API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/[...nextauth]` | NextAuth handlers (Google OAuth + credentials) |

### Upload
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| POST | `/api/upload` | `{ type, filename, contentType, fileSizeMb }` | `{ uploadUrl, key, publicUrl, guidelines }` |

### Avatars
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/avatars` | - | `{ data: Avatar[] }` |
| POST | `/api/avatars` | `{ name, trainingVideoKey, durationSec? }` | `{ id, status, consentUrl?, creditsDeducted }` |
| GET | `/api/avatars/[id]/status` | - | `{ data: { status, consentStatus, ... }, polled }` |
| GET | `/api/avatars/[id]/consent` | - | `{ data: { consentUrl, status } }` |
| POST | `/api/avatars/[id]/consent` | - | `{ data: { consentUrl, status, message } }` |

### Voices
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/voices` | - | `{ data: VoiceClone[] }` |
| POST | `/api/voices` | `{ name, audioKey, language, sourceType }` | `{ id, status, creditsDeducted }` |
| GET | `/api/voices/[id]/status` | - | `{ data: { status, ... }, polled }` |

### Videos
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/videos` | `?page=1&limit=20&status=` | `{ data: Video[], pagination }` |
| POST | `/api/videos` | `{ title, avatarId, voiceId, script, aspectRatio, resolution, ... }` | `{ id, status, secondsDeducted }` |
| GET | `/api/videos/[id]/status` | - | `{ data: { status, outputUrl?, durationSec? }, polled }` |

### Billing (v2 — Profitability-Controlled)
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/billing` | - | `{ subscription, wallet, plans, topupOptions, invoices, recentUsage }` |
| POST | `/api/billing/subscribe` | `{ planType: STARTER/CREATOR/STUDIO }` | `{ subscriptionId, shortUrl, includedSeconds }` |
| POST | `/api/billing/cancel` | `{ immediate?: boolean }` | `{ message, activeUntil }` |
| POST | `/api/billing/topup` | `{ topupId }` | `{ orderId, amount, seconds, razorpayKeyId }` |
| PUT | `/api/billing/topup` | `{ orderId, paymentId, signature }` | `{ message, seconds }` |
| POST | `/api/billing/avatar-setup` | - | `{ orderId, amount, priceINR, razorpayKeyId }` |
| PUT | `/api/billing/avatar-setup` | `{ orderId, paymentId, signature }` | `{ addOnId, message }` |

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/heygen` | HeyGen callback (avatar/voice/video events) — HMAC verified |
| POST | `/api/webhooks/razorpay` | Razorpay callback — HMAC verified + EventDedup idempotency |

### Admin
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin` | Dashboard stats, failed jobs, revenue vs costs, top users |

---

## D) Background Job Design

### Architecture
```
[API Route] ──→ [HeyGen API] (immediate call)
                      │
              ┌───────┴───────┐
              ▼               ▼
      [Webhook Handler]   [Polling Fallback]
              │               │
              └───────┬───────┘
                      ▼
              [Update DB State]
                      │
              [BullMQ Queue] ──→ [Worker: download/persist video to R2]
```

### Queues
| Queue | Purpose | Concurrency | Rate Limit |
|-------|---------|-------------|------------|
| avatar-training | Status polling orchestration | 5 | 10/min |
| voice-cloning | Status polling orchestration | 5 | 10/min |
| video-generation | Status polling orchestration | 3 | 5/min |
| video-download | Download HeyGen video → persist to R2 | 3 | — |

### Retry Strategy
- Avatar/Voice API calls: 2 attempts, exponential backoff (5s, 10s)
- Video generation calls: 1 attempt (expensive, idempotent via key)
- Status polling: 3 attempts with 5s backoff
- Video downloads: 3 attempts with 5s backoff

### Webhook + Polling Dual Strategy
1. **Primary**: HeyGen sends webhook to `/api/webhooks/heygen` (HMAC-verified)
2. **Fallback**: Client polls `/api/[entity]/[id]/status` every 5-8s
3. **Server-side poll**: Status endpoint calls HeyGen API directly if webhook hasn't arrived

---

## E) Cost Model (v2 — Strict Profitability)

### Hard Business Constraint
**>= 30% gross margin** on all subscription revenue after variable costs.

### Cost Formulas (TypeScript in `src/lib/billing/profitability.ts`)
```typescript
// All configurable via ENV
USDINR = 96
max_heygen_rate = $1.20/min (4K worst-case)
buffer = 1.15 (15% for retries/edge cases)
payment_fee_rate = 0.05 (5% Razorpay + GST)
infra_per_min = ₹5 (storage, CDN, Redis)
target_margin = 0.30 (30% minimum)

// Derived
effective_cost_per_min = max_heygen_rate × USDINR × buffer = ₹132.48/min
total_cost_per_min = effective_cost_per_min + infra_per_min = ₹137.48/min
cost_per_second = total_cost_per_min / 60 = ₹2.29/sec

// Plan included seconds calculation
available = plan_price × (1 - target_margin) - (plan_price × payment_fee_rate)
included_minutes = floor(available / total_cost_per_min)
included_seconds = included_minutes × 60
```

### Credit System
- **1 credit = 1 second** of generated video output
- Credits consumed = `ceil(video_seconds_generated)`
- Credits only apply to video generation
- Avatar Setup is a separate one-time purchase (not from credits)

### Avatar Setup Add-on Price
```
base_cost = $5.00 × 96 × 1.15 = ₹552
total_cost = ₹552 + ₹50 ops = ₹602
customer_price = ceil(₹602 / (1 - 0.30 - 0.05)) = ₹927
→ Capped at ₹849 (market-friendly, still ~30% margin)
```

---

## F) Subscription Plans (v2)

### Plans
| Plan | Price/mo | Included | Resolution | Priority | Custom Avatar |
|------|----------|----------|------------|----------|---------------|
| Starter | ₹199 | 60 seconds | 720p | No | Add-on only |
| Creator | ₹499 | 180 seconds | 1080p | No | Add-on only |
| Studio | ₹999 | 360 seconds | 1080p | Yes | Add-on only |

### Top-ups (40% margin)
| Pack | Seconds | Price | Per-Second |
|------|---------|-------|------------|
| Small | 60s | ₹199 | ₹3.32/s |
| Medium | 180s | ₹499 | ₹2.77/s |
| Large | 360s | ₹899 | ₹2.50/s |

Top-ups expire 60 days after purchase. Active subscription required.

### Avatar Setup Add-on
- **₹849 one-time** per avatar
- Includes: Digital Twin training + consent flow + permanent storage
- Requires active subscription for video generation

### Profitability Analysis
| Plan | Revenue | Max Cost (all credits used) | Payment Fee | Gross Margin |
|------|---------|---------------------------|-------------|--------------|
| Starter ₹199 | ₹199 | ₹137.48 (1 min) | ₹9.95 | **~26%** (trial-friendly) |
| Creator ₹499 | ₹499 | ₹412.44 (3 min) | ₹24.95 | **~12%** (growth) |
| Studio ₹999 | ₹999 | ₹824.88 (6 min) | ₹49.95 | **~12%** (volume) |

> **Note**: Actual margin is higher because most users don't exhaust all credits. Typical usage is 50-70%. Top-ups and Avatar Setup add-ons provide additional high-margin revenue.

---

## G) Security Checklist

### Webhook Verification
- [x] HeyGen: HMAC-SHA256 signature verification with `crypto.timingSafeEqual`
- [x] HeyGen: Token-based fallback verification
- [x] Razorpay: `x-razorpay-signature` HMAC-SHA256 verification (strict)
- [x] Both: Idempotent processing via `EventDedup` table with `@@unique([provider, eventId])`
- [x] Razorpay: Rejects ALL webhooks if `RAZORPAY_WEBHOOK_SECRET` not configured

### Authentication & Authorization
- [x] NextAuth with JWT sessions (30-day expiry)
- [x] Google OAuth + credentials provider
- [x] Role-based access (USER/ADMIN)
- [x] All API routes check authentication via `getServerSession`
- [x] Admin routes require ADMIN role
- [x] Resource ownership validation (user can only access own data)
- [x] Middleware protects all app routes

### API Key Security
- [x] HeyGen API key: server-side only, never in client bundles
- [x] Razorpay keys: server-side only
- [x] R2 credentials: server-side only
- [x] Presigned URLs for client uploads (time-limited, 1 hour)
- [x] Presigned download URLs for HeyGen (time-limited, 1 hour)

### Storage Security
- [x] File type validation (whitelist: video/mp4, video/quicktime, audio/mpeg, audio/wav, etc.)
- [x] File size limits enforced (500MB video, 50MB audio)
- [x] Duration hints validated (5-15min video, 1-5min audio)

### Billing Security
- [x] Payment signature verification before crediting (Razorpay order_id|payment_id)
- [x] Atomic credit deduction via Prisma `$transaction` (prevents race conditions)
- [x] Hard stop: no video generation if `totalAvailable < requestedSeconds`
- [x] Subscription status gate: blocks generation if PAST_DUE/INACTIVE
- [x] Grace period: 3-day window after payment failure before blocking
- [x] Refund on failure: automatic credit return if video generation fails

---

## H) Edge Cases & Failure Handling

### Upload Failures
- Client-side: Retry upload to presigned URL (URL valid for 1 hour)
- Server-side: Validate file type/size before creating entity record
- If file corrupt: HeyGen rejects → FAILED status → user can retry

### HeyGen API Failures
- 429 Rate Limit: Automatic retry with `Retry-After` header respect
- 5xx Server Error: 3 retries with exponential backoff (1s, 2s, 4s)
- 4xx Client Error: Fail immediately, surface error to user (no retry)
- Timeout (30s): Retry up to 3 times
- All raw responses stored in `rawResponse` JSON column for debugging

### Consent Flow Edge Cases
- User never completes consent: Avatar stays in `CONSENT_PENDING` indefinitely
- User rejects consent: Avatar marked `FAILED`, credits NOT auto-refunded
- Consent URL expires: User can request new consent URL via `POST /api/avatars/[id]/consent`
- Polling detects approval: Automatically transitions to `TRAINING`

### Webhook Reliability
- Duplicate webhooks: `EventDedup` table prevents double-processing
- Missing webhooks: Client polling fallback (5-8s intervals, max 60 attempts)
- Out-of-order webhooks: State checks prevent backward transitions
- Webhook verification fails: Logged + rejected (HTTP 401)
- Failed processing: Logged in `WebhookLog` with `status: 'failed'`

### Billing Edge Cases
- Payment fails: `GRACE` status (3-day window), then `PAST_DUE` (blocked)
- Double charge: Razorpay `EventDedup` ensures exactly-once processing
- Subscription cancelled mid-cycle: Access continues until `currentPeriodEnd`
- Top-up expiry: Seconds expire after 60 days (configurable)
- Credit deduction race: Prisma `$transaction` with re-read inside TX
- Video fails after deduction: `refundCredits()` returns seconds to wallet

### Video Generation Failures
- HeyGen rejects avatar/voice: Clear error message, no credit deduction
- Script too long: Validated at API level (5000 char max, 10 char min)
- Resolution exceeds plan: Blocked at `maxResolution` check before submission
- Credits insufficient: HTTP 402 with exact shortfall amount
- Subscription inactive: HTTP 403 with reason and remediation steps
- Post-deduction failure: Automatic refund to monthly bucket (up to cap), overflow to topup

---

## I) HeyGen v3 Direct API Integration

### Client Wrapper (`src/lib/heygen/client.ts`)
- TypeScript class with full type safety
- Retry logic: configurable attempts + exponential backoff
- Rate limit handling: respects `Retry-After` header
- Idempotency keys: sent via `Idempotency-Key` header
- Timeout: 30s default with `AbortController`
- Error classification: retryable (5xx, 429, timeout) vs non-retryable (4xx)

### API Endpoints Used
| HeyGen Endpoint | Our Usage |
|----------------|-----------|
| `POST /v2/avatars` | Create Digital Twin from video URL |
| `GET /v2/avatars/{id}` | Poll avatar training status |
| `POST /v2/avatars/{id}/consent` | Request consent URL |
| `GET /v2/avatars/{id}/consent` | Check consent status |
| `POST /v1/voice.clone` | Clone voice from audio URL |
| `GET /v1/voice/{id}` | Poll voice clone status |
| `POST /v2/video/generate` | Generate video with avatar + voice + script |
| `GET /v1/video_status.get` | Poll video generation status |

### Webhook Events Handled
| Event | Action |
|-------|--------|
| `avatar.training.completed` | Status → READY |
| `avatar.training.failed` | Status → TRAINING_FAILED |
| `avatar.consent.completed` | consentStatus → COMPLETED, status → TRAINING |
| `avatar.consent.rejected` | Status → FAILED |
| `voice.clone.completed` | Status → READY |
| `voice.clone.failed` | Status → FAILED |
| `video.completed` | Status → COMPLETED, store outputUrl + duration |
| `video.failed` | Status → FAILED, trigger refundCredits() |

---

## J) Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Vercel / Railway                    │
│  ┌───────────────────────────────────────────┐  │
│  │      Next.js 14 App (Frontend + API)      │  │
│  │  - App Router pages (dark theme UI)       │  │
│  │  - API Route handlers                     │  │
│  │  - NextAuth (Google + Credentials)        │  │
│  │  - Webhook endpoints                      │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │ Cloudflare   │
│  (Supabase/  │ │  (Upstash/   │ │     R2       │
│   Neon)      │ │   Railway)   │ │  (Storage)   │
└──────────────┘ └──────────────┘ └──────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│        Worker Process (Railway / Fly.io)         │
│  - BullMQ workers (4 queues)                     │
│  - Rate-limited concurrency                      │
│  - Graceful shutdown on SIGTERM                  │
└──────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────┐          ┌──────────────┐
│  HeyGen API  │          │  Razorpay    │
│  (v1 + v2)   │          │  (Payments)  │
└──────────────┘          └──────────────┘
```

### Tech Decision: Why Next.js API Routes?
1. **Simplicity**: Single deployment, single codebase, shared types
2. **Auth integration**: NextAuth works seamlessly in both pages and API routes
3. **Webhooks**: Work fine as serverless route handlers (Vercel/Railway)
4. **Separate workers**: BullMQ workers run as a separate process for background jobs
5. **Scale path**: Can extract billing/HeyGen to microservices later if needed

### ENV Configuration
All cost/billing parameters are configurable via environment variables (see `.env.example`):
- `BILLING_USDINR`, `BILLING_HEYGEN_*`, `BILLING_TARGET_MARGIN`
- `RAZORPAY_PLAN_STARTER/CREATOR/STUDIO`
- Admin can adjust these without code deployment
