import type { EmailRecord } from '@repo/shared';
import { cn } from '@/lib/cn';
import { ClockIcon, StarIcon } from '@/components/icons';
import { formatRowTime } from '@/lib/datetime';

export interface EmailRowProps {
  email: EmailRecord;
  onOpen: (email: EmailRecord) => void;
  onToggleStar: (email: EmailRecord) => void;
}

/** Orange clock pill for scheduled, neutral pill for a settled email. */
function StatusChip({ email }: { email: EmailRecord }) {
  if (email.status === 'SCHEDULED') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chip-warn px-3 py-1 text-[13px] font-medium text-chip-warnText">
        <ClockIcon className="h-[13px] w-[13px]" />
        {formatRowTime(email.scheduledAt)}
      </span>
    );
  }

  if (email.status === 'FAILED') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-3 py-1 text-[13px] font-medium text-red-700">
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-chip-idle px-3 py-1 text-[13px] font-medium text-chip-idleText">
      Sent
    </span>
  );
}

export function EmailRow({ email, onOpen, onToggleStar }: EmailRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(email)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(email);
        }
      }}
      className="flex cursor-pointer items-center gap-5 border-b border-line px-6 py-4 transition-colors hover:bg-field/60"
    >
      <span className="w-[150px] shrink-0 truncate text-[15px] font-semibold text-ink">
        To: {email.recipient}
      </span>

      <StatusChip email={email} />

      {/* min-w-0 lets the flex child shrink so the truncation actually bites. */}
      <div className="min-w-0 flex-1 truncate text-[15px]">
        <span className="font-semibold text-ink">{email.subject}</span>
        {email.error ? (
          <span className="text-ink-faint"> - {email.error}</span>
        ) : (
          <span className="text-ink-faint"> - {email.senderName ?? 'Scheduled send'}</span>
        )}
      </div>

      <button
        onClick={(e) => {
          // The row is clickable; without this the star would also open it.
          e.stopPropagation();
          onToggleStar(email);
        }}
        aria-label={email.starred ? 'Unstar' : 'Star'}
        aria-pressed={email.starred}
        className={cn(
          'shrink-0 rounded p-1 transition-colors',
          email.starred ? 'text-amber-400' : 'text-line hover:text-ink-faint',
        )}
      >
        <StarIcon filled={email.starred} className="h-[21px] w-[21px]" />
      </button>
    </div>
  );
}
