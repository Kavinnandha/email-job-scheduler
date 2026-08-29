import type {
  AuthUser,
  Campaign,
  CreateCampaignRequest,
  CreateCampaignResponse,
  EmailDetail,
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
  /** One or more statuses; the API takes them as a comma-separated list. */
  status?: EmailStatus[];
  page?: number;
  pageSize?: number;
}

export type EmailSearchResponse = Paginated<EmailRecord> & { usedElasticsearch: boolean };

type QueryValue = string | number | string[] | undefined;

function toQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // An empty array is "no filter", not "match nothing", so it is dropped
    // alongside undefined rather than sent as an empty parameter.
    const serialised = Array.isArray(value) ? value.join(',') : value;
    if (serialised !== undefined && serialised !== '') search.set(key, String(serialised));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const getEmails = (params: EmailListParams = {}) =>
  apiRequest<Paginated<EmailRecord>>(`/api/emails${toQueryString({ ...params })}`);

export const searchEmails = (params: EmailListParams & { q: string }) =>
  apiRequest<EmailSearchResponse>(`/api/emails/search${toQueryString({ ...params })}`);

export const getEmail = (id: string) => apiRequest<EmailDetail>(`/api/emails/${id}`);

export const setEmailStarred = (id: string, starred: boolean) =>
  apiRequest<{ ok: true; starred: boolean }>(`/api/emails/${id}/star`, {
    method: 'PATCH',
    body: { starred },
  });

/** Cancels a scheduled email: removes its queued job and deletes the row. */
export const cancelEmail = (id: string) =>
  apiRequest<{ ok: true }>(`/api/emails/${id}`, { method: 'DELETE' });

// --- Slack ------------------------------------------------------------------

export const getSlackStatus = () => apiRequest<SlackStatus>('/api/slack/status');

export const startSlackConnect = () => apiRequest<{ url: string }>('/api/slack/start');

export const disconnectSlack = () =>
  apiRequest<{ ok: true }>('/api/slack/disconnect', { method: 'POST' });

export const sendSlackTest = () => apiRequest<{ ok: true }>('/api/slack/test', { method: 'POST' });
