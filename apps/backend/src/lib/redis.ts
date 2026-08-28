import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { createLogger } from './logger.js';

const log = createLogger('redis');

/**
 * BullMQ requires maxRetriesPerRequest: null on the connections it owns,
 * otherwise long-blocking commands abort. Everything else (sessions, the
 * rate limiter, the send-slot reservation) uses its own connection so a
 * blocked queue command can never stall a limiter check.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 200, 5_000),
};

export function createRedisConnection(role: string, options: RedisOptions = {}): Redis {
  const client = new Redis(env.REDIS_URL, { ...baseOptions, ...options });

  client.on('error', (err) => log.error({ role, err: err.message }, 'redis connection error'));
  client.on('ready', () => log.debug({ role }, 'redis ready'));

  return client;
}

/** General-purpose connection: rate limiting, send slots, Slack de-dup keys. */
export const redis = createRedisConnection('app');

/** Dedicated connection for express-session's store. */
export const sessionRedis = createRedisConnection('session');

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([redis.quit(), sessionRedis.quit()]);
}
