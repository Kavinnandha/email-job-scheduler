import type { EmailRecord, EmailStatus } from '@repo/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { Table, type Column } from '@/components/ui/Table';
import { formatDateTime, formatRelative } from '@/lib/datetime';

export interface EmailTableProps {
  status: EmailStatus;
  rows: EmailRecord[];
  loading: boolean;
  error: string | null;
  emptyAction?: React.ReactNode;
}

function TimeCell({ iso, showRelative }: { iso: string | null; showRelative: boolean }) {
  const relative = showRelative ? formatRelative(iso) : null;
  return (
    <div className="whitespace-nowrap">
      <div>{formatDateTime(iso)}</div>
      {relative && <div className="text-xs text-slate-400">{relative}</div>}
    </div>
  );
}

export function EmailTable({ status, rows, loading, error, emptyAction }: EmailTableProps) {
  const isScheduled = status === 'SCHEDULED';

  const columns: Column<EmailRecord>[] = [
    {
      key: 'recipient',
      header: 'Email',
      render: (row) => <span className="font-medium text-slate-900">{row.recipient}</span>,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => <span className="line-clamp-1">{row.subject}</span>,
    },
    {
      key: 'sender',
      header: 'Sender',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-500">{row.senderName ?? '—'}</span>
      ),
    },
    {
      key: 'time',
      header: isScheduled ? 'Scheduled time' : 'Sent time',
      render: (row) => (
        <TimeCell iso={isScheduled ? row.scheduledAt : row.sentAt} showRelative={isScheduled} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.status} />
          {/* A failure is only useful if the reason is visible. */}
          {row.status === 'FAILED' && row.error && (
            <span className="max-w-[220px] truncate text-xs text-red-600" title={row.error}>
              {row.error}
            </span>
          )}
          {row.status === 'SENT' && row.previewUrl && (
            <a
              href={row.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              View message
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      error={error}
      emptyTitle={isScheduled ? 'No scheduled emails' : 'No sent emails yet'}
      emptyDescription={
        isScheduled
          ? 'Compose a campaign to queue your first batch.'
          : 'Emails will appear here once the worker starts delivering them.'
      }
      emptyAction={emptyAction}
    />
  );
}
