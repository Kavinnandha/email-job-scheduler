import { createLogger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { enqueueEmails } from './scheduler.js';
import { emailJobId, emailQueue } from './queue.js';

const log = createLogger('reconcile');

export interface ReconcileResult {
  scheduledInDb: number;
  alreadyQueued: number;
  reEnqueued: number;
}

/**
 * Rebuilds the queue from the database at boot.
 *
 * Redis persistence (appendonly) already carries delayed jobs across an
 * ordinary restart, so on a normal boot this finds every job present and
 * re-adds nothing. It exists for the case persistence cannot cover: Redis
 * losing its data entirely - a flush, a wiped volume, a failover to an empty
 * replica. Postgres is the system of record, so the schedule can always be
 * reconstructed from it.
 *
 * Re-adding is safe regardless: job ids are derived from the email id, so a
 * job that is still queued is not duplicated.
 */
export async function reconcileQueue(): Promise<ReconcileResult> {
  const pending = await prisma.email.findMany({
    where: { status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
  });

  if (pending.length === 0) {
    log.info({ scheduledInDb: 0, reEnqueued: 0 }, 'reconciliation complete - nothing pending');
    return { scheduledInDb: 0, alreadyQueued: 0, reEnqueued: 0 };
  }

  // Check membership in bulk rather than one getJob round trip per email; a
  // large backlog would otherwise make boot crawl.
  const existing = await Promise.all(
    pending.map((email) => emailQueue.getJob(emailJobId(email.id))),
  );

  const missing = pending.filter((_, index) => !existing[index]);
  const reEnqueued = await enqueueEmails(missing);

  const result: ReconcileResult = {
    scheduledInDb: pending.length,
    alreadyQueued: pending.length - missing.length,
    reEnqueued,
  };

  log.info(result, 'reconciliation complete');
  return result;
}
