import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const log = createLogger('slack');

export interface RateLimitNotification {
  userId: string;
  senderName: string;
  senderEmail: string;
  limit: number;
  resumesAt: Date;
}

/**
 * Posts a real message to the user's Slack workspace when a sender exhausts
 * its hourly quota.
 *
 * Two behaviours the assignment calls out explicitly:
 *  - If the user has never connected Slack, this is a no-op, not an error.
 *    A missing integration must never disturb delivery.
 *  - The webhook URL is read fresh from the database on every call, so a user
 *    who connects Slack later starts receiving notifications immediately,
 *    with no redeploy or restart.
 */
export async function notifyRateLimitHit(notification: RateLimitNotification): Promise<boolean> {
  const { userId, senderName, senderEmail, limit, resumesAt } = notification;

  const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
  if (!integration) {
    log.debug({ userId }, 'no slack integration - skipping notification');
    return false;
  }

  const resumeTime = resumesAt.toISOString().replace('T', ' ').slice(0, 16);

  const payload = {
    text: `Hourly send limit reached for ${senderName}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Hourly send limit reached', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sender*\n${senderName}` },
          { type: 'mrkdwn', text: `*Address*\n${senderEmail}` },
          { type: 'mrkdwn', text: `*Limit*\n${limit} emails/hour` },
          { type: 'mrkdwn', text: `*Resumes*\n${resumeTime} UTC` },
        ],
      },
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

    log.info({ userId, senderName }, 'slack rate-limit notification sent');
    return true;
  } catch (err) {
    // Slack being unreachable must not fail the job that triggered it.
    log.warn({ userId, err: String(err) }, 'slack notification failed');
    return false;
  }
}
