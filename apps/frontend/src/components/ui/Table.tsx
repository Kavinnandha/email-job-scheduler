import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

/**
 * One table component drives both the Scheduled and Sent views, so loading,
 * empty and error handling stay identical between them instead of being
 * re-implemented per screen.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
        <Spinner className="text-brand-500" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Could not load emails"
        description={error}
      />
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    // Horizontal scroll is on the wrapper so a wide table never forces the
    // whole page to scroll sideways on small screens.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-surface-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-surface-border last:border-0 hover:bg-slate-50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-4 py-3 text-sm text-slate-700', column.className)}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
