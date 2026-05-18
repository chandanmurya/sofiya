'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgressTracker } from '@/components/ui/ProgressTracker';
import { usePolling } from '@/hooks/usePolling';

type FlowStep = 'upload' | 'details' | 'processing' | 'consent' | 'training' | 'ready';

export default function CreateAvatarPage() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>('upload');
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling for status after creation
  const { data: statusData } = usePolling({
    url: avatarId ? `/api/avatars/${avatarId}/status` : '',
    enabled: !!avatarId && ['processing', 'consent', 'training'].includes(step),
    interval: 8000,
    stopWhen: (d) => ['READY', 'FAILED', 'TRAINING_FAILED'].includes(d?.status),
    onUpdate: (d) => {
      if (d?.status === 'READY') {
        setStep('ready');
        toast.success('Avatar is ready! 🎉');
      } else if (d?.status === 'CONSENT_REQUIRED' || d?.status === 'CONSENT_PENDING') {
        setStep('consent');
        if (d.consentUrl) setConsentUrl(d.consentUrl);
      } else if (d?.status === 'TRAINING') {
        setStep('training');
      } else if (d?.status === 'FAILED' || d?.status === 'TRAINING_FAILED') {
        setError(d.errorMessage || 'Avatar training failed');
      }
    },
  });

  const progressSteps = [
    { id: 'upload', label: 'Upload Video', labelHi: 'वीडियो अपलोड', status: getStepStatus('upload') },
    { id: 'details', label: 'Details', labelHi: 'विवरण', status: getStepStatus('details') },
    { id: 'consent', label: 'Consent', labelHi: 'सहमति', status: getStepStatus('consent') },
    { id: 'training', label: 'Training', labelHi: 'ट्रेनिंग', status: getStepStatus('training') },
    { id: 'ready', label: 'Ready', labelHi: 'तैयार', status: getStepStatus('ready') },
  ] as any;

  function getStepStatus(s: string) {
    const order = ['upload', 'details', 'processing', 'consent', 'training', 'ready'];
    const currentIdx = order.indexOf(step);
    const stepIdx = order.indexOf(s);
    if (step === s) return 'current';
    if (stepIdx < currentIdx) return 'completed';
    if (error && step === s) return 'failed';
    return 'upcoming';
  }

  async function handleCreateAvatar() {
    if (!uploadedKey || !avatarName.trim()) return;

    setLoading(true);
    setError(null);
    setStep('processing');

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

      if (!data.success) {
        throw new Error(data.error || 'Failed to create avatar');
      }

      setAvatarId(data.data.id);

      if (data.data.consentRequired) {
        setConsentUrl(data.data.consentUrl);
        setStep('consent');
        toast('Consent required. Please complete the verification.', { icon: '📋' });
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
      <h1 className="page-title">Create Your Digital Twin</h1>
      <p className="page-subtitle">
        Upload a 5-10 minute training video to create your AI avatar clone.
      </p>

      {/* Progress Tracker */}
      <div className="mb-10">
        <ProgressTracker steps={progressSteps} />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">⚠️ {error}</p>
          <button
            onClick={() => { setError(null); setStep('details'); }}
            className="text-xs text-red-300 underline mt-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Step 1: Upload Training Video
          </h2>
          <FileUpload
            type="training-video"
            accept="video/mp4,video/quicktime,video/webm"
            maxSizeMb={500}
            onUploadComplete={({ key }) => {
              setUploadedKey(key);
              setStep('details');
              toast.success('Video uploaded!');
            }}
            onError={(err) => toast.error(err)}
            guidelines={{
              duration: '5-10 minutes recommended',
              quality: 'At least 720p, good lighting',
              framing: 'Head and shoulders, look at camera',
              audio: 'Clear speech, no background noise',
              format: 'MP4 preferred, max 500MB',
            }}
          />
        </div>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Step 2: Name Your Avatar
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Avatar Name</label>
              <input
                type="text"
                value={avatarName}
                onChange={(e) => setAvatarName(e.target.value)}
                className="input-field"
                placeholder="e.g., My Digital Twin"
                maxLength={50}
              />
              <p className="text-xs text-dark-200 mt-1">This name is for your reference only.</p>
            </div>

            <div className="p-4 bg-dark-600/50 rounded-lg">
              <p className="text-sm text-dark-100 mb-2">📝 What happens next:</p>
              <ol className="text-xs text-dark-200 space-y-1 list-decimal pl-4">
                <li>HeyGen will process your video</li>
                <li>You'll need to complete a consent verification (face + voice match)</li>
                <li>Once consent is approved, training begins (~10-30 minutes)</li>
                <li>Your avatar will be ready to use!</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                onClick={handleCreateAvatar}
                disabled={!avatarName.trim() || loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Creating...' : 'Create Avatar (50 credits)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Consent */}
      {step === 'consent' && (
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Consent Required
          </h2>
          <p className="text-sm text-dark-100 mb-6 max-w-md mx-auto">
            HeyGen requires you to verify your identity. Click below to complete the consent process.
            This ensures only you can create an avatar of yourself.
          </p>
          
          {consentUrl ? (
            <a
              href={consentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2"
            >
              Complete Consent ↗
            </a>
          ) : (
            <p className="text-sm text-dark-200">Loading consent URL...</p>
          )}

          <p className="text-xs text-dark-300 mt-6">
            We'll automatically detect when consent is approved and start training.
          </p>
        </div>
      )}

      {/* Step: Training */}
      {step === 'training' && (
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse-slow">🧬</div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Training Your Avatar
          </h2>
          <p className="text-sm text-dark-100 mb-4">
            This usually takes 10-30 minutes. You can leave this page and come back.
          </p>
          <div className="progress-bar max-w-xs mx-auto">
            <div className="progress-bar-fill animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-xs text-dark-300 mt-4">
            We'll notify you when your avatar is ready.
          </p>
        </div>
      )}

      {/* Step: Ready */}
      {step === 'ready' && (
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-lg font-semibold text-white mb-2">
            Avatar Ready!
          </h2>
          <p className="text-sm text-dark-100 mb-6">
            Your digital twin "{avatarName}" is ready to create videos.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/create-video')}
              className="btn-primary"
            >
              Create a Video →
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
