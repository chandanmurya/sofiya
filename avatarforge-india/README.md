# AvatarForge India

> AI Avatar Clone Creator for the Indian market. Create your Digital Twin, clone your voice, generate professional videos — in Hindi, English, or Hinglish.

Built with Next.js 14, TypeScript, Tailwind CSS, Prisma, BullMQ, HeyGen API, Razorpay, and Cloudflare R2.

---

## Quick Start

### Prerequisites

- Node.js 18+ (22 recommended)
- Docker & Docker Compose (for local Postgres + Redis)
- A HeyGen API key
- A Razorpay account (test mode for dev)
- A Cloudflare R2 bucket (or any S3-compatible store)

### Setup

```bash
# 1. Clone and enter the project
cd avatarforge-india

# 2. Install dependencies
npm install

# 3. Copy environment template and fill in your keys
cp .env.example .env
# Edit .env with your actual values (see Environment Variables below)

# 4. Start local services (Postgres + Redis)
docker-compose up -d

# 5. Generate Prisma client
npx prisma generate

# 6. Push schema to database
npx prisma db push

# 7. Seed script templates
npm run db:seed

# 8. Start development server
npm run dev
# → http://localhost:3000

# 9. (Optional) Start background workers
npm run worker:dev
```

---

## Environment Variables

All required environment variables are documented in `.env.example`. Key groups:

| Group | Variables | Required |
|-------|-----------|----------|
| **App** | `NEXT_PUBLIC_APP_URL`, `NODE_ENV` | Yes |
| **Database** | `DATABASE_URL` | Yes |
| **Auth** | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID/SECRET` | Yes |
| **HeyGen** | `HEYGEN_API_KEY`, `HEYGEN_WEBHOOK_SECRET` | Yes |
| **Storage (R2)** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Yes |
| **Redis** | `REDIS_URL` | Yes (for workers) |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_*` | Yes |
| **Billing Config** | `BILLING_USDINR`, `BILLING_TARGET_MARGIN`, etc. | Optional (defaults provided) |
| **Sentry** | `SENTRY_DSN` | Optional |

---

## Deployment Guide

### Recommended Stack

| Service | Provider | Why |
|---------|----------|-----|
| **App** | Vercel | Zero-config Next.js deployment, global edge |
| **Database** | Supabase or Neon | Managed Postgres, free tier available |
| **Redis** | Upstash | Serverless Redis, pay-per-request |
| **Storage** | Cloudflare R2 | S3-compatible, no egress fees |
| **Workers** | Railway or Fly.io | Always-on process for BullMQ workers |
| **Domain** | Any registrar | Point to Vercel |

### Deploy Steps

#### 1. Database (Supabase/Neon)
```bash
# Create a Postgres database
# Copy the connection string to DATABASE_URL
# Run migrations:
npx prisma db push
npm run db:seed
```

#### 2. Redis (Upstash)
```bash
# Create an Upstash Redis database
# Copy the Redis URL to REDIS_URL
# Format: redis://default:TOKEN@ENDPOINT:PORT
```

#### 3. Storage (Cloudflare R2)
```bash
# Create an R2 bucket (e.g., "avatarforge-uploads")
# Create an API token with read/write access
# Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
# Enable public access or use custom domain for R2_PUBLIC_URL
```

#### 4. App (Vercel)
```bash
# Connect your GitHub repo to Vercel
# Add all environment variables in Vercel dashboard
# Deploy
vercel --prod
```

#### 5. Workers (Railway)
```bash
# Create a new Railway service
# Set command: npm run worker:start
# Add environment variables: DATABASE_URL, REDIS_URL, HEYGEN_API_KEY
# Deploy
```

#### 6. Webhooks
```bash
# HeyGen: Set callback URL to https://yourdomain.com/api/webhooks/heygen
# Razorpay: Add webhook URL https://yourdomain.com/api/webhooks/razorpay
#   Events: subscription.activated, subscription.charged, payment.captured,
#           payment.failed, invoice.paid, subscription.cancelled
```

#### 7. Razorpay Plans
```bash
# Create 3 subscription plans in Razorpay Dashboard:
#   Starter: ₹199/month
#   Creator: ₹499/month
#   Studio: ₹999/month
# Copy plan IDs to RAZORPAY_PLAN_STARTER, RAZORPAY_PLAN_CREATOR, RAZORPAY_PLAN_STUDIO
```

---

## Security Checklist

### Authentication & Authorization
- [x] NextAuth JWT sessions (30-day expiry, httpOnly cookies)
- [x] Google OAuth + credential-based auth
- [x] Role-based access control (USER / ADMIN)
- [x] Middleware protects all authenticated routes
- [x] Resource ownership validation on all endpoints

### API Key Protection
- [x] HeyGen API key: server-side only, never exposed to client
- [x] Razorpay keys: server-side only
- [x] R2 credentials: server-side only
- [x] Client uploads via time-limited presigned URLs (1-hour expiry)

### Webhook Security
- [x] Razorpay: HMAC-SHA256 verification with `crypto.timingSafeEqual` (MANDATORY)
- [x] HeyGen: HMAC signature + token fallback verification
- [x] Both: Idempotent processing via `EventDedup` table (unique constraint)
- [x] Both: Audit logged

### Rate Limiting
- [x] Per-user rate limits on generation endpoints (5 req/min)
- [x] Per-IP rate limits on auth endpoints (10 req/5min)
- [x] Per-user rate limits on creation endpoints (10 req/min)
- [x] Higher limits for webhook endpoints (100 req/min)

### CSRF Protection
- [x] SameSite=Lax cookies (NextAuth default)
- [x] Origin/Referer validation on all mutations
- [x] Custom header required for destructive actions

### Input Validation
- [x] All API inputs validated with Zod schemas
- [x] File type whitelist (video: mp4/mov/webm, audio: mp3/wav/m4a)
- [x] File size limits enforced (500MB video, 50MB audio)
- [x] Script length limits (10-5000 chars)

### Data Protection
- [x] Minimal PII stored (name, email only)
- [x] "Delete my data" flow with confirmation
- [x] Presigned URLs expire after 1 hour
- [x] Raw HeyGen responses stored for debugging (no user PII in them)
- [x] Passwords hashed with bcrypt (12 rounds)

### Credit System Security
- [x] Atomic deduction via Prisma `$transaction`
- [x] Double-check inside transaction (re-read wallet)
- [x] Hard stop: no generation if credits < requested
- [x] Automatic refund on generation failure

### Audit Trail
- [x] All sensitive actions logged (registration, deletion, purchases, generation)
- [x] Webhook events logged with full payload
- [x] IP address captured for auth events

---

## End-to-End Test Plan

### 1. Authentication Flow
| Test | Steps | Expected |
|------|-------|----------|
| Google OAuth | Click "Continue with Google" → Select account | Redirect to /dashboard, session created |
| Email Register | Fill form → Submit | Account created, auto-login, 60s credits granted |
| Email Login | Enter credentials → Submit | Session created, redirect to dashboard |
| Invalid Login | Wrong password → Submit | Error message shown, no redirect |
| Rate Limit Auth | 11 login attempts in 5 min | 429 response on 11th attempt |

### 2. Avatar Creation Flow
| Test | Steps | Expected |
|------|-------|----------|
| Upload Video | Select MP4 < 500MB | Presigned URL obtained, upload succeeds, file in R2 |
| Invalid File | Upload .exe file | Rejected at validation ("Invalid video type") |
| Create Avatar | Fill name → Submit | API call to HeyGen, avatar record created, consent URL shown |
| Consent Flow | Open consent URL → Complete | Polling detects approval, status → TRAINING |
| Training Complete | Wait for webhook | Status → READY, user notified |

### 3. Voice Cloning Flow
| Test | Steps | Expected |
|------|-------|----------|
| Upload Audio | Select MP3 1-3 min | Upload succeeds |
| Clone Voice | Fill name, select language → Submit | HeyGen called, status → CLONING |
| Clone Ready | Wait for webhook/poll | Status → READY |

### 4. Video Generation Flow
| Test | Steps | Expected |
|------|-------|----------|
| Insufficient Credits | Try to generate with 0 credits | 402 error, "Insufficient credits" message |
| Generate Video | Fill form with valid data → Submit | Credits deducted, video queued, redirect to My Videos |
| Video Completion | Wait for HeyGen webhook | Status → COMPLETED, download button shown |
| Failed Generation | HeyGen returns error | Status → FAILED, credits refunded automatically |

### 5. Billing Flow
| Test | Steps | Expected |
|------|-------|----------|
| Subscribe | Choose Creator plan → Pay via Razorpay | Subscription activated, 180s credits granted |
| Monthly Renewal | Razorpay charges monthly | Credits reset to plan amount |
| Payment Failed | Card declined | Status → GRACE (3 days), then PAST_DUE |
| Cancel | Click Cancel → Confirm | Access until period end, then INACTIVE |
| Top-up | Buy 60s pack → Pay | Credits added to wallet, expires in 60 days |
| Avatar Setup | Buy add-on → Pay | Can now create custom avatar |

### 6. Webhook Idempotency
| Test | Steps | Expected |
|------|-------|----------|
| Duplicate Webhook | Send same event twice | Second call returns "duplicate_skipped", no double-processing |
| Invalid Signature | Send webhook with wrong signature | 401 response, event rejected |
| Missing Signature | Send webhook without header | 401 response |

### 7. Data Deletion
| Test | Steps | Expected |
|------|-------|----------|
| Request Deletion | Settings → Type DELETE → Confirm | Request logged, toast confirmation |
| Verify Minimal PII | Check database | Only name + email stored, no unnecessary data |

### 8. Rate Limiting
| Test | Steps | Expected |
|------|-------|----------|
| Generation Limit | 6 video generations in 1 minute | 6th request returns 429 |
| Upload Limit | 21 upload requests in 1 minute | 21st returns 429 |

---

## Project Structure

```
avatarforge-india/
├── prisma/
│   ├── schema.prisma          # Database schema (v2)
│   └── seed.ts                # Script template seeder
├── src/
│   ├── app/
│   │   ├── (marketing)/       # Landing page (no auth)
│   │   ├── (auth)/            # Login, Register
│   │   ├── (app)/             # Authenticated app pages
│   │   │   ├── dashboard/
│   │   │   ├── create-avatar/
│   │   │   ├── clone-voice/
│   │   │   ├── create-video/
│   │   │   ├── my-videos/
│   │   │   ├── pricing/
│   │   │   ├── billing/
│   │   │   ├── settings/
│   │   │   └── admin/
│   │   └── api/
│   │       ├── auth/          # NextAuth + register
│   │       ├── avatars/       # Avatar CRUD + status
│   │       ├── voices/        # Voice CRUD + status
│   │       ├── videos/        # Video CRUD + status
│   │       ├── billing/       # Subscribe, cancel, topup, avatar-setup
│   │       ├── upload/        # Presigned URL generation
│   │       ├── webhooks/      # HeyGen + Razorpay callbacks
│   │       └── admin/         # Admin dashboard API
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   └── layout/            # Sidebar, AppLayout, Providers
│   ├── hooks/                 # usePolling, etc.
│   ├── lib/
│   │   ├── auth/              # NextAuth config + session helpers
│   │   ├── billing/           # Profitability engine, credits, Razorpay
│   │   ├── heygen/            # HeyGen v3 API client + webhook + polling
│   │   ├── queue/             # BullMQ queue setup
│   │   ├── security/          # Rate limiting, CSRF, audit log
│   │   ├── storage/           # Cloudflare R2 client
│   │   └── utils/             # Helpers, cn(), formatters
│   ├── styles/                # Global CSS + Tailwind
│   └── types/                 # TypeScript type definitions
├── workers/                   # BullMQ worker process
├── docs/                      # Architecture documentation
├── docker-compose.yml         # Local dev services
├── .env.example               # Environment variable template
└── README.md                  # This file
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run worker:dev` | Start BullMQ workers (watch mode) |
| `npm run worker:start` | Start BullMQ workers (production) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration |
| `npm run db:seed` | Seed script templates |

---

## License

Private. All rights reserved.
