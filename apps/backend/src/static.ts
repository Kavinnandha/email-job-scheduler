import express, { type Express, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './lib/logger.js';

const log = createLogger('static');

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves to apps/frontend/dist from either src/ or dist/ - both sit exactly
 * two levels under apps/, so one relative path serves the dev and built layouts.
 */
const DEFAULT_CLIENT_DIR = path.resolve(here, '../../frontend/dist');

/**
 * Serving the SPA from the API process is what makes a single-origin
 * deployment possible, and single-origin is what lets the session cookie stay
 * SameSite=Lax without any cross-site relaxation. On a free host it also means
 * one service instead of two.
 *
 * A missing build directory is not fatal: the API still serves /api and
 * /health, which is the correct behaviour for an API-only deployment.
 */
export function mountClient(app: Express): void {
  const dir = process.env.CLIENT_DIST_DIR
    ? path.resolve(process.env.CLIENT_DIST_DIR)
    : DEFAULT_CLIENT_DIR;

  const indexHtml = path.join(dir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    log.warn({ dir }, 'no client build found - running API only');
    return;
  }

  // Hashed asset filenames are safe to cache forever; index.html never is,
  // or a deploy would keep serving the previous bundle's script tags.
  app.use(
    express.static(dir, {
      index: false,
      maxAge: '1y',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  // Client-side routing catch-all. Anything under /api or /admin has already
  // been handled above, so those still reach their own 404s rather than being
  // answered with the SPA shell.
  app.get(/^\/(?!api(?:\/|$)|admin(?:\/|$)|health$).*/, (_req: Request, res: Response) => {
    res.sendFile(indexHtml);
  });

  log.info({ dir }, 'serving client build');
}
