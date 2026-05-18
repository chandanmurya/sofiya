'use client';

import { cn } from '@/lib/utils';

interface Step {
  id: string;
  label: string;
  labelHi?: string;
  status: 'completed' | 'current' | 'upcoming' | 'failed';
}

interface ProgressTrackerProps {
  steps: Step[];
  locale?: 'en' | 'hi';
}

export function ProgressTracker({ steps, locale = 'en' }: ProgressTrackerProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  step.status === 'completed' && 'bg-green-500/20 text-green-400 border border-green-500/50',
                  step.status === 'current' && 'bg-brand-500/20 text-brand-400 border border-brand-500/50 animate-pulse-slow',
                  step.status === 'upcoming' && 'bg-dark-600 text-dark-200 border border-dark-400/50',
                  step.status === 'failed' && 'bg-red-500/20 text-red-400 border border-red-500/50'
                )}
              >
                {step.status === 'completed' ? '✓' : 
                 step.status === 'failed' ? '✗' : 
                 index + 1}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs text-center max-w-[80px]',
                  step.status === 'current' ? 'text-brand-400 font-medium' :
                  step.status === 'completed' ? 'text-green-400' :
                  step.status === 'failed' ? 'text-red-400' :
                  'text-dark-200'
                )}
              >
                {locale === 'hi' && step.labelHi ? step.labelHi : step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  step.status === 'completed' ? 'bg-green-500/50' : 'bg-dark-500'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
