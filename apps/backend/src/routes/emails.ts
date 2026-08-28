import { Router } from 'express';
import { z } from 'zod';
import type { EmailRecord, Paginated } from '@repo/shared';
import type { Email, Sender } from '@prisma/client';
import { getUser, requireAuth } from '../auth/requireAuth.js';
import { prisma } from '../lib/prisma.js';

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
  };
}

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
