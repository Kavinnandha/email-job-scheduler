import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '@/api/client';

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google sign-in did not complete. Please try again.',
  oauth_not_configured:
    'Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
};

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 010-4.22V7.05H2.18a11 11 0 000 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 002.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Sign-in failed.') : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-surface-border">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z"
                  strokeWidth="1.7"
                />
                <path d="M3.5 7l8.5 6 8.5-6" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Email Job Scheduler</h1>
            <p className="mt-1 text-sm text-slate-500">
              Schedule campaigns, track delivery, and stay within your sending limits.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
              {errorMessage}
            </div>
          )}

          {/* A plain link, not fetch: OAuth needs a top-level navigation so the
              provider can render its own consent screen. */}
          <a
            href={apiUrl('/api/auth/google')}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-surface-border bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <GoogleMark />
            Continue with Google
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          You will be redirected to Google to sign in securely.
        </p>
      </div>
    </div>
  );
}
