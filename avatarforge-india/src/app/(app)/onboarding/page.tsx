'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';

// ─── Stock Avatars (placeholders — replaced with real HeyGen stock IDs in production) ─
const STOCK_AVATARS = [
  { id: 'stock_avatar_1', name: 'Priya', gender: 'Female', thumbnail: '', language: 'Hindi/English' },
  { id: 'stock_avatar_2', name: 'Arjun', gender: 'Male', thumbnail: '', language: 'Hindi/English' },
  { id: 'stock_avatar_3', name: 'Sarah', gender: 'Female', thumbnail: '', language: 'English' },
  { id: 'stock_avatar_4', name: 'Raj', gender: 'Male', thumbnail: '', language: 'Hinglish' },
];

// ─── Quick Script Templates (limited for free) ──────────────
const FREE_TEMPLATES = [
  { id: 'quick-intro', name: 'Quick Intro', script: 'Hi! I am [YOUR NAME] and I create content about [TOPIC]. Follow me for more!' },
  { id: 'product-teaser', name: 'Product Teaser', script: 'Check out [PRODUCT] — it solves [PROBLEM] in seconds. Try it today!' },
  { id: 'hindi-greeting', name: 'Hindi Greeting', script: 'नमस्ते दोस्तों! मैं हूं [NAME] और आज मैं आपको कुछ बहुत ज़रूरी बताने वाला हूं।' },
];

type OnboardingStep = 'welcome' | 'avatar' | 'script' | 'generating' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = session?.user?.name?.split(' ')[0] || 'Creator';
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(1, Math.ceil((wordCount / 150) * 60));
  const overLimit = estSeconds > 15;

  // Poll for video status when generating
  useEffect(() => {
    if (step !== 'generating' || !videoId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/status`);
        const data = await res.json();
        if (data.success) {
          if (data.data.status === 'COMPLETED') {
            setVideoUrl(data.data.outputUrl);
            setStep('done');
            clearInterval(interval);
            // Mark onboarding complete
            fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {});
          } else if (data.data.status === 'FAILED') {
            setError(data.data.errorMessage || 'Generation failed. Please try again.');
            setStep('script');
            clearInterval(interval);
          }
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [step, videoId]);

  // ─── Submit Generation ─────────────────────────────────
  async function handleGenerate() {
    if (!selectedAvatar || !script.trim() || overLimit) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/videos/demo-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockAvatarId: selectedAvatar,
          script: script.trim(),
          deviceHash: getDeviceHash(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setVideoId(data.data.videoId);
      setStep('generating');
      toast.success('Your video is being created!');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container max-w-2xl mx-auto">
      {/* ═══ Progress Dots ═══ */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(['welcome', 'avatar', 'script', 'generating', 'done'] as const).map((s, i) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              s === step ? 'w-6 bg-brand-500' :
              (['welcome', 'avatar', 'script', 'generating', 'done'].indexOf(step) > i)
                ? 'bg-brand-500/60'
                : 'bg-dark-500'
            }`}
          />
        ))}
      </div>

      {/* ═══ STEP: Welcome ═══ */}
      {step === 'welcome' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500/20 to-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-6">
            <span className="text-4xl">🎬</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Hey {firstName}! Let's create your<br />
            <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              first AI video
            </span>
          </h1>

          <p className="text-dark-100 text-sm leading-relaxed max-w-md mx-auto mb-2">
            Pick a stock avatar, type a short script, and watch the magic happen.
            Takes less than 30 seconds.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mt-2 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            15 seconds free — no card needed
          </div>

          <Button size="lg" onClick={() => setStep('avatar')}>
            Let's Go →
          </Button>

          <button
            onClick={() => router.push('/dashboard')}
            className="block mx-auto mt-4 text-xs text-dark-300 hover:text-dark-100 transition-colors"
          >
            Skip onboarding
          </button>
        </Card>
      )}

      {/* ═══ STEP: Select Stock Avatar ═══ */}
      {step === 'avatar' && (
        <Card padding="lg">
          <CardTitle className="text-center">Step 1: Choose an Avatar</CardTitle>
          <CardDescription className="text-center">
            Select a stock avatar for your demo video. Custom avatars unlock with paid plans.
          </CardDescription>

          <div className="grid grid-cols-2 gap-3 mt-6">
            {STOCK_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`p-4 rounded-xl border transition-all text-center ${
                  selectedAvatar === avatar.id
                    ? 'border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-dark-400/20 hover:border-dark-400/40 hover:bg-dark-600/30'
                }`}
              >
                {/* Avatar placeholder */}
                <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl mb-2 ${
                  selectedAvatar === avatar.id ? 'bg-brand-500/20' : 'bg-dark-600/50'
                }`}>
                  {avatar.gender === 'Female' ? '👩' : '👨'}
                </div>
                <p className={`text-sm font-medium ${selectedAvatar === avatar.id ? 'text-brand-400' : 'text-white'}`}>
                  {avatar.name}
                </p>
                <p className="text-[10px] text-dark-300 mt-0.5">{avatar.language}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={() => setStep('welcome')}>← Back</Button>
            <Button className="flex-1" disabled={!selectedAvatar} onClick={() => setStep('script')}>
              Next: Write Script →
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Script ═══ */}
      {step === 'script' && (
        <Card padding="lg">
          <CardTitle className="text-center">Step 2: Type Your Script</CardTitle>
          <CardDescription className="text-center">
            Keep it short — free demo is limited to 15 seconds (~35 words).
          </CardDescription>

          {/* Quick Templates */}
          <div className="mt-5 mb-4">
            <p className="text-xs text-dark-200 mb-2 font-medium">Quick start templates:</p>
            <div className="flex flex-wrap gap-2">
              {FREE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setScript(t.script)}
                  className="px-3 py-1.5 rounded-lg bg-dark-600/40 border border-dark-400/20 text-xs text-dark-100 hover:border-brand-500/30 hover:text-white transition-all"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="input-field min-h-[120px] resize-y text-sm"
            placeholder="Type your script here... (keep it under ~35 words for 15 seconds)"
            maxLength={300}
            autoFocus
          />

          <div className="flex justify-between mt-2 text-[11px]">
            <span className={overLimit ? 'text-red-400' : 'text-dark-300'}>
              {wordCount} words • ~{estSeconds}s
              {overLimit && ' (exceeds 15s limit!)'}
            </span>
            <span className="text-dark-300">{script.length}/300</span>
          </div>

          {overLimit && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/15">
              <p className="text-[11px] text-red-300">
                Free demo is limited to 15 seconds (~35 words). Shorten your script or{' '}
                <a href="/pricing" className="underline text-red-200">upgrade for longer videos</a>.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/15">
              <p className="text-[11px] text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={() => setStep('avatar')}>← Back</Button>
            <Button
              className="flex-1"
              onClick={handleGenerate}
              loading={loading}
              disabled={!script.trim() || overLimit || script.trim().length < 5}
              icon={<span>🎬</span>}
            >
              Generate Video (Free)
            </Button>
          </div>

          {/* Constraint reminders */}
          <div className="mt-4 p-3 rounded-lg bg-dark-600/20 border border-dark-400/10">
            <div className="grid grid-cols-2 gap-2 text-[10px] text-dark-300">
              <span>📐 720p resolution</span>
              <span>⏱️ Max 15 seconds</span>
              <span>💧 Watermark included</span>
              <span>🎭 Stock avatar only</span>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Generating ═══ */}
      {step === 'generating' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
            <span className="text-4xl animate-pulse-slow">✨</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Creating Your Video...</h2>
          <p className="text-sm text-dark-100 max-w-sm mx-auto mb-6">
            Our AI is generating your video. This usually takes 1–3 minutes.
          </p>

          {/* Animated progress bar */}
          <div className="max-w-xs mx-auto mb-6">
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 rounded-full animate-pulse w-2/3" />
            </div>
            <p className="text-[11px] text-dark-300 mt-2">Processing with AI magic...</p>
          </div>

          {/* Fun loading states */}
          <div className="space-y-2 text-xs text-dark-200">
            <p className="animate-pulse">🧬 Preparing avatar...</p>
            <p className="animate-pulse delay-100">🎙️ Synthesizing voice...</p>
            <p className="animate-pulse delay-200">🎬 Rendering video...</p>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Done — Video Ready + Upgrade CTA ═══ */}
      {step === 'done' && (
        <div className="space-y-5">
          {/* Video Result */}
          <Card padding="lg" className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Your Video is Ready!</h2>
            <p className="text-sm text-dark-100 mb-5">Here's your first AI-generated video.</p>

            {/* Video preview */}
            {videoUrl && (
              <div className="relative aspect-[9/16] max-w-[200px] mx-auto rounded-xl overflow-hidden border border-dark-400/30 mb-5">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                />
                {/* Watermark overlay */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] text-white/80 font-medium">
                  Made with AvatarForge
                </div>
              </div>
            )}

            {!videoUrl && (
              <div className="aspect-[9/16] max-w-[200px] mx-auto rounded-xl bg-dark-600/50 border border-dark-400/20 flex items-center justify-center mb-5">
                <span className="text-dark-300 text-sm">Video preview</span>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => videoUrl && window.open(videoUrl, '_blank')}
              disabled={!videoUrl}
            >
              Download (with watermark)
            </Button>
          </Card>

          {/* ─── Upgrade CTA Card ─────────────────────────── */}
          <Card glow padding="lg" className="text-center border-brand-500/30">
            <h3 className="text-lg font-bold text-white mb-2">
              Love it? Unlock the full power.
            </h3>
            <p className="text-sm text-dark-100 mb-5 max-w-sm mx-auto">
              Remove watermark, create your own Digital Twin, clone your voice, 
              and generate longer high-quality videos.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6 text-left max-w-sm mx-auto">
              {[
                { icon: '🧬', label: 'Create your AI Avatar', locked: true },
                { icon: '🎙️', label: 'Clone your voice', locked: true },
                { icon: '💎', label: 'Remove watermark', locked: true },
                { icon: '📹', label: 'Longer videos (up to 6 min)', locked: true },
                { icon: '🎯', label: '1080p + 4K export', locked: true },
                { icon: '⚡', label: 'Priority generation queue', locked: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-dark-600/20">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-[11px] text-dark-100">{item.label}</span>
                </div>
              ))}
            </div>

            <Button size="lg" onClick={() => router.push('/pricing')}>
              Upgrade — Starting ₹199/mo
            </Button>

            <p className="text-[10px] text-dark-300 mt-3">
              No long-term commitment. Cancel anytime.
            </p>
          </Card>

          {/* Secondary actions */}
          <div className="flex justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setStep('avatar'); setScript(''); setVideoUrl(null); }}>
              Try another script
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Device Fingerprint Hash (simple) ────────────────────────
function getDeviceHash(): string {
  if (typeof window === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('AvatarForge', 2, 2);
    }
    const canvasData = canvas.toDataURL();
    const nav = `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}|${new Date().getTimezoneOffset()}`;
    const raw = canvasData + nav;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  } catch {
    return 'unknown';
  }
}
