import { Router } from 'express';
import type { AuthUser } from '@repo/shared';
import { env, googleOAuthConfigured } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { passport } from '../auth/passport.js';
import { getUser, requireAuth } from '../auth/requireAuth.js';

const log = createLogger('auth-routes');

export const authRouter: Router = Router();

authRouter.get('/google', (req, res, next) => {
  if (!googleOAuthConfigured) {
    res.status(503).json({
      error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRouter.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleOAuthConfigured) {
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_not_configured`);
      return;
    }
    next();
  },
  passport.authenticate('google', {
    failureRedirect: `${env.FRONTEND_URL}/login?error=google_auth_failed`,
    session: true,
  }),
  (req, res) => {
    // Session cookie is set; hand control back to the SPA.
    log.info({ userId: getUser(req).id }, 'oauth callback complete');
    res.redirect(env.FRONTEND_URL);
  },
);

authRouter.get('/me', requireAuth, (req, res) => {
  const user = getUser(req);
  const payload: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  res.json(payload);
});

authRouter.post('/logout', (req, res, next) => {
  req.logout((logoutErr) => {
    if (logoutErr) {
      next(logoutErr);
      return;
    }
    // Destroy the Redis-side session too, not just the passport user, so the
    // session id cannot be replayed.
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        next(destroyErr);
        return;
      }
      res.clearCookie('ejs.sid');
      res.json({ ok: true });
    });
  });
});
