import { createBullBoard } from '@bull-board/api';
// No .js suffix: the package's exports map declares './bullMQAdapter' exactly.
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from './config/env.js';
import { emailQueue } from './queue/queue.js';

/**
 * The dashboard exposes queue internals and can retry or remove jobs, so it
 * sits behind basic auth rather than being open on the same port as the API.
 */
function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === env.BULL_BOARD_USER && pass === env.BULL_BOARD_PASS) {
      next();
      return;
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Queue dashboard"');
  res.status(401).send('Authentication required');
}

export function createBullBoardRouter(): { path: string; handlers: RequestHandler[] } {
  const serverAdapter = new ExpressAdapter();
  const path = '/admin/queues';
  serverAdapter.setBasePath(path);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  return { path, handlers: [basicAuth, serverAdapter.getRouter() as RequestHandler] };
}
