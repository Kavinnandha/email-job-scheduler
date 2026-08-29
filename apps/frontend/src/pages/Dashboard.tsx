import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailRecord, EmailStatus } from '@repo/shared';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar, type TopBarFilters } from '@/components/layout/TopBar';
import { EmailRow } from '@/components/email/EmailRow';
import { Pagination } from '@/components/email/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { UndoIcon } from '@/components/icons';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useEmailList, useSenders, useToggleStar } from '@/hooks/useEmails';

type TabValue = Extract<EmailStatus, 'SCHEDULED' | 'SENT'>;

const SLACK_MESSAGES: Record<string, { text: string; tone: 'success' | 'error' }> = {
  connected: { text: 'Slack connected — rate-limit alerts are live', tone: 'success' },
  denied: { text: 'Slack authorisation was cancelled', tone: 'error' },
  invalid_state: { text: 'Slack connection expired, please try again', tone: 'error' },
  failed: { text: 'Could not connect Slack', tone: 'error' },
};

const EMPTY_FILTERS: TopBarFilters = { senderId: null, starredOnly: false };

export function DashboardPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // The active tab lives in the URL so that opening an email and coming back
  // returns to the list the user was actually looking at.
  const tab: TabValue = searchParams.get('tab') === 'sent' ? 'SENT' : 'SCHEDULED';
  const setTab = (next: TabValue) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'SENT') params.set('tab', 'sent');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TopBarFilters>(EMPTY_FILTERS);

  const senders = useSenders();
  const toggleStar = useToggleStar();

  // The Slack callback redirects back with a result code; surface it once and
  // strip it so a refresh does not repeat the toast.
  useEffect(() => {
    const slack = searchParams.get('slack');
    if (!slack) return;

    const message = SLACK_MESSAGES[slack];
    if (message) notify(message.text, message.tone);

    searchParams.delete('slack');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, notify]);

  // Any change to what is being asked for invalidates the current page number.
  useEffect(() => setPage(1), [tab, search, filters]);

  const scheduled = useEmailList({ statuses: ['SCHEDULED'], page, search, pollMs: 5000 });
  // FAILED rides along with SENT: both are settled deliveries, and a failure
  // that appeared nowhere would leave the user with no way to see it.
  const sent = useEmailList({ statuses: ['SENT', 'FAILED'], page, search, pollMs: 5000 });

  const active = tab === 'SCHEDULED' ? scheduled : sent;

  /**
   * Sender and starred filtering is applied client-side against the current
   * page. The list endpoint paginates server-side and does not accept these
   * as query parameters, so filtering here narrows what the user is looking
   * at without misreporting the totals, which stay server-authoritative.
   */
  const visibleRows = useMemo(() => {
    const items = active.data?.items ?? [];
    return items.filter(
      (item) =>
        (!filters.senderId || item.senderId === filters.senderId) &&
        (!filters.starredOnly || item.starred),
    );
  }, [active.data?.items, filters]);

  const filtersActive = Boolean(search || filters.senderId || filters.starredOnly);

  const handleOpen = (email: EmailRecord) => navigate(`/email/${email.id}`);

  const handleToggleStar = (email: EmailRecord) =>
    toggleStar.mutate(
      { id: email.id, starred: !email.starred },
      { onError: () => notify('Could not update star', 'error') },
    );

  const resetView = () => {
    setSearch('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        user={user}
        counts={{ SCHEDULED: scheduled.data?.total, SENT: sent.data?.total }}
        activeStatus={tab}
        onSelectStatus={setTab}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          senders={senders.data ?? []}
          onRefresh={() => void active.refetch()}
          refreshing={active.isFetching}
        />

        <div className="flex-1 overflow-y-auto pb-24">
          {active.isLoading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-ink-muted">
              <Spinner className="text-brand-500" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : active.error ? (
            <EmptyState
              tone="error"
              title="Could not load emails"
              description={active.error.message}
            />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              title={
                filtersActive
                  ? 'No emails match this view'
                  : tab === 'SCHEDULED'
                    ? 'No scheduled emails'
                    : 'No sent emails yet'
              }
              description={
                filtersActive
                  ? 'Try clearing the search or filters.'
                  : tab === 'SCHEDULED'
                    ? 'Compose a campaign to queue your first batch.'
                    : 'Emails appear here once the worker delivers them.'
              }
            />
          ) : (
            visibleRows.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                onOpen={handleOpen}
                onToggleStar={handleToggleStar}
              />
            ))
          )}
        </div>

        <Pagination
          page={active.data?.page ?? 1}
          totalPages={active.data?.totalPages ?? 1}
          onChange={setPage}
        />

        {filtersActive && (
          <button
            onClick={resetView}
            className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full bg-[#1f2329] px-4 py-2.5 text-sm font-medium text-white shadow-pop transition-opacity hover:opacity-90"
          >
            <UndoIcon className="h-4 w-4" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
