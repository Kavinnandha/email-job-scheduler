import { RATE_LIMIT_TIER, type RateLimitTier } from '@repo/shared';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const log = createLogger('slack');

export interface RateLimitNotification {
  userId: string;
  /** Which limiter tier pushed the job into the next window. */
  tier: RateLimitTier;
  /** The limit belonging to that tier - NOT always the per-sender ceiling. */
  limit: number;
  senderName: string;
  senderEmail: string;
  campaignSubject?: string | null;
  resumesAt: Date;
}

/** Human wording per tier, so the message names the limit that actually hit. */
const TIER_COPY: Record<RateLimitTier, { headline: string; scope: string }> = {
  [RATE_LIMIT_TIER.SENDER]: {
    headline: 'Sender hourly limit reached',
    scope: 'Per-sender ceiling',
  },
  [RATE_LIMIT_TIER.CAMPAIGN]: {
    headline: 'Campaign hourly limit reached',
    scope: 'Campaign pacing',
  },
  [RATE_LIMIT_TIER.GLOBAL]: {
    headline: 'Global hourly limit reached',
    scope: 'Across all senders',
  },
};

/**
 * Posts a real message to the user's Slack workspace when an hourly quota is
 * exhausted and the remaining emails are pushed into the next window.
 *
 * Two behaviours the assignment calls out explicitly:
 *  - If the user has never connected Slack, this is a no-op, not an error.
 *    A missing integration must never disturb delivery.
 *  - The webhook URL is read fresh from the database on every call, so a user
 *    who connects Slack later starts receiving notifications immediately,
 *    with no redeploy or restart.
 */
export async function notifyRateLimitHit(notification: RateLimitNotification): Promise<boolean> {
  const { userId, tier, limit, senderName, senderEmail, campaignSubject, resumesAt } =
    notification;

  const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
  if (!integration) {
    log.debug({ userId }, 'no slack integration - skipping notification');
    return false;
  }

  const copy = TIER_COPY[tier] ?? TIER_COPY[RATE_LIMIT_TIER.SENDER];
  const resumeTime = resumesAt.toISOString().replace('T', ' ').slice(0, 16);

  const fields = [
    { type: 'mrkdwn', text: `*Limit*\n${limit} emails/hour` },
    { type: 'mrkdwn', text: `*Scope*\n${copy.scope}` },
    { type: 'mrkdwn', text: `*Sender*\n${senderName} <${senderEmail}>` },
    { type: 'mrkdwn', text: `*Resumes*\n${resumeTime} UTC` },
  ];

  if (campaignSubject) {
    fields.push({ type: 'mrkdwn', text: `*Campaign*\n${campaignSubject}` });
  }

  const payload = {
    text: `${copy.headline} - ${limit} emails/hour. Sending resumes ${resumeTime} UTC.`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: copy.headline, emoji: true },
      },
      { type: 'section', fields },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Remaining emails were rescheduled into the next hour window. Nothing was dropped.',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(integration.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      const body = await response.text();
      log.warn({ userId, status: response.status, body }, 'slack notification rejected');
      return false;
    }

    log.info({ userId, tier, senderName }, 'slack rate-limit notification sent');
    return true;
  } catch (err) {
    // Slack being unreachable must not fail the job that triggered it.
    log.warn({ userId, err: String(err) }, 'slack notification failed');
    return false;
  }
}
