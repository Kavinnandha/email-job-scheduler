import { Queue, type JobsOptions } from 'bullmq';
import { QUEUE_NAME } from '../config/env.js';
import { createRedisConnection } from '../lib/redis.js';

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  senderId: string;
  sequenceIndex: number;
}

/**
 * Deterministic job id derived from the Email row.
 *
 * BullMQ refuses to add a second job with an existing id, which makes
 * enqueueing idempotent for free: re-running the scheduler, or the boot
 * reconciler re-adding a job that is still queued, cannot produce a duplicate
 * send. It also lets any code path look a job up from just the email id.
 *
 * Separator is "-" because BullMQ rejects ":" in a custom job id (it uses
 * colons internally for its own Redis key namespacing).
 */
export const emailJobId = (emailId: string): string => `email-${emailId}`;

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
  // Completed jobs are kept briefly so they stay visible in the dashboard,
  // then trimmed. Failures are kept for inspection.
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: false,
};

const connection = createRedisConnection('queue');

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions,
});

export async function closeQueue(): Promise<void> {
  await emailQueue.close();
  await connection.quit();
}
