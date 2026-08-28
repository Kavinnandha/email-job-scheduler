import type { EmailStatus } from '@repo/shared';
import { cn } from '@/lib/cn';

const STYLES: Record<EmailStatus, { label: string; className: string }> = {
  SCHEDULED: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  SENT: { label: 'Sent', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  FAILED: { label: 'Failed', className: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
