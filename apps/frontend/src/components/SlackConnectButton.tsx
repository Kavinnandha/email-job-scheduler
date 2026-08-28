import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { disconnectSlack, getSlackStatus, startSlackConnect } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const SLACK_QUERY_KEY = ['slack', 'status'] as const;

function SlackMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#E01E5A"
        d="M6 15.2a2 2 0 11-2-2h2v2zm1 0a2 2 0 014 0v5a2 2 0 11-4 0v-5z"
      />
      <path fill="#36C5F0" d="M9 6a2 2 0 112-2v2H9zm0 1a2 2 0 010 4H4a2 2 0 110-4h5z" />
      <path fill="#2EB67D" d="M18 9a2 2 0 112 2h-2V9zm-1 0a2 2 0 01-4 0V4a2 2 0 114 0v5z" />
      <path fill="#ECB22E" d="M15 18a2 2 0 11-2 2v-2h2zm0-1a2 2 0 010-4h5a2 2 0 110 4h-5z" />
    </svg>
  );
}

export function SlackConnectButton() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const status = useQuery({ queryKey: SLACK_QUERY_KEY, queryFn: getSlackStatus });

  const connect = useMutation({
    mutationFn: startSlackConnect,
    // Slack renders its own consent screen, so this must be a top-level
    // navigation rather than a fetch.
    onSuccess: (data) => window.location.assign(data.url),
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const disconnect = useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SLACK_QUERY_KEY });
      notify('Slack disconnected', 'info');
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  if (status.isLoading) return null;

  if (status.data?.connected) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <SlackMark />
          {status.data.teamName ?? 'Slack'}
          {status.data.channel && <span className="text-emerald-600/70">#{status.data.channel.replace(/^#/, '')}</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          loading={disconnect.isPending}
          onClick={() => disconnect.mutate()}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<SlackMark />}
      loading={connect.isPending}
      onClick={() => connect.mutate()}
    >
      Connect Slack
    </Button>
  );
}
