import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { configurePassport, passport } from './auth/passport.js';
import { createSessionMiddleware } from './auth/session.js';
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { isElasticsearchAvailable } from './lib/elasticsearch.js';
import { authRouter } from './routes/auth.js';

const log = createLogger('http');

// Explicit return type: pnpm's nested node_modules layout makes the inferred
// Express type unnameable across package boundaries (TS2742).
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // credentials: true because auth rides on a session cookie, not a bearer token.
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );

  // 5mb: a pasted lead list can be large, but recipients are parsed in the
  // browser and posted as a JSON array, not as a raw file upload.
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(createSessionMiddleware());
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/api/auth', authRouter);

  app.get('/health', async (_req: Request, res: Response) => {
    const [db, cache, search] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then(() => true).catch(() => false),
      isElasticsearchAvailable(true),
    ]);

    const healthy = db && cache;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      postgres: db,
      redis: cache,
      // Search being down is explicitly not fatal - queries fall back to Postgres.
      elasticsearch: search,
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error({ err: err.message, stack: err.stack }, 'unhandled request error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
