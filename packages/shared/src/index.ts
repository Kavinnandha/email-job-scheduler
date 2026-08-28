/**
 * Types shared between the Express backend and the React frontend.
 * The backend is the source of truth; the frontend imports these so an API
 * shape change breaks the build instead of failing silently at runtime.
 */

export const EMAIL_STATUS = {
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export type EmailStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];

/** Which limiter tier pushed a job into a later hour window. */
export const RATE_LIMIT_TIER = {
  /** Provider-throttling ceiling for a sender. Triggers the Slack alert. */
  SENDER: 'SENDER',
  /** User-chosen pacing for one campaign. Never alerts. */
  CAMPAIGN: 'CAMPAIGN',
  /** Optional ceiling across every sender. */
  GLOBAL: 'GLOBAL',
} as const;

export type RateLimitTier = (typeof RATE_LIMIT_TIER)[keyof typeof RATE_LIMIT_TIER];

// --- Entities ---------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  name: string;
  fromEmail: string;
  active: boolean;
}

export interface EmailRecord {
  id: string;
  campaignId: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  senderId: string;
  senderName: string | null;
  senderEmail: string | null;
  sequenceIndex: number;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
  attempts: number;
  starred: boolean;
}

/** A single email plus the campaign body, for the reading view. */
export interface EmailDetail extends EmailRecord {
  body: string;
  senderDisplayName: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  senderIds: string[];
  totalRecipients: number;
  createdAt: string;
  counts: EmailStatusCounts;
}

export interface EmailStatusCounts {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  channel: string | null;
}

// --- Requests ---------------------------------------------------------------

export interface CreateCampaignRequest {
  subject: string;
  body: string;
  recipients: string[];
  /** ISO-8601. When scheduling begins. */
  startTime: string;
  /** Minimum gap between consecutive sends, in seconds. */
  delaySeconds: number;
  /** Per-campaign hourly pacing. Omitted falls back to the server default,
   *  and is always bounded by the hard per-sender cap. */
  hourlyLimit?: number;
  /** Empty/omitted => use every active sender. */
  senderIds?: string[];
}

// --- Responses --------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface CreateCampaignResponse {
  campaign: Campaign;
  scheduled: number;
  /** Recipients dropped as duplicates or invalid addresses. */
  skipped: number;
}
