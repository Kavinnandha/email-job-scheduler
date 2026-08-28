import { Router } from 'express';
import { z } from 'zod';
import type { Campaign as CampaignDto, CreateCampaignResponse } from '@repo/shared';
import type { Campaign, Email } from '@prisma/client';
import { env } from '../config/env.js';
import { getUser, requireAuth } from '../auth/requireAuth.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { listActiveSenders } from '../mail/senders.js';
import { scheduleCampaign } from '../queue/scheduler.js';

const log = createLogger('campaigns');

export const campaignsRouter: Router = Router();

const createCampaignSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.coerce.date(),
  delaySeconds: z.coerce.number().min(0).max(3600),
  hourlyLimit: z.coerce.number().int().min(1).optional(),
  senderIds: z.array(z.string()).optional(),
});

/** Deliberately permissive: the goal is to reject obvious junk, not to
 *  re-implement RFC 5322 and refuse addresses that would actually deliver. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseRecipients(raw: string[]): { valid: string[]; skipped: number } {
  const seen = new Set<string>();
  const valid: string[] = [];

  for (const entry of raw) {
    const address = entry.trim().toLowerCase();
    if (!address || !EMAIL_PATTERN.test(address) || seen.has(address)) continue;
    seen.add(address);
    valid.push(address);
  }

  return { valid, skipped: raw.length - valid.length };
}

function toCampaignDto(
  campaign: Campaign,
  counts: { scheduled: number; sent: number; failed: number },
): CampaignDto {
  return {
    id: campaign.id,
    subject: campaign.subject,
    body: campaign.body,
    startTime: campaign.startTime.toISOString(),
    delayMs: campaign.delayMs,
    hourlyLimit: campaign.hourlyLimit,
    senderIds: campaign.senderIds,
    totalRecipients: campaign.totalRecipients,
    createdAt: campaign.createdAt.toISOString(),
    counts: { ...counts, total: counts.scheduled + counts.sent + counts.failed },
  };
}

campaignsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const user = getUser(req);
    const { subject, body, startTime, delaySeconds, senderIds } = parsed.data;

    const { valid, skipped } = normaliseRecipients(parsed.data.recipients);
    if (valid.length === 0) {
      res.status(400).json({ error: 'No valid email addresses found in the recipient list' });
      return;
    }

    const allSenders = await listActiveSenders();
    if (allSenders.length === 0) {
      res.status(503).json({ error: 'No active senders configured' });
      return;
    }

    // An explicit selection is filtered against the active pool so a stale id
    // from the client cannot schedule mail through an inactive sender.
    const senders =
      senderIds && senderIds.length > 0
        ? allSenders.filter((s) => senderIds.includes(s.id))
        : allSenders;

    if (senders.length === 0) {
      res.status(400).json({ error: 'None of the selected senders are active' });
      return;
    }

    // The per-campaign limit is user-facing pacing. It can never exceed the
    // hard per-sender ceiling, which exists to protect the SMTP account.
    const requestedLimit = parsed.data.hourlyLimit ?? env.DEFAULT_CAMPAIGN_HOURLY_LIMIT;
    const hourlyLimit = Math.min(requestedLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);

    const result = await scheduleCampaign({
      userId: user.id,
      subject,
      body,
      recipients: valid,
      startTime,
      delayMs: Math.round(delaySeconds * 1000),
      hourlyLimit,
      senders,
    });

    const payload: CreateCampaignResponse = {
      campaign: toCampaignDto(result.campaign, {
        scheduled: result.scheduled,
        sent: 0,
        failed: 0,
      }),
      scheduled: result.scheduled,
      skipped,
    };

    log.info(
      { campaignId: result.campaign.id, scheduled: result.scheduled, skipped },
      'campaign created',
    );
    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

campaignsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = getUser(req);

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (campaigns.length === 0) {
      res.json([]);
      return;
    }

    // One grouped query for every campaign's counts, rather than N queries.
    const grouped = await prisma.email.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: { _all: true },
    });

    const countsByCampaign = new Map<string, { scheduled: number; sent: number; failed: number }>();
    for (const campaign of campaigns) {
      countsByCampaign.set(campaign.id, { scheduled: 0, sent: 0, failed: 0 });
    }
    for (const row of grouped) {
      const entry = countsByCampaign.get(row.campaignId);
      if (!entry) continue;
      if (row.status === 'SCHEDULED') entry.scheduled = row._count._all;
      else if (row.status === 'SENT') entry.sent = row._count._all;
      else if (row.status === 'FAILED') entry.failed = row._count._all;
    }

    res.json(
      campaigns.map((c) =>
        toCampaignDto(c, countsByCampaign.get(c.id) ?? { scheduled: 0, sent: 0, failed: 0 }),
      ),
    );
  } catch (err) {
    next(err);
  }
});

export type { Email };
