import { Worker } from 'bullmq';
import { env, QUEUE_NAME } from './config/env.js';
import { ensureEmailsIndex } from './lib/elasticsearch.js';
import { createLogger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { createRedisConnection, disconnectRedis } from './lib/redis.js';
import { closeAllTransports } from './mail/transport.js';
import { ensureSenderPool } from './mail/senders.js';
import { processEmailJob } from './queue/processor.js';
import { closeQueue } from './queue/queue.js';
import { reconcileQueue } from './queue/reconcile.js';
import type { EmailJobData } from './queue/queue.js';

const log = createLogger('worker-main');

async function main() {
  await ensureEmailsIndex();
  await ensureSenderPool();

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

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down worker');
    // Graceful close: lets in-flight sends finish rather than orphaning a job
    // between SMTP acceptance and its status write.
    await worker.close();
    closeAllTransports();
    await Promise.allSettled([closeQueue(), disconnectPrisma(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.fatal({ err: err instanceof Error ? err.message : String(err) }, 'worker failed to start');
  process.exit(1);
});
