'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function MyVideosPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchVideos();
  }, [page]);

  async function fetchVideos() {
    try {
      const res = await fetch(`/api/videos?page=${page}&limit=12`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-dark-600 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">My Videos</h1>
      <p className="page-subtitle">All your generated videos in one place.</p>

      {videos.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-lg font-semibold text-white mb-2">No videos yet</h2>
          <p className="text-sm text-dark-100">Create your first video to see it here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                ← Previous
              </button>
              <span className="text-sm text-dark-200 self-center">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: any }) {
  return (
    <div className="glass-card-hover overflow-hidden">
      {/* Thumbnail / Preview */}
      <div className="aspect-video bg-dark-600 flex items-center justify-center relative">
        {video.status === 'COMPLETED' && video.outputUrl ? (
          <video
            src={video.outputUrl}
            className="w-full h-full object-cover"
            poster=""
          />
        ) : (
          <div className="text-center">
            <span className="text-3xl">
              {video.status === 'GENERATING' ? '⏳' : video.status === 'FAILED' ? '❌' : '🎬'}
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={video.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-dark-200">
            {video.avatar?.name} • {video.voice?.name}
          </span>
          <span className="text-xs text-dark-300">
            {new Date(video.createdAt).toLocaleDateString('en-IN')}
          </span>
        </div>
        {video.durationSec && (
          <span className="text-xs text-dark-200 mt-1 block">
            Duration: {Math.floor(video.durationSec / 60)}:{(video.durationSec % 60).toString().padStart(2, '0')}
          </span>
        )}

        {/* Actions */}
        {video.status === 'COMPLETED' && video.outputUrl && (
          <a
            href={video.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs mt-3 block text-center"
          >
            Download ↗
          </a>
        )}
      </div>
    </div>
  );
}
