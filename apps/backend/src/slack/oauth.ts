import { env } from '../config/env.js';

/**
 * Slack OAuth v2 with the incoming-webhook scope. Slack asks the user to pick
 * a channel during authorisation and returns a webhook bound to it, so the
 * app never needs permission to post anywhere else in the workspace.
 */
export const SLACK_SCOPES = 'incoming-webhook';

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  team?: { id: string; name: string };
  incoming_webhook?: {
    url: string;
    channel: string;
    channel_id: string;
    configuration_url: string;
  };
}

export async function exchangeSlackCode(code: string): Promise<SlackTokenResponse> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  // Slack answers 200 with ok:false for most failures, so the body decides.
  return (await response.json()) as SlackTokenResponse;
}
