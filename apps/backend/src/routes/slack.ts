import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { RATE_LIMIT_TIER, type SlackStatus } from '@repo/shared';
import { env, slackOAuthConfigured } from '../config/env.js';
import { getUser, requireAuth } from '../auth/requireAuth.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { buildSlackAuthorizeUrl, exchangeSlackCode } from '../slack/oauth.js';
import { notifyRateLimitHit } from '../slack/notify.js';

const log = createLogger('slack-routes');

export const slackRouter: Router = Router();

declare module 'express-session' {
  interface SessionData {
    slackState?: string;
    slackUserId?: string;
  }
}

slackRouter.get('/start', requireAuth, (req, res) => {
  if (!slackOAuthConfigured) {
    res.status(503).json({
      error: 'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.',
    });
    return;
  }

  // CSRF protection: a random state is stored in the session and must come
  // back unchanged, so a forged callback cannot bind someone else's workspace.
  const state = randomBytes(16).toString('hex');
  req.session.slackState = state;
  // Slack's callback is a top-level redirect and carries no session for the
  // SPA, so the user is pinned here rather than re-derived from the callback.
  req.session.slackUserId = getUser(req).id;

  req.session.save((err) => {
    if (err) {
      log.error({ err: err.message }, 'failed to persist slack oauth state');
      res.status(500).json({ error: 'Could not start Slack connection' });
      return;
    }
    res.json({ url: buildSlackAuthorizeUrl(state) });
  });
});

slackRouter.get('/callback', async (req, res) => {
  const redirectTo = (status: string) => `${env.FRONTEND_URL}/?slack=${status}`;

  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;

    if (error) {
      log.warn({ error }, 'slack authorisation denied');
      res.redirect(redirectTo('denied'));
      return;
    }

    const expectedState = req.session.slackState;
    const userId = req.session.slackUserId;

    if (!code || !state || !expectedState || state !== expectedState || !userId) {
      log.warn({ hasCode: Boolean(code), stateMatch: state === expectedState }, 'invalid slack callback');
      res.redirect(redirectTo('invalid_state'));
      return;
    }

    delete req.session.slackState;
    delete req.session.slackUserId;

    const token = await exchangeSlackCode(code);

    if (!token.ok || !token.incoming_webhook?.url) {
      log.warn({ error: token.error }, 'slack token exchange failed');
      res.redirect(redirectTo('failed'));
      return;
    }

    // Upsert on userId: reconnecting replaces the old webhook rather than
    // accumulating stale ones, so a user can move the alerts to another channel.
    await prisma.slackIntegration.upsert({
      where: { userId },
      create: {
        userId,
        teamId: token.team?.id ?? null,
        teamName: token.team?.name ?? null,
        channel: token.incoming_webhook.channel,
        webhookUrl: token.incoming_webhook.url,
      },
      update: {
        teamId: token.team?.id ?? null,
        teamName: token.team?.name ?? null,
        channel: token.incoming_webhook.channel,
        webhookUrl: token.incoming_webhook.url,
      },
    });

    log.info({ userId, team: token.team?.name }, 'slack connected');
    res.redirect(redirectTo('connected'));
  } catch (err) {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'slack callback error');
    res.redirect(redirectTo('failed'));
  }
});

slackRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: getUser(req).id },
    });

    const payload: SlackStatus = {
      connected: Boolean(integration),
      teamName: integration?.teamName ?? null,
      channel: integration?.channel ?? null,
    };
    // The webhook URL is a credential and is never returned to the client.
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

slackRouter.post('/disconnect', requireAuth, async (req, res, next) => {
  try {
    await prisma.slackIntegration.deleteMany({ where: { userId: getUser(req).id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Sends a real message so the user can confirm the connection works without
 * having to drive a sender into its hourly limit first.
 */
slackRouter.post('/test', requireAuth, async (req, res, next) => {
  try {
    const user = getUser(req);
    const sent = await notifyRateLimitHit({
      userId: user.id,
      tier: RATE_LIMIT_TIER.SENDER,
      limit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      senderName: 'Test sender',
      senderEmail: 'test@example.com',
      campaignSubject: 'Test campaign',
      resumesAt: new Date(Date.now() + 3_600_000),
    });

    if (!sent) {
      res.status(400).json({ error: 'Slack is not connected, or the webhook was rejected' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
