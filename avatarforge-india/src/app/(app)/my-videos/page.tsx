'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { usePolling } from '@/hooks/usePolling';

interface VideoItem {
  id: string;
  title: string;
  status: string;
  aspectRatio: string;
  resolution: string;
  outputUrl: string | null;
  durationSec: number | null;
  secondsUsed: number;
  script: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  avatar: { id: string; name: string } | null;
  voice: { id: string; name: string } | null;
}

export default function MyVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('');

  // ─── Fetch Videos ──────────────────────────────────────
  const fetchVideos = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (filter) params.set('status', filter);

      const res = await fetch(`/api/videos?${params}`);
      const data = await res.json();

      if (data.success) {
        setVideos(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // ─── Auto-refresh if any video is in-progress ──────────
  const hasInProgress = videos.some((v) => ['QUEUED', 'GENERATING', 'PROCESSING'].includes(v.status));

  usePolling({
    url: `/api/videos?page=${page}&limit=12${filter ? `&status=${filter}` : ''}`,
    enabled: hasInProgress,
    interval: 8000,
    maxAttempts: 60,
    stopWhen: () => false, // keep polling while in-progress videos exist
    onUpdate: (raw) => {
      if (raw) {
        // raw is the full API response data array
        // Re-fetch to update state cleanly
        fetchVideos();
      }
    },
  });

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-container">
        <div className="mb-6">
          <div className="h-8 w-32 bg-dark-600/60 rounded animate-pulse" />
        </div>
        <ListSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">My Videos</h1>
          <p className="page-subtitle">
            {total} video{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        <Button onClick={() => router.push('/create-video')} icon={<span>+</span>}>
          New Video
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: '', label: 'All' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'GENERATING', label: 'In Progress' },
          { value: 'FAILED', label: 'Failed' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              filter === f.value
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'bg-dark-600/30 text-dark-200 border border-dark-400/10 hover:border-dark-400/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Videos Grid */}
      {videos.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={filter ? '🔍' : '🎬'}
            title={filter ? 'No videos match this filter' : 'No videos yet'}
            description={filter ? 'Try a different filter or create a new video.' : 'Generate your first AI video to see it here.'}
            action={{ label: 'Create Video', onClick: () => router.push('/create-video') }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} onRefresh={fetchVideos} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Previous
              </Button>
              <span className="text-xs text-dark-200">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Video Card Component ────────────────────────────────────

function VideoCard({ video, onRefresh }: { video: VideoItem; onRefresh: () => void }) {
  const [polling, setPolling] = useState(false);

  const isInProgress = ['QUEUED', 'GENERATING', 'PROCESSING'].includes(video.status);
  const isCompleted = video.status === 'COMPLETED';
  const isFailed = video.status === 'FAILED';

  // Poll individual video if in progress
  usePolling({
    url: `/api/videos/${video.id}/status`,
    enabled: isInProgress,
    interval: 6000,
    maxAttempts: 100,
    stopWhen: (d) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(d?.status),
    onUpdate: (d) => {
      if (d?.status === 'COMPLETED' || d?.status === 'FAILED') {
        onRefresh();
      }
    },
  });

  return (
    <Card hover padding="none" className="overflow-hidden flex flex-col">
      {/* Thumbnail / Preview Area */}
      <div className="aspect-video bg-dark-800 flex items-center justify-center relative overflow-hidden">
        {isCompleted && video.outputUrl ? (
          <video
            src={video.outputUrl}
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isInProgress && (
              <div className="relative">
                <span className="text-3xl">⏳</span>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              </div>
            )}
            {isFailed && <span className="text-3xl">❌</span>}
            {!isInProgress && !isFailed && <span className="text-3xl">🎬</span>}
            <p className="text-[10px] text-dark-300">
              {isInProgress ? 'Generating...' : isFailed ? 'Failed' : 'Draft'}
            </p>
          </div>
        )}

        {/* Status Badge Overlay */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={video.status} />
        </div>

        {/* Aspect Ratio Badge */}
        <div className="absolute bottom-2 left-2">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-dark-100 backdrop-blur-sm">
            {video.aspectRatio === 'PORTRAIT_9_16' ? '9:16' : '16:9'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>

        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-dark-300">
          {video.avatar && <span>{video.avatar.name}</span>}
          {video.avatar && video.voice && <span>•</span>}
          {video.voice && <span>{video.voice.name}</span>}
        </div>

        <div className="flex items-center gap-2 mt-1 text-[11px] text-dark-300">
          <span>{new Date(video.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {video.durationSec && (
            <>
              <span>•</span>
              <span>{Math.floor(video.durationSec / 60)}:{(video.durationSec % 60).toString().padStart(2, '0')}</span>
            </>
          )}
          {video.secondsUsed > 0 && (
            <>
              <span>•</span>
              <span>{video.secondsUsed}s used</span>
            </>
          )}
        </div>

        {/* Error message */}
        {isFailed && video.errorMessage && (
          <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/15">
            <p className="text-[10px] text-red-300 line-clamp-2">{video.errorMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-3">
          {isCompleted && video.outputUrl && (
            <a
              href={video.outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="primary" size="sm" className="w-full" icon={<span>↓</span>}>
                Download
              </Button>
            </a>
          )}

          {isInProgress && (
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400">Processing...</span>
            </div>
          )}

          {isFailed && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-400"
              onClick={() => {/* Could implement retry */}}
            >
              Retry Generation
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
