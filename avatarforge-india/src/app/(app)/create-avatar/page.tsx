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

type WizardStep = 'upload' | 'details' | 'submitting' | 'consent' | 'training' | 'ready';

export default function CreateAvatarPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('upload');
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Polling for avatar status after submission ────────
  const { data: statusData } = usePolling({
    url: avatarId ? `/api/avatars/${avatarId}/status` : '',
    enabled: !!avatarId && ['submitting', 'consent', 'training'].includes(step),
    interval: 7000,
    maxAttempts: 120, // ~14 minutes max polling
    stopWhen: (d) => ['READY', 'FAILED', 'TRAINING_FAILED'].includes(d?.status),
    onUpdate: (d) => {
      if (d?.status === 'READY') {
        setStep('ready');
        toast.success('Your Digital Twin is ready!');
      } else if (d?.status === 'CONSENT_REQUIRED' || d?.status === 'CONSENT_PENDING') {
        setStep('consent');
        if (d.consentUrl) setConsentUrl(d.consentUrl);
      } else if (d?.status === 'TRAINING') {
        setStep('training');
      } else if (['FAILED', 'TRAINING_FAILED'].includes(d?.status)) {
        setError(d.errorMessage || 'Avatar training failed. Please try again.');
      }
    },
  });

  // ─── Progress Steps ────────────────────────────────────
  const progressSteps = [
    { id: 'upload', label: 'Upload', status: getStepStatus('upload') },
    { id: 'details', label: 'Details', status: getStepStatus('details') },
    { id: 'consent', label: 'Consent', status: getStepStatus('consent') },
    { id: 'training', label: 'Training', status: getStepStatus('training') },
    { id: 'ready', label: 'Ready', status: getStepStatus('ready') },
  ] as any;

  function getStepStatus(s: string): 'completed' | 'current' | 'upcoming' | 'failed' {
    const order: WizardStep[] = ['upload', 'details', 'submitting', 'consent', 'training', 'ready'];
    const currentIdx = order.indexOf(step);
    const stepIdx = order.indexOf(s as WizardStep);
    // Map submitting to details for display
    const displayStep = step === 'submitting' ? 'details' : step;
    const displayIdx = order.indexOf(displayStep);

    if (error && s === step) return 'failed';
    if (s === displayStep) return 'current';
    if (stepIdx < displayIdx) return 'completed';
    return 'upcoming';
  }

  // ─── Submit Avatar ─────────────────────────────────────
  async function handleCreateAvatar() {
    if (!uploadedKey || !avatarName.trim()) return;

    setLoading(true);
    setError(null);
    setStep('submitting');

    try {
      const res = await fetch('/api/avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: avatarName.trim(),
          trainingVideoKey: uploadedKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create avatar');
      }

      setAvatarId(data.data.id);

      if (data.data.consentRequired) {
        setConsentUrl(data.data.consentUrl);
        setStep('consent');
        toast('Consent verification required', { icon: '📋' });
      } else {
        setStep('training');
        toast.success('Avatar submitted for training!');
      }
    } catch (err: any) {
      setError(err.message);
      setStep('details');
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Create Your Digital Twin</h1>
        <p className="page-subtitle">
          Upload a 5–10 minute training video to create your AI avatar clone.
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
          <CardTitle>Step 1: Upload Training Video</CardTitle>
          <CardDescription>
            Record yourself speaking naturally for 5–10 minutes. Look at the camera.
          </CardDescription>

          <div className="mt-6">
            <FileUpload
              type="training-video"
              accept="video/mp4,video/quicktime,video/webm"
              maxSizeMb={500}
              onUploadComplete={({ key }) => {
                setUploadedKey(key);
                setStep('details');
                toast.success('Video uploaded successfully!');
              }}
              onError={(err) => toast.error(err)}
              guidelines={{
                duration: '5–10 minutes (required)',
                resolution: 'At least 720p, 1080p preferred',
                lighting: 'Well-lit, even lighting, no harsh shadows',
                background: 'Clean, uncluttered background',
                framing: 'Head & shoulders visible, centered in frame',
                audio: 'Clear speech, minimal background noise',
                movement: 'Natural head movements, look at camera',
                format: 'MP4 preferred, max 500MB',
              }}
            />
          </div>

          {/* Tips Card */}
          <div className="mt-6 p-4 rounded-xl bg-dark-600/30 border border-dark-400/10">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
              💡 Tips for Best Results
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: '🎥', tip: 'Use your phone camera at eye level' },
                { icon: '💡', tip: 'Face a window for natural lighting' },
                { icon: '🗣️', tip: 'Speak clearly at a natural pace' },
                { icon: '👀', tip: 'Look directly at the camera lens' },
                { icon: '🤫', tip: 'Record in a quiet room' },
                { icon: '📐', tip: 'Keep face centered in the frame' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-dark-100">{item.tip}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <p className="text-[11px] text-yellow-300/80">
                <strong>Compression tip:</strong> If your file is too large, use{' '}
                <a href="https://handbrake.fr" target="_blank" rel="noopener" className="underline">HandBrake</a>{' '}
                (free) → H.264, CRF 23, to reduce size without quality loss.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Details ═══ */}
      {step === 'details' && (
        <Card padding="lg">
          <CardTitle>Step 2: Name Your Avatar</CardTitle>
          <CardDescription>
            Choose a name for your Digital Twin. This is for your reference only.
          </CardDescription>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="avatar-name" className="label">Avatar Name</label>
              <input
                id="avatar-name"
                type="text"
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                className="input-field"
                placeholder="e.g., My Digital Twin, Hindi Avatar"
                maxLength={50}
                autoFocus
              />
              <p className="text-[11px] text-dark-300 mt-1.5">2–50 characters</p>
            </div>

            {/* What happens next */}
            <div className="p-4 rounded-xl bg-dark-600/30 border border-dark-400/10">
              <h4 className="text-xs font-semibold text-white mb-3">📝 What happens next:</h4>
              <ol className="space-y-2">
                {[
                  'We send your video to HeyGen for processing',
                  'You complete a consent verification (face + voice match)',
                  'Once consent is approved, avatar training begins (~10–30 min)',
                  'Your Digital Twin will be ready to generate videos!',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-[10px] text-brand-400 font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-dark-100">{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setStep('upload')}>
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateAvatar}
                loading={loading}
                disabled={!avatarName.trim() || avatarName.trim().length < 2}
              >
                Create Avatar (uses Avatar Setup credit)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ STEP: Consent ═══ */}
      {step === 'consent' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5">
            <span className="text-3xl">📋</span>
          </div>
          <CardTitle className="text-center">Consent Verification Required</CardTitle>
          <p className="text-sm text-dark-100 mt-2 max-w-md mx-auto">
            HeyGen requires identity verification to ensure only you can create an avatar of yourself. 
            Complete the quick consent process to proceed.
          </p>

          <div className="mt-8">
            {consentUrl ? (
              <a
                href={consentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" icon={<span>↗</span>}>
                  Complete Consent Verification
                </Button>
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 text-dark-200">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading consent URL...</span>
              </div>
            )}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-dark-600/30 border border-dark-400/10 max-w-sm mx-auto">
            <p className="text-[11px] text-dark-300 leading-relaxed">
              We'll automatically detect when consent is approved and start training your avatar. 
              You can close this page and come back — we'll update the status.
            </p>
          </div>

          <div className="mt-4">
            <StatusBadge status="CONSENT_PENDING" />
          </div>
        </Card>
      )}

      {/* ═══ STEP: Training ═══ */}
      {step === 'training' && (
        <Card padding="lg" className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
            <span className="text-3xl animate-pulse-slow">🧬</span>
          </div>
          <CardTitle className="text-center">Training Your Digital Twin</CardTitle>
          <p className="text-sm text-dark-100 mt-2 max-w-md mx-auto">
            This usually takes 10–30 minutes. You can safely leave this page.
          </p>

          {/* Animated progress */}
          <div className="mt-8 max-w-xs mx-auto">
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full animate-pulse w-3/4" />
            </div>
            <p className="text-[11px] text-dark-300 mt-2">Processing... this may take a while</p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2">
            <StatusBadge status="TRAINING" />
          </div>

          <div className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard (we'll notify you)
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
          <CardTitle className="text-center">Your Digital Twin is Ready!</CardTitle>
          <p className="text-sm text-dark-100 mt-2 max-w-md mx-auto">
            <span className="text-white font-medium">"{avatarName}"</span> has been successfully trained. 
            You can now use it to generate videos.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push('/create-video')} size="lg">
              Create a Video →
            </Button>
            <Button variant="secondary" onClick={() => router.push('/clone-voice')}>
              Clone Voice First
            </Button>
          </div>

          <div className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
