import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, ClockIcon, StarIcon, TrashIcon } from '@/components/icons';
import { Avatar } from '@/components/layout/Sidebar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useCancelEmail, useEmail, useToggleStar } from '@/hooks/useEmails';
import { formatDetailTime, formatRowTime } from '@/lib/datetime';
import { cn } from '@/lib/cn';

export function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();

  const email = useEmail(id);
  const toggleStar = useToggleStar();
  const cancelEmail = useCancelEmail();

  if (email.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" className="text-brand-500" />
      </div>
    );
  }

  if (email.error || !email.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <EmptyState
          tone="error"
          title="Email not found"
          description="It may have been cancelled or never existed."
          action={
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-field"
            >
              Back to inbox
            </button>
          }
        />
      </div>
    );
  }

  const record = email.data;
  const isScheduled = record.status === 'SCHEDULED';

  // Return to the tab this email belongs to rather than the dashboard default,
  // which would silently switch a settled email's reader over to Scheduled.
  const listHref = isScheduled ? '/' : '/?tab=sent';

  const handleCancel = () => {
    cancelEmail.mutate(record.id, {
      onSuccess: () => {
        notify('Scheduled email cancelled', 'success');
        navigate('/');
      },
      onError: (err) => notify(err instanceof Error ? err.message : 'Could not cancel', 'error'),
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="flex items-center gap-4 border-b border-line px-6 py-4">
        <button
          onClick={() => navigate(listHref)}
          aria-label="Back"
          className="rounded-lg p-1 text-ink transition-colors hover:bg-field"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-[22px] font-medium text-ink">
          {record.subject}
        </h1>

        <button
          onClick={() =>
            toggleStar.mutate(
              { id: record.id, starred: !record.starred },
              { onError: () => notify('Could not update star', 'error') },
            )
          }
          aria-label={record.starred ? 'Unstar' : 'Star'}
          className={cn(
            'rounded-lg p-2 transition-colors hover:bg-field',
            record.starred ? 'text-amber-400' : 'text-ink-faint',
          )}
        >
          <StarIcon filled={record.starred} className="h-[22px] w-[22px]" />
        </button>

        {/* Cancelling only makes sense while the email is still queued; a sent
            email has already left, so removing it would falsify the log. */}
        {isScheduled && (
          <button
            onClick={handleCancel}
            disabled={cancelEmail.isPending}
            aria-label="Cancel scheduled email"
            title="Cancel scheduled email"
            className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <TrashIcon className="h-[22px] w-[22px]" />
          </button>
        )}

        <span className="mx-1 h-6 w-px bg-line" />

        {user && <Avatar user={user} size={36} />}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-semibold text-white">
              {(record.senderDisplayName || '?').charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[16px] font-bold text-ink">{record.senderDisplayName}</span>
                <span className="text-sm text-ink-muted">&lt;{record.senderEmail}&gt;</span>
                <span className="ml-auto whitespace-nowrap text-sm text-ink-muted">
                  {record.status === 'SENT'
                    ? formatDetailTime(record.sentAt)
                    : formatDetailTime(record.scheduledAt)}
                </span>
              </div>

              <p className="mt-0.5 text-sm text-ink-muted">to {record.recipient}</p>
            </div>
          </div>

          {isScheduled && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-chip-warn px-4 py-2.5 text-sm text-chip-warnText">
              <ClockIcon className="h-4 w-4" />
              Scheduled to send {formatRowTime(record.scheduledAt)}
            </div>
          )}

          {record.status === 'FAILED' && record.error && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
              Delivery failed after {record.attempts} attempt
              {record.attempts === 1 ? '' : 's'}: {record.error}
            </div>
          )}

          {/* whitespace-pre-wrap: the body is stored as plain text, so newlines
              are the only structure it carries. */}
          <div className="prose-email mt-8 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {record.body}
          </div>

          {record.previewUrl && (
            <a
              href={record.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
            >
              View delivered message on Ethereal
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
