import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '@/api/client';
import { GoogleIcon } from '@/components/icons';

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_failed: 'Google sign-in did not complete. Please try again.',
  oauth_not_configured:
    'Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
};

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');
  const [notice, setNotice] = useState<string | null>(null);

  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Sign-in failed.') : null;

  /**
   * The email/password fields are part of the provided design, but this
   * service authenticates through Google only - there is no password store to
   * check against. Rather than render a control that silently does nothing,
   * submitting explains that and points at the working path.
   */
  const handleEmailLogin = (event: FormEvent) => {
    event.preventDefault();
    setNotice('This workspace uses Google sign-in. Use "Login with Google" above to continue.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[620px] rounded-2xl border border-line px-16 py-14 shadow-card">
        <h1 className="text-center text-[42px] font-bold tracking-tight text-ink">Login</h1>

        {errorMessage && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {/* A link, not a fetch: OAuth needs a top-level navigation so Google
            can render its own consent screen. */}
        <a
          href={apiUrl('/api/auth/google')}
          className="mt-9 flex h-[62px] w-full items-center justify-center gap-3 rounded-xl bg-brand-50 text-[17px] font-medium text-ink transition-colors hover:bg-brand-100"
        >
          <GoogleIcon className="h-[22px] w-[22px]" />
          Login with Google
        </a>

        <div className="my-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[15px] tracking-wide text-ink-faint">or sign up through email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Email ID"
            aria-label="Email ID"
            className="h-[62px] w-full rounded-xl bg-field px-6 text-[16px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            className="h-[62px] w-full rounded-xl bg-field px-6 text-[16px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-100"
          />

          {notice && <p className="text-center text-sm text-ink-muted">{notice}</p>}

          <button
            type="submit"
            className="h-[62px] w-full rounded-xl bg-brand-500 text-[17px] font-medium text-white transition-colors hover:bg-brand-600"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
