import type { Campaign, Email, Sender } from '@prisma/client';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { indexEmailsForCampaign } from '../search/emails.js';
import { emailJobId, emailQueue, type EmailJobData } from './queue.js';

const log = createLogger('scheduler');

export interface ScheduleCampaignInput {
  userId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
  senders: Sender[];
}

export interface ScheduleCampaignResult {
  campaign: Campaign;
  emails: Email[];
  scheduled: number;
}

/**
 * Creates a campaign and enqueues one delayed BullMQ job per recipient.
 *
 * No cron anywhere: each email becomes a delayed job whose delay is the
 * distance to its own send time. Redis holds the delayed set and promotes
 * jobs as they come due.
 *
 * Order of operations matters. Rows are written first, jobs second, so a
 * crash between the two leaves emails that the boot reconciler will pick up
 * and enqueue. The reverse order could leave a job pointing at a row that
 * was never committed.
 */
export async function scheduleCampaign(
  input: ScheduleCampaignInput,
): Promise<ScheduleCampaignResult> {
  const { userId, subject, body, recipients, startTime, delayMs, hourlyLimit, senders } = input;

  // Never schedule into the past: a start time that has already elapsed means
  // "begin now", not "fire everything at once with a negative delay".
  const now = Date.now();
  const effectiveStart = Math.max(startTime.getTime(), now);

  const senderIds = senders.map((s) => s.id);

  const { campaign, emails } = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        userId,
        subject,
        body,
        startTime: new Date(effectiveStart),
        delayMs,
        hourlyLimit,
        senderIds,
        totalRecipients: recipients.length,
      },
    });

    await tx.email.createMany({
      data: recipients.map((recipient, index) => ({
        campaignId: created.id,
        userId,
        recipient,
        // Round-robin, resolved here rather than in the worker so a retried or
        // rescheduled job always targets the same sender.
        senderId: senderIds[index % senderIds.length]!,
        sequenceIndex: index,
        // The inter-send delay is baked into the schedule itself. The worker's
        // slot reservation is a backstop for when a backlog comes due at once.
        scheduledAt: new Date(effectiveStart + index * delayMs),
      })),
    });

    const rows = await tx.email.findMany({
      where: { campaignId: created.id },
      orderBy: { sequenceIndex: 'asc' },
    });

    return { campaign: created, emails: rows };
  });

  await enqueueEmails(emails);

  // Best-effort: indexing failures must never fail a scheduled campaign.
  await indexEmailsForCampaign(campaign.id);

  log.info(
    { campaignId: campaign.id, count: emails.length, delayMs, hourlyLimit },
    'campaign scheduled',
  );

  return { campaign, emails, scheduled: emails.length };
}

/**
 * Adds delayed jobs for the given emails. Safe to call repeatedly: the job id
 * is derived from the email id, so an already-queued job is not duplicated.
 */
export async function enqueueEmails(emails: Email[]): Promise<number> {
  if (emails.length === 0) return 0;

  const now = Date.now();

  const jobs = emails.map((email) => {
    const data: EmailJobData = {
      emailId: email.id,
      campaignId: email.campaignId,
      senderId: email.senderId,
      sequenceIndex: email.sequenceIndex,
    };

    return {
      name: 'send-email',
      data,
      opts: {
        jobId: emailJobId(email.id),
        // Past-due emails (server was down through their slot) get delay 0 and
        // are paced by the worker's slot reservation instead of firing at once.
        delay: Math.max(0, email.scheduledAt.getTime() - now),
      },
    };
  });

  // addBulk is one round trip for the whole campaign rather than N.
  await emailQueue.addBulk(jobs);
  return jobs.length;
}

/**
 * Computes the delay for a job pushed into the next hour window, spreading
 * the campaign back out by sequenceIndex so relative order is preserved.
 */
export function nextWindowDelay(sequenceIndex: number, now = Date.now()): number {
  const HOUR_MS = 3_600_000;
  const nextWindowStart = (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;
  return nextWindowStart - now + sequenceIndex * env.ORDER_STEP_MS;
}
