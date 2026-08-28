import passport from 'passport';
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20';
import { env, googleOAuthConfigured } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const log = createLogger('auth');

/** Only the user id goes in the session cookie; the rest is loaded per request. */
passport.serializeUser<string>((user, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser<string>(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    // A deleted user yields `false`, which clears the stale session cleanly.
    done(null, user ?? false);
  } catch (err) {
    done(err as Error);
  }
});

function pickProfileEmail(profile: Profile): string | null {
  return profile.emails?.find((e) => e.value)?.value ?? null;
}

export function configurePassport(): void {
  if (!googleOAuthConfigured) {
    // Not fatal: the rest of the API still boots so /health and the queue
    // dashboard work. The login route reports the misconfiguration instead.
    log.warn('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing - Google login disabled');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = pickProfileEmail(profile);
          if (!email) {
            return done(null, false, { message: 'Google account has no email address' });
          }

          const name = profile.displayName || email.split('@')[0] || 'User';
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          // Keyed on googleId so a user who changes their Google display name
          // or avatar updates in place rather than creating a second row.
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: { googleId: profile.id, email, name, avatarUrl },
            update: { email, name, avatarUrl },
          });

          log.info({ userId: user.id, email: user.email }, 'google login');
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}

export { passport };
