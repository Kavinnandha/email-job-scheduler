import type {
  AuthUser,
  Campaign,
  CreateCampaignRequest,
  CreateCampaignResponse,
  EmailRecord,
  EmailStatus,
  Paginated,
  Sender,
  SlackStatus,
} from '@repo/shared';
import { apiRequest } from './client';

// --- Auth -------------------------------------------------------------------

export const getCurrentUser = () => apiRequest<AuthUser>('/api/auth/me');

export const logout = () => apiRequest<{ ok: true }>('/api/auth/logout', { method: 'POST' });

// --- Senders ----------------------------------------------------------------

export const getSenders = () => apiRequest<Sender[]>('/api/senders');

// --- Campaigns --------------------------------------------------------------

export const getCampaigns = () => apiRequest<Campaign[]>('/api/campaigns');

export const createCampaign = (payload: CreateCampaignRequest) =>
  apiRequest<CreateCampaignResponse>('/api/campaigns', { method: 'POST', body: payload });

// --- Emails -----------------------------------------------------------------

export interface EmailListParams {
  status?: EmailStatus;
  page?: number;
  pageSize?: number;
}

export type EmailSearchResponse = Paginated<EmailRecord> & { usedElasticsearch: boolean };

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const getEmails = (params: EmailListParams = {}) =>
  apiRequest<Paginated<EmailRecord>>(`/api/emails${toQueryString({ ...params })}`);

export const searchEmails = (params: EmailListParams & { q: string }) =>
  apiRequest<EmailSearchResponse>(`/api/emails/search${toQueryString({ ...params })}`);

// --- Slack ------------------------------------------------------------------

export const getSlackStatus = () => apiRequest<SlackStatus>('/api/slack/status');

export const startSlackConnect = () => apiRequest<{ url: string }>('/api/slack/start');

export const disconnectSlack = () =>
  apiRequest<{ ok: true }>('/api/slack/disconnect', { method: 'POST' });

export const sendSlackTest = () => apiRequest<{ ok: true }>('/api/slack/test', { method: 'POST' });
