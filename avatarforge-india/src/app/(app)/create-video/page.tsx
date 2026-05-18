'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';

// ─── Script Templates ────────────────────────────────────────
const TEMPLATES = [
  { id: 'reel-hi', name: 'Reel Script (Hindi)', lang: 'hi', category: 'reel', script: 'नमस्ते दोस्तों! आज मैं आपको बताने वाला हूं एक ऐसी चीज़ जो आपकी ज़िंदगी बदल देगी। अगर आप भी [TOPIC] के बारे में जानना चाहते हैं तो यह वीडियो आपके लिए है। तो चलिए शुरू करते हैं!' },
  { id: 'reel-en', name: 'Reel Script (English)', lang: 'en', category: 'reel', script: 'Hey everyone! Today I want to share something that completely changed how I approach [TOPIC]. If you are struggling with this, stay till the end because I have a game-changer for you.' },
  { id: 'explainer', name: 'Educational Explainer', lang: 'en', category: 'education', script: 'In this video, I will explain the concept of [TOPIC] in simple terms that anyone can understand. Whether you are a beginner or have some experience, by the end of this video, you will have a clear understanding.' },
  { id: 'promo', name: 'Promo Ad', lang: 'en', category: 'promo', script: 'Introducing [PRODUCT] — the solution you have been waiting for. Here is why thousands of people trust us. First, [BENEFIT 1]. Second, [BENEFIT 2]. Try it today!' },
  { id: 'pitch-hinglish', name: 'Business Pitch (Hinglish)', lang: 'hinglish', category: 'promo', script: 'Hi friends! Main hoon [NAME] aur aaj main aapko batata hoon [PRODUCT] ke baare mein. Agar aap [PROBLEM] se pareshan hain, toh yeh solution aapke liye perfect hai.' },
  { id: 'course-promo', name: 'Course Promo', lang: 'en', category: 'education', script: 'Want to master [SKILL] in just [TIMEFRAME]? My comprehensive course covers everything from basics to advanced concepts. Join over [NUMBER] students who transformed their careers.' },
];

export default function CreateVideoPage() {
  const router = useRouter();

  // ─── Data Loading ──────────────────────────────────────
  const [avatars, setAvatars] = useState<any[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [fetchingData, setFetchingData] = useState(true);

  // ─── Form State ────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [scriptLanguage, setScriptLanguage] = useState('en');
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [aspectRatio, setAspectRatio] = useState('PORTRAIT_9_16');
  const [resolution, setResolution] = useState('HD_720P');
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [transparentBg, setTransparentBg] = useState(false);
  const [bgMode, setBgMode] = useState<'color' | 'image' | 'transparent'>('color');

  // ─── UI State ──────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { fetchAssets(); }, []);

  async function fetchAssets() {
    try {
      const [aRes, vRes, bRes] = await Promise.all([
        fetch('/api/avatars'), fetch('/api/voices'), fetch('/api/billing'),
      ]);
      const [aData, vData, bData] = await Promise.all([aRes.json(), vRes.json(), bRes.json()]);

      const readyAvatars = (aData.data || []).filter((a: any) => a.status === 'READY');
      const readyVoices = (vData.data || []).filter((v: any) => v.status === 'READY');

      setAvatars(readyAvatars);
      setVoices(readyVoices);
      setWallet(bData.data?.wallet || null);

      if (readyAvatars.length > 0) setAvatarId(readyAvatars[0].id);
      if (readyVoices.length > 0) setVoiceId(readyVoices[0].id);
    } catch (err) {
      console.error('Fetch assets error:', err);
    } finally {
      setFetchingData(false);
    }
  }

  // ─── Computed Values ───────────────────────────────────
  const wordCount = useMemo(() => script.split(/\s+/).filter(Boolean).length, [script]);
  const estDurationSec = useMemo(() => Math.max(1, Math.ceil((wordCount / 150) * 60)), [wordCount]);
  const estCredits = estDurationSec; // 1 credit = 1 second

  const canSubmit = title.trim() && script.trim().length >= 10 && avatarId && voiceId;
  const hasEnoughCredits = wallet ? wallet.totalAvailable >= estCredits : false;

  // ─── Submit ────────────────────────────────────────────
  async function handleGenerate() {
    if (!canSubmit) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!hasEnoughCredits) {
      toast.error(`Insufficient credits. Need ~${estCredits}s, have ${wallet?.totalAvailable || 0}s`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          script: script.trim(),
          scriptLanguage,
          avatarId,
          voiceId,
          aspectRatio,
          resolution,
          backgroundColor: bgMode === 'color' ? bgColor : undefined,
          backgroundImageUrl: bgMode === 'image' ? bgImageUrl : undefined,
          transparentBg: bgMode === 'transparent',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate video');
      }

      toast.success(`Video queued! ~${estCredits}s credits used.`);
      router.push('/my-videos');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Loading State ─────────────────────────────────────
  if (fetchingData) return <PageSkeleton />;

  // ─── No Assets State ───────────────────────────────────
  if (avatars.length === 0 || voices.length === 0) {
    return (
      <div className="page-container max-w-2xl mx-auto">
        <h1 className="page-title">Create Video</h1>
        <Card padding="lg" className="mt-6">
          <EmptyState
            icon="⚠️"
            title="Setup Required"
            description={
              avatars.length === 0 && voices.length === 0
                ? 'You need at least one ready avatar AND one ready voice clone.'
                : avatars.length === 0
                ? 'You need at least one ready avatar to create videos.'
                : 'You need at least one ready voice clone to create videos.'
            }
            action={{
              label: avatars.length === 0 ? 'Create Avatar' : 'Clone Voice',
              onClick: () => router.push(avatars.length === 0 ? '/create-avatar' : '/clone-voice'),
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Create Video</h1>
        <p className="page-subtitle">Generate a professional video with your AI avatar and cloned voice.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ Main Form (Left 2/3) ═══ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Title */}
          <Card>
            <label htmlFor="video-title" className="label">Video Title</label>
            <input
              id="video-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="My awesome video"
              maxLength={100}
            />
          </Card>

          {/* Script Editor */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Script</label>
              <div className="flex items-center gap-2">
                <select
                  value={scriptLanguage}
                  onChange={(e) => setScriptLanguage(e.target.value)}
                  className="text-xs bg-dark-600 border border-dark-400/30 rounded-lg px-2.5 py-1.5 text-dark-100 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-1"
                >
                  {showTemplates ? 'Hide Templates' : '📝 Templates'}
                </button>
              </div>
            </div>

            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="input-field min-h-[180px] resize-y font-mono text-sm leading-relaxed"
              placeholder="Type or paste your script here...&#10;&#10;Tip: Write naturally as if you're speaking to camera."
              maxLength={5000}
            />

            <div className="flex justify-between mt-2 text-[11px] text-dark-300">
              <span>{wordCount} words • ~{estDurationSec}s estimated</span>
              <span>{script.length}/5000</span>
            </div>

            {/* Templates Drawer */}
            {showTemplates && (
              <div className="mt-4 p-4 rounded-xl bg-dark-600/30 border border-dark-400/10">
                <p className="text-xs text-dark-100 mb-3 font-medium">Choose a template to get started:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setScript(t.script); setScriptLanguage(t.lang); setShowTemplates(false); }}
                      className="text-left p-3 rounded-lg bg-dark-700/50 border border-dark-400/10 hover:border-brand-500/30 hover:bg-dark-600/50 transition-all"
                    >
                      <p className="text-xs font-medium text-white">{t.name}</p>
                      <p className="text-[10px] text-dark-300 mt-0.5 capitalize">{t.category} • {t.lang}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Avatar & Voice Selection */}
          <Card>
            <div className="grid grid-cols-2 gap-4">
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
          </Card>
        </div>

        {/* ═══ Sidebar (Right 1/3) ═══ */}
        <div className="space-y-5">

          {/* Aspect Ratio */}
          <Card>
            <CardTitle className="text-sm">Format</CardTitle>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { value: 'PORTRAIT_9_16', label: '9:16', desc: 'Reels / Shorts', icon: '📱' },
                { value: 'LANDSCAPE_16_9', label: '16:9', desc: 'YouTube / Web', icon: '🖥️' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    aspectRatio === opt.value
                      ? 'border-brand-500/60 bg-brand-500/10'
                      : 'border-dark-400/20 hover:border-dark-400/40'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <p className={`text-xs font-medium mt-1 ${aspectRatio === opt.value ? 'text-brand-400' : 'text-white'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-dark-300">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Resolution */}
          <Card>
            <CardTitle className="text-sm">Resolution</CardTitle>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="input-field mt-2"
            >
              <option value="SD_480P">480p (SD) — fastest</option>
              <option value="HD_720P">720p (HD) — recommended</option>
              <option value="FHD_1080P">1080p (Full HD)</option>
            </select>
          </Card>

          {/* Background */}
          <Card>
            <CardTitle className="text-sm">Background</CardTitle>
            <div className="mt-3 space-y-3">
              {/* Mode selector */}
              <div className="flex rounded-lg overflow-hidden border border-dark-400/20">
                {([
                  { value: 'color', label: 'Color' },
                  { value: 'image', label: 'Image' },
                  { value: 'transparent', label: 'None' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBgMode(opt.value)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      bgMode === opt.value
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'text-dark-200 hover:text-white hover:bg-dark-600/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {bgMode === 'color' && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-dark-400/30"
                  />
                  <div>
                    <p className="text-xs text-white font-mono">{bgColor}</p>
                    <p className="text-[10px] text-dark-300">Click to change</p>
                  </div>
                </div>
              )}

              {bgMode === 'image' && (
                <div>
                  <input
                    type="url"
                    value={bgImageUrl}
                    onChange={(e) => setBgImageUrl(e.target.value)}
                    className="input-field text-xs"
                    placeholder="https://example.com/background.jpg"
                  />
                  <p className="text-[10px] text-dark-300 mt-1">Paste a public image URL</p>
                </div>
              )}

              {bgMode === 'transparent' && (
                <div className="p-3 rounded-lg bg-dark-600/30 border border-dark-400/10">
                  <p className="text-[11px] text-dark-200">
                    Output will be WEBM format with transparent background. 
                    Great for overlays and compositing.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Cost Estimate */}
          <Card glow>
            <CardTitle className="text-sm">Cost Estimate</CardTitle>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-dark-200">
                <span>Est. Duration</span>
                <span className="text-white">~{estDurationSec}s</span>
              </div>
              <div className="flex justify-between text-xs text-dark-200">
                <span>Credits Required</span>
                <span className="text-white">~{estCredits}s</span>
              </div>
              <div className="flex justify-between text-xs text-dark-200">
                <span>Available</span>
                <span className={hasEnoughCredits ? 'text-green-400' : 'text-red-400'}>
                  {wallet?.totalAvailable || 0}s
                </span>
              </div>
              <hr className="border-dark-400/20 my-2" />
              <div className="flex justify-between text-xs">
                <span className="text-dark-100 font-medium">After generation</span>
                <span className={`font-bold ${hasEnoughCredits ? 'text-brand-400' : 'text-red-400'}`}>
                  {hasEnoughCredits ? `${(wallet?.totalAvailable || 0) - estCredits}s remaining` : 'Insufficient!'}
                </span>
              </div>
            </div>

            {!hasEnoughCredits && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/15">
                <p className="text-[11px] text-red-300">
                  Not enough credits.{' '}
                  <a href="/billing" className="underline hover:text-red-200">Buy a top-up</a> or shorten your script.
                </p>
              </div>
            )}
          </Card>

          {/* Generate Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            loading={loading}
            disabled={!canSubmit || !hasEnoughCredits}
            icon={<span>🎬</span>}
          >
            Generate Video
          </Button>

          <p className="text-center text-[10px] text-dark-400">
            Generation takes 2–5 minutes. You'll be notified when ready.
          </p>
        </div>
      </div>
    </div>
  );
}
