import type { AuthUser } from '@repo/shared';
import { Button } from '@/components/ui/Button';
import { SlackConnectButton } from '@/components/SlackConnectButton';
import { useLogout } from '@/hooks/useAuth';

function Avatar({ user }: { user: AuthUser }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        // referrerPolicy is required or Google's CDN returns 403 for the
        // profile image when it is loaded from another origin.
        referrerPolicy="no-referrer"
        className="h-9 w-9 rounded-full object-cover ring-1 ring-surface-border"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function Header({ user }: { user: AuthUser }) {
  const logout = useLogout();

  return (
    <header className="border-b border-surface-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z"
                strokeWidth="1.8"
              />
              <path d="M3.5 7l8.5 6 8.5-6" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-900">Email Job Scheduler</span>
        </div>

        <div className="flex items-center gap-3">
          <SlackConnectButton />

          <div className="hidden items-center gap-3 border-l border-surface-border pl-3 sm:flex">
            <Avatar user={user} />
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={logout.isPending}
            onClick={() => {
              logout.mutate(undefined, {
                // Full reload rather than client navigation, so no cached
                // component state survives the session change.
                onSuccess: () => window.location.assign('/login'),
              });
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
