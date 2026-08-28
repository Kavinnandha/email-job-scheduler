import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'error';
}

export function EmptyState({ title, description, action, tone = 'default' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={cn(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
          tone === 'error' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400',
        )}
      >
        {tone === 'error' ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z"
              strokeWidth="1.6"
            />
            <path d="M3.5 7l8.5 6 8.5-6" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
