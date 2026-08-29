import { RedisStore } from 'connect-redis';
import session, { type SessionOptions } from 'express-session';
import type { RequestHandler } from 'express';
import { env, isProduction } from '../config/env.js';
import { sessionRedis } from '../lib/redis.js';

/**
 * Sessions live in Redis, not in process memory, for two reasons:
 * an API restart must not log everyone out, and the API can be scaled to
 * more than one instance without sticky sessions.
 */
export function createSessionMiddleware(): RequestHandler {
  const options: SessionOptions = {
    store: new RedisStore({ client: sessionRedis, prefix: 'sess:' }),
    secret: env.SESSION_SECRET,
    name: 'ejs.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Lax, not Strict, even in production: the Google OAuth callback arrives
      // as a top-level navigation from accounts.google.com, and Strict would
      // withhold the cookie on exactly that request, losing the OAuth state.
      // Lax still blocks the cross-site subrequests CSRF actually rides on.
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  };

  return session(options);
}
