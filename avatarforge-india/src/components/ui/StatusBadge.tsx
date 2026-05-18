'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Avatar statuses
  PENDING_UPLOAD: { label: 'Pending Upload', className: 'status-pending' },
  UPLOADING: { label: 'Uploading...', className: 'status-processing' },
  UPLOADED: { label: 'Uploaded', className: 'status-processing' },
  CONSENT_REQUIRED: { label: 'Consent Required', className: 'status-consent' },
  CONSENT_PENDING: { label: 'Awaiting Consent', className: 'status-consent' },
  TRAINING: { label: 'Training...', className: 'status-processing' },
  TRAINING_FAILED: { label: 'Training Failed', className: 'status-failed' },
  READY: { label: 'Ready', className: 'status-ready' },
  FAILED: { label: 'Failed', className: 'status-failed' },

  // Voice statuses
  CLONING: { label: 'Cloning...', className: 'status-processing' },
  CLONE_FAILED: { label: 'Clone Failed', className: 'status-failed' },

  // Video statuses
  DRAFT: { label: 'Draft', className: 'status-pending' },
  QUEUED: { label: 'Queued', className: 'status-pending' },
  GENERATING: { label: 'Generating...', className: 'status-processing' },
  PROCESSING: { label: 'Processing...', className: 'status-processing' },
  COMPLETED: { label: 'Completed', className: 'status-ready' },
  CANCELLED: { label: 'Cancelled', className: 'status-failed' },

  // Subscription statuses
  ACTIVE: { label: 'Active', className: 'status-ready' },
  PAST_DUE: { label: 'Past Due', className: 'status-failed' },
  PAUSED: { label: 'Paused', className: 'status-pending' },
  EXPIRED: { label: 'Expired', className: 'status-failed' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'status-pending' };
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
