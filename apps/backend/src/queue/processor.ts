import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getTransport } from '../mail/transport.js';
import {
  claimRateLimitAlert,
  consumeQuota,
  refundQuota,
  releaseSendSlot,
  reserveSendSlot,
  windowStart,
} from '../ratelimit/limiter.js';
import { notifyRateLimitHit } from '../slack/notify.js';
import { indexEmail } from '../search/emails.js';
import type { EmailJobData } from './queue.js';

const log = createLogger('worker');

/** Small jitter so jobs released by the same wait do not re-collide instantly. */
const jitter = (): number => Math.floor(Math.random() * 250);

/**
 * Reschedules a job without consuming one of its retry attempts.
 *
 * moveToDelayed followed by throwing DelayedError is the documented BullMQ
 * handshake for "not now, try later": throwing anything else would count as a
 * failure and burn an attempt, so a rate-limited campaign would exhaust its
 * retries and dead-letter instead of simply waiting for capacity.
 */
async function deferJob(job: Job<EmailJobData>, until: number, token?: string): Promise<never> {
  await job.moveToDelayed(until, token);
  throw new DelayedError();
}

export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const { emailId } = job.data;

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, campaign: true },
  });

  if (!email) {
    // The campaign was deleted while the job sat in the delayed set. Nothing
    // to send, and retrying will never help.
    throw new UnrecoverableError(`Email ${emailId} no longer exists`);
  }

  // Guard 1 - idempotency. A job replayed after a crash, or promoted twice,
  // stops here rather than sending a second copy.
  if (email.status !== 'SCHEDULED') {
    log.debug({ emailId, status: email.status }, 'skipping - already processed');
    return;
  }

  const { sender, campaign } = email;
  const now = Date.now();

  // Guard 2 - minimum delay between sends from this sender. Reserved before
  // the SMTP call, so a slow send cannot let a second job through behind it.
  const waitMs = await reserveSendSlot(sender.id, env.DELAY_BETWEEN_EMAILS_MS, undefined, now);
  if (waitMs > 0) {
    log.debug({ emailId, senderId: sender.id, waitMs }, 'send slot busy - deferring');
    return deferJob(job, now + waitMs + jitter(), token);
  }

  // Guard 3 - hourly quota across both tiers.
  const quota = await consumeQuota({
    senderId: sender.id,
    campaignId: campaign.id,
    campaignLimit: campaign.hourlyLimit,
    now,
  });

  if (!quota.allowed) {
    // Hand the send slot back; this job is not going to use it.
    await releaseSendSlot(sender.id, now, env.DELAY_BETWEEN_EMAILS_MS);

    // Spread the campaign back out across the next window by sequenceIndex so
    // relative order survives the deferral.
    const nextWindow = windowStart(quota.window + 1);
    const until = nextWindow + email.sequenceIndex * env.ORDER_STEP_MS;

    log.info(
      { emailId, senderId: sender.id, blockedBy: quota.blockedBy, until: new Date(until) },
      'hourly limit reached - rescheduling into next window',
    );

    // Every tier that defers a send is worth one alert. Restricting this to
    // the sender ceiling meant the notification almost never fired: sends are
    // round-robined across a campaign's senders, so each sender counter climbs
    // at 1/Nth the rate of the campaign counter and the campaign limit is what
    // actually blocks in normal use.
    if (quota.blockedBy && quota.blockedLimit !== null && quota.blockedScopeId) {
      const shouldAlert = await claimRateLimitAlert(
        quota.blockedBy,
        quota.blockedScopeId,
        quota.window,
      );
      if (shouldAlert) {
        await notifyRateLimitHit({
          userId: email.userId,
          tier: quota.blockedBy,
          limit: quota.blockedLimit,
          senderName: sender.name,
          senderEmail: sender.fromEmail,
          campaignSubject: campaign.subject,
          resumesAt: new Date(nextWindow),
        });
      }
    }

    return deferJob(job, until, token);
  }

  // --- Send -----------------------------------------------------------------
  try {
    const transport = getTransport(sender);
    const info = await transport.sendMail({
      from: `"${sender.name}" <${sender.fromEmail}>`,
      to: email.recipient,
      subject: campaign.subject,
      text: campaign.body,
    });

    const nodemailer = await import('nodemailer');
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    // Guarded update: the WHERE clause includes status='SCHEDULED', so if
    // another worker somehow completed this email first, this updates zero
    // rows instead of overwriting the winner's result.
    const updated = await prisma.email.updateMany({
      where: { id: emailId, status: 'SCHEDULED' },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: info.messageId,
        previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
        attempts: { increment: 1 },
        error: null,
      },
    });

    if (updated.count === 0) {
      log.warn({ emailId }, 'lost race to another worker - result already recorded');
      return;
    }

    log.info(
      { emailId, to: email.recipient, sender: sender.fromEmail, previewUrl },
      'email sent',
    );

    await indexEmail(emailId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // The send failed, so give the hourly capacity back rather than letting a
    // failure permanently consume a slot.
    await refundQuota(sender.id, campaign.id, quota.window);

    const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts.attempts ?? 1);

    await prisma.email.updateMany({
      where: { id: emailId, status: 'SCHEDULED' },
      data: {
        attempts: { increment: 1 },
        error: message,
        // Only mark FAILED once retries are exhausted; until then the email is
        // still legitimately scheduled for another attempt.
        ...(isFinalAttempt ? { status: 'FAILED' as const } : {}),
      },
    });

    if (isFinalAttempt) await indexEmail(emailId);

    log.error({ emailId, err: message, isFinalAttempt }, 'send failed');
    throw err;
  }
}
