'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgressTracker } from '@/components/ui/ProgressTracker';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePolling } from '@/hooks/usePolling';

type Step = 'upload' | 'details' | 'cloning' | 'ready';

export default function CloneVoicePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'hinglish'>('en');
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Polling ───────────────────────────────────────────
  usePolling({
    url: voiceId ? `/api/voices/${voiceId}/status` : '',
    enabled: !!voiceId && step === 'cloning',
    interval: 5000,
    maxAttempts: 60,
    stopWhen: (d) => ['READY', 'FAILED'].includes(d?.status),
    onUpdate: (d) => {
      if (d?.status === 'READY') {
        setStep('ready');
        toast.success('Voice cloned successfully!');
      } else if (d?.status === 'FAILED') {
        setError(d.errorMessage || 'Voice cloning failed. Please try again.');
      }
    },
  });

  // ─── Progress Steps ────────────────────────────────────
  function getStatus(s: string): 'completed' | 'current' | 'upcoming' | 'failed' {
    const order: Step[] = ['upload', 'details', 'cloning', 'ready'];
    const ci = order.indexOf(step);
    const si = order.indexOf(s as Step);
    if (error && s === step) return 'failed';
    if (s === step) return 'current';
    if (si < ci) return 'completed';
    return 'upcoming';
  }

  const progressSteps = [
    { id: 'upload', label: 'Upload Audio', status: getStatus('upload') },
    { id: 'details', label: 'Details', status: getStatus('details') },
    { id: 'cloning', label: 'Cloning', status: getStatus('cloning') },
    { id: 'ready', label: 'Ready', status: getStatus('ready') },
  ] as any;

  // ─── Submit ────────────────────────────────────────────
  async function handleCloneVoice() {
    if (!uploadedKey || !voiceName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: voiceName.trim(),
          audioKey: uploadedKey,
          language,
          sourceType: 'DEDICATED_AUDIO',
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to clone voice');
      }

      setVoiceId(data.data.id);
      setStep('cloning');
      toast.success('Voice submitted for cloning!');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Clone Your Voice</h1>
        <p className="page-subtitle">
          Upload a 1–3 minute audio sample to create your AI voice clone.
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-10">
        <ProgressTracker steps={progressSteps} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <span className="text-red-400 mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => { setError(null); setStep('details'); }}
              className="text-xs text-red-400/80 hover:text-red-300 mt-1.5 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP: Upload ═══ */}
      {step === 'upload' && (
        <Card padding="lg">
          <CardTitle>Step 1: Upload Voice Sample</CardTitle>
          <CardDescription>
            Record yourself reading a passage clearly for 1–3 minutes. Single speaker, no music.
          </CardDescription>

          <div className="mt-6">
            <FileUpload
              type="voice-audio"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/ogg,audio/flac"
              maxSizeMb={50}
              onUploadComplete={({ key }) => {
                setUploadedKey(key);
                setStep('details');
                toast.success('Audio uploaded!');
              }}
              onError={(err) => toast.error(err)}
              guidelines={{
                duration: '1–3 minutes of clear speech',
                quality: 'No background music or ambient noise',
                speaker: 'Single speaker only',
                content: 'Read naturally, maintain consistent pace',
                format: 'MP3 or WAV preferred, max 50MB',
              }}
            />
          </div>

          {/* Preview / Tips */}
          <div className="mt-6 p-4 rounded-xl bg-dark-600/30 border border-dark-400/10">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              🎙️ Recording Tips
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: '🔇', tip: 'Use a quiet room, close windows/fans' },
                { icon: '🎧', tip: 'A simple earphone mic works great' },
                { icon: '📖', tip: 'Read a book passage or news article' },
                { icon: '⚡', tip: 'Speak naturally — don\'t over-enunciate' },
                { icon: '🔊', tip: 'Keep consistent distance from mic' },
                { icon: '⏱️', tip: 'Minimum 60 seconds, ideal 2–3 minutes' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-dark-100">{item.tip}</span>
                </div>
              ))}
            </div>

            {/* Sample script suggestion */}
            <div className="mt-4 p-3 rounded-lg bg-brand-500/5 border border-brand-500/10">
              <p className="text-[11px] text-brand-300/80">
                <strong>Don't know what to read?</strong> Open any news article or Wikipedia page 
                and read it out loud at your natural pace. That's perfect for voice cloning.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Details ═══ */}
      {step === 'details' && (
        <Card padding="lg">
          <CardTitle>Step 2: Voice Details</CardTitle>
          <CardDescription>
            Give your voice clone a name and select the primary language.
          </CardDescription>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="voice-name" className="label">Voice Name</label>
              <input
                id="voice-name"
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="input-field"
                placeholder="e.g., My Hindi Voice, Professional English"
                maxLength={50}
                autoFocus
              />
            </div>

            <div>
              <label className="label">Primary Language</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'en', label: 'English', sublabel: 'अंग्रेजी' },
                  { value: 'hi', label: 'Hindi', sublabel: 'हिंदी' },
                  { value: 'hinglish', label: 'Hinglish', sublabel: 'हिंगलिश' },
                ] as const).map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => setLanguage(lang.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      language === lang.value
                        ? 'border-brand-500/60 bg-brand-500/10 text-brand-400'
                        : 'border-dark-400/30 text-dark-200 hover:border-dark-300/50 hover:bg-dark-600/30'
                    }`}
                  >
                    <p className="text-sm font-medium">{lang.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{lang.sublabel}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio preview placeholder */}
            <div className="p-4 rounded-xl bg-dark-600/30 border border-dark-400/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-dark-500/50 flex items-center justify-center">
                  <span className="text-lg">🎵</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">Uploaded audio file</p>
                  <p className="text-[11px] text-dark-300">Ready for cloning</p>
                </div>
                <StatusBadge status="UPLOADED" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCloneVoice}
                loading={loading}
                disabled={!voiceName.trim() || voiceName.trim().length < 2}
              >
                Clone Voice (10 credits)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Cloning ═══ */}
      {step === 'cloning' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
            <span className="text-3xl animate-pulse-slow">🎙️</span>
          </div>
          <CardTitle className="text-center">Cloning Your Voice</CardTitle>
          <p className="text-sm text-dark-100 mt-2 max-w-md mx-auto">
            This usually takes 2–5 minutes. You can safely leave this page.
          </p>

          <div className="mt-8 max-w-xs mx-auto">
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full animate-pulse w-1/2" />
            </div>
            <p className="text-[11px] text-dark-300 mt-2">Processing your audio...</p>
          </div>

          <div className="mt-6">
            <StatusBadge status="CLONING" />
          </div>

          <div className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Ready ═══ */}
      {step === 'ready' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
            <span className="text-3xl">🎉</span>
          </div>
          <CardTitle className="text-center">Voice Clone Ready!</CardTitle>
          <p className="text-sm text-dark-100 mt-2 max-w-md mx-auto">
            <span className="text-white font-medium">"{voiceName}"</span> ({language}) is now available for video generation.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push('/create-video')} size="lg">
              Create a Video →
            </Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      )}

      {/* ─── Existing voices list ─────────────────────────── */}
      <ExistingVoices />
    </div>
  );
}

// ─── Sub-component: Show existing voice clones ───────────────

function ExistingVoices() {
  const [voices, setVoices] = useState<any[] | null>(null);

  // Fetch on mount
  useState(() => {
    fetch('/api/voices')
      .then((r) => r.json())
      .then((d) => setVoices(d.data || []))
      .catch(() => {});
  });

  if (!voices || voices.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardTitle>Your Voice Clones</CardTitle>
      <div className="mt-4 space-y-2">
        {voices.map((v: any) => (
          <div
            key={v.id}
            className="flex items-center justify-between p-3 rounded-xl bg-dark-600/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-dark-500/50 flex items-center justify-center">
                <span className="text-sm">🎙️</span>
              </div>
              <div>
                <p className="text-sm text-white font-medium">{v.name}</p>
                <p className="text-[11px] text-dark-300">{v.language} • {new Date(v.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
            <StatusBadge status={v.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}
