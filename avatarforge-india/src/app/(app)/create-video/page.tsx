'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { id: 'reel-hi', name: 'Reel Script (Hindi)', category: 'reel', script: 'नमस्ते दोस्तों! आज मैं आपको बताने वाला हूं एक ऐसी चीज़ जो आपकी ज़िंदगी बदल देगी...' },
  { id: 'reel-en', name: 'Reel Script (English)', category: 'reel', script: 'Hey everyone! Today I want to share something that completely changed how I work...' },
  { id: 'explainer', name: 'Educational Explainer', category: 'education', script: 'In this video, I will explain the concept of [TOPIC] in simple terms that anyone can understand...' },
  { id: 'promo', name: 'Promo Ad', category: 'promo', script: 'Introducing [PRODUCT] - the solution you have been waiting for. Here is why thousands of people trust us...' },
  { id: 'intro', name: 'Channel Intro', category: 'intro', script: 'Welcome to my channel! I am [NAME] and here I share content about [TOPIC]. Make sure to subscribe...' },
];

export default function CreateVideoPage() {
  const router = useRouter();
  const [avatars, setAvatars] = useState<any[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [aspectRatio, setAspectRatio] = useState('PORTRAIT_9_16');
  const [resolution, setResolution] = useState('HD_720P');
  const [bgColor, setBgColor] = useState('#000000');
  const [transparentBg, setTransparentBg] = useState(false);
  const [scriptLanguage, setScriptLanguage] = useState('en');

  useEffect(() => {
    fetchUserAssets();
  }, []);

  async function fetchUserAssets() {
    try {
      const [avatarsRes, voicesRes] = await Promise.all([
        fetch('/api/avatars'),
        fetch('/api/voices'),
      ]);
      const [avatarsData, voicesData] = await Promise.all([
        avatarsRes.json(),
        voicesRes.json(),
      ]);

      const readyAvatars = (avatarsData.data || []).filter((a: any) => a.status === 'READY');
      const readyVoices = (voicesData.data || []).filter((v: any) => v.status === 'READY');

      setAvatars(readyAvatars);
      setVoices(readyVoices);

      if (readyAvatars.length > 0) setAvatarId(readyAvatars[0].id);
      if (readyVoices.length > 0) setVoiceId(readyVoices[0].id);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setFetchingData(false);
    }
  }

  async function handleGenerate() {
    if (!title || !script || !avatarId || !voiceId) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          script,
          avatarId,
          voiceId,
          aspectRatio,
          resolution,
          scriptLanguage,
          backgroundColor: transparentBg ? undefined : bgColor,
          transparentBg,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate video');
      }

      toast.success(`Video queued! ${data.data.creditsDeducted} credits used.`);
      router.push('/my-videos');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Estimate word count / duration
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const estDurationSec = Math.ceil((wordCount / 150) * 60);
  const estDurationMin = (estDurationSec / 60).toFixed(1);

  if (fetchingData) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-600 rounded w-48" />
          <div className="h-64 bg-dark-600 rounded-xl" />
        </div>
      </div>
    );
  }

  // Check if user has assets
  if (avatars.length === 0 || voices.length === 0) {
    return (
      <div className="page-container max-w-2xl mx-auto">
        <h1 className="page-title">Create Video</h1>
        <div className="glass-card p-8 text-center mt-8">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-white mb-2">Setup Required</h2>
          <p className="text-sm text-dark-100 mb-6">
            You need at least one ready avatar and one ready voice clone to create videos.
          </p>
          <div className="flex gap-3 justify-center">
            {avatars.length === 0 && (
              <button onClick={() => router.push('/create-avatar')} className="btn-primary">
                Create Avatar
              </button>
            )}
            {voices.length === 0 && (
              <button onClick={() => router.push('/clone-voice')} className="btn-secondary">
                Clone Voice
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      <h1 className="page-title">Create Video</h1>
      <p className="page-subtitle">Generate a professional video with your AI avatar.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="glass-card p-6">
            <label className="label">Video Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="My awesome video"
              maxLength={100}
            />
          </div>

          {/* Script */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Script</label>
              <select
                value={scriptLanguage}
                onChange={(e) => setScriptLanguage(e.target.value)}
                className="text-xs bg-dark-600 border border-dark-400/50 rounded px-2 py-1 text-dark-100"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="input-field min-h-[200px] resize-y"
              placeholder="Type or paste your script here..."
              maxLength={5000}
            />
            <div className="flex justify-between mt-2 text-xs text-dark-200">
              <span>{wordCount} words • ~{estDurationMin} min</span>
              <span>{script.length}/5000 chars</span>
            </div>

            {/* Templates */}
            <details className="mt-3">
              <summary className="text-xs text-brand-400 cursor-pointer hover:text-brand-300">
                Use a template
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setScript(t.script)}
                    className="text-left p-2 bg-dark-600/50 rounded-lg text-xs hover:bg-dark-500/50 transition-colors"
                  >
                    <span className="font-medium text-white">{t.name}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Avatar & Voice Selection */}
          <div className="glass-card p-6 grid grid-cols-2 gap-4">
            <div>
              <label className="label">Avatar</label>
              <select
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                className="input-field"
              >
                {avatars.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Voice</label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="input-field"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.language})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sidebar - Settings */}
        <div className="space-y-6">
          {/* Video Settings */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Video Settings</h3>

            <div>
              <label className="label">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'PORTRAIT_9_16', label: '9:16', desc: 'Reels' },
                  { value: 'LANDSCAPE_16_9', label: '16:9', desc: 'YouTube' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAspectRatio(opt.value)}
                    className={`p-2 rounded-lg text-xs border transition-all ${
                      aspectRatio === opt.value
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-dark-400/50 text-dark-200 hover:border-dark-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="input-field"
              >
                <option value="SD_480P">480p (SD)</option>
                <option value="HD_720P">720p (HD)</option>
                <option value="FHD_1080P">1080p (Full HD)</option>
              </select>
            </div>

            <div>
              <label className="label">Background</label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-dark-100">Transparent (WEBM)</span>
              </div>
              {!transparentBg && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <span className="text-xs text-dark-200">{bgColor}</span>
                </div>
              )}
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-3">Cost Estimate</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-dark-200">
                <span>Duration</span>
                <span>~{estDurationMin} min</span>
              </div>
              <div className="flex justify-between text-dark-200">
                <span>Resolution</span>
                <span>{resolution.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between text-dark-200">
                <span>Transparent</span>
                <span>{transparentBg ? 'Yes (+20%)' : 'No'}</span>
              </div>
              <hr className="border-dark-400/30" />
              <div className="flex justify-between text-white font-medium">
                <span>Estimated Credits</span>
                <span className="text-brand-400">
                  ~{Math.ceil(
                    (estDurationSec / 60) *
                    (resolution === 'FHD_1080P' ? 25 : resolution === 'HD_720P' ? 15 : 10) *
                    (transparentBg ? 1.2 : 1)
                  )} credits
                </span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !title || !script || !avatarId || !voiceId}
            className="btn-primary w-full text-center"
          >
            {loading ? 'Generating...' : '🎬 Generate Video'}
          </button>
        </div>
      </div>
    </div>
  );
}
