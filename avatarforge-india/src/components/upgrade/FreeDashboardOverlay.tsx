'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UpgradeModal, LockedFeatureCard, UpgradeBanner, LOCKED_FEATURES } from './UpgradeModal';

// ─── Types ───────────────────────────────────────────────────

interface FreeDashboardOverlayProps {
  creditsRemaining: number;
  creditsTotal: number;
  freeDemoUsed: boolean;
  onboardingCompleted: boolean;
}

/**
 * Dashboard overlay for free users showing:
 * - Credits meter (15s lifetime)
 * - Onboarding prompt (if not completed)
 * - Blurred locked features grid
 * - Upgrade CTAs
 */
export function FreeDashboardOverlay({
  creditsRemaining,
  creditsTotal,
  freeDemoUsed,
  onboardingCompleted,
}: FreeDashboardOverlayProps) {
  const router = useRouter();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [modalTrigger, setModalTrigger] = useState<'manual' | 'locked_feature' | 'credits_exhausted'>('manual');
  const [featureContext, setFeatureContext] = useState<string>('');

  const creditsUsed = creditsTotal - creditsRemaining;
  const creditsPercent = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;
  const exhausted = creditsRemaining <= 0;

  function handleLockedFeatureClick(feature: typeof LOCKED_FEATURES[number]) {
    setModalTrigger('locked_feature');
    setFeatureContext(feature.title);
    setShowUpgradeModal(true);
  }

  return (
    <>
      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger={modalTrigger}
        featureContext={featureContext}
      />

      <div className="space-y-6">
        {/* ─── Credits Exhausted Banner ──────────────────── */}
        {exhausted && (
          <UpgradeBanner
            urgency="high"
            message="Free credits used up! Upgrade to keep creating videos."
            onUpgrade={() => { setModalTrigger('credits_exhausted'); setShowUpgradeModal(true); }}
          />
        )}

        {/* ─── Onboarding Prompt ─────────────────────────── */}
        {!onboardingCompleted && !freeDemoUsed && (
          <Card glow className="border-brand-500/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                <span className="text-2xl">🎬</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Create your first AI video in 30 seconds</h3>
                <p className="text-xs text-dark-200 mt-0.5">
                  Pick a stock avatar, type a short script, and watch the magic. Free — no card needed.
                </p>
              </div>
              <Button onClick={() => router.push('/onboarding')}>
                Start Demo →
              </Button>
            </div>
          </Card>
        )}

        {/* ─── Free Credits Meter ────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-white">Free Demo Credits</h3>
              <p className="text-[11px] text-dark-300">Lifetime limit — does not reset</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-white">
                {creditsRemaining}<span className="text-sm text-dark-300">s</span>
              </p>
              <p className="text-[10px] text-dark-300">of {creditsTotal}s</p>
            </div>
          </div>

          <div className="h-2.5 bg-dark-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                exhausted
                  ? 'bg-red-500'
                  : creditsRemaining <= 5
                  ? 'bg-yellow-500'
                  : 'bg-gradient-to-r from-brand-600 to-brand-400'
              }`}
              style={{ width: `${creditsPercent}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-[10px] text-dark-400">
            <span>{creditsUsed}s used</span>
            <span>{creditsRemaining}s remaining</span>
          </div>

          {!exhausted && creditsRemaining <= 5 && (
            <p className="text-[11px] text-yellow-400 mt-2">
              Almost out! Only {creditsRemaining}s left.{' '}
              <button onClick={() => setShowUpgradeModal(true)} className="underline hover:text-yellow-300">Upgrade now</button>
            </p>
          )}
        </Card>

        {/* ─── Locked Features Grid (Blurred) ────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">Premium Features</h3>
            <button
              onClick={() => { setModalTrigger('manual'); setShowUpgradeModal(true); }}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Unlock all →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LOCKED_FEATURES.slice(0, 4).map((feature) => (
              <LockedFeatureCard
                key={feature.id}
                feature={feature}
                onUpgrade={() => handleLockedFeatureClick(feature)}
              />
            ))}
          </div>
        </div>

        {/* ─── Upgrade CTA (persistent bottom) ───────────── */}
        {freeDemoUsed && (
          <Card className="bg-gradient-to-r from-brand-600/10 to-brand-500/5 border-brand-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Ready to go pro?</p>
                <p className="text-xs text-dark-200 mt-0.5">
                  Plans start at ₹199/mo • Remove watermark • Longer videos
                </p>
              </div>
              <Button size="sm" onClick={() => router.push('/pricing')}>
                View Plans
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
