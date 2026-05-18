'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgressTracker } from '@/components/ui/ProgressTracker';
import { usePolling } from '@/hooks/usePolling';

export default function CloneVoicePage() {
  const router = useRouter();
  const [step, setStep] = useState<'upload' | 'details' | 'cloning' | 'ready'>('upload');
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'hinglish'>('en');
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll voice status
  usePolling({
    url: voiceId ? `/api/voices/${voiceId}/status` : '',
    enabled: !!voiceId && step === 'cloning',
    interval: 5000,
    stopWhen: (d) => ['READY', 'FAILED'].includes(d?.status),
    onUpdate: (d) => {
      if (d?.status === 'READY') {
        setStep('ready');
        toast.success('Voice cloned successfully! 🎉');
      } else if (d?.status === 'FAILED') {
        setError(d.errorMessage || 'Voice cloning failed');
      }
    },
  });

  const progressSteps = [
    { id: 'upload', label: 'Upload Audio', status: step === 'upload' ? 'current' : 'completed' },
    { id: 'details', label: 'Details', status: step === 'details' ? 'current' : step === 'upload' ? 'upcoming' : 'completed' },
    { id: 'cloning', label: 'Cloning', status: step === 'cloning' ? 'current' : step === 'ready' ? 'completed' : 'upcoming' },
    { id: 'ready', label: 'Ready', status: step === 'ready' ? 'current' : 'upcoming' },
  ] as any;

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

      if (!data.success) {
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
      <h1 className="page-title">Clone Your Voice</h1>
      <p className="page-subtitle">
        Upload a 1-3 minute audio sample to create your AI voice clone.
      </p>

      <div className="mb-10">
        <ProgressTracker steps={progressSteps} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">⚠️ {error}</p>
        </div>
      )}

      {step === 'upload' && (
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Upload Voice Sample
          </h2>
          <FileUpload
            type="voice-audio"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
            maxSizeMb={50}
            onUploadComplete={({ key }) => {
              setUploadedKey(key);
              setStep('details');
              toast.success('Audio uploaded!');
            }}
            onError={(err) => toast.error(err)}
            guidelines={{
              duration: '1-3 minutes of clear speech',
              quality: 'No background music or noise',
              speaker: 'Single speaker only',
              content: 'Read naturally, maintain consistent pace',
              format: 'MP3 or WAV, max 50MB',
            }}
          />
        </div>
      )}

      {step === 'details' && (
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Voice Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Voice Name</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="input-field"
                placeholder="e.g., My Voice"
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="input-field"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('upload')} className="btn-secondary">
                ← Back
              </button>
              <button
                onClick={handleCloneVoice}
                disabled={!voiceName.trim() || loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Submitting...' : 'Clone Voice (10 credits)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'cloning' && (
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4 animate-pulse-slow">🎙️</div>
          <h2 className="text-lg font-semibold text-white mb-2">Cloning Your Voice</h2>
          <p className="text-sm text-dark-100 mb-4">
            This usually takes 2-5 minutes. You can leave and come back.
          </p>
          <div className="progress-bar max-w-xs mx-auto">
            <div className="progress-bar-fill animate-pulse" style={{ width: '50%' }} />
          </div>
        </div>
      )}

      {step === 'ready' && (
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-lg font-semibold text-white mb-2">Voice Ready!</h2>
          <p className="text-sm text-dark-100 mb-6">
            Your voice clone "{voiceName}" is ready to use in videos.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/create-video')} className="btn-primary">
              Create a Video →
            </button>
            <button onClick={() => router.push('/dashboard')} className="btn-secondary">
              Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
