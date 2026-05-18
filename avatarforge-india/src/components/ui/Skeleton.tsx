'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  lines?: number;
}

export function Skeleton({ className, variant = 'rectangular', lines = 1 }: SkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('animate-pulse rounded-2xl bg-dark-600/60 border border-dark-500/20', className)}>
        <div className="p-6 space-y-4">
          <div className="h-4 bg-dark-500/60 rounded w-3/4" />
          <div className="h-3 bg-dark-500/40 rounded w-1/2" />
          <div className="h-24 bg-dark-500/30 rounded-lg mt-4" />
        </div>
      </div>
    );
  }

  if (variant === 'circular') {
    return <div className={cn('animate-pulse rounded-full bg-dark-600/60', className)} />;
  }

  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse h-3 bg-dark-600/60 rounded',
              i === lines - 1 ? 'w-2/3' : 'w-full'
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('animate-pulse rounded-xl bg-dark-600/60', className)} />;
}

// Pre-built skeleton layouts
export function PageSkeleton() {
  return (
    <div className="page-container space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Skeleton variant="card" className="h-40" />
        <Skeleton variant="card" className="h-40" />
        <Skeleton variant="card" className="h-40" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-dark-600/30 animate-pulse">
          <Skeleton variant="circular" className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
