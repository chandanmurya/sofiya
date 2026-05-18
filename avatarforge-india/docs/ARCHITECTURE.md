# AvatarForge India - Architecture & Product Documentation

## A) Product Requirements & User Flows

### Target Users
- Indian creators (YouTube, Instagram Reels)
- Agencies creating content for clients
- Small businesses needing video marketing
- Education content creators

### Core User Flow

```
1. Sign Up → Google OAuth or Email/Password
2. Create Avatar → Upload training video (5-10 min) → Complete consent → Wait for training
3. Clone Voice → Upload audio sample (1-3 min) → Wait for processing
4. Create Video → Select avatar + voice + write script → Choose format → Generate
5. Download/Share → Get completed video
```

### Detailed User Flows

#### Avatar Creation Flow
```
Upload Video → Validate (type, size, duration) → Store in R2
  → Get presigned URL → Call HeyGen createAvatar API
  → Receive consent URL → User completes consent
  → HeyGen trains avatar → Webhook: avatar.ready
  → Avatar status: READY
```

#### Video Generation Flow
```
Select Avatar + Voice → Write/choose script
  → Choose aspect ratio (9:16 or 16:9) + resolution + background
  → Estimate credits → Confirm & deduct credits
  → Call HeyGen generateVideo API
  → Poll status / await webhook
  → Video ready → Download from HeyGen → Store in R2
```

### Normalized Job States
| State | Description |
|-------|-------------|
| QUEUED | Job created, waiting to be processed |
| UPLOADING | File being uploaded to storage |
| PROCESSING | Submitted to HeyGen, being processed |
| NEEDS_CONSENT | Avatar requires consent completion |
| APPROVED | Consent approved, proceeding |
| FAILED | Terminal failure state |
| READY | Successfully completed |

---

## B) Database Schema

See `prisma/schema.prisma` for complete schema. Key tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| User | Authentication & profile | email, role, locale |
| Avatar | Digital twin avatars | heygenAvatarId, status, consentUrl, consentStatus |
| VoiceClone | Cloned voices | heygenVoiceId, status, language |
| Video | Generated videos | heygenVideoId, status, outputUrl, creditsUsed |
| Job | Background job tracking | type, status, entityId, idempotencyKey |
| Subscription | Plan management | razorpaySubId, plan, monthlyCredits |
| CreditBalance | Credit accounting | balance, totalEarned, totalSpent |
| UsageRecord | Per-operation cost tracking | type, credits, costInr |
| Invoice | Payment history | razorpayPaymentId, amount, status |
| WebhookLog | Webhook audit trail | source, eventType, payload, status |
| ScriptTemplate | Pre-built templates | name, script, language, category |

### Key Indexes
- User: email (unique)
- Avatar: userId, heygenAvatarId (unique), status
- Video: userId, heygenVideoId (unique), status, createdAt
- Job: userId, status, entityId+entityType
- WebhookLog: source+eventType, createdAt

---

## C) API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/[...nextauth]` | NextAuth handlers |

### Upload
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| POST | `/api/upload` | `{ type, filename, contentType, fileSizeMb }` | `{ uploadUrl, key, publicUrl }` |

### Avatars
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/avatars` | - | `{ data: Avatar[] }` |
| POST | `/api/avatars` | `{ name, trainingVideoKey, durationSec? }` | `{ id, status, consentUrl?, creditsDeducted }` |
| GET | `/api/avatars/[id]/status` | - | `{ data: { status, consentStatus, ... } }` |
| GET | `/api/avatars/[id]/consent` | - | `{ data: { consentUrl, status } }` |
| POST | `/api/avatars/[id]/consent` | - | `{ data: { consentUrl, status } }` |

### Voices
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/voices` | - | `{ data: VoiceClone[] }` |
| POST | `/api/voices` | `{ name, audioKey, language, sourceType }` | `{ id, status, creditsDeducted }` |

### Videos
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/videos` | `?page=1&limit=20&status=` | `{ data: Video[], pagination }` |
| POST | `/api/videos` | `{ title, avatarId, voiceId, script, aspectRatio, resolution, ... }` | `{ id, status, creditsDeducted }` |
| GET | `/api/videos/[id]/status` | - | `{ data: { status, outputUrl? } }` |

### Billing
| Method | Route | Request | Response |
|--------|-------|---------|----------|
| GET | `/api/billing` | - | `{ subscription, credits, invoices, plans }` |
| POST | `/api/billing` | `{ planId }` | `{ subscriptionId, shortUrl }` |
| DELETE | `/api/billing` | `{ cancelAtEnd? }` | `{ message }` |

### Webhooks
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/heygen` | HeyGen callback (avatar/voice/video events) |
| POST | `/api/webhooks/razorpay` | Razorpay callback (subscription/payment events) |

### Admin
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin` | Dashboard stats, failed jobs, top users |

---

## D) Background Job Design

### Architecture
```
[API Route] → [BullMQ Queue] → [Worker Process] → [HeyGen API / R2]
                                       ↑
                              [Webhook Handler] (updates state)
```

### Queues
| Queue | Purpose | Concurrency | Rate Limit |
|-------|---------|-------------|------------|
| avatar-training | Avatar creation orchestration | 5 | 10/min |
| voice-cloning | Voice clone orchestration | 5 | 10/min |
| video-generation | Video gen orchestration | 3 | 5/min |
| video-download | Download & persist HeyGen videos | 3 | - |

### Retry Strategy
- Avatar/Voice: 3 attempts, exponential backoff (5s, 10s, 20s)
- Video Generation: 2 attempts, exponential backoff (10s, 20s)
- Downloads: 3 attempts, exponential backoff (5s, 10s, 20s)

### Webhook + Polling Dual Strategy
1. **Primary**: HeyGen sends webhook to `/api/webhooks/heygen`
2. **Fallback**: Client polls `/api/[entity]/[id]/status` every 5-8s
3. **Server poll**: Status endpoint calls HeyGen API if no webhook received

---

## E) Cost Model

### HeyGen API Costs (Approximate)
| Operation | HeyGen Cost (USD) | Our Margin | Credits Charged |
|-----------|-------------------|------------|-----------------|
| Avatar Training | ~$5/training | 3x | 50 credits |
| Voice Cloning | ~$1/clone | 3x | 10 credits |
| Video (720p/min) | ~$1.50/min | 3x | 15 credits/min |
| Video (1080p/min) | ~$2.50/min | 3x | 25 credits/min |
| Video (480p/min) | ~$0.80/min | 3x | 10 credits/min |
| Transparent BG | +20% premium | - | +20% credits |

### Credit Value
- 1 credit = ₹10 internal cost value
- Conservative 3x margin on all operations
- Ensures profitability even with Razorpay fees (2%)

---

## F) Subscription Plans

| Plan | Price (INR/mo) | Credits | Avatars | Voices | Max Res | Max Duration |
|------|----------------|---------|---------|--------|---------|--------------|
| Free | ₹0 | 50 | 1 | 1 | 720p | 60s |
| Starter | ₹999 | 200 | 2 | 2 | 720p | 3 min |
| Creator | ₹2,499 | 600 | 5 | 5 | 1080p | 10 min |
| Agency | ₹7,999 | 2,500 | 20 | 20 | 1080p | 30 min |

### Profitability Analysis
| Plan | Revenue | Max API Cost (if all credits used) | Gross Margin |
|------|---------|--------------------------------------|--------------|
| Starter | ₹999 | ~₹667 (200 credits × ₹3.33 cost) | ~33% |
| Creator | ₹2,499 | ~₹2,000 | ~20% |
| Agency | ₹7,999 | ~₹8,333 | Break-even* |

*Agency tier profitable due to most users not exhausting all credits (typical 60-70% usage).

---

## G) Security Checklist

### Webhook Verification
- [x] HeyGen: HMAC-SHA256 signature verification with timing-safe comparison
- [x] HeyGen: Token-based fallback verification
- [x] Razorpay: x-razorpay-signature HMAC verification
- [x] Both: Idempotent processing (deduplicate via WebhookLog)

### Authentication & Authorization
- [x] NextAuth with JWT sessions (30-day expiry)
- [x] Google OAuth + credentials provider
- [x] Role-based access (USER/ADMIN)
- [x] All API routes check authentication
- [x] Admin routes require ADMIN role
- [x] Resource ownership validation (user can only access own data)

### API Key Security
- [x] HeyGen API key: server-side only, never in client bundles
- [x] Razorpay keys: server-side only
- [x] R2 credentials: server-side only
- [x] Presigned URLs for client uploads (time-limited)

### Storage Security
- [x] Presigned upload URLs (1-hour expiry)
- [x] Presigned download URLs for HeyGen access (1-hour expiry)
- [x] File type validation (whitelist)
- [x] File size limits enforced

### Rate Limiting & Abuse Prevention
- [x] BullMQ rate limiters per queue
- [x] Credit system prevents unlimited usage
- [x] Plan limits cap avatars/voices/resolution
- [x] Hard stop when credits = 0

---

## H) Edge Cases & Failure Handling

### Upload Failures
- Client-side: Retry upload to presigned URL (URL valid for 1 hour)
- Server-side: Validate file before creating avatar/voice record
- If file corrupt: HeyGen rejects → FAILED status → user can retry

### HeyGen API Failures
- 429 Rate Limit: Automatic retry with Retry-After header
- 5xx Server Error: 3 retries with exponential backoff
- 4xx Client Error: Fail immediately, surface error to user
- Timeout (30s): Retry up to 3 times

### Consent Flow Edge Cases
- User never completes consent: Avatar stays in CONSENT_PENDING
- User rejects consent: Avatar marked FAILED, credits NOT refunded (policy)
- Consent URL expires: User can request new consent URL

### Webhook Reliability
- Duplicate webhooks: Idempotent processing via dedupKey
- Missing webhooks: Polling fallback every 5-8 seconds from client
- Out-of-order webhooks: State machine prevents backward transitions
- Webhook verification fails: Logged + rejected (401)

### Billing Edge Cases
- Payment fails: Subscription marked PAST_DUE, credits frozen
- Double charge: Razorpay idempotency + our dedup in WebhookLog
- Subscription cancelled mid-cycle: Access continues until period end
- Plan downgrade: Current resources preserved, new limits apply on renewal

### Credit System Edge Cases
- Race condition on deduction: Transaction-based (Prisma $transaction)
- Credits go negative: Prevented by check-before-deduct pattern
- Monthly reset: Only on successful payment webhook
- Refund: Admin manually adds credits back

### Video Generation Failures
- HeyGen rejects avatar/voice: Clear error message shown
- Script too long: Validated at API level (5000 char max)
- Resolution exceeds plan: Blocked before submission
- Video generation fails after credit deduction: Mark FAILED, admin can refund

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                  Vercel / Railway                │
│  ┌───────────────────────────────────────────┐  │
│  │         Next.js App (Frontend + API)      │  │
│  │  - App Router pages                       │  │
│  │  - API Route handlers                     │  │
│  │  - NextAuth                               │  │
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
│           Worker Process (Railway/Fly)            │
│  - BullMQ workers                                │
│  - Processes avatar/voice/video jobs             │
│  - Downloads & persists videos                   │
└──────────────────────────────────────────────────┘
         │
         ▼
┌──────────────┐          ┌──────────────┐
│  HeyGen API  │          │  Razorpay    │
│  (External)  │          │  (Payments)  │
└──────────────┘          └──────────────┘
```

## Tech Decision: Why Next.js API Routes (not separate backend)?

1. **Simplicity**: Single deployment, single codebase
2. **Type sharing**: Frontend + backend share TypeScript types
3. **Auth integration**: NextAuth works seamlessly
4. **Webhooks**: Work fine as serverless route handlers
5. **Separate workers**: BullMQ workers run as a separate process (Railway/Fly)
6. **Scale path**: Can extract to separate service later if needed

The only separate process is the BullMQ worker, which handles background job orchestration.
