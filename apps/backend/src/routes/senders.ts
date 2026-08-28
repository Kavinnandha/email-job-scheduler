import { Router } from 'express';
import type { Sender as SenderDto } from '@repo/shared';
import { requireAuth } from '../auth/requireAuth.js';
import { listActiveSenders } from '../mail/senders.js';

export const sendersRouter: Router = Router();

sendersRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const senders = await listActiveSenders();
    // SMTP credentials deliberately never leave the server.
    const payload: SenderDto[] = senders.map((s) => ({
      id: s.id,
      name: s.name,
      fromEmail: s.fromEmail,
      active: s.active,
    }));
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
