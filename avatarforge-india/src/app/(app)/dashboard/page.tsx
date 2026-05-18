'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface DashboardData {
  wallet: {
    monthlyRemaining: number;
    topupSeconds: number;
    totalAvailable: number;
    monthlyIncludedSeconds: number;
  };
  subscription: { plan: string; status: string } | null;
  stats: {
    avatars: number;
    avatarsReady: number;
    voices: number;
    voicesReady: number;
    videos: number;
    videosCompleted: number;
  };
  recentVideos: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    durationSec?: number;
  }>;
  activeJobs: Array<{
    id: string;
    type: string;
    status: string;
    entityId: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const [billingRes, avatarsRes, voicesRes, videosRes] = await Promise.all([
        fetch('/api/billing'),
        fetch('/api/avatars'),
        fetch('/api/voices'),
        fetch('/api/videos?limit=5'),
      ]);

      const [billing, avatars, voices, videos] = await Promise.all([
        billingRes.json(),
        avatarsRes.json(),
        voicesRes.json(),
        videosRes.json(),
      ]);

      const avatarsList = avatars.data || [];
      const voicesList = voices.data || [];

      setData({
        wallet: billing.data?.wallet || { monthlyRemaining: 0, topupSeconds: 0, totalAvailable: 0, monthlyIncludedSeconds: 60 },
        subscription: billing.data?.subscription || null,
        stats: {
          avatars: avatarsList.length,
          avatarsReady: avatarsList.filter((a: any) => a.status === 'READY').length,
          voices: voicesList.length,
          voicesReady: voicesList.filter((v: any) => v.status === 'READY').length,
          videos: videos.pagination?.total || 0,
          videosCompleted: (videos.data || []).filter((v: any) => v.status === 'COMPLETED').length,
        },
        recentVideos: videos.data || [],
        activeJobs: [],
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageSkeleton />;

  const firstName = session?.user?.name?.split(' ')[0] || 'Creator';
  const wallet = data?.wallet;
  const stats = data?.stats;
  const plan = data?.subscription?.plan || 'Free';
  const creditsPercent = wallet ? Math.round((wallet.totalAvailable / Math.max(wallet.monthlyIncludedSeconds, 1)) * 100) : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome, {firstName} 👋
          </h1>
          <p className="text-dark-100 text-sm mt-1">
            Here's your AvatarForge overview
          </p>
        </div>
        <Link href="/create-video">
          <Button icon={<span>🎬</span>}>New Video</Button>
        </Link>
      </div>

      {/* ─── Usage Widget (Credits) ───────────────────────── */}
      <Card glow className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <span className="text-lg">💎</span>
              </div>
              <div>
                <p className="text-sm text-dark-100">Video Credits Available</p>
                <p className="text-2xl font-bold text-white">
                  {wallet?.totalAvailable || 0}<span className="text-sm font-normal text-dark-200">s</span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="max-w-md">
              <div className="flex justify-between text-[11px] text-dark-300 mb-1">
                <span>Monthly: {wallet?.monthlyRemaining || 0}s remaining</span>
                <span>{wallet?.monthlyIncludedSeconds || 0}s total</span>
              </div>
              <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, creditsPercent)}%` }}
                />
              </div>
              {wallet && wallet.topupSeconds > 0 && (
                <p className="text-[11px] text-dark-300 mt-1.5">
                  + {wallet.topupSeconds}s from top-ups
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/billing">
              <Button variant="ghost" size="sm">View Usage</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="sm">
                {plan === 'Free' || !plan ? 'Upgrade' : 'Top Up'}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* ─── Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QuickActionCard
          href="/create-avatar"
          icon="🧬"
          title="Create Avatar"
          subtitle={`${stats?.avatarsReady || 0} ready`}
          stat={stats?.avatars || 0}
        />
        <QuickActionCard
          href="/clone-voice"
          icon="🎙️"
          title="Clone Voice"
          subtitle={`${stats?.voicesReady || 0} ready`}
          stat={stats?.voices || 0}
        />
        <QuickActionCard
          href="/create-video"
          icon="🎬"
          title="Create Video"
          subtitle={`${stats?.videosCompleted || 0} completed`}
          stat={stats?.videos || 0}
        />
        <QuickActionCard
          href="/my-videos"
          icon="📹"
          title="My Videos"
          subtitle="View all"
          stat={stats?.videos || 0}
        />
      </div>

      {/* ─── Getting Started Guide (if new user) ─────────── */}
      {stats && stats.avatars === 0 && (
        <Card className="mb-8 border-brand-500/20 bg-brand-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
              <span className="text-2xl">🚀</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">Get Started in 4 Steps</h3>
              <p className="text-sm text-dark-100 mb-4">
                Create your first AI video in under 30 minutes.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { step: '1', label: 'Upload Video', href: '/create-avatar', done: (stats?.avatars || 0) > 0 },
                  { step: '2', label: 'Complete Consent', href: '/create-avatar', done: (stats?.avatarsReady || 0) > 0 },
                  { step: '3', label: 'Clone Voice', href: '/clone-voice', done: (stats?.voices || 0) > 0 },
                  { step: '4', label: 'Create Video', href: '/create-video', done: (stats?.videosCompleted || 0) > 0 },
                ].map((item) => (
                  <Link key={item.step} href={item.href}>
                    <div className={`p-3 rounded-lg border text-center transition-all hover:border-brand-500/40 ${
                      item.done ? 'border-green-500/30 bg-green-500/5' : 'border-dark-400/30 hover:bg-dark-600/30'
                    }`}>
                      <div className={`text-xs font-bold mb-0.5 ${item.done ? 'text-green-400' : 'text-brand-400'}`}>
                        {item.done ? '✓' : `Step ${item.step}`}
                      </div>
                      <p className="text-[11px] text-dark-100">{item.label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Recent Videos ────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Recent Videos</CardTitle>
          <Link href="/my-videos" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
            View all →
          </Link>
        </div>

        {data?.recentVideos && data.recentVideos.length > 0 ? (
          <div className="space-y-2">
            {data.recentVideos.map((video) => (
              <div
                key={video.id}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-600/30 hover:bg-dark-600/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-dark-500/50 flex items-center justify-center shrink-0">
                    <span className="text-sm">
                      {video.status === 'COMPLETED' ? '✅' : video.status === 'GENERATING' ? '⏳' : '🎬'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{video.title}</p>
                    <p className="text-[11px] text-dark-300">
                      {new Date(video.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {video.durationSec && ` • ${video.durationSec}s`}
                    </p>
                  </div>
                </div>
                <StatusBadge status={video.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🎬"
            title="No videos yet"
            description="Create your first AI video to see it here."
            action={{ label: 'Create Video', onClick: () => window.location.href = '/create-video' }}
            className="py-10"
          />
        )}
      </Card>

      {/* ─── Plan Badge ───────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-dark-700/30 border border-dark-400/10">
        <div className="flex items-center gap-3">
          <span className="text-lg">📋</span>
          <div>
            <p className="text-sm text-white font-medium">
              Plan: <span className="text-brand-400">{plan || 'Free Trial'}</span>
            </p>
            <p className="text-[11px] text-dark-300">
              {data?.subscription?.status === 'ACTIVE' ? 'Active subscription' : 'Upgrade to unlock more'}
            </p>
          </div>
        </div>
        {(!plan || plan === 'Free') && (
          <Link href="/pricing">
            <Button size="sm" variant="primary">Upgrade</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Quick Action Card Component ─────────────────────────────

function QuickActionCard({ href, icon, title, subtitle, stat }: {
  href: string; icon: string; title: string; subtitle: string; stat: number;
}) {
  return (
    <Link href={href}>
      <Card hover padding="md" className="group h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-lg font-bold text-white">{stat}</span>
        </div>
        <h3 className="text-sm font-medium text-white group-hover:text-brand-400 transition-colors">
          {title}
        </h3>
        <p className="text-[11px] text-dark-300 mt-0.5">{subtitle}</p>
      </Card>
    </Link>
  );
}
