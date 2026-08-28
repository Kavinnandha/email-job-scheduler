import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EmailStatus } from '@repo/shared';
import { Header } from '@/components/Header';
import { ComposeModal } from '@/components/ComposeModal';
import { EmailTable } from '@/components/EmailTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useEmailList } from '@/hooks/useEmails';

type TabValue = Extract<EmailStatus, 'SCHEDULED' | 'SENT'>;

const SLACK_MESSAGES: Record<string, { text: string; tone: 'success' | 'error' }> = {
  connected: { text: 'Slack connected — rate-limit alerts are live', tone: 'success' },
  denied: { text: 'Slack authorisation was cancelled', tone: 'error' },
  invalid_state: { text: 'Slack connection expired, please try again', tone: 'error' },
  failed: { text: 'Could not connect Slack', tone: 'error' },
};

export function DashboardPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<TabValue>('SCHEDULED');
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

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

  const scheduled = useEmailList({
    status: 'SCHEDULED',
    page: 1,
    search,
    // Only the scheduled list is live - it drains as the worker sends.
    pollMs: 5000,
  });

  const sent = useEmailList({
    status: 'SENT',
    page: 1,
    search,
    pollMs: tab === 'SENT' ? 5000 : undefined,
  });

  const active = tab === 'SCHEDULED' ? scheduled : sent;

  const tabItems = useMemo(
    () => [
      { value: 'SCHEDULED' as const, label: 'Scheduled', count: scheduled.data?.total },
      { value: 'SENT' as const, label: 'Sent', count: sent.data?.total },
    ],
    [scheduled.data?.total, sent.data?.total],
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-muted">
      <Header user={user} />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Campaigns</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Track what is queued and what has already gone out.
            </p>
          </div>
          <Button onClick={() => setComposeOpen(true)}>Compose new email</Button>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-surface-border">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 pt-3">
            <Tabs items={tabItems} value={tab} onChange={setTab} />
            <div className="w-full pb-3 sm:w-64">
              <Input
                type="search"
                placeholder="Search subject or recipient…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <EmailTable
            status={tab}
            rows={active.data?.items ?? []}
            // isLoading is false while placeholderData keeps the previous page
            // on screen, so the table does not flash a spinner while typing.
            loading={active.isLoading}
            error={active.error ? active.error.message : null}
            emptyAction={
              tab === 'SCHEDULED' && !search ? (
                <Button size="sm" onClick={() => setComposeOpen(true)}>
                  Compose new email
                </Button>
              ) : undefined
            }
          />
        </div>
      </main>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
