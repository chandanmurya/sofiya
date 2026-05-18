'use client';

import { Button } from './Button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon = '📭', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="text-5xl mb-5 animate-pulse-slow">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-dark-100 max-w-sm mb-6">{description}</p>
      {action && (
        <Button
          variant="primary"
          onClick={action.onClick}
          {...(action.href ? { as: 'a', href: action.href } : {})}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
