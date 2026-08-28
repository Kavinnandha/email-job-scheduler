import { Router } from 'express';
import { z } from 'zod';
import type { EmailDetail, EmailRecord, Paginated } from '@repo/shared';
import type { Email, Sender } from '@prisma/client';
import { getUser, requireAuth } from '../auth/requireAuth.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { emailJobId, emailQueue } from '../queue/queue.js';
import { removeEmailFromIndex, searchEmails } from '../search/emails.js';

const log = createLogger('emails-routes');

export const emailsRouter: Router = Router();

const listQuerySchema = z.object({
  status: z.enum(['SCHEDULED', 'SENT', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

type EmailWithRelations = Email & {
  sender: Pick<Sender, 'name' | 'fromEmail'> | null;
  campaign: { subject: string };
};

export function toEmailDto(email: EmailWithRelations): EmailRecord {
  return {
    id: email.id,
    campaignId: email.campaignId,
    recipient: email.recipient,
    subject: email.campaign.subject,
    status: email.status,
    senderId: email.senderId,
    senderName: email.sender?.name ?? null,
    senderEmail: email.sender?.fromEmail ?? null,
    sequenceIndex: email.sequenceIndex,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() ?? null,
    previewUrl: email.previewUrl,
    error: email.error,
    attempts: email.attempts,
    starred: email.starred,
  };
}

const searchQuerySchema = listQuerySchema.extend({
  q: z.string().trim().default(''),
});

/**
 * Elasticsearch returns ids; the rows themselves are re-read from Postgres so
 * the response reflects current state even when the index lags behind a
 * status change. Registered before '/' so it is not shadowed by it.
 */
emailsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
      return;
    }

    const user = getUser(req);
    const { q, status, page, pageSize } = parsed.data;

    const result = await searchEmails({ userId: user.id, query: q, status, page, pageSize });

    const rows =
      result.ids.length === 0
        ? []
        : await prisma.email.findMany({
            where: { id: { in: result.ids }, userId: user.id },
            include: {
              sender: { select: { name: true, fromEmail: true } },
              campaign: { select: { subject: true } },
            },
          });

    // findMany does not honour the order of an `in` list, so restore the
    // relevance ranking Elasticsearch returned.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = result.ids
      .map((id) => byId.get(id))
      .filter((row): row is (typeof rows)[number] => Boolean(row));

    const payload: Paginated<EmailRecord> & { usedElasticsearch: boolean } = {
      items: ordered.map(toEmailDto),
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      // Surfaced so the UI can tell the user when results are unranked.
      usedElasticsearch: result.usedElasticsearch,
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

emailsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
      return;
    }

    const user = getUser(req);
    const { status, page, pageSize } = parsed.data;
    const where = { userId: user.id, ...(status ? { status } : {}) };

    // Scheduled reads best in send order (soonest first); sent/failed read
    // best newest-first, which is what a delivery log is normally scanned for.
    const orderBy =
      status === 'SCHEDULED'
        ? ({ scheduledAt: 'asc' } as const)
        : ({ updatedAt: 'desc' } as const);

    const [total, rows] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sender: { select: { name: true, fromEmail: true } },
          campaign: { select: { subject: true } },
        },
      }),
    ]);

    const payload: Paginated<EmailRecord> = {
      items: rows.map(toEmailDto),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * Single email plus the campaign body, for the reading view.
 * Registered after the list routes so ':id' cannot shadow '/search'.
 */
emailsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = getUser(req);
    const email = await prisma.email.findFirst({
      // Scoped by userId as well as id, so an id guessed from another account
      // returns 404 rather than leaking a row.
      where: { id: req.params.id, userId: user.id },
      include: {
        sender: { select: { name: true, fromEmail: true } },
        campaign: { select: { subject: true, body: true } },
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const payload: EmailDetail = {
      ...toEmailDto(email),
      body: email.campaign.body,
      senderDisplayName: email.sender?.name ?? 'Unknown sender',
      createdAt: email.createdAt.toISOString(),
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

const starSchema = z.object({ starred: z.boolean() });

emailsRouter.patch('/:id/star', requireAuth, async (req, res, next) => {
  try {
    const parsed = starSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const user = getUser(req);
    // updateMany rather than update: it scopes by userId in the same statement
    // and reports 0 rows instead of throwing when the id is not the caller's.
    const result = await prisma.email.updateMany({
      where: { id: req.params.id, userId: user.id },
      data: { starred: parsed.data.starred },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({ ok: true, starred: parsed.data.starred });
  } catch (err) {
    next(err);
  }
});

/**
 * Cancels a scheduled email: removes its delayed job and deletes the row.
 *
 * Only SCHEDULED emails can be cancelled. A sent email has already left the
 * building, so deleting it would misrepresent the delivery log.
 */
emailsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = getUser(req);
    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: { id: true, status: true },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    if (email.status !== 'SCHEDULED') {
      res.status(409).json({ error: 'Only scheduled emails can be cancelled' });
      return;
    }

    // Remove the job first. If the row were deleted first and this failed, the
    // job would survive and the worker would wake to a missing email.
    const job = await emailQueue.getJob(emailJobId(email.id));
    if (job) await job.remove();

    await prisma.email.delete({ where: { id: email.id } });
    await removeEmailFromIndex(email.id);

    log.info({ emailId: email.id }, 'scheduled email cancelled');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
