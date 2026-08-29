import { Worker } from 'bullmq';
import { env, QUEUE_NAME } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { createRedisConnection } from '../lib/redis.js';
import { closeAllTransports } from '../mail/transport.js';
import { processEmailJob } from './processor.js';
import { closeQueue } from './queue.js';
import { reconcileQueue } from './reconcile.js';
import type { EmailJobData } from './queue.js';

const log = createLogger('worker');

/**
 * Extracted from the worker entrypoint so a single-process deployment can run
 * the consumer inside the API process without duplicating the wiring. The
 * behaviour is identical either way: same reconcile, same concurrency, same
 * shutdown semantics.
 */
export async function startWorker(): Promise<Worker<EmailJobData>> {
  // Runs before the worker starts consuming, so a queue emptied by Redis data
  // loss is rebuilt from Postgres before any job is processed.
  await reconcileQueue();

  const connection = createRedisConnection('worker');

  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    // Required for job.moveToDelayed: the processor receives the lock token it
    // needs to hand the job back to the delayed set without losing ownership.
    autorun: true,
  });

  worker.on('completed', (job) => {
    log.debug({ jobId: job.id }, 'job completed');
  });

  worker.on('failed', (job, err) => {
    log.warn({ jobId: job?.id, err: err.message }, 'job failed');
  });

  worker.on('error', (err) => {
    log.error({ err: err.message }, 'worker error');
  });

  log.info(
    {
      concurrency: env.WORKER_CONCURRENCY,
      minDelayMs: env.DELAY_BETWEEN_EMAILS_MS,
      maxPerHourPerSender: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      maxPerHourGlobal: env.MAX_EMAILS_PER_HOUR_GLOBAL || 'disabled',
    },
    'worker started',
  );

  return worker;
}

/**
 * Graceful close: lets in-flight sends finish rather than orphaning a job
 * between SMTP acceptance and its status write.
 */
export async function stopWorker(worker: Worker<EmailJobData>): Promise<void> {
  await worker.close();
  closeAllTransports();
  await closeQueue();
}
