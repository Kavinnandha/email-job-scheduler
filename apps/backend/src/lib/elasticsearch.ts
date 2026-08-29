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

/**
 * Bumped whenever the analysers or mappings below change. It is written into
 * the index `_meta` so a boot against an index built by an older version can
 * detect the mismatch and rebuild, instead of silently serving queries against
 * a mapping that no longer matches the query builder.
 */
export const EMAILS_SCHEMA_VERSION = 2;

/**
 * Recipients, subjects and sender names are searched by fragment - people type
 * "kavin" or "gmail", not the whole token - so these fields are indexed as
 * n-grams and queried with a plain analyser. The standard analyser alone made
 * every partial query return nothing: it emits "kavinnandhakavin" and
 * "gmail.com" as single terms, so neither "kavin" nor "gmail" matched.
 *
 * Body is deliberately left on the standard analyser. N-gramming a full email
 * body multiplies the term count for little benefit - body matches are
 * whole-word in practice, and fuzziness already covers typos there.
 */
const EMAILS_SETTINGS = {
  // ngram filters need this raised: it defaults to 1.
  'index.max_ngram_diff': 19,
  analysis: {
    tokenizer: {
      // Splits on any run of non-alphanumerics, so the punctuation that holds
      // an address together becomes a token boundary: "a.b@gmail.com" yields
      // "a", "b", "gmail", "com" rather than two opaque blobs. The standard
      // tokenizer keeps "gmail.com" whole, which is why "gmail" never matched.
      alphanumeric: {
        type: 'pattern' as const,
        pattern: '[^\\p{L}\\p{N}]+',
      },
    },
    filter: {
      substring_ngram: { type: 'ngram' as const, min_gram: 2, max_gram: 20 },
    },
    analyzer: {
      // Index time: every substring of every token.
      substring_index: {
        type: 'custom' as const,
        tokenizer: 'alphanumeric',
        filter: ['lowercase', 'substring_ngram'],
      },
      // Search time: the query is NOT n-grammed. Doing so on both sides makes
      // any two-character overlap a match, which destroys precision.
      substring_search: {
        type: 'custom' as const,
        tokenizer: 'alphanumeric',
        filter: ['lowercase'],
      },
    },
  },
};

/** A fragment-searchable field that keeps an exact keyword sub-field. */
const substringField = (ignoreAbove: number) => ({
  type: 'text' as const,
  analyzer: 'substring_index',
  search_analyzer: 'substring_search',
  fields: { keyword: { type: 'keyword' as const, ignore_above: ignoreAbove } },
});

const EMAILS_MAPPINGS = {
  _meta: { version: EMAILS_SCHEMA_VERSION },
  properties: {
    campaignId: { type: 'keyword' as const },
    userId: { type: 'keyword' as const },
    senderId: { type: 'keyword' as const },
    // Was a bare keyword, so it was unsearchable by any free-text query even
    // though the UI shows it. Now searchable, with the keyword kept for exact
    // matching and aggregation.
    senderName: substringField(256),
    recipient: substringField(320),
    subject: substringField(512),
    body: { type: 'text' as const },
    status: { type: 'keyword' as const },
    sequenceIndex: { type: 'integer' as const },
    scheduledAt: { type: 'date' as const },
    sentAt: { type: 'date' as const },
  },
};

async function createEmailsIndex(): Promise<void> {
  if (!esClient) return;
  await esClient.indices.create({
    index: EMAILS_INDEX,
    settings: EMAILS_SETTINGS,
    mappings: EMAILS_MAPPINGS,
  });
  log.info({ index: EMAILS_INDEX, version: EMAILS_SCHEMA_VERSION }, 'created elasticsearch index');
}

/** Reads the schema version an existing index was built with. */
async function indexedSchemaVersion(): Promise<number> {
  if (!esClient) return 0;
  const mapping = await esClient.indices.getMapping({ index: EMAILS_INDEX });
  const meta = mapping[EMAILS_INDEX]?.mappings?._meta as { version?: number } | undefined;
  return meta?.version ?? 0;
}

export interface EnsureIndexResult {
  /** True when the index was built from scratch and holds no documents yet. */
  rebuilt: boolean;
}

/**
 * Idempotent. Creates the index when missing, and rebuilds it when it was
 * built by an older schema version.
 *
 * Rebuilding by dropping and recreating is safe precisely because
 * Elasticsearch is not the system of record here: every document can be
 * regenerated from Postgres, so the cost of a rebuild is one backfill rather
 * than data loss. Mappings for existing fields cannot be changed in place, so
 * there is no cheaper option.
 */
export async function ensureEmailsIndex(): Promise<EnsureIndexResult> {
  if (!(await isElasticsearchAvailable(true)) || !esClient) return { rebuilt: false };

  const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
  if (!exists) {
    await createEmailsIndex();
    return { rebuilt: true };
  }

  const version = await indexedSchemaVersion();
  if (version === EMAILS_SCHEMA_VERSION) {
    log.debug({ index: EMAILS_INDEX, version }, 'index already present and current');
    return { rebuilt: false };
  }

  log.warn(
    { index: EMAILS_INDEX, found: version, expected: EMAILS_SCHEMA_VERSION },
    'index schema is out of date - rebuilding from postgres',
  );
  await esClient.indices.delete({ index: EMAILS_INDEX }, { ignore: [404] });
  await createEmailsIndex();
  return { rebuilt: true };
}
