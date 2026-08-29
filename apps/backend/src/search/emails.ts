import type { EmailStatus } from '@repo/shared';
import {
  EMAILS_INDEX,
  ensureEmailsIndex,
  esClient,
  isElasticsearchAvailable,
} from '../lib/elasticsearch.js';
import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

const log = createLogger('search');

export interface EmailSearchHit {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderName: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  sequenceIndex: number;
  scheduledAt: string;
  sentAt: string | null;
}

/**
 * Indexing is best-effort by design. Elasticsearch is a search accelerator,
 * not the system of record - Postgres is - so a failure here is logged and
 * swallowed rather than allowed to fail a job that already delivered mail.
 * Losing a document costs search freshness; throwing would cost a duplicate
 * send on the retry.
 */
export async function indexEmail(emailId: string): Promise<void> {
  try {
    if (!(await isElasticsearchAvailable()) || !esClient) return;

    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: { select: { name: true } }, campaign: { select: { subject: true, body: true } } },
    });
    if (!email) return;

    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      // Upsert semantics: re-indexing the same id overwrites, so a status
      // transition never leaves two documents for one email.
      document: {
        campaignId: email.campaignId,
        userId: email.userId,
        senderId: email.senderId,
        senderName: email.sender.name,
        recipient: email.recipient,
        subject: email.campaign.subject,
        body: email.campaign.body,
        status: email.status,
        sequenceIndex: email.sequenceIndex,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString() ?? null,
      },
      refresh: false,
    });
  } catch (err) {
    log.warn({ emailId, err: String(err) }, 'failed to index email - search may be stale');
  }
}

/** Bulk variant used when a whole campaign is scheduled at once. */
export async function indexEmailsForCampaign(campaignId: string): Promise<number> {
  try {
    if (!(await isElasticsearchAvailable()) || !esClient) return 0;

    const emails = await prisma.email.findMany({
      where: { campaignId },
      include: { sender: { select: { name: true } }, campaign: { select: { subject: true, body: true } } },
    });
    if (emails.length === 0) return 0;

    const operations = emails.flatMap((email) => [
      { index: { _index: EMAILS_INDEX, _id: email.id } },
      {
        campaignId: email.campaignId,
        userId: email.userId,
        senderId: email.senderId,
        senderName: email.sender.name,
        recipient: email.recipient,
        subject: email.campaign.subject,
        body: email.campaign.body,
        status: email.status,
        sequenceIndex: email.sequenceIndex,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString() ?? null,
      },
    ]);

    const result = await esClient.bulk({ operations, refresh: false });
    if (result.errors) log.warn({ campaignId }, 'some documents failed to index');

    return emails.length;
  } catch (err) {
    log.warn({ campaignId, err: String(err) }, 'bulk index failed - search may be stale');
    return 0;
  }
}

export interface SearchEmailsInput {
  userId: string;
  query: string;
  /** Restrict to these statuses; omitted or empty means every status. */
  statuses?: EmailStatus[];
  page: number;
  pageSize: number;
}

export interface SearchEmailsResult {
  ids: string[];
  total: number;
  /** False when the query was served by the Postgres fallback. */
  usedElasticsearch: boolean;
}

/**
 * Full-text search over subject, body and recipient, always scoped to the
 * requesting user. Returns ids only; the caller re-reads the rows from
 * Postgres so the response is authoritative even if the index lags.
 */
export async function searchEmails(input: SearchEmailsInput): Promise<SearchEmailsResult> {
  const { userId, query, statuses, page, pageSize } = input;

  if ((await isElasticsearchAvailable()) && esClient) {
    try {
      const filter: Record<string, unknown>[] = [{ term: { userId } }];
      // `terms` rather than `term` so the Sent view can ask for SENT and
      // FAILED together in one query.
      if (statuses?.length) filter.push({ terms: { status: statuses } });

      const response = await esClient.search({
        index: EMAILS_INDEX,
        from: (page - 1) * pageSize,
        size: pageSize,
        query: {
          bool: {
            filter,
            must: query
              ? [
                  {
                    bool: {
                      // The n-gram fields and the plain-analysed body cannot
                      // share one multi_match: fuzziness against n-grams is
                      // both meaningless and expensive, so they are scored as
                      // separate clauses and OR-ed together.
                      should: [
                        {
                          multi_match: {
                            query,
                            // Subject outranks the rest; recipient and sender
                            // are boosted so searching for an address or a
                            // sender finds it ahead of a body mention.
                            fields: ['subject^3', 'recipient^2', 'senderName^2'],
                            type: 'best_fields',
                          },
                        },
                        {
                          match: { body: { query, fuzziness: 'AUTO' } },
                        },
                      ],
                      minimum_should_match: 1,
                    },
                  },
                ]
              : [{ match_all: {} }],
          },
        },
        // Relevance first, then recency as the tie-break. Sorting by date
        // alone discarded the ranking the query had just computed, so an
        // exact subject hit could land below an incidental body match.
        sort: query
          ? [{ _score: { order: 'desc' } }, { scheduledAt: { order: 'desc' } }]
          : [{ scheduledAt: { order: 'desc' } }],
      });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      return {
        ids: response.hits.hits.map((hit) => hit._id).filter((id): id is string => Boolean(id)),
        total,
        usedElasticsearch: true,
      };
    } catch (err) {
      log.warn({ err: String(err) }, 'elasticsearch query failed - falling back to postgres');
    }
  }

  // Fallback: correctness over ranking. Slower and no relevance scoring, but
  // search keeps working when the cluster is down.
  const where = {
    userId,
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(query
      ? {
          OR: [
            { recipient: { contains: query, mode: 'insensitive' as const } },
            // Sender name is searchable here too, so the fallback covers the
            // same fields as the index rather than silently dropping results
            // the moment the cluster goes down.
            { sender: { name: { contains: query, mode: 'insensitive' as const } } },
            { campaign: { subject: { contains: query, mode: 'insensitive' as const } } },
            { campaign: { body: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true },
    }),
  ]);

  return { ids: rows.map((r) => r.id), total, usedElasticsearch: false };
}

/**
 * Rebuilds the whole index from Postgres. Used after a schema change, where
 * the old index has been dropped and every document has to be regenerated.
 *
 * Batched rather than one bulk call: a single request holding every email in
 * the system is the one that fails on a large deployment, and a partial
 * backfill that got most of the way is far better than one that got nowhere.
 */
export async function reindexAllEmails(batchSize = 500): Promise<number> {
  if (!(await isElasticsearchAvailable()) || !esClient) return 0;

  let cursor: string | undefined;
  let indexed = 0;

  for (;;) {
    const emails = await prisma.email.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        sender: { select: { name: true } },
        campaign: { select: { subject: true, body: true } },
      },
    });
    if (emails.length === 0) break;

    const operations = emails.flatMap((email) => [
      { index: { _index: EMAILS_INDEX, _id: email.id } },
      {
        campaignId: email.campaignId,
        userId: email.userId,
        senderId: email.senderId,
        senderName: email.sender.name,
        recipient: email.recipient,
        subject: email.campaign.subject,
        body: email.campaign.body,
        status: email.status,
        sequenceIndex: email.sequenceIndex,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString() ?? null,
      },
    ]);

    const result = await esClient.bulk({ operations, refresh: false });
    if (result.errors) log.warn({ cursor }, 'some documents failed to backfill');

    indexed += emails.length;
    cursor = emails[emails.length - 1]?.id;
    if (emails.length < batchSize) break;
  }

  // Unlike the incremental paths, make the result searchable immediately:
  // a backfill exists precisely so search works on the next request.
  await esClient.indices.refresh({ index: EMAILS_INDEX });

  log.info({ indexed }, 'search index backfilled from postgres');
  return indexed;
}

/**
 * Boot-time entry point: bring the index schema up to date and, when that
 * required a rebuild, refill it. Safe to run from several processes at once -
 * documents are written by email id, so a concurrent backfill overwrites with
 * identical content rather than duplicating.
 */
export async function initEmailSearch(): Promise<void> {
  try {
    const { rebuilt } = await ensureEmailsIndex();
    if (rebuilt) await reindexAllEmails();
  } catch (err) {
    // Search setup must never stop the process from booting: every query
    // degrades to Postgres on its own.
    log.warn({ err: String(err) }, 'search initialisation failed - falling back to postgres');
  }
}

/** Removes a cancelled email from the index. Best-effort, like indexing. */
export async function removeEmailFromIndex(emailId: string): Promise<void> {
  try {
    if (!(await isElasticsearchAvailable()) || !esClient) return;
    await esClient.delete({ index: EMAILS_INDEX, id: emailId }, { ignore: [404] });
  } catch (err) {
    log.warn({ emailId, err: String(err) }, 'failed to remove email from index');
  }
}
