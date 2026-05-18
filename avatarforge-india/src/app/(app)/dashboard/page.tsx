'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCredits, formatCurrency } from '@/lib/utils';

interface DashboardData {
  stats: {
    avatars: number;
    voices: number;
    videos: number;
    creditsBalance: number;
    creditsTotal: number;
    plan: string;
  };
  recentVideos: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  activeJobs: Array<{
    id: string;
    type: string;
    status: string;
    entityId: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const [avatarsRes, voicesRes, videosRes, billingRes] = await Promise.all([
        fetch('/api/avatars'),
        fetch('/api/voices'),
        fetch('/api/videos?limit=5'),
        fetch('/api/billing'),
      ]);

      const [avatars, voices, videos, billing] = await Promise.all([
        avatarsRes.json(),
        voicesRes.json(),
        videosRes.json(),
        billingRes.json(),
      ]);

      setData({
        stats: {
          avatars: avatars.data?.length || 0,
          voices: voices.data?.length || 0,
          videos: videos.pagination?.total || 0,
          creditsBalance: billing.data?.credits?.balance || 0,
          creditsTotal: billing.data?.subscription?.monthlyCredits || 50,
          plan: billing.data?.subscription?.plan || 'FREE',
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-dark-600 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-dark-600 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back! Here's your AvatarForge overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="🧬"
          label="Avatars"
          value={stats?.avatars || 0}
          href="/create-avatar"
        />
        <StatCard
          icon="🎙️"
          label="Voice Clones"
          value={stats?.voices || 0}
          href="/clone-voice"
        />
        <StatCard
          icon="🎬"
          label="Videos"
          value={stats?.videos || 0}
          href="/my-videos"
        />
        <StatCard
          icon="💎"
          label="Credits"
          value={`${formatCredits(stats?.creditsBalance || 0)} / ${formatCredits(stats?.creditsTotal || 50)}`}
          href="/billing"
          highlight
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickAction
          icon="🧬"
          title="Create Avatar"
          description="Upload a training video to create your digital twin"
          href="/create-avatar"
        />
        <QuickAction
          icon="🎙️"
          title="Clone Voice"
          description="Clone your voice with a short audio sample"
          href="/clone-voice"
        />
        <QuickAction
          icon="🎬"
          title="Generate Video"
          description="Create a video using your avatar and voice"
          href="/create-video"
        />
      </div>

      {/* Recent Videos */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Videos</h2>
          <Link href="/my-videos" className="text-sm text-brand-400 hover:text-brand-300">
            View all →
          </Link>
        </div>
        
        {data?.recentVideos && data.recentVideos.length > 0 ? (
          <div className="space-y-3">
            {data.recentVideos.map((video) => (
              <div key={video.id} className="flex items-center justify-between p-3 bg-dark-600/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">{video.title}</p>
                  <p className="text-xs text-dark-200">
                    {new Date(video.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <StatusBadge status={video.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-dark-200">
            <p className="text-3xl mb-2">🎬</p>
            <p>No videos yet. Create your first one!</p>
          </div>
        )}
      </div>

      {/* Plan Badge */}
      <div className="mt-6 glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">📋</span>
          <div>
            <p className="text-sm font-medium text-white">
              Current Plan: <span className="text-brand-400">{stats?.plan}</span>
            </p>
            <p className="text-xs text-dark-200">
              {stats?.plan === 'FREE' ? 'Upgrade to unlock more features' : 'Subscription active'}
            </p>
          </div>
        </div>
        {stats?.plan === 'FREE' && (
          <Link href="/billing" className="btn-primary text-sm">
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, href, highlight }: {
  icon: string; label: string; value: string | number; href: string; highlight?: boolean;
}) {
  return (
    <Link href={href} className="glass-card-hover p-5 group">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-dark-100">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-400' : 'text-white'}`}>
        {value}
      </p>
    </Link>
  );
}

function QuickAction({ icon, title, description, href }: {
  icon: string; title: string; description: string; href: string;
}) {
  return (
    <Link href={href} className="glass-card-hover p-5 group">
      <span className="text-2xl">{icon}</span>
      <h3 className="text-white font-medium mt-2 group-hover:text-brand-400 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-dark-200 mt-1">{description}</p>
    </Link>
  );
}
