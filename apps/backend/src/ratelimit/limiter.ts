import type { Redis } from 'ioredis';
import { RATE_LIMIT_TIER, type RateLimitTier } from '@repo/shared';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';

export const HOUR_MS = 3_600_000;

/** Counters outlive their window slightly so a clock skew cannot lose one. */
const WINDOW_TTL_SECONDS = 3_700;

export const currentWindow = (now = Date.now()): number => Math.floor(now / HOUR_MS);
export const windowStart = (window: number): number => window * HOUR_MS;

// --- Send slot ---------------------------------------------------------------

/**
 * Check-and-reserve the next send slot for a sender, atomically.
 *
 * The naive version - read the last-send timestamp, compare, send, write the
 * new timestamp - is broken the moment concurrency exceeds 1: N workers all
 * read the same stale value, all conclude the gap has elapsed, and all send
 * together. The minimum-delay guarantee then fails in exactly the situation
 * it exists for. Doing the comparison and the write in one Lua script closes
 * that window, and the slot is claimed BEFORE the SMTP call rather than after,
 * so a slow send cannot let a second job slip through behind it.
 *
 * Returns 0 when the slot is reserved, or the milliseconds to wait otherwise.
 */
const RESERVE_SLOT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local gap = tonumber(ARGV[2])
local nextAllowed = tonumber(redis.call('GET', key) or '0')

if nextAllowed > now then
  return nextAllowed - now
end

redis.call('SET', key, now + gap, 'PX', gap + 60000)
return 0
`;

const slotKey = (senderId: string): string => `slot:${senderId}`;

export async function reserveSendSlot(
  senderId: string,
  gapMs: number = env.DELAY_BETWEEN_EMAILS_MS,
  client: Redis = redis,
  now: number = Date.now(),
): Promise<number> {
  if (gapMs <= 0) return 0;
  const waitMs = await client.eval(RESERVE_SLOT_SCRIPT, 1, slotKey(senderId), now, gapMs);
  return Number(waitMs);
}

/**
 * Hands a reserved slot back when a later check (the hourly limit) rejects the
 * send. Guarded by value so it can only clear a reservation still owned by
 * this job - another worker may have legitimately claimed the slot since.
 */
const RELEASE_SLOT_SCRIPT = `
local key = KEYS[1]
local expected = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or '0')

if current == expected then
  redis.call('DEL', key)
  return 1
end
return 0
`;

export async function releaseSendSlot(
  senderId: string,
  reservedAt: number,
  gapMs: number = env.DELAY_BETWEEN_EMAILS_MS,
  client: Redis = redis,
): Promise<boolean> {
  if (gapMs <= 0) return false;
  const released = await client.eval(
    RELEASE_SLOT_SCRIPT,
    1,
    slotKey(senderId),
    reservedAt + gapMs,
  );
  return Number(released) === 1;
}

// --- Hourly rate limiting ----------------------------------------------------

/**
 * Increments every applicable counter, and if ANY of them would exceed its
 * limit, rolls back every increment it already made and reports which tier
 * blocked.
 *
 * All-or-nothing matters: incrementing the tiers sequentially from Node lets a
 * job that trips the second tier leave the first tier's counter permanently
 * inflated, so the counters drift upward under concurrency and the effective
 * limit silently drops over time. In one script the rollback cannot be
 * interleaved with another worker's increment.
 *
 * KEYS  = the counter keys, ARGV = matching limits, then the TTL.
 * Returns 0 when allowed, or the 1-based index of the key that blocked.
 */
const CONSUME_SCRIPT = `
local ttl = tonumber(ARGV[#ARGV])
local incremented = {}

for i = 1, #KEYS do
  local limit = tonumber(ARGV[i])
  local count = redis.call('INCR', KEYS[i])

  if count == 1 then
    redis.call('EXPIRE', KEYS[i], ttl)
  end

  table.insert(incremented, KEYS[i])

  if count > limit then
    for _, k in ipairs(incremented) do
      redis.call('DECR', k)
    end
    return i
  end
end

return 0
`;

export interface ConsumeQuotaInput {
  senderId: string;
  campaignId: string;
  /** Per-campaign pacing chosen by the user. */
  campaignLimit: number;
  now?: number;
  client?: Redis;
}

export interface QuotaResult {
  allowed: boolean;
  /** Which tier rejected the send. Every tier raises a Slack alert. */
  blockedBy: RateLimitTier | null;
  /** The limit value of the tier that rejected, for the alert message. */
  blockedLimit: number | null;
  /**
   * The entity the blocking limit is counted against - a sender id, a campaign
   * id, or 'global'. Alerts are de-duplicated per scope, not per sender, so a
   * campaign block and a sender block cannot silence one another.
   */
  blockedScopeId: string | null;
  window: number;
}

export async function consumeQuota(input: ConsumeQuotaInput): Promise<QuotaResult> {
  const { senderId, campaignId, campaignLimit } = input;
  const client = input.client ?? redis;
  const now = input.now ?? Date.now();
  const window = currentWindow(now);

  const keys: string[] = [];
  const limits: number[] = [];
  const tiers: RateLimitTier[] = [];
  const scopes: string[] = [];

  // Order is deliberate: the hard sender ceiling is evaluated first so that
  // when several tiers are exhausted the sender tier is the one reported, and
  // the operator gets the alert that actually matters.
  keys.push(`rl:sender:${senderId}:${window}`);
  limits.push(env.MAX_EMAILS_PER_HOUR_PER_SENDER);
  tiers.push(RATE_LIMIT_TIER.SENDER);
  scopes.push(senderId);

  if (env.MAX_EMAILS_PER_HOUR_GLOBAL > 0) {
    keys.push(`rl:global:${window}`);
    limits.push(env.MAX_EMAILS_PER_HOUR_GLOBAL);
    tiers.push(RATE_LIMIT_TIER.GLOBAL);
    scopes.push('global');
  }

  keys.push(`rl:campaign:${campaignId}:${window}`);
  limits.push(campaignLimit);
  tiers.push(RATE_LIMIT_TIER.CAMPAIGN);
  scopes.push(campaignId);

  const blockedIndex = Number(
    await client.eval(CONSUME_SCRIPT, keys.length, ...keys, ...limits, WINDOW_TTL_SECONDS),
  );

  if (blockedIndex === 0) {
    return { allowed: true, blockedBy: null, blockedLimit: null, blockedScopeId: null, window };
  }

  return {
    allowed: false,
    blockedBy: tiers[blockedIndex - 1] ?? null,
    blockedLimit: limits[blockedIndex - 1] ?? null,
    blockedScopeId: scopes[blockedIndex - 1] ?? null,
    window,
  };
}

/**
 * Returns a slot to the hourly counters when a send fails after the quota was
 * consumed, so a failed attempt does not permanently burn capacity.
 */
export async function refundQuota(
  senderId: string,
  campaignId: string,
  window: number,
  client: Redis = redis,
): Promise<void> {
  const pipeline = client.pipeline();
  pipeline.decr(`rl:sender:${senderId}:${window}`);
  pipeline.decr(`rl:campaign:${campaignId}:${window}`);
  if (env.MAX_EMAILS_PER_HOUR_GLOBAL > 0) pipeline.decr(`rl:global:${window}`);
  await pipeline.exec();
}

/** Current usage for a sender in the active window, for dashboards/debugging. */
export async function senderUsage(senderId: string, now = Date.now()): Promise<number> {
  const value = await redis.get(`rl:sender:${senderId}:${currentWindow(now)}`);
  return value ? Number(value) : 0;
}

/**
 * One alert per limiter scope per window. SET NX is the whole mechanism:
 * whichever worker wins the race sends the notification, and the rest see the
 * key and stay quiet, so a limit hit by 400 concurrent jobs still produces one
 * message.
 *
 * The key is scoped by tier as well as by entity. Keying it on the sender
 * alone was wrong once campaign pacing started alerting too: a campaign block
 * and a sender block in the same window would collapse into a single alert.
 */
export async function claimRateLimitAlert(
  tier: RateLimitTier,
  scopeId: string,
  window: number,
  client: Redis = redis,
): Promise<boolean> {
  const result = await client.set(
    `alert:ratelimit:${tier}:${scopeId}:${window}`,
    '1',
    'EX',
    WINDOW_TTL_SECONDS,
    'NX',
  );
  return result === 'OK';
}
