import { Client } from '@elastic/elasticsearch';
import { elasticsearchConfigured, env } from '../config/env.js';
import { createLogger } from './logger.js';

const log = createLogger('elasticsearch');

export const EMAILS_INDEX = 'emails';

/**
 * Null when ELASTICSEARCH_URL is empty. The client constructor rejects an
 * empty node, so a deployment that runs without a cluster must not build one
 * at all rather than construct it and hope nothing calls it.
 */
export const esClient: Client | null = elasticsearchConfigured
  ? new Client({
      node: env.ELASTICSEARCH_URL,
      requestTimeout: 5_000,
      maxRetries: 2,
    })
  : null;

let available: boolean | null = null;

/**
 * Elasticsearch is a search accelerator here, not the system of record -
 * Postgres is. Every call site degrades to a Postgres query when ES is down,
 * so a dead cluster costs search quality, never correctness or delivery.
 */
export async function isElasticsearchAvailable(force = false): Promise<boolean> {
  // Not configured is a deployment choice, not a fault: never probe, never warn.
  if (!esClient) return false;
  if (available !== null && !force) return available;
  try {
    await esClient.ping();
    available = true;
  } catch (err) {
    available = false;
    log.warn({ err: String(err) }, 'elasticsearch unreachable - search falls back to postgres');
  }
  return available;
}

/** Idempotent: creating an index that already exists is a no-op. */
export async function ensureEmailsIndex(): Promise<void> {
  if (!(await isElasticsearchAvailable(true)) || !esClient) return;

  const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
  if (exists) {
    log.debug({ index: EMAILS_INDEX }, 'index already present');
    return;
  }

  await esClient.indices.create({
    index: EMAILS_INDEX,
    mappings: {
      properties: {
        campaignId: { type: 'keyword' },
        userId: { type: 'keyword' },
        senderId: { type: 'keyword' },
        senderName: { type: 'keyword' },
        // Searchable free-text, plus a keyword sub-field for exact match / sort.
        recipient: {
          type: 'text',
          fields: { keyword: { type: 'keyword', ignore_above: 320 } },
        },
        subject: { type: 'text' },
        body: { type: 'text' },
        status: { type: 'keyword' },
        sequenceIndex: { type: 'integer' },
        scheduledAt: { type: 'date' },
        sentAt: { type: 'date' },
      },
    },
  });

  log.info({ index: EMAILS_INDEX }, 'created elasticsearch index');
}
