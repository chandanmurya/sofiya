'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  trigger?: 'demo_complete' | 'credits_exhausted' | 'locked_feature' | 'manual';
  featureContext?: string; // which locked feature triggered this
}

// ─── Locked Features Data ────────────────────────────────────

const LOCKED_FEATURES = [
  {
    id: 'custom_avatar',
    icon: '🧬',
    title: 'Custom AI Avatar',
    titleHi: 'कस्टम AI अवतार',
    description: 'Create a Digital Twin that looks exactly like you',
    plan: 'Creator',
  },
  {
    id: 'voice_clone',
    icon: '🎙️',
    title: 'Voice Cloning',
    titleHi: 'वॉइस क्लोनिंग',
    description: 'Clone your voice for natural-sounding videos',
    plan: 'Creator',
  },
  {
    id: 'remove_watermark',
    icon: '💎',
    title: 'Remove Watermark',
    titleHi: 'वॉटरमार्क हटाएं',
    description: 'Clean, professional videos without branding',
    plan: 'Starter',
  },
  {
    id: 'hd_1080p',
    icon: '🎯',
    title: '1080p Full HD',
    titleHi: '1080p फुल HD',
    description: 'Crystal-clear video for YouTube and courses',
    plan: 'Creator',
  },
  {
    id: 'longer_videos',
    icon: '📹',
    title: 'Longer Videos',
    titleHi: 'लंबे वीडियो',
    description: 'Generate up to 6 minutes per video',
    plan: 'Studio',
  },
  {
    id: 'priority_queue',
    icon: '⚡',
    title: 'Priority Queue',
    titleHi: 'प्रायॉरिटी क्यू',
    description: 'Skip the line — get videos faster',
    plan: 'Studio',
  },
  {
    id: 'transparent_bg',
    icon: '🖼️',
    title: 'Transparent Background',
    titleHi: 'ट्रांसपेरेंट बैकग्राउंड',
    description: 'WEBM export for overlays and compositing',
    plan: 'Studio',
  },
  {
    id: 'templates_all',
    icon: '📝',
    title: 'All Templates',
    titleHi: 'सभी टेम्पलेट',
    description: 'Access 20+ professional script templates',
    plan: 'Starter',
  },
];

// ─── Modal Content by Trigger ────────────────────────────────

const MODAL_CONTENT = {
  demo_complete: {
    title: 'Your Demo Video is Ready!',
    subtitle: 'Unlock the full power of AvatarForge',
    emoji: '🎉',
  },
  credits_exhausted: {
    title: 'Free Credits Used Up',
    subtitle: 'Upgrade to keep creating amazing videos',
    emoji: '💫',
  },
  locked_feature: {
    title: 'Premium Feature',
    subtitle: 'This feature is available on paid plans',
    emoji: '🔒',
  },
  manual: {
    title: 'Upgrade Your Plan',
    subtitle: 'Unlock unlimited AI video creation',
    emoji: '🚀',
  },
};

// ─── Component ───────────────────────────────────────────────

export function UpgradeModal({ open, onClose, trigger = 'manual', featureContext }: UpgradeModalProps) {
  const router = useRouter();
  const content = MODAL_CONTENT[trigger];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-800 border border-dark-400/30 rounded-3xl shadow-2xl shadow-brand-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-brand-500/10 blur-3xl rounded-full" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-dark-600/50 flex items-center justify-center text-dark-200 hover:text-white hover:bg-dark-500/50 transition-all z-10"
        >
          ✕
        </button>

        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">{content.emoji}</div>
            <h2 className="text-xl font-bold text-white">{content.title}</h2>
            <p className="text-sm text-dark-100 mt-1">{content.subtitle}</p>
          </div>

          {/* Feature context (if triggered by locked feature) */}
          {trigger === 'locked_feature' && featureContext && (
            <div className="mb-6 p-3 rounded-xl bg-brand-500/5 border border-brand-500/20 text-center">
              <p className="text-xs text-brand-300">
                <span className="font-medium">"{featureContext}"</span> requires a paid plan.
              </p>
            </div>
          )}

          {/* Locked Features Grid */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {LOCKED_FEATURES.slice(0, 6).map((feature) => (
              <div
                key={feature.id}
                className="p-3 rounded-xl bg-dark-700/50 border border-dark-400/15 flex items-center gap-2.5"
              >
                <span className="text-lg shrink-0">{feature.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{feature.title}</p>
                  <p className="text-[10px] text-dark-300 truncate">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Plan Quick Compare */}
          <div className="flex gap-2 mb-6">
            {[
              { name: 'Starter', price: '₹199', highlight: false },
              { name: 'Creator', price: '₹499', highlight: true },
              { name: 'Studio', price: '₹999', highlight: false },
            ].map((plan) => (
              <button
                key={plan.name}
                onClick={() => router.push('/pricing')}
                className={cn(
                  'flex-1 p-3 rounded-xl border text-center transition-all hover:scale-[1.02]',
                  plan.highlight
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-dark-400/20 hover:border-dark-400/40'
                )}
              >
                <p className={cn('text-xs font-medium', plan.highlight ? 'text-brand-400' : 'text-white')}>
                  {plan.name}
                </p>
                <p className="text-lg font-bold text-white mt-0.5">{plan.price}</p>
                <p className="text-[10px] text-dark-300">/month</p>
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-2.5">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push('/pricing')}
            >
              View Plans & Upgrade
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onClose}
            >
              Maybe later
            </Button>
          </div>

          {/* Social proof */}
          <p className="text-center text-[10px] text-dark-400 mt-4">
            Join 1,000+ Indian creators using AvatarForge
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Locked Feature Card (for dashboard blurred state) ───────

export function LockedFeatureCard({ feature, onUpgrade }: {
  feature: typeof LOCKED_FEATURES[number];
  onUpgrade: () => void;
}) {
  return (
    <div
      onClick={onUpgrade}
      className="relative p-5 rounded-2xl border border-dark-400/20 bg-dark-700/30 cursor-pointer group hover:border-brand-500/30 transition-all overflow-hidden"
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-dark-800/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="text-center">
          <span className="text-lg">🔒</span>
          <p className="text-xs text-brand-400 font-medium mt-1">Unlock with {feature.plan}</p>
        </div>
      </div>

      {/* Content (slightly faded) */}
      <div className="opacity-60 group-hover:opacity-40 transition-opacity">
        <span className="text-2xl">{feature.icon}</span>
        <h4 className="text-sm font-medium text-white mt-2">{feature.title}</h4>
        <p className="text-[11px] text-dark-200 mt-0.5">{feature.description}</p>
      </div>

      {/* Lock badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-dark-500/80 border border-dark-400/30 text-[9px] text-dark-200 font-medium">
        🔒 {feature.plan}
      </div>
    </div>
  );
}

// ─── Inline Upgrade Banner (for use in pages) ────────────────

export function UpgradeBanner({ message, urgency = 'medium', onUpgrade }: {
  message: string;
  urgency?: 'low' | 'medium' | 'high';
  onUpgrade: () => void;
}) {
  const styles = {
    low: 'bg-dark-700/40 border-dark-400/20 text-dark-100',
    medium: 'bg-brand-500/5 border-brand-500/20 text-brand-300',
    high: 'bg-gradient-to-r from-brand-600/10 to-brand-500/10 border-brand-500/30 text-brand-200',
  };

  return (
    <div className={cn('flex items-center justify-between p-4 rounded-xl border', styles[urgency])}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{urgency === 'high' ? '🚀' : urgency === 'medium' ? '💡' : '✨'}</span>
        <p className="text-sm truncate">{message}</p>
      </div>
      <Button size="sm" onClick={onUpgrade} className="shrink-0 ml-3">
        Upgrade
      </Button>
    </div>
  );
}

// ─── Export features data for use elsewhere ──────────────────
export { LOCKED_FEATURES };
